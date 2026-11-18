// 실시간 파괴형 부유섬 지형 엔진 (Destructible Floating Island + Matter.js Static Sync)
import { WORLD } from './config.js';

const Matter = window.Matter;

export const BIOMES = {
  meadow: {
    name: '버터 식빵',
    core: '#9A4A10', // 노릇노릇 구워진 하단 빵 껍질
    mid: '#FDE68A', // 폭신한 노란 버터 카스테라 속살
    jam: '#F59E0B', // 중간 달콤한 커스터드/꿀 시럽 층
    top: '#FEF3C7',
    crust: '#D97706', // 황금빛 구운 빵 껍질
    crustHi: '#FCD34D',
    outline: '#78350F',
    skyTop: '#60A5FA',
    skyMid: '#BAE6FD',
    skyBot: '#FEF3C7',
    hillFar: 'rgba(253, 230, 138, 0.35)',
    hillNear: 'rgba(251, 191, 36, 0.25)',
  },
  glacier: {
    name: '슈가 크루아상',
    core: '#92400E',
    mid: '#FCD34D', // 바삭한 페스트리 버터층
    jam: '#FFFBEB', // 중간 휘핑크림 층
    top: '#FEF9C3',
    crust: '#FFFFFF', // 하얀 슈가 글레이즈 드립!
    crustHi: '#E0F2FE',
    outline: '#78350F',
    skyTop: '#38BDF8',
    skyMid: '#E0F2FE',
    skyBot: '#FFFBEB',
    hillFar: 'rgba(224, 242, 254, 0.45)',
    hillNear: 'rgba(254, 243, 199, 0.32)',
  },
  volcano: {
    name: '초코 브라우니빵',
    core: '#271312',
    mid: '#5D3322', // 촉촉한 초코 스펀지 빵
    jam: '#FEF3C7', // 중간 바닐라 크림 샌드 층
    top: '#7C4530',
    crust: '#3B1D0A', // 윤기 흐르는 다크 초코 시럽 드립
    crustHi: '#A4643B',
    outline: '#1A0B0A',
    skyTop: '#FB923C',
    skyMid: '#FED7AA',
    skyBot: '#FEF3C7',
    hillFar: 'rgba(180, 83, 9, 0.26)',
    hillNear: 'rgba(124, 45, 18, 0.24)',
  },
  candy: {
    name: '딸기 생크림빵',
    core: '#9D174D',
    mid: '#FDE68A', // 폭신한 카스테라 빵 시트
    jam: '#FB7185', // 중간 상큼한 딸기잼 샌드 층!
    top: '#FFFBEB',
    crust: '#FFF1F2', // 몽글몽글 하얀 생크림 아이싱 드립
    crustHi: '#F472B6',
    outline: '#831843',
    skyTop: '#A855F7',
    skyMid: '#FBCFE8',
    skyBot: '#FEF9C3',
    hillFar: 'rgba(244, 114, 182, 0.28)',
    hillNear: 'rgba(251, 207, 232, 0.3)',
  },
};

export class DestructibleTerrain {
  constructor(matterWorld) {
    this.matterWorld = matterWorld;
    this.cols = Math.floor(WORLD.WIDTH / WORLD.CELL_SIZE);
    this.rows = Math.floor(WORLD.HEIGHT / WORLD.CELL_SIZE);
    this.mask = new Uint8Array(this.cols * this.rows);

    // 오프스크린 지형 캐시 캔버스
    this.canvas = document.createElement('canvas');
    this.canvas.width = WORLD.WIDTH;
    this.canvas.height = WORLD.HEIGHT;
    this.ctx = this.canvas.getContext('2d');

    // 스트립별 Matter.js 정적 바디 배열
    this.stripCount = Math.ceil(WORLD.WIDTH / WORLD.STRIP_WIDTH);
    this.stripBodies = Array.from({ length: this.stripCount }, () => []);
    this.currentBiome = 'meadow';
    this.lastRenderArgs = null;

    // 실제 구운 빵 단면 이미지 텍스처 프리로드
    this.breadImg = new Image();
    this.breadImgReady = false;
    this.breadImg.onload = () => {
      this.breadImgReady = true;
      if (this.lastRenderArgs) {
        this.ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        this.renderInitialIsland(
          this.lastRenderArgs.topProfile,
          this.lastRenderArgs.botProfile,
          this.lastRenderArgs.platforms
        );
      }
    };
    this.breadImg.src = './assets/bread_texture.jpg?v=35';

    // 실제 베이커리 아일랜드 PNG 4종(버터 식빵, 바게트·크루아상, 도넛·딸기케이크, 초코케이크 성채) 프리로드
    this.activeMapKey = 'bridge';
    this.mapImages = {};
    for (const key of ['bridge', 'twin_peaks', 'archipelago', 'citadel']) {
      const img = new Image();
      const entry = { img, loaded: false };
      img.onload = () => {
        entry.loaded = true;
        if (this.activeMapKey === key && this.pendingImageApply) {
          this.pendingImageApply = false;
          this.applyBakeryMapImage(key);
        }
      };
      img.src = `./assets/maps/${key}.png?v=37`;
      this.mapImages[key] = entry;
    }
  }

  applyBakeryMapImage(mapKey) {
    const entry = this.mapImages[mapKey];
    if (!entry?.loaded) return null;
    this.mask.fill(0);
    this.ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    this.ctx.drawImage(entry.img, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    const data = this.ctx.getImageData(0, 0, WORLD.WIDTH, WORLD.HEIGHT).data;
    const cell = WORLD.CELL_SIZE;
    for (let gy = 0; gy < this.rows; gy++) {
      const py = Math.min(WORLD.HEIGHT - 1, gy * cell + 2);
      const rowOff = py * WORLD.WIDTH;
      for (let gx = 0; gx < this.cols; gx++) {
        const px = Math.min(WORLD.WIDTH - 1, gx * cell + 2);
        const alpha = data[(rowOff + px) * 4 + 3];
        if (alpha > 120) {
          this.mask[gy * this.cols + gx] = 1;
        }
      }
    }

    this.syncMatterStrips(0, WORLD.WIDTH);
    const terraces = [];
    for (const tx of [380, 620, 800, 980, 1220]) {
      if (this.findTopSurface(tx) !== null) terraces.push(tx);
    }
    return terraces;
  }

  /**
   * 부유섬 프리셋 또는 랜덤 지형(구조 + 바이옴) 생성
   * @param {'random' | 'bridge' | 'twin_peaks' | 'archipelago' | 'citadel'} preset
   * @returns {number[]} 생성된 구조물 평탄화 X좌표 목록
   */
  generate(preset = 'random') {
    this.mask.fill(0);
    this.ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    const mapPool = ['bridge', 'twin_peaks', 'archipelago', 'citadel'];
    const mapKey =
      preset === 'random'
        ? mapPool[Math.floor(Math.random() * mapPool.length)]
        : mapPool.includes(preset)
          ? preset
          : 'bridge';
    this.activeMapKey = mapKey;

    if (mapKey === 'twin_peaks') this.currentBiome = 'glacier';
    else if (mapKey === 'archipelago') this.currentBiome = 'candy';
    else if (mapKey === 'citadel') this.currentBiome = 'volcano';
    else this.currentBiome = 'meadow';

    if (this.mapImages[mapKey]?.loaded) {
      this.pendingImageApply = false;
      return this.applyBakeryMapImage(mapKey);
    }
    this.pendingImageApply = true;

    const biomeKeys = Object.keys(BIOMES);
    let shapeMode = preset;

    if (preset === 'random') {
      const shapes = ['single_hills', 'split_islands', 'triple_islands', 'cliff_steps'];
      shapeMode = shapes[Math.floor(Math.random() * shapes.length)];
      this.currentBiome = biomeKeys[Math.floor(Math.random() * biomeKeys.length)];
    } else if (preset === 'twin_peaks') {
      this.currentBiome = 'glacier';
    } else if (preset === 'archipelago') {
      this.currentBiome = 'candy';
      shapeMode = 'triple_islands';
    } else if (preset === 'citadel') {
      this.currentBiome = 'volcano';
    } else {
      this.currentBiome = 'meadow';
    }

    const rSeed = Math.random() * 100;
    const rAmp1 = 45 + Math.random() * 80;
    const rAmp2 = 40 + Math.random() * 85;
    const rAmp3 = 35 + Math.random() * 75;
    const rWaveFreq = 3 + Math.random() * 4;
    const rWaveAmp = 10 + Math.random() * 18;

    const topProfile = new Float32Array(this.cols);
    const botProfile = new Float32Array(this.cols);

    for (let gx = 0; gx < this.cols; gx++) {
      const wx = gx * WORLD.CELL_SIZE;
      const nx = wx / WORLD.WIDTH;

      if (wx < 75 || wx > WORLD.WIDTH - 75) {
        topProfile[gx] = -1;
        botProfile[gx] = -1;
        continue;
      }

      // 다중 섬 모드일 때 섬과 섬 사이 구름 협곡(빈 공간) 생성
      if (shapeMode === 'split_islands') {
        if (nx > 0.44 && nx < 0.56) {
          topProfile[gx] = -1;
          botProfile[gx] = -1;
          continue;
        }
      } else if (shapeMode === 'triple_islands') {
        if ((nx > 0.31 && nx < 0.38) || (nx > 0.62 && nx < 0.69)) {
          topProfile[gx] = -1;
          botProfile[gx] = -1;
          continue;
        }
      }

      let surfaceY = 560;
      let underY = 765;

      if (shapeMode === 'split_islands') {
        const leftPeak = Math.exp(-Math.pow((nx - 0.25) / 0.13, 2)) * 105;
        const rightPeak = Math.exp(-Math.pow((nx - 0.75) / 0.13, 2)) * 115;
        surfaceY = 585 - leftPeak - rightPeak + Math.sin(nx * 14 + rSeed) * 14;
        underY = 765;
      } else if (shapeMode === 'triple_islands') {
        const midIsland = Math.exp(-Math.pow((nx - 0.5) / 0.08, 2)) * 115;
        const sideL = Math.exp(-Math.pow((nx - 0.19) / 0.09, 2)) * 65;
        const sideR = Math.exp(-Math.pow((nx - 0.81) / 0.09, 2)) * 75;
        surfaceY = 580 - midIsland - sideL - sideR;
        underY = 755 - (nx > 0.38 && nx < 0.62 ? 25 : 0);
      } else if (shapeMode === 'cliff_steps') {
        // 좌측 저지대 -> 중앙 계단 -> 우측 고지대 절벽형
        const step = nx < 0.35 ? 0 : nx < 0.65 ? -85 : -155;
        surfaceY = 635 + step + Math.sin(nx * 16 + rSeed) * 14;
        underY = 785 + step * 0.25;
      } else if (shapeMode === 'single_hills') {
        const h1 = Math.exp(-Math.pow((nx - 0.24) / 0.13, 2)) * rAmp1;
        const h2 = Math.exp(-Math.pow((nx - 0.5) / 0.14, 2)) * rAmp2;
        const h3 = Math.exp(-Math.pow((nx - 0.76) / 0.13, 2)) * rAmp3;
        surfaceY = 615 - h1 - h2 - h3 + Math.sin(nx * Math.PI * rWaveFreq + rSeed) * rWaveAmp;
        underY = 775 - Math.exp(-Math.pow((nx - 0.5) / 0.1, 2)) * 65;
      } else if (preset === 'twin_peaks') {
        const peakL = Math.exp(-Math.pow((nx - 0.24) / 0.14, 2)) * 125;
        const peakR = Math.exp(-Math.pow((nx - 0.76) / 0.14, 2)) * 125;
        const dipCenter = Math.exp(-Math.pow((nx - 0.5) / 0.09, 2)) * 65;
        surfaceY = 595 - peakL - peakR + dipCenter;
        underY = 760 - Math.exp(-Math.pow((nx - 0.5) / 0.13, 2)) * 85;
      } else if (preset === 'citadel') {
        const plateau = Math.exp(-Math.pow((nx - 0.5) / 0.18, 2)) * 135;
        const sideWaves = Math.sin(nx * Math.PI * 5) * 18;
        surfaceY = 610 - plateau + sideWaves;
        underY = 780 - Math.sin(nx * Math.PI) * 20;
      } else {
        const hillL = Math.exp(-Math.pow((nx - 0.22) / 0.16, 2)) * 75;
        const hillC = Math.exp(-Math.pow((nx - 0.53) / 0.15, 2)) * 95;
        const hillR = Math.exp(-Math.pow((nx - 0.8) / 0.15, 2)) * 85;
        surfaceY = 615 - hillL - hillC - hillR + Math.sin(nx * 18) * 8;
        underY = 775 - Math.exp(-Math.pow((nx - 0.38) / 0.08, 2)) * 60;
      }

      if (underY - surfaceY < 24) {
        topProfile[gx] = -1;
        botProfile[gx] = -1;
      } else {
        topProfile[gx] = surfaceY;
        botProfile[gx] = underY;
      }
    }

    // 모든 연속된 섬 구간(단일 섬 / 2분할 / 3분할)의 양 끝을 둥글게 말아 올려 반듯한 직각 절단면 제거
    let segStart = -1;
    const roundRadiusCells = Math.ceil(68 / WORLD.CELL_SIZE);
    for (let gx = 0; gx <= this.cols; gx++) {
      const valid = gx < this.cols && topProfile[gx] >= 0;
      if (valid && segStart === -1) {
        segStart = gx;
      } else if (!valid && segStart !== -1) {
        const segEnd = gx - 1;
        const segLen = segEnd - segStart + 1;
        const effRadius = Math.min(roundRadiusCells, Math.floor(segLen * 0.38));
        for (let i = segStart; i <= segEnd; i++) {
          const distEdge = Math.min(i - segStart, segEnd - i);
          if (distEdge < effRadius) {
            const factor = 1 - distEdge / Math.max(1, effRadius);
            topProfile[i] += factor * factor * 48;
            botProfile[i] -= factor * factor * 92;
            if (botProfile[i] - topProfile[i] < 16) {
              topProfile[i] = -1;
              botProfile[i] = -1;
            }
          }
        }
        segStart = -1;
      }
    }

    // 장애물(필드 오브젝트) 배치용 랜덤 스팟 2~5개 생성 (서로 최소 130px 간격, 육지 위)
    const targetCount = 2 + Math.floor(Math.random() * 4); // 2 ~ 5개
    const terraces = [];
    let attempts = 0;
    while (terraces.length < targetCount && attempts < 45) {
      attempts++;
      const candX = Math.round(350 + Math.random() * 900); // 350 ~ 1250
      const gx = Math.floor(candX / WORLD.CELL_SIZE);
      if (gx < 0 || gx >= this.cols || topProfile[gx] < 0) continue;
      if (terraces.some((tx) => Math.abs(tx - candX) < 135)) continue;
      terraces.push(candX);
    }
    terraces.sort((a, b) => a - b);

    for (const tx of terraces) {
      const centerGx = Math.floor(tx / WORLD.CELL_SIZE);
      if (centerGx < 0 || centerGx >= this.cols || topProfile[centerGx] < 0) continue;
      const flatY = Math.round(topProfile[centerGx] / WORLD.CELL_SIZE) * WORLD.CELL_SIZE;
      if (flatY <= 0) continue;

      const flatHalfCells = Math.ceil(46 / WORLD.CELL_SIZE);
      const blendCells = Math.ceil(18 / WORLD.CELL_SIZE);
      for (let d = -flatHalfCells - blendCells; d <= flatHalfCells + blendCells; d++) {
        const gx = centerGx + d;
        if (gx < 0 || gx >= this.cols || topProfile[gx] < 0) continue;
        const absD = Math.abs(d);
        if (absD <= flatHalfCells) {
          topProfile[gx] = flatY;
        } else {
          const t = (absD - flatHalfCells) / blendCells;
          topProfile[gx] = flatY * (1 - t) + topProfile[gx] * t;
        }
      }
    }

    // 최종 topProfile ~ botProfile 구간 마스크 채우기
    for (let gx = 0; gx < this.cols; gx++) {
      const surfaceY = topProfile[gx];
      const underY = botProfile[gx];
      if (surfaceY < 0 || underY - surfaceY < 24) {
        topProfile[gx] = -1;
        botProfile[gx] = -1;
        continue;
      }
      const gyTop = Math.max(0, Math.floor(surfaceY / WORLD.CELL_SIZE));
      const gyBot = Math.min(this.rows - 1, Math.floor(underY / WORLD.CELL_SIZE));
      for (let gy = gyTop; gy <= gyBot; gy++) {
        this.mask[gy * this.cols + gx] = 1;
      }
    }

    // 공중 미니 부유 발판 1~2개 추가 (고각/도탄/엄폐 입체감 강화)
    const platforms = [];
    if (shapeMode === 'split_islands' || shapeMode === 'triple_islands' || Math.random() < 0.65) {
      const px = shapeMode === 'split_islands' ? 800 : Math.round(520 + Math.random() * 560);
      const py = Math.round(195 + Math.random() * 45);
      const pw = 128;
      const ph = 26;
      platforms.push({ x: px, y: py, w: pw, h: ph });
      this.stampFloatingPlatform(px, py, pw, ph);
    }

    this.renderInitialIsland(topProfile, botProfile, platforms);
    this.syncMatterStrips(0, WORLD.WIDTH);
    return terraces;
  }

  stampFloatingPlatform(cx, cy, w, h) {
    const startGx = Math.max(0, Math.floor((cx - w / 2) / WORLD.CELL_SIZE));
    const endGx = Math.min(this.cols - 1, Math.ceil((cx + w / 2) / WORLD.CELL_SIZE));
    for (let gx = startGx; gx <= endGx; gx++) {
      const nx = ((gx * WORLD.CELL_SIZE) - cx) / (w * 0.5);
      const arch = Math.sqrt(Math.max(0, 1 - nx * nx * 0.65));
      const topY = cy;
      const botY = cy + h * arch;
      const gyTop = Math.max(0, Math.floor(topY / WORLD.CELL_SIZE));
      const gyBot = Math.min(this.rows - 1, Math.floor(botY / WORLD.CELL_SIZE));
      for (let gy = gyTop; gy <= gyBot; gy++) {
        this.mask[gy * this.cols + gx] = 1;
      }
    }
  }

  /**
   * 다중 섬 지형에서 끊어진 구멍에 빠지지 않도록 가장 가까운 안전 육지 X좌표 탐색
   */
  findSafeSpawnX(preferredX) {
    if (this.findTopSurface(preferredX) !== null) return preferredX;
    for (let offset = 12; offset < 420; offset += 12) {
      if (preferredX - offset > 100 && this.findTopSurface(preferredX - offset) !== null) {
        return preferredX - offset;
      }
      if (preferredX + offset < WORLD.WIDTH - 100 && this.findTopSurface(preferredX + offset) !== null) {
        return preferredX + offset;
      }
    }
    return preferredX;
  }

  /**
   * 바이옴 팔레트 기반 고퀄리티 입체 부유섬 + 표면 데코 + 미니 발판 렌더링
   */
  renderInitialIsland(topProfile, botProfile, platforms = []) {
    this.lastRenderArgs = { topProfile, botProfile, platforms };
    const ctx = this.ctx;
    const pal = BIOMES[this.currentBiome] || BIOMES.meadow;
    ctx.save();

    for (let gx = 0; gx < this.cols; gx++) {
      const top = topProfile[gx];
      const bot = botProfile[gx];
      if (top < 0 || bot <= top) continue;

      const x = gx * WORLD.CELL_SIZE;
      const w = WORLD.CELL_SIZE;
      const totalH = bot - top;

      // 1) 하단/측면 노릇한 구운 빵 껍질 (식빵 테두리) + 외곽 아웃라인
      ctx.fillStyle = pal.outline;
      ctx.fillRect(x, top, w, totalH);
      ctx.fillStyle = pal.core;
      ctx.fillRect(x, top, w, Math.max(0, totalH - 6));

      // 2) 폭신한 빵 속살 (하단으로 갈수록 살짝 구워진 따뜻한 그라데이션)
      const crustDepth = this.currentBiome === 'meadow' ? 16 : 14;
      const midH = Math.max(0, totalH - 18);
      ctx.fillStyle = pal.mid;
      ctx.fillRect(x, top + crustDepth * 0.6, w, Math.max(0, midH - crustDepth * 0.6));

      // 3) 가운데 달콤한 크림/잼 샌드 띠 (케이크/빵 샌드위치 층)
      if (totalH > 85) {
        const jamY = top + totalH * 0.48;
        ctx.fillStyle = pal.jam;
        ctx.fillRect(x, jamY, w, 12);
      }

      // 4) 상단 구워진 빵 껍질 / 생크림 아이싱 드립 (웨이브 곡선)
      const drip =
        this.currentBiome === 'meadow' || this.currentBiome === 'glacier'
          ? 16 + Math.sin(gx * 0.08) * 3
          : 16 + Math.max(0, Math.sin(gx * 0.22)) * 14;
      ctx.fillStyle = pal.crust;
      ctx.fillRect(x, top, w, Math.min(drip, totalH));
      ctx.fillStyle = pal.crustHi;
      ctx.fillRect(x, top, w, Math.min(6, totalH));
    }

    // 5) 실제 구운 빵 이미지 텍스처(bread_texture.jpg)를 지형 실루엣 내부에 입히기!
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';

    if (this.breadImgReady) {
      const pat = ctx.createPattern(this.breadImg, 'repeat');
      if (pat) {
        // 적당한 크기의 폭신한 빵 기공 비율로 스케일링
        if (pat.setTransform) {
          pat.setTransform(new DOMMatrix().scale(0.32, 0.32));
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = this.currentBiome === 'volcano' ? 0.25 : 0.36;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        ctx.restore();

        // 상단 잼/생크림 샌드 띠와 크러스트가 빵 텍스처 위에도 선명히 살아나도록 덧칠
        ctx.globalCompositeOperation = 'source-atop';
        for (let gx = 0; gx < this.cols; gx++) {
          const top = topProfile[gx];
          const bot = botProfile[gx];
          if (top < 0 || bot <= top) continue;
          const x = gx * WORLD.CELL_SIZE;
          const w = WORLD.CELL_SIZE;
          const totalH = bot - top;
          if (totalH > 85) {
            ctx.fillStyle = pal.jam;
            ctx.fillRect(x, top + totalH * 0.48, w, 12);
          }
          const drip =
            this.currentBiome === 'meadow' || this.currentBiome === 'glacier'
              ? 22 + Math.sin(gx * 0.08) * 3
              : 20 + Math.max(0, Math.sin(gx * 0.22)) * 18;
          ctx.fillStyle = pal.crust;
          ctx.fillRect(x, top, w, Math.min(drip, totalH));
          ctx.fillStyle = pal.crustHi;
          ctx.fillRect(x, top, w, Math.min(6, totalH));
          // 하단 구운 빵 테두리 껍질 유지
          ctx.fillStyle = pal.core;
          ctx.fillRect(x, bot - 18, w, 13);
          ctx.fillStyle = pal.outline;
          ctx.fillRect(x, bot - 5, w, 5);
        }
      }
    } else {
      // 이미지 로드 전 폴백 기공 텍스처
      for (let i = 0; i < 360; i++) {
        const rx = 90 + ((i * 137) % (WORLD.WIDTH - 180));
        const ry = 460 + ((i * 89) % 310);
        ctx.fillStyle =
          this.currentBiome === 'volcano'
            ? 'rgba(26, 11, 10, 0.28)'
            : i % 2 === 0
              ? 'rgba(255, 255, 255, 0.35)'
              : 'rgba(180, 83, 9, 0.16)';
        ctx.beginPath();
        ctx.ellipse(rx, ry, 2.5 + (i % 4), 4.0 + (i % 4), (i % 3) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 바게트/식빵 특유의 노릇한 사선 빵 칼집(쿠프 무늬) & 도넛/케이크 스프링클!
    if (this.currentBiome === 'meadow' || this.currentBiome === 'glacier') {
      for (let sx = 150; sx < WORLD.WIDTH - 150; sx += 125) {
        const gx = Math.floor(sx / WORLD.CELL_SIZE);
        const sy = topProfile[gx];
        if (sy < 0) continue;
        // 짙게 구워진 바게트 칼집 홈 + 안쪽 노릇한 속살 립
        ctx.strokeStyle = '#78350F';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx - 24, sy + 9);
        ctx.quadraticCurveTo(sx, sy + 24, sx + 28, sy + 36);
        ctx.stroke();

        ctx.strokeStyle = '#FEF3C7';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(sx - 22, sy + 11);
        ctx.quadraticCurveTo(sx, sy + 25, sx + 25, sy + 36);
        ctx.stroke();
      }
    } else if (this.currentBiome === 'candy' || this.currentBiome === 'volcano') {
      // 도넛/케이크 아이싱 위의 알록달록 스프링클 & 초코칩
      const sprinkleColors =
        this.currentBiome === 'candy'
          ? ['#FFFFFF', '#FDE047', '#38BDF8', '#4ADE80', '#FB7185']
          : ['#FDE047', '#FFFFFF', '#FDBA74', '#FB7185'];
      for (let sx = 130; sx < WORLD.WIDTH - 130; sx += 34) {
        const gx = Math.floor(sx / WORLD.CELL_SIZE);
        const sy = topProfile[gx];
        if (sy < 0) continue;
        const dy = 7 + ((sx * 17) % 14);
        ctx.save();
        ctx.translate(sx, sy + dy);
        ctx.rotate(((sx * 29) % 10) * 0.3);
        ctx.fillStyle = sprinkleColors[(sx / 34) % sprinkleColors.length | 0];
        ctx.beginPath();
        ctx.roundRect(-4.5, -1.8, 9, 3.6, 1.8);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();

    // 빵/도넛/케이크 위에 올라간 생크림 휘핑 · 녹는 버터 · 통딸기 · 체리 토핑!
    for (let wx = 190; wx < WORLD.WIDTH - 190; wx += 220) {
      const gx = Math.floor(wx / WORLD.CELL_SIZE);
      const topY = topProfile[gx];
      if (topY < 0) continue;

      if (this.currentBiome === 'meadow' || this.currentBiome === 'glacier') {
        // 노란 사각 버터 조각이 빵 위에서 사르르 녹아있는 모습
        ctx.fillStyle = '#FDE047';
        ctx.strokeStyle = '#CA8A04';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(wx - 16, topY - 8, 32, 12, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#FEF9C3';
        ctx.fillRect(wx - 11, topY - 6, 18, 3);
      } else if (this.currentBiome === 'candy') {
        // 하얀 생크림 휘핑 + 빨간 통딸기 세트!
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#FBCFE8';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.ellipse(wx, topY - 2, 14, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#E11D48';
        ctx.strokeStyle = '#881337';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(wx, topY - 19);
        ctx.quadraticCurveTo(wx + 11, topY - 15, wx + 7, topY - 3);
        ctx.lineTo(wx - 7, topY - 3);
        ctx.quadraticCurveTo(wx - 11, topY - 15, wx, topY - 19);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.ellipse(wx, topY - 19, 7, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.currentBiome === 'volcano') {
        // 초코 케이크 위 생크림 + 빨간 체리!
        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.ellipse(wx, topY - 2, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E11D48';
        ctx.strokeStyle = '#881337';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(wx, topY - 10, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // 공중 미니 부유 발판 렌더링
    for (const pf of platforms) {
      const startGx = Math.max(0, Math.floor((pf.x - pf.w / 2) / WORLD.CELL_SIZE));
      const endGx = Math.min(this.cols - 1, Math.ceil((pf.x + pf.w / 2) / WORLD.CELL_SIZE));
      for (let gx = startGx; gx <= endGx; gx++) {
        const nx = ((gx * WORLD.CELL_SIZE) - pf.x) / (pf.w * 0.5);
        const arch = Math.sqrt(Math.max(0, 1 - nx * nx * 0.65));
        const x = gx * WORLD.CELL_SIZE;
        const h = pf.h * arch;
        ctx.fillStyle = pal.outline;
        ctx.fillRect(x, pf.y, WORLD.CELL_SIZE, h);
        ctx.fillStyle = pal.mid;
        ctx.fillRect(x, pf.y, WORLD.CELL_SIZE, Math.max(0, h - 3));
        ctx.fillStyle = pal.crust;
        ctx.fillRect(x, pf.y, WORLD.CELL_SIZE, Math.min(9, h));
        ctx.fillStyle = pal.crustHi;
        ctx.fillRect(x, pf.y, WORLD.CELL_SIZE, Math.min(3.5, h));
      }
    }

    // 빵 내부 폭신폭신한 기공(구멍) & 초코칩 텍스처
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 320; i++) {
      const rx = 90 + ((i * 137) % (WORLD.WIDTH - 180));
      const ry = 460 + ((i * 89) % 310);
      if (this.currentBiome === 'volcano') {
        ctx.fillStyle = i % 3 === 0 ? 'rgba(253, 224, 71, 0.16)' : 'rgba(26, 11, 10, 0.32)';
      } else {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.26)' : 'rgba(180, 83, 9, 0.14)';
      }
      ctx.beginPath();
      ctx.ellipse(rx, ry, 3.2 + (i % 5), 2.2 + (i % 3), (i % 4) * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 빵 표면 위 귀여운 디저트 토핑 데코 (체리, 깨/설탕가루, 초코 스프링클, 별사탕)
    for (let wx = 125; wx < WORLD.WIDTH - 125; wx += 48 + (wx % 29)) {
      const gx = Math.floor(wx / WORLD.CELL_SIZE);
      const topY = topProfile[gx];
      if (topY < 0) continue;

      if (this.currentBiome === 'meadow') {
        // 식빵 위 고소한 참깨 / 버터 크림 방울
        ctx.fillStyle = '#FFFBEB';
        ctx.beginPath();
        ctx.ellipse(wx, topY + 3, 3.5, 1.8, 0.2, 0, Math.PI * 2);
        ctx.fill();
        if (wx % 3 === 0) {
          ctx.fillStyle = '#F43F5E';
          ctx.beginPath();
          ctx.arc(wx + 6, topY - 4, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.currentBiome === 'glacier') {
        // 크루아상 위 반짝이는 설탕 결정
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#BAE6FD';
        ctx.lineWidth = 1;
        ctx.fillRect(wx - 2, topY - 4, 4, 4);
        ctx.strokeRect(wx - 2, topY - 4, 4, 4);
      } else if (this.currentBiome === 'volcano') {
        // 브라우니 위 알록달록 초코 스프링클
        ctx.fillStyle = wx % 2 === 0 ? '#F472B6' : '#FACC15';
        ctx.fillRect(wx, topY - 3, 6, 2.5);
      } else if (this.currentBiome === 'candy') {
        // 딸기 케이크 위 생크림 체리 & 막대사탕
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(wx, topY - 3, 5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#E11D48';
        ctx.beginPath();
        ctx.arc(wx, topY - 8, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * 실시간 원형 크레이터 굴착 + 그을린 테두리 연출 + 물리 정적 바디 부분 갱신
   */
  carveCrater(cx, cy, radius) {
    const rCells = Math.ceil(radius / WORLD.CELL_SIZE);
    const gxCenter = Math.floor(cx / WORLD.CELL_SIZE);
    const gyCenter = Math.floor(cy / WORLD.CELL_SIZE);
    const rSq = radius * radius;

    const minGx = Math.max(0, gxCenter - rCells);
    const maxGx = Math.min(this.cols - 1, gxCenter + rCells);
    const minGy = Math.max(0, gyCenter - rCells);
    const maxGy = Math.min(this.rows - 1, gyCenter + rCells);

    let carvedCount = 0;
    for (let gy = minGy; gy <= maxGy; gy++) {
      const wy = gy * WORLD.CELL_SIZE + WORLD.CELL_SIZE * 0.5;
      const dy = wy - cy;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const wx = gx * WORLD.CELL_SIZE + WORLD.CELL_SIZE * 0.5;
        const dx = wx - cx;
        if (dx * dx + dy * dy <= rSq) {
          const idx = gy * this.cols + gx;
          if (this.mask[idx] === 1) {
            this.mask[idx] = 0;
            carvedCount++;
          }
        }
      }
    }

    // 오프스크린 캔버스 구멍 뚫기 + 먹음직스러운 빵 속살 테두리 베이크 표현
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000'; // 반드시 100% 불투명 알파로 완전히 파내야 잔상이 남지 않음!
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (carvedCount > 0) {
      this.syncMatterStrips(cx - radius - 18, cx + radius + 18);
    }
    return carvedCount;
  }

  /**
   * 지정된 X 구간의 Matter.js 정적 지형 콜라이더 스트립 재구성
   * (지형이 파이면 상단 물리 블록들이 즉시 지지력을 잃고 무너져 내림)
   */
  syncMatterStrips(minWx, maxWx) {
    const startIdx = Math.max(0, Math.floor(minWx / WORLD.STRIP_WIDTH));
    const endIdx = Math.min(this.stripCount - 1, Math.ceil(maxWx / WORLD.STRIP_WIDTH));

    for (let s = startIdx; s <= endIdx; s++) {
      // 기존 정적 바디 제거
      if (this.stripBodies[s].length > 0) {
        Matter.Composite.remove(this.matterWorld, this.stripBodies[s]);
        this.stripBodies[s] = [];
      }

      const xCenter = s * WORLD.STRIP_WIDTH + WORLD.STRIP_WIDTH * 0.5;
      const gx = Math.min(this.cols - 1, Math.max(0, Math.floor(xCenter / WORLD.CELL_SIZE)));

      let inRun = false;
      let runStartGy = 0;
      const newBodies = [];

      for (let gy = 0; gy <= this.rows; gy++) {
        const solid = gy < this.rows ? this.mask[gy * this.cols + gx] === 1 : false;
        if (solid && !inRun) {
          inRun = true;
          runStartGy = gy;
        } else if (!solid && inRun) {
          inRun = false;
          const yTop = runStartGy * WORLD.CELL_SIZE;
          const yBot = gy * WORLD.CELL_SIZE;
          const height = yBot - yTop;

          // 미세 부스러기(6px 미만)는 제거하여 매끄러운 붕괴 유도
          if (height >= 6) {
            const body = Matter.Bodies.rectangle(
              xCenter,
              (yTop + yBot) * 0.5,
              WORLD.STRIP_WIDTH + 1.2,
              height,
              {
                isStatic: true,
                friction: 0.72,
                restitution: 0.12,
                label: 'terrain',
              }
            );
            newBodies.push(body);
          } else {
            for (let clearGy = runStartGy; clearGy < gy; clearGy++) {
              this.mask[clearGy * this.cols + gx] = 0;
            }
          }
        }
      }

      if (newBodies.length > 0) {
        this.stripBodies[s] = newBodies;
        Matter.Composite.add(this.matterWorld, newBodies);
      }
    }
  }

  isSolid(wx, wy) {
    if (wx < 0 || wx >= WORLD.WIDTH || wy < 0 || wy >= WORLD.HEIGHT) return false;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const gy = Math.floor(wy / WORLD.CELL_SIZE);
    return this.mask[gy * this.cols + gx] === 1;
  }

  /**
   * 특정 x 좌표에서 기준 y 근처의 지형 표면 높이를 탐색 (통통카 주행 및 안착용)
   */
  findSurfaceNear(wx, refY, maxClimb = 22, maxStepDown = 26) {
    if (wx < 10 || wx >= WORLD.WIDTH - 10) return null;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const startGy = Math.max(0, Math.floor((refY - maxClimb) / WORLD.CELL_SIZE));
    const endGy = Math.min(this.rows - 1, Math.floor((refY + maxStepDown) / WORLD.CELL_SIZE));

    for (let gy = startGy; gy <= endGy; gy++) {
      if (this.mask[gy * this.cols + gx] === 1) {
        // 바로 위 셀이 비어 있어야 실제 표면
        if (gy === 0 || this.mask[(gy - 1) * this.cols + gx] === 0) {
          return gy * WORLD.CELL_SIZE;
        }
      }
    }
    return null;
  }

  /**
   * 하늘(또는 지정 높이 minY)에서부터 해당 x의 가장 위쪽 지형 표면을 탐색
   * (스폰 시 상공 미니 발판이 아닌 메인 섬 표면을 찾도록 minY 기본값 265 적용)
   */
  findTopSurface(wx, minY = 265) {
    if (wx < 0 || wx >= WORLD.WIDTH) return null;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const startGy = Math.max(0, Math.floor(minY / WORLD.CELL_SIZE));
    for (let gy = startGy; gy < this.rows; gy++) {
      if (this.mask[gy * this.cols + gx] === 1) {
        return gy * WORLD.CELL_SIZE;
      }
    }
    return null;
  }

  /**
   * 특정 좌표가 지형 내부에 박혔을 때, 위로 올라가며 가장 가까운 실제 지형 표면을 찾습니다.
   */
  findSurfaceUpward(wx, wy, maxUp = 56) {
    if (wx < 0 || wx >= WORLD.WIDTH) return null;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const startGy = Math.min(this.rows - 1, Math.max(0, Math.floor(wy / WORLD.CELL_SIZE)));
    const minGy = Math.max(0, startGy - Math.ceil(maxUp / WORLD.CELL_SIZE));

    for (let gy = startGy; gy >= minGy; gy--) {
      if (this.mask[gy * this.cols + gx] === 1) {
        if (gy === 0 || this.mask[(gy - 1) * this.cols + gx] === 0) {
          return gy * WORLD.CELL_SIZE;
        }
      }
    }
    return null;
  }

  /**
   * 통통카 기울기 표현을 위한 주변 경사각 계산
   */
  getSlopeAngle(wx, wy) {
    const leftY = this.findSurfaceNear(wx - 12, wy, 28, 28) ?? wy;
    const rightY = this.findSurfaceNear(wx + 12, wy, 28, 28) ?? wy;
    return Math.atan2(rightY - leftY, 24) * 0.65;
  }

  /**
   * 포탄 도탄(바운스)을 위한 충돌 지점 지형 법선 벡터 계산
   */
  getSurfaceNormal(wx, wy) {
    let nx = 0;
    let ny = 0;
    const step = WORLD.CELL_SIZE * 2;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.isSolid(wx + dx * step, wy + dy * step)) {
          nx -= dx;
          ny -= dy;
        }
      }
    }
    const len = Math.hypot(nx, ny);
    if (len < 0.001) return { x: 0, y: -1 };
    return { x: nx / len, y: ny / len };
  }
}
