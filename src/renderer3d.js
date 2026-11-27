// Three.js WebGL 2.5D PBR Bakery Siege Renderer
// ACESFilmicToneMapping + SRGBColorSpace + PMREM Bakery HDRI + PCFSoftShadowMap (2048x2048)
// UnrealBloomPass + SMAAPass + Velvet/Mochi Fresnel Rim-Light Shader + 3-Layer Parallax + 6-Stage Hit-Feel
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { SHELLS, WORLD } from './config.js';
import { BIOMES } from './terrain.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// Convert 2D world coords (0..1600, 0..900 top-down) -> 3D Three.js coords (centered at 0,0)
function wx(x) { return (x - W * 0.5) * 0.02; }
function wy(y) { return (H * 0.5 - y) * 0.02; }

// Velvet-Mochi Custom Shader (Soft Fuzzy Fresnel Rim Light + Slingshot Elastic Stretch + Blush Tension + Hit Flash)
const MOCHI_VERT = `
  varying vec2 vUv;
  uniform vec2 uStretch;
  uniform float uJiggle;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 pos = position;
    // Elastic jelly jiggle & slingshot cheek pull
    float topMask = smoothstep(0.0, 1.0, uv.y);
    float centerMask = 1.0 - smoothstep(0.0, 0.75, length(uv - vec2(0.5, 0.48)));
    pos.x += uStretch.x * (0.45 + 0.55 * centerMask);
    pos.y += uStretch.y * (0.45 + 0.55 * centerMask);
    pos.x += sin(uTime * 5.2 + uv.y * 4.0) * uJiggle * 0.035 * topMask;
    pos.y += cos(uTime * 4.4) * uJiggle * 0.028 * topMask;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const MOCHI_FRAG = `
  uniform sampler2D uMap;
  uniform float uBlush;
  uniform float uHitFlash;
  uniform vec3 uRimColor;
  uniform float uGhost;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.05) discard;

    // Soft velvet Fresnel rim-light approximation along alpha silhouette & top-edge lighting
    float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float rim = pow(clamp(1.0 - edgeDist * 3.8, 0.0, 1.0), 2.2) * 0.52;
    vec3 col = tex.rgb;
    // Warm top-right bakery key-light gloss
    float topGlow = smoothstep(0.45, 0.95, vUv.y) * 0.10;
    col += uRimColor * rim + vec3(1.0, 0.96, 0.88) * topGlow;

    // Max-power slingshot rosy cheek blush
    float cheekMask = exp(-dot(vUv - vec2(0.5, 0.46), vUv - vec2(0.5, 0.46)) * 18.0);
    col = mix(col, vec3(1.0, 0.45, 0.58), uBlush * cheekMask * 0.55);

    // 80ms Hit-Stop white flash
    col = mix(col, vec3(1.0, 1.0, 1.0), clamp(uHitFlash, 0.0, 1.0));

    // Ghost support translucent cyan tint for eliminated 2v2 teammate
    if (uGhost > 0.5) {
      col = mix(col, vec3(0.55, 0.92, 1.0), 0.42);
      gl_FragColor = vec4(col, tex.a * 0.62);
      return;
    }
    gl_FragColor = vec4(col, tex.a);
  }
`;

export class GameRenderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.shake = 0;
    this.flashColor = '#FEF08A';
    this.flashAlpha = 0;
    this.terrainJiggle = 0;
    this.bungeeZoomTimer = 0;
    this.bungeeTarget = new THREE.Vector3(0, 0, 0);
    this.slowMoTimer = 0;
    this.time = 0;
    this.lastTerrainVersion = -1;
    this.lastBiomeKey = '';

    // Create sibling WebGL canvas behind the existing 2D HUD overlay canvas
    this.parent = canvas.parentElement || document.body;
    if (getComputedStyle(this.parent).position === 'static') {
      this.parent.style.position = 'relative';
    }
    this.glCanvas = document.createElement('canvas');
    this.glCanvas.id = 'bakeryWebGLCanvas';
    this.glCanvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;pointer-events:none;';
    this.parent.insertBefore(this.glCanvas, canvas);

    // Existing canvas becomes crisp transparent HUD & floating text overlay
    canvas.style.position = 'relative';
    canvas.style.zIndex = '2';
    canvas.style.background = 'transparent';
    this.ctx = canvas.getContext('2d');

    this._initThree();
    this._buildParallaxBakery();
    this._buildTerrainLayer();
    this._buildWindSugarParticles();
    this._buildTrajectoryDots();

    // Dynamic entity pools
    this.charTextures = new Map();
    this.charAimTextures = new Map();
    this.cartMeshes = new Map();
    this.blockMeshes = new Map();
    this.projMeshes = new Map();
    this.particleMeshes = [];
    this.shockwaveMeshes = [];
    this.ribbonLines = new Map();
    this.sharedCrumbleGeo = new THREE.DodecahedronGeometry(0.16, 0);
    this.sharedCreamGeo = new THREE.SphereGeometry(0.14, 10, 10);
    this.sharedProjGeo = new THREE.SphereGeometry(0.28, 20, 20);
    this.sharedShadowGeo = new THREE.CircleGeometry(0.75, 24);
    this.sharedShadowMat = new THREE.MeshBasicMaterial({
      color: 0x3b1d0a,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });

    this.resize();
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.glCanvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x93d5ff);
    this.scene.fog = new THREE.FogExp2(0xffe9c7, 0.0085);

    // Warm Bakery Studio HDRI Environment (PMREMGenerator)
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = envTex;
      pmrem.dispose();
    } catch (_) {}

    // 2.5D Perspective Camera framed cleanly on 1600x900 bakery arena (32 x 18 units)
    this.baseCamPos = new THREE.Vector3(0, 0.4, 24.5);
    this.camera = new THREE.PerspectiveCamera(40, W / H, 0.5, 160);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(0, 0, 0);

    // Warm Bakery Key Light + Soft Fill + Rim Light + 2048x2048 Soft Shadows
    const hemi = new THREE.HemisphereLight(0xfff5e4, 0xf5b971, 1.05);
    this.scene.add(hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff1d0, 1.85);
    this.sunLight.position.set(12, 20, 18);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 65;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 14;
    this.sunLight.shadow.camera.bottom = -14;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const rimLight = new THREE.DirectionalLight(0xffb8e0, 0.65);
    rimLight.position.set(-14, 10, -10);
    this.scene.add(rimLight);

    // Post-processing: RenderPass -> UnrealBloomPass -> SMAAPass
    this.composer = null;
    try {
      const w = this.glCanvas.clientWidth || 1280;
      const h = this.glCanvas.clientHeight || 720;
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.38, 0.90);
      this.composer.addPass(this.bloomPass);
      this.smaaPass = new SMAAPass(w * this.renderer.getPixelRatio(), h * this.renderer.getPixelRatio());
      this.composer.addPass(this.smaaPass);
    } catch (_) {
      this.composer = null;
    }
  }

  _buildParallaxBakery() {
    // Layer 1 (Far): Pastel Bakery Sky Backdrop Plane
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x60a5fa) },
        uMid: { value: new THREE.Color(0xbae6fd) },
        uBot: { value: new THREE.Color(0xfef3c7) },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop, uMid, uBot; varying vec2 vUv;
        void main() {
          vec3 c = vUv.y > 0.5 ? mix(uMid, uTop, (vUv.y - 0.5) * 2.0) : mix(uBot, uMid, vUv.y * 2.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      depthWrite: false,
    });
    const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(110, 62), this.skyMat);
    skyPlane.position.set(0, 0, -26);
    this.scene.add(skyPlane);

    // Layer 1.5: Fluffy Cotton-Candy Clouds drifting in far sky
    this.clouds = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff8f2, roughness: 0.92, metalness: 0.0 });
    for (let i = 0; i < 9; i++) {
      const grp = new THREE.Group();
      const puffs = 3 + (i % 3);
      for (let p = 0; p < puffs; p++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(1.1 + (p % 2) * 0.45, 14, 14), cloudMat);
        m.position.set((p - puffs * 0.5) * 1.15, Math.sin(p) * 0.35, 0);
        m.scale.set(1.25, 0.78, 0.75);
        grp.add(m);
      }
      grp.position.set(-28 + i * 7.2, 5.5 + (i % 3) * 2.4, -17 - (i % 3) * 2.5);
      grp.userData = { baseSpeed: 0.25 + (i % 4) * 0.09 };
      this.scene.add(grp);
      this.clouds.push(grp);
    }

    // Layer 2 (Midground): Rotating Biscuit Windmills + Chocolate Fountain + Oven Castle
    this.windmills = [];
    const biscuitMat = new THREE.MeshPhysicalMaterial({ color: 0xd9822b, roughness: 0.48, clearcoat: 0.35 });
    const waferMat = new THREE.MeshPhysicalMaterial({ color: 0xfde68a, roughness: 0.35, clearcoat: 0.5 });
    const chocoMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2414, roughness: 0.16, clearcoat: 0.92, metalness: 0.05 });
    const icingMat = new THREE.MeshPhysicalMaterial({ color: 0xfff1f5, roughness: 0.22, clearcoat: 0.85 });

    for (const side of [-1, 1]) {
      const tower = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.55, 5.2, 16), biscuitMat);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.8, 16), icingMat);
      roof.position.y = 3.4;
      tower.add(body, roof);

      const blades = new THREE.Group();
      blades.position.set(0, 1.7, 1.15);
      for (let b = 0; b < 4; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.45, 3.2, 0.12), waferMat);
        blade.rotation.z = (b * Math.PI) / 2;
        blade.position.set(Math.sin((b * Math.PI) / 2) * 1.4, Math.cos((b * Math.PI) / 2) * 1.4, 0);
        blades.add(blade);
      }
      tower.add(blades);
      tower.position.set(side * 12.2, 0.8, -11);
      tower.userData = { blades, dir: side };
      this.scene.add(tower);
      this.windmills.push(tower);
    }

    // Center-distance Chocolate Fountain & Oven Castle silhouette
    const fountain = new THREE.Group();
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 1.1, 20), icingMat);
    const fMid = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.0, 2.6, 18), chocoMat);
    fMid.position.y = 1.6;
    const fTop = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 16), chocoMat);
    fTop.position.y = 3.1;
    fountain.add(fBase, fMid, fTop);
    fountain.position.set(0, -1.4, -13.5);
    this.scene.add(fountain);
    this.chocoFountain = fountain;

    // Cloud Sea Floor at SEA_LEVEL (y = 825) — soft pastel sky-milk mist
    const seaGeo = new THREE.PlaneGeometry(80, 24);
    const seaMat = new THREE.MeshStandardMaterial({
      color: 0xbfe6ff,
      emissive: 0x7cc4fa,
      emissiveIntensity: 0.12,
      roughness: 0.88,
      transparent: true,
      opacity: 0.58,
    });
    this.cloudSea = new THREE.Mesh(seaGeo, seaMat);
    this.cloudSea.rotation.x = -Math.PI * 0.42;
    this.cloudSea.position.set(0, wy(WORLD.SEA_LEVEL) - 1.6, -2);
    this.scene.add(this.cloudSea);
  }

  _buildTerrainLayer() {
    // Real-time Destructible 2.5D PBR Bakery Terrain:
    // Front high-res textured bread slice + extruded depth shadow backing + glossy glaze sheen
    this.terrainGroup = new THREE.Group();
    this.terrainCanvasTex = null;

    const planeGeo = new THREE.PlaneGeometry(W * 0.02, H * 0.02);
    this.terrainFrontMat = new THREE.MeshPhysicalMaterial({
      transparent: true,
      alphaTest: 0.12,
      roughness: 0.36,
      metalness: 0.02,
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
    });
    this.terrainFrontMesh = new THREE.Mesh(planeGeo, this.terrainFrontMat);
    this.terrainFrontMesh.receiveShadow = true;
    this.terrainFrontMesh.position.z = 0.25;

    // 3D Extruded Crust Depth Layers behind the front slice for rich 2.5D thickness!
    this.terrainDepthMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.65,
    });
    this.terrainDepthLayers = [];
    for (let i = 1; i <= 4; i++) {
      const layer = new THREE.Mesh(planeGeo, this.terrainDepthMat);
      layer.position.set(0, -i * 0.09, 0.25 - i * 0.38);
      this.terrainGroup.add(layer);
      this.terrainDepthLayers.push(layer);
    }
    this.terrainGroup.add(this.terrainFrontMesh);
    this.scene.add(this.terrainGroup);
  }

  _buildWindSugarParticles() {
    const count = 90;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 38;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 + 1.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfffdf5,
      size: 0.19,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.sugarWindPoints = new THREE.Points(geo, mat);
    this.scene.add(this.sugarWindPoints);
  }

  _buildTrajectoryDots() {
    this.trajGroup = new THREE.Group();
    this.trajDots = [];
    const geo = new THREE.SphereGeometry(0.11, 10, 10);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i < 6 ? 0xfff5c0 : 0xff9ec4,
        transparent: true,
        opacity: 0.9 - i * 0.048,
      });
      const dot = new THREE.Mesh(geo, mat);
      dot.visible = false;
      this.trajGroup.add(dot);
      this.trajDots.push(dot);
    }
    this.scene.add(this.trajGroup);
  }

  resize() {
    const rect = this.parent.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || window.innerWidth));
    const cssH = Math.max(200, Math.round(rect.height || window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = cssW;
    this.viewH = cssH;

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);
    this.camera.aspect = cssW / cssH;
    // Ensure full 32x18 bakery stage fits comfortably on any phone/tablet aspect ratio
    const vFovRad = (this.camera.fov * Math.PI) / 180;
    const distH = 9.6 / Math.tan(vFovRad * 0.5);
    const distW = 16.8 / (Math.tan(vFovRad * 0.5) * this.camera.aspect);
    this.baseCamPos.z = Math.max(distH, distW);
    this.camera.updateProjectionMatrix();

    if (this.composer) {
      this.composer.setSize(cssW, cssH);
      if (this.bloomPass) this.bloomPass.setSize(cssW, cssH);
      if (this.smaaPass) this.smaaPass.setSize(cssW * dpr, cssH * dpr);
    }
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const ny = (clientY - rect.top) / Math.max(1, rect.height);
    return { x: nx * W, y: ny * H };
  }

  addShake(mag = 6) {
    this.shake = Math.max(this.shake, Math.min(28, mag));
    if (mag >= 9) {
      this.terrainJiggle = Math.min(1.0, this.terrainJiggle + mag * 0.045);
    }
  }

  addFlash(color = '#FEF08A', alpha = 0.2) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  triggerBungeeZoom(worldX, worldY) {
    this.bungeeZoomTimer = 1.15;
    this.bungeeTarget.set(wx(worldX), wy(worldY), 0);
  }

  _getCharTexture(charId, isAim = false) {
    const map = isAim ? this.charAimTextures : this.charTextures;
    if (map.has(charId)) return map.get(charId);
    const loader = new THREE.TextureLoader();
    const url = isAim ? `./assets/chars_aim/${charId}.png?v=1` : `./assets/chars/${charId}.png?v=20`;
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    map.set(charId, tex);
    return tex;
  }

  _syncTerrain(terrain) {
    const srcCanvas = terrain && (terrain.canvas || terrain.offCanvas);
    if (!srcCanvas) return;
    if (!this.terrainCanvasTex) {
      this.terrainCanvasTex = new THREE.CanvasTexture(srcCanvas);
      this.terrainCanvasTex.colorSpace = THREE.SRGBColorSpace;
      this.terrainFrontMat.map = this.terrainCanvasTex;
      this.terrainDepthMat.map = this.terrainCanvasTex;
      this.terrainFrontMat.needsUpdate = true;
      this.terrainDepthMat.needsUpdate = true;
    }
    const ver = typeof terrain.version === 'number' ? terrain.version : -1;
    if (ver !== this.lastTerrainVersion || this._terrainSyncTick % 12 === 0) {
      this.lastTerrainVersion = ver;
      this.terrainCanvasTex.needsUpdate = true;
    }
    this._terrainSyncTick = (this._terrainSyncTick || 0) + 1;

    const biome = (terrain.currentBiome && BIOMES[terrain.currentBiome]) || terrain.biome || BIOMES.meadow;
    if (biome.name !== this.lastBiomeKey) {
      this.lastBiomeKey = biome.name;
      this.skyMat.uniforms.uTop.value.set(biome.skyTop || '#60A5FA');
      this.skyMat.uniforms.uMid.value.set(biome.skyMid || '#BAE6FD');
      this.skyMat.uniforms.uBot.value.set(biome.skyBot || '#FEF3C7');
      this.terrainDepthMat.color.set(biome.core || '#8b4513');
    }
  }

  _syncStructures(structures) {
    const blocks = (structures && structures.blocks) || [];
    const seen = new Set();
    for (const b of blocks) {
      if (!b || !b.body || b.destroyed) continue;
      seen.add(b.id);
      let mesh = this.blockMeshes.get(b.id);
      if (!mesh) {
        const bw = (b.width || 40) * 0.02;
        const bh = (b.height || 40) * 0.02;
        const matSpec = b.material || {};
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(matSpec.fill || '#8B4513'),
          roughness: matSpec.id === 'ICE' ? 0.12 : 0.28,
          metalness: matSpec.id === 'STONE' ? 0.15 : 0.04,
          clearcoat: matSpec.id === 'ICE' || matSpec.id === 'WOOD' ? 0.88 : 0.45,
          clearcoatRoughness: 0.18,
          emissive: matSpec.explosive ? new THREE.Color(0xf43f5e) : new THREE.Color(0x000000),
          emissiveIntensity: matSpec.explosive ? 0.45 : 0,
        });
        mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.95), mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.blockMeshes.set(b.id, mesh);
      }
      mesh.position.set(wx(b.body.position.x), wy(b.body.position.y), 0.35);
      mesh.rotation.z = -b.body.angle;
      if (b.material && b.material.explosive) {
        mesh.material.emissiveIntensity = 0.35 + Math.sin(this.time * 8) * 0.25;
      }
    }
    for (const [id, mesh] of this.blockMeshes.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.blockMeshes.delete(id);
      }
    }
  }

  _syncCarts(carts, activeActor, dragState) {
    const seen = new Set();
    for (const c of carts || []) {
      seen.add(c.id);
      let entry = this.cartMeshes.get(c.id);
      if (!entry) {
        const grp = new THREE.Group();
        const shadow = new THREE.Mesh(this.sharedShadowGeo, this.sharedShadowMat);
        shadow.rotation.x = -Math.PI * 0.44;
        shadow.position.set(0, -0.78, -0.05);
        grp.add(shadow);

        const tex = this._getCharTexture(c.spec.id, false);
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uMap: { value: tex },
            uStretch: { value: new THREE.Vector2(0, 0) },
            uJiggle: { value: 1.0 },
            uTime: { value: 0 },
            uBlush: { value: 0 },
            uHitFlash: { value: 0 },
            uRimColor: { value: new THREE.Color(c.teamId === 1 ? 0x60d5ff : 0xff7eb6) },
            uGhost: { value: 0 },
          },
          vertexShader: MOCHI_VERT,
          fragmentShader: MOCHI_FRAG,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const card = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.95, 12, 12), mat);
        card.position.set(0, 0.12, 0.05);
        grp.add(card);
        this.scene.add(grp);
        entry = { grp, card, mat, shadow };
        this.cartMeshes.set(c.id, entry);
      }

      const isGhost = !c.alive && c.ghostSupportReady;
      entry.grp.visible = c.alive || isGhost;
      if (!entry.grp.visible) continue;

      const isActive = activeActor && activeActor.id === c.id;
      const isPulling = isActive && dragState && dragState.active;
      const recoilOff = (c.recoil || 0) * -c.facing * 0.35;

      // Tension tremble at high slingshot power (>80%)
      const highPower = isPulling && c.aimPower >= 82 ? (c.aimPower - 82) / 18 : 0;
      const trembleX = highPower > 0 ? Math.sin(this.time * 55) * 0.06 * highPower : 0;
      const trembleY = highPower > 0 ? Math.cos(this.time * 48) * 0.05 * highPower : 0;

      entry.grp.position.set(wx(c.x) + recoilOff + trembleX, wy(c.y) + 0.65 + trembleY, 0.85);
      entry.card.scale.x = c.facing >= 0 ? 1 : -1;
      entry.card.rotation.z = -(c.tiltAngle || 0) * 0.55;

      // Switch to aim sprite when pulling slingshot
      const targetTex = this._getCharTexture(c.spec.id, isPulling);
      if (entry.mat.uniforms.uMap.value !== targetTex) {
        entry.mat.uniforms.uMap.value = targetTex;
      }

      // Compute elastic cheek-stretch vector opposite launch direction
      if (isPulling) {
        const rad = (c.aimElevation * Math.PI) / 180;
        const pRatio = Math.max(0, Math.min(1, (c.aimPower - 15) / 85));
        entry.mat.uniforms.uStretch.value.set(-Math.cos(rad) * pRatio * 0.34, -Math.sin(rad) * pRatio * 0.28);
        entry.mat.uniforms.uBlush.value = highPower;
      } else {
        entry.mat.uniforms.uStretch.value.multiplyScalar(0.82);
        entry.mat.uniforms.uBlush.value *= 0.86;
      }

      entry.mat.uniforms.uTime.value = this.time + c.slotIndex * 1.7;
      entry.mat.uniforms.uJiggle.value = isPulling ? 1.5 : 1.0;
      entry.mat.uniforms.uHitFlash.value = c.mood === 'hurt' && c.moodTimer > 62 ? 0.85 : 0;
      entry.mat.uniforms.uGhost.value = isGhost ? 1.0 : 0.0;
      entry.shadow.visible = c.grounded && c.alive;
    }

    for (const [id, entry] of this.cartMeshes.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(entry.grp);
        entry.mat.dispose();
        this.cartMeshes.delete(id);
      }
    }
  }

  _syncProjectiles(projectiles) {
    const seen = new Set();
    for (const p of projectiles || []) {
      const pid = p.id || `${p.ownerId}_${p.shellKey}_${Math.round(p.x)}`;
      p._rid = p._rid || pid;
      seen.add(p._rid);
      let mesh = this.projMeshes.get(p._rid);
      const shell = SHELLS[p.shellKey] || SHELLS.ACORN_SPLIT;
      if (!mesh) {
        const col = new THREE.Color(p.isUltimate ? '#ff4da6' : (shell.color || '#f59e0b'));
        const mat = new THREE.MeshPhysicalMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: p.isUltimate ? 1.35 : 0.78,
          roughness: 0.12,
          clearcoat: 1.0,
        });
        mesh = new THREE.Mesh(this.sharedProjGeo, mat);
        mesh.scale.setScalar(p.isUltimate ? 1.45 : 1.0);
        this.scene.add(mesh);
        this.projMeshes.set(p._rid, mesh);
      }
      mesh.position.set(wx(p.x), wy(p.y), 1.05);
      mesh.rotation.z += 0.25;

      // Glowing Syrup Ribbon Trail
      let ribbon = this.ribbonLines.get(p._rid);
      if (p.trail && p.trail.length >= 2) {
        const pts = p.trail.map((t) => new THREE.Vector3(wx(t.x), wy(t.y), 0.95));
        if (!ribbon) {
          const rGeo = new THREE.BufferGeometry().setFromPoints(pts);
          const rMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(p.isUltimate ? '#ffd84d' : (shell.coreColor || '#ff9ec4')),
            transparent: true,
            opacity: 0.88,
          });
          ribbon = new THREE.Line(rGeo, rMat);
          this.scene.add(ribbon);
          this.ribbonLines.set(p._rid, ribbon);
        } else {
          ribbon.geometry.dispose();
          ribbon.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        }
      }
    }

    for (const [id, mesh] of this.projMeshes.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.material.dispose();
        this.projMeshes.delete(id);
      }
    }
    for (const [id, line] of this.ribbonLines.entries()) {
      if (!seen.has(id)) {
        this.scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
        this.ribbonLines.delete(id);
      }
    }
  }

  _syncTrajectory(activeActor, dragState, wind, weather) {
    const show = activeActor && activeActor.alive && activeActor.controller === 'human' && dragState && dragState.active;
    if (!show) {
      for (const d of this.trajDots) d.visible = false;
      return;
    }
    const muzzle = activeActor.getMuzzlePosition();
    const vel = activeActor.getLaunchVelocity();
    let px = muzzle.x;
    let py = muzzle.y;
    let vx = vel.vx;
    let vy = vel.vy;
    const grav = WORLD.GRAVITY * (weather === 'RAIN' ? WORLD.RAIN_GRAVITY_MULT : 1.0);
    // Show ONLY the first 35% of the arc (16 dots, 2 ticks apart) so wind & skill still matter!
    for (let i = 0; i < this.trajDots.length; i++) {
      for (let step = 0; step < 2; step++) {
        vx += wind * WORLD.WIND_SCALE;
        vy += grav;
        px += vx;
        py += vy;
      }
      const dot = this.trajDots[i];
      dot.position.set(wx(px), wy(py), 1.15);
      dot.scale.setScalar(1.05 - i * 0.04);
      dot.visible = true;
    }
  }

  _drawOverlayHud(state) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    const sx = this.viewW / W;
    const sy = this.viewH / H;

    // 1. Character HP Bars, Nameplates & Turn Crown
    for (const c of state.carts || []) {
      if (!c.alive) continue;
      const cx = c.x * sx;
      const cy = c.y * sy;
      const isAct = state.activeActor && state.activeActor.id === c.id;

      // Active turn indicator bounce arrow
      if (isAct && state.phase === 'AIM') {
        const bob = Math.sin(this.time * 7) * 4;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 58 + bob);
        ctx.lineTo(cx - 8, cy - 70 + bob);
        ctx.lineTo(cx + 8, cy - 70 + bob);
        ctx.closePath();
        ctx.fill();
      }

      // Crisp HP Bar
      const bw = 54;
      const bx = cx - bw * 0.5;
      const by = cy - 48;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      ctx.beginPath();
      ctx.roundRect(bx - 2, by - 2, bw + 4, 10, 5);
      ctx.fill();
      const hpRatio = Math.max(0, Math.min(1, c.hp / Math.max(1, c.maxHp)));
      ctx.fillStyle = c.teamId === 1 ? '#38bdf8' : '#fb7185';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw * hpRatio, 6, 3);
      ctx.fill();

      // Nameplate
      ctx.font = '700 11px "Jua", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeText(c.displayName, cx, by - 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.displayName, cx, by - 5);
    }

    // 2. Crisp 2D Particles (Crumble / Cream / Jam) & Shockwave Rings
    for (const sw of state.shockwaves || []) {
      ctx.save();
      ctx.strokeStyle = sw.color || '#fde047';
      ctx.globalAlpha = Math.max(0, sw.alpha || 0.7);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x * sx, sw.y * sy, (sw.radius || 20) * sx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const pt of state.particles || []) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / Math.max(1, pt.maxLife || 30)));
      ctx.fillStyle = pt.color || '#fde68a';
      ctx.beginPath();
      ctx.arc(pt.x * sx, pt.y * sy, Math.max(2, (pt.size || 4) * sx), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. 2v2 Tactical Pings ("여기 쏴! 🎯")
    for (const ping of state.tacticalPings || []) {
      const px = ping.x * sx;
      const py = ping.y * sy;
      const pulse = 1 + Math.sin(this.time * 10) * 0.15;
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, 20 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '800 13px "Jua", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.strokeText('여기 쏴! 🎯', px, py - 24);
      ctx.fillText('여기 쏴! 🎯', px, py - 24);
      ctx.restore();
    }

    // 4. Floating Damage & BUNGEE OUT! Callouts
    for (const ft of state.floatingTexts || []) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.life / 24));
      ctx.font = `900 ${Math.round((ft.size || 20) * Math.max(0.8, sx * 1.15))}px "Jua", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20, 12, 8, 0.9)';
      ctx.strokeText(ft.text, ft.x * sx, ft.y * sy);
      ctx.fillStyle = ft.color || '#fde047';
      ctx.fillText(ft.text, ft.x * sx, ft.y * sy);
      ctx.restore();
    }

    // 5. Screen Impact Flash Overlay
    if (this.flashAlpha > 0.01) {
      ctx.save();
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.restore();
      this.flashAlpha *= 0.84;
    }
  }

  render(state) {
    this.time += 1 / 60;

    // 1. Animate 3-Layer Parallax Bakery Background
    const windSpeed = state.wind || 0;
    for (const cl of this.clouds) {
      cl.position.x += (cl.userData.baseSpeed + windSpeed * 0.06) * 0.016;
      if (cl.position.x > 34) cl.position.x = -34;
      if (cl.position.x < -34) cl.position.x = 34;
    }
    for (const wm of this.windmills) {
      wm.userData.blades.rotation.z -= (0.45 + Math.abs(windSpeed) * 0.08) * 0.016 * wm.userData.dir;
    }

    // Animate Sugar-Powder Wind Stream
    const posAttr = this.sugarWindPoints.geometry.attributes.position;
    const arr = posAttr.array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += (windSpeed * 0.055 + 0.02);
      arr[i + 1] -= 0.018;
      if (arr[i] > 19) arr[i] = -19;
      if (arr[i] < -19) arr[i] = 19;
      if (arr[i + 1] < -10) arr[i + 1] = 10;
    }
    posAttr.needsUpdate = true;

    // 2. Terrain Jelly Jiggle after crater explosion
    if (this.terrainJiggle > 0.005) {
      this.terrainGroup.position.y = Math.sin(this.time * 42) * this.terrainJiggle * 0.16;
      this.terrainGroup.scale.y = 1 + Math.cos(this.time * 36) * this.terrainJiggle * 0.018;
      this.terrainJiggle *= 0.9;
    } else {
      this.terrainGroup.position.y = 0;
      this.terrainGroup.scale.y = 1;
    }

    // 3. Sync 3D Bakery Terrain, Blocks, 20 Mochi Characters, Projectiles & 35% Slingshot Guide
    this._syncTerrain(state.terrain);
    this._syncStructures(state.structures);
    this._syncCarts(state.carts, state.activeActor, state.dragState);
    this._syncProjectiles(state.projectiles);
    this._syncTrajectory(state.activeActor, state.dragState, state.wind || 0, state.weather || 'CLEAR');

    // 4. Camera Shake + BUNGEE OUT! Cinematic Zoom
    let targetCamX = 0;
    let targetCamY = 0.4;
    let targetCamZ = this.baseCamPos.z;
    if (this.bungeeZoomTimer > 0) {
      this.bungeeZoomTimer = Math.max(0, this.bungeeZoomTimer - 1 / 60);
      targetCamX = this.bungeeTarget.x * 0.45;
      targetCamY = this.bungeeTarget.y * 0.35;
      targetCamZ = this.baseCamPos.z * 0.72;
    }
    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.12;
    this.camera.position.y += (targetCamY - this.camera.position.y) * 0.12;
    this.camera.position.z += (targetCamZ - this.camera.position.z) * 0.12;

    if (this.shake > 0.1) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.032;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.032;
      this.shake *= 0.85;
    }
    this.camera.lookAt(this.camera.position.x * 0.4, this.camera.position.y * 0.35, 0);

    // 5. Render High-End PBR WebGL Scene (with UnrealBloom + SMAA) + Crisp 2D HUD Overlay
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    this._drawOverlayHud(state);
  }
}
