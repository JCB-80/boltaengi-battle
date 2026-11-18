// 파스텔 2.5D 토이 아일랜드 렌더러 (Clean-IP 3D 피규어 스프라이트 · 플로팅 조준 링 · 물리 블록 · 이펙트)
import { SHELLS, WORLD } from './config.js';
import { BIOMES } from './terrain.js';

const CHAR_SPRITES = new Map();

function getCharSprite(charId, onLoad = null) {
  if (!charId) return { img: null, loaded: false, callbacks: [] };
  let entry = CHAR_SPRITES.get(charId);
  if (!entry) {
    const img = new Image();
    entry = { img, loaded: false, callbacks: [] };
    img.onload = () => {
      entry.loaded = true;
      for (const cb of entry.callbacks) cb();
      entry.callbacks = [];
    };
    img.src = `./assets/chars/${charId}.png?v=20`;
    CHAR_SPRITES.set(charId, entry);
  }
  if (!entry.loaded && typeof onLoad === 'function') {
    entry.callbacks.push(onLoad);
  }
  return entry;
}

/**
 * 3D 피규어 이미지를 지정된 볼살 좌표 중심으로 가우시안 탄성 메쉬 워핑해 그립니다.
 * (인게임 조준 볼당김 & 돋보기 볼꼬집기 교감 공용)
 */
function drawWarpedSprite3D(ctx, img, ox, oy, destSize, anchorX, anchorY, dx, dy, sigma = 46, N = 12) {
  const pullMag = Math.hypot(dx, dy);
  if (pullMag <= 1.5) {
    ctx.drawImage(img, ox, oy, destSize, destSize);
    return;
  }
  const sigma2 = 2 * sigma * sigma;
  const imgW = img.width || 256;
  const imgH = img.height || 256;

  const pts = [];
  for (let gy = 0; gy <= N; gy++) {
    const row = [];
    const baseY = oy + (gy / N) * destSize;
    for (let gx = 0; gx <= N; gx++) {
      const baseX = ox + (gx / N) * destSize;
      const dist2 = (baseX - anchorX) ** 2 + (baseY - anchorY) ** 2;
      const wgt = Math.exp(-dist2 / sigma2);
      row.push({
        x: baseX + dx * wgt,
        y: baseY + dy * wgt,
        u: (gx / N) * imgW,
        v: (gy / N) * imgH,
      });
    }
    pts.push(row);
  }

  const drawTri = (p0, p1, p2) => {
    const denom = p0.u * (p1.v - p2.v) + p1.u * (p2.v - p0.v) + p2.u * (p0.v - p1.v);
    if (Math.abs(denom) < 1e-4) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.closePath();
    ctx.clip();

    const a = (p0.x * (p1.v - p2.v) + p1.x * (p2.v - p0.v) + p2.x * (p0.v - p1.v)) / denom;
    const b = (p0.y * (p1.v - p2.v) + p1.y * (p2.v - p0.v) + p2.y * (p0.v - p1.v)) / denom;
    const c = (p0.x * (p2.u - p1.u) + p1.x * (p0.u - p2.u) + p2.x * (p1.u - p0.u)) / denom;
    const d = (p0.y * (p2.u - p1.u) + p1.y * (p0.u - p2.u) + p2.y * (p1.u - p0.u)) / denom;
    const e = (p0.x * (p1.u * p2.v - p2.u * p1.v) + p1.x * (p2.u * p0.v - p0.u * p2.v) + p2.x * (p0.u * p1.v - p1.u * p0.v)) / denom;
    const f = (p0.y * (p1.u * p2.v - p2.u * p1.v) + p1.y * (p2.u * p0.v - p0.u * p2.v) + p2.y * (p0.u * p1.v - p1.u * p0.v)) / denom;

    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  for (let gy = 0; gy < N; gy++) {
    for (let gx = 0; gx < N; gx++) {
      const p00 = pts[gy][gx];
      const p10 = pts[gy][gx + 1];
      const p01 = pts[gy + 1][gx];
      const p11 = pts[gy + 1][gx + 1];
      drawTri(p00, p10, p11);
      drawTri(p00, p11, p01);
    }
  }
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 구름 배경 및 바람 꽃잎 파티클 초기화
    this.bgClouds = Array.from({ length: 8 }, (_, i) => ({
      x: (i * 230) % WORLD.WIDTH,
      y: 75 + (i % 4) * 68,
      scale: 0.75 + (i % 3) * 0.28,
      speedFactor: 0.12 + (i % 3) * 0.06,
    }));

    this.windPetals = Array.from({ length: 28 }, () => ({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * (WORLD.SEA_LEVEL - 60),
      r: 2.5 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
    }));

    this.rainDrops = Array.from({ length: 95 }, () => ({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.SEA_LEVEL,
      len: 12 + Math.random() * 14,
      speed: 13 + Math.random() * 6,
    }));

    this.shakeMag = 0;
    this.flashAlpha = 0;
    this.flashColor = '#FEF08A';
  }

  addShake(amount) {
    this.shakeMag = Math.min(28, Math.max(this.shakeMag, amount));
  }

  addFlash(color = '#FEF08A', alpha = 0.38) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  render(state) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, cw, ch);

    // 1600x900 논리 월드를 현재 캔버스 해상도에 맞게 균일 스케일링 (레터박스 없는 꽉 찬 뷰)
    const scaleX = cw / WORLD.WIDTH;
    const scaleY = ch / WORLD.HEIGHT;
    ctx.scale(scaleX, scaleY);

    // 화면 흔들림(타격감 카메라 쉐이크)
    if (this.shakeMag > 0.2) {
      const sx = (Math.random() - 0.5) * this.shakeMag * 2;
      const sy = (Math.random() - 0.5) * this.shakeMag * 2;
      ctx.translate(sx, sy);
      this.shakeMag *= 0.86;
    } else {
      this.shakeMag = 0;
    }

    this.drawSkyAndBackdrop(ctx, state.wind, state.weather, state.terrain.currentBiome, state.frameCount);
    if (state.weather === 'RAIN') {
      this.drawRain(ctx, state.wind);
    } else {
      this.drawWindPetals(ctx, state.wind, state.frameCount);
    }

    // 1) 지형 레이어 (오프스크린 캐시 캔버스)
    ctx.drawImage(state.terrain.canvas, 0, 0);

    // 2) 물리 구조물 블록 레이어
    this.drawBlocks(ctx, state.structures.blocks, state.frameCount);

    // 2.5) 랜덤 회오리 기둥 & 하늘 보급 풍선 박스 렌더링
    if (state.tornado && state.tornado.active) {
      this.drawTornado(ctx, state.tornado, state.frameCount);
    }
    if (state.skyBox && state.skyBox.active) {
      this.drawSkyBox(ctx, state.skyBox, state.frameCount);
    }
    if (Array.isArray(state.fixedBoxes) && state.fixedBoxes.length > 0) {
      this.drawFixedBoxes(ctx, state.fixedBoxes, state.frameCount);
    }

    // 3) 소동물 통통카 캐릭터 레이어
    for (const cart of state.carts) {
      if (!cart.alive) continue;
      const isCurrent = state.activeActor && state.activeActor.id === cart.id;
      this.drawCoasterCart(ctx, cart, isCurrent, state.phase, state.frameCount);
    }

    // 4) 플로팅 아크 조준 링 & 28% 가이드 점선 (플레이어 조준 페이즈)
    if (
      state.phase === 'AIM' &&
      state.activeActor &&
      state.activeActor.alive &&
      state.activeActor.controller === 'human'
    ) {
      this.drawFloatingAimHUD(ctx, state.activeActor, state.wind, state.weather, state.dragState);
    }

    // 5) 비행 중인 캡슐탄 레이어
    for (const proj of state.projectiles) {
      if (proj.active) {
        this.drawProjectile(ctx, proj, state.frameCount);
      }
    }

    // 6) 폭발 링 · 파편 파티클 레이어
    this.drawParticlesAndShockwaves(ctx, state.particles, state.shockwaves);

    // 7) 하단 구름 바다 (드롭아웃 경계선 연출)
    this.drawCloudSea(ctx, state.frameCount);

    // 8) 플로팅 데미지 & 상태 텍스트
    this.drawFloatingTexts(ctx, state.floatingTexts);

    // 8.5) 크게 맞았을 때 주인을 쳐다보는 불쌍한 얼굴 확대 컷인
    if (state.pityCutin && state.pityCutin.active && state.pityCutin.cart) {
      this.drawPityCutin(ctx, state.pityCutin, state.frameCount);
    }

    // 9) 강한 스킬 임팩트 화면 플래시
    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillRect(-40, -40, WORLD.WIDTH + 80, WORLD.HEIGHT + 80);
      this.flashAlpha *= 0.8;
    }

    ctx.restore();
  }

  drawSkyAndBackdrop(ctx, wind, weather, biomeKey = 'meadow', frameCount) {
    const pal = BIOMES[biomeKey] || BIOMES.meadow;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    if (weather === 'RAIN') {
      skyGrad.addColorStop(0, '#475569');
      skyGrad.addColorStop(0.58, '#94A3B8');
      skyGrad.addColorStop(1, '#CBD5E1');
    } else {
      skyGrad.addColorStop(0, pal.skyTop);
      skyGrad.addColorStop(0.58, pal.skyMid);
      skyGrad.addColorStop(1, pal.skyBot);
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 원경 파스텔 태양/달 (비 올 땐 구름 뒤에 숨김)
    if (weather !== 'RAIN') {
      ctx.fillStyle = biomeKey === 'volcano' ? 'rgba(254, 240, 138, 0.45)' : 'rgba(255, 251, 235, 0.6)';
      ctx.beginPath();
      ctx.arc(1320, 145, 68, 0, Math.PI * 2);
      ctx.fill();

      // 과자 초원 / 캔디 구름 테마일 때 은은한 파스텔 무지개 아치
      if (biomeKey === 'meadow' || biomeKey === 'candy') {
        const rbColors = ['rgba(244,114,182,0.14)', 'rgba(251,191,36,0.14)', 'rgba(56,189,248,0.14)'];
        rbColors.forEach((c, idx) => {
          ctx.strokeStyle = c;
          ctx.lineWidth = 14;
          ctx.beginPath();
          ctx.arc(480, 680, 440 - idx * 14, Math.PI * 1.08, Math.PI * 1.92);
          ctx.stroke();
        });
      }
    }

    // 원경 패럴랙스 산맥 / 부유섬 실루엣 (2겹 깊이감)
    ctx.fillStyle = weather === 'RAIN' ? 'rgba(100, 116, 139, 0.25)' : pal.hillFar;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT);
    for (let x = 0; x <= WORLD.WIDTH; x += 40) {
      const y =
        biomeKey === 'glacier' || biomeKey === 'volcano'
          ? 640 - Math.abs(Math.sin(x * 0.0055)) * 155
          : 660 - Math.sin(x * 0.0045) * 85 - Math.cos(x * 0.011) * 35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = weather === 'RAIN' ? 'rgba(71, 85, 105, 0.25)' : pal.hillNear;
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT);
    for (let x = 0; x <= WORLD.WIDTH; x += 40) {
      const y =
        biomeKey === 'glacier' || biomeKey === 'volcano'
          ? 700 - Math.abs(Math.cos(x * 0.007 + 1)) * 120
          : 710 - Math.cos(x * 0.006 + 1.2) * 65;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();

    // 흐르는 솜사탕/비 구름
    for (const cl of this.bgClouds) {
      cl.x += (0.2 + wind * 0.06) * cl.speedFactor;
      if (cl.x > WORLD.WIDTH + 160) cl.x = -150;
      if (cl.x < -160) cl.x = WORLD.WIDTH + 150;

      ctx.save();
      ctx.translate(cl.x, cl.y + Math.sin(frameCount * 0.015 + cl.x) * 3);
      ctx.scale(cl.scale, cl.scale);
      ctx.fillStyle =
        weather === 'RAIN'
          ? 'rgba(100, 116, 139, 0.85)'
          : biomeKey === 'volcano'
            ? 'rgba(254, 215, 170, 0.65)'
            : 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.arc(30, -8, 28, 0, Math.PI * 2);
      ctx.arc(-28, 4, 24, 0, Math.PI * 2);
      ctx.arc(54, 6, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawRain(ctx, wind) {
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.52)';
    ctx.lineWidth = 1.6;
    const slantX = wind * 0.45;
    for (const drop of this.rainDrops) {
      drop.x += slantX;
      drop.y += drop.speed;
      if (drop.y > WORLD.SEA_LEVEL) {
        drop.y = -20;
        drop.x = Math.random() * WORLD.WIDTH;
      }
      if (drop.x > WORLD.WIDTH + 30) drop.x = -20;
      if (drop.x < -30) drop.x = WORLD.WIDTH + 20;

      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + slantX * 0.8, drop.y + drop.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTornado(ctx, tornado, frameCount) {
    ctx.save();
    const baseY = tornado.y;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const ringY = baseY - i * 24;
      const radiusX = 16 + t * 52;
      const wobbleX = Math.sin(frameCount * 0.25 + i * 0.7) * (6 + t * 14);
      ctx.strokeStyle = `rgba(224, 242, 254, ${0.72 - t * 0.35})`;
      ctx.lineWidth = 4.5 - t * 1.5;
      ctx.beginPath();
      ctx.ellipse(tornado.x + wobbleX, ringY, radiusX, 9 + t * 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFixedBoxes(ctx, fixedBoxes, frameCount) {
    for (const box of fixedBoxes) {
      if (!box.active) continue;
      const pulse = 1 + Math.sin(frameCount * 0.08 + box.x) * 0.04;
      ctx.save();
      ctx.translate(box.x, box.y);
      ctx.scale(pulse, pulse);

      ctx.fillStyle = 'rgba(120, 53, 15, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(244, 114, 182, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#F472B6';
      ctx.strokeStyle = '#9D174D';
      ctx.lineWidth = 2.2;
      this.roundRect(ctx, -14, -14, 28, 28, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FDE047';
      ctx.fillRect(-3, -14, 6, 28);
      ctx.fillRect(-14, -3, 28, 6);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, 5);
      ctx.restore();
    }
  }

  drawSkyBox(ctx, skyBox, frameCount) {
    ctx.save();
    ctx.translate(skyBox.x, skyBox.y);
    const tilt = Math.sin(frameCount * 0.06) * 0.1;
    ctx.rotate(tilt);

    // 반짝이는 황금 후광 링
    const auraR = 26 + Math.sin(frameCount * 0.16) * 3;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.stroke();

    // 매달린 줄
    ctx.strokeStyle = '#FDE68A';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, -12);
    ctx.lineTo(-4, -26);
    ctx.moveTo(8, -12);
    ctx.lineTo(4, -26);
    ctx.stroke();

    // 파스텔 열기구 풍선
    ctx.fillStyle = '#FB7185';
    ctx.strokeStyle = '#9F1239';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -36, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFE4E6';
    ctx.beginPath();
    ctx.arc(-4, -40, 4, 0, Math.PI * 2);
    ctx.fill();

    // 황금 선물 박스 (작아서 맞추기 힘든 목표물!)
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 2.2;
    this.roundRect(ctx, -14, -12, 28, 24, 5);
    ctx.fill();
    ctx.stroke();

    // 리본 십자 & 별 마크
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(-3, -12, 6, 24);
    ctx.fillRect(-14, -3, 28, 6);
    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', 0, 0.5);

    ctx.restore();
  }

  drawWindPetals(ctx, wind, frameCount) {
    for (const p of this.windPetals) {
      p.x += wind * 0.34 + 0.12;
      p.y += 0.45 + Math.sin(frameCount * 0.04 + p.phase) * 0.35;
      if (p.x > WORLD.WIDTH + 20) p.x = -20;
      if (p.x < -20) p.x = WORLD.WIDTH + 20;
      if (p.y > WORLD.SEA_LEVEL) p.y = 20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(frameCount * 0.03 + p.phase);
      ctx.fillStyle = Math.abs(wind) > 8 ? 'rgba(251, 146, 60, 0.65)' : 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.5, p.r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawBlocks(ctx, blocks, frameCount) {
    for (const blk of blocks) {
      if (blk.destroyed) continue;
      const { x, y } = blk.body.position;
      const w = blk.w;
      const h = blk.h;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(blk.body.angle);

      // 버섯 스프링 말랑 스케일 텐션
      if (blk.wobble > 0) {
        const s = 1 + Math.sin(blk.wobble * Math.PI * 4) * 0.16 * blk.wobble;
        ctx.scale(s, 2 - s);
      }

      if (blk.mat.id === 'JELLY') {
        // 막대에 꽂힌 몽실몽실 투톤 솜사탕 (진짜 간식 비주얼!)
        ctx.fillStyle = '#FDE68A';
        ctx.strokeStyle = '#92400E';
        ctx.lineWidth = 1.6;
        ctx.fillRect(-2.5, 2, 5, h * 0.55);
        ctx.strokeRect(-2.5, 2, 5, h * 0.55);

        ctx.fillStyle = '#F9A8D4';
        ctx.strokeStyle = '#DB2777';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(-w * 0.24, -1, h * 0.44, 0, Math.PI * 2);
        ctx.arc(w * 0.24, -1, h * 0.44, 0, Math.PI * 2);
        ctx.arc(0, -5, h * 0.54, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#BAE6FD';
        ctx.beginPath();
        ctx.arc(-w * 0.12, -6, h * 0.25, 0, Math.PI * 2);
        ctx.fill();
      } else if (blk.mat.id === 'ICE') {
        // 막대기 + 나선형 회오리 롤리팝 사탕!
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.6;
        ctx.fillRect(-2.5, 0, 5, h * 0.52);
        ctx.strokeRect(-2.5, 0, 5, h * 0.52);

        const candyR = Math.min(w, h) * 0.44;
        ctx.fillStyle = '#ECFEFF';
        ctx.strokeStyle = '#0E7490';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, -h * 0.14, candyR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 나선형 회오리 캔디 무늬
        ctx.strokeStyle = '#22D3EE';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 3.6; a += 0.25) {
          const r = (a / (Math.PI * 3.6)) * (candyR - 2);
          const px = Math.cos(a) * r;
          const py = -h * 0.14 + Math.sin(a) * r;
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (blk.mat.id === 'TNT') {
        // 양쪽 끝이 리본처럼 묶인 알록달록 왕사탕 폭탄!
        ctx.fillStyle = '#FB7185';
        ctx.strokeStyle = '#9F1239';
        ctx.lineWidth = 2;
        // 좌/우 캔디 포장지 리본 날개
        ctx.beginPath();
        ctx.moveTo(-w * 0.35, 0);
        ctx.lineTo(-w * 0.58, -h * 0.32);
        ctx.lineTo(-w * 0.58, h * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w * 0.35, 0);
        ctx.lineTo(w * 0.58, -h * 0.32);
        ctx.lineTo(w * 0.58, h * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 둥근 알사탕 본체
        ctx.fillStyle = '#F43F5E';
        this.roundRect(ctx, -w * 0.42, -h * 0.42, w * 0.84, h * 0.84, 11);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FDE047';
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9F1239';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 0.5);

        const sparkR = 2.5 + Math.sin(frameCount * 0.35 + blk.id) * 1.5;
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, -h * 0.48, sparkR, 0, Math.PI * 2);
        ctx.fill();
      } else if (blk.mat.id === 'WOOD') {
        // 포장지가 반쯤 벗겨진 진짜 초콜렛 바!
        ctx.fillStyle = '#6D3B1A';
        ctx.strokeStyle = '#3B1D0A';
        ctx.lineWidth = 2.2;
        this.roundRect(ctx, -w / 2, -h / 2, w, h, 4);
        ctx.fill();
        ctx.stroke();

        // 초콜렛 조각 칸선
        ctx.strokeStyle = '#3B1D0A';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-w / 2 + 3, -h * 0.16);
        ctx.lineTo(w / 2 - 3, -h * 0.16);
        ctx.stroke();

        // 아래쪽 반을 감싼 빨간/금색 초콜렛 포장지 + 은박지 띠
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-w / 2 + 1, 0, w - 2, 5);
        ctx.fillStyle = '#DC2626';
        ctx.strokeStyle = '#7F1D1D';
        ctx.lineWidth = 1.8;
        this.roundRect(ctx, -w / 2 - 1, 4, w + 2, h / 2 - 3, 3);
        ctx.fill();
        ctx.stroke();
      } else {
        // 통통한 샌드 마카롱 (위/아래 꼬끄 + 가운데 생크림 필링!)
        ctx.fillStyle = '#F472B6';
        ctx.strokeStyle = '#9D174D';
        ctx.lineWidth = 2.2;
        // 위 꼬끄
        this.roundRect(ctx, -w / 2, -h / 2, w, h * 0.38, 10);
        ctx.fill();
        ctx.stroke();
        // 아래 꼬끄
        this.roundRect(ctx, -w / 2, h * 0.12, w, h * 0.38, 10);
        ctx.fill();
        ctx.stroke();
        // 가운데 두툼한 바닐라 크림 필링
        ctx.fillStyle = '#FFFBEB';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.4;
        this.roundRect(ctx, -w / 2 - 1, -h * 0.12, w + 2, h * 0.24, 5);
        ctx.fill();
        ctx.stroke();
      }

      // 손상 균열 표현 (HP 비율 기반)
      const hpRatio = blk.hp / blk.maxHp;
      if (!blk.mat.indestructible && hpRatio < 0.68) {
        ctx.strokeStyle = 'rgba(45, 25, 15, 0.65)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-w * 0.25, -h * 0.2);
        ctx.lineTo(0, 0);
        ctx.lineTo(w * 0.2, h * 0.25);
        if (hpRatio < 0.36) {
          ctx.moveTo(w * 0.22, -h * 0.25);
          ctx.lineTo(-w * 0.15, h * 0.22);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  drawCoasterCart(ctx, cart, isCurrent, phase, frameCount) {
    ctx.save();
    // 발사 반동(Recoil)에 따른 뒤로 밀림 효과
    const recoilShift = -cart.facing * cart.recoil * 9;
    ctx.translate(cart.x + recoilShift, cart.y);

    // 스킬/궁극기/하늘보급 슈퍼버프 활성화 오라 링
    if (cart.powerUpTurns > 0) {
      const pPulse = 1 + Math.sin(frameCount * 0.28) * 0.16;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, -18, 38 * pPulse, 29 * pPulse, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = 'bold 11px "Pretendard", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FEF08A';
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3;
      ctx.strokeText('⚡ POWER UP!', 0, -56);
      ctx.fillText('⚡ POWER UP!', 0, -56);
    } else if (isCurrent && (cart.useUltimate || cart.skillMode !== 'NORMAL')) {
      const auraPulse = 1 + Math.sin(frameCount * 0.22) * 0.14;
      ctx.strokeStyle = cart.useUltimate ? 'rgba(250, 204, 21, 0.85)' : 'rgba(249, 115, 22, 0.78)';
      ctx.lineWidth = cart.useUltimate ? 3.5 : 2.5;
      ctx.beginPath();
      ctx.ellipse(0, -18, 34 * auraPulse, 26 * auraPulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 내 차례일 때 발밑 바닥 글로우 표시 + 기본 접지 그림자
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 1, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isCurrent) {
      const pulse = 1 + Math.sin(frameCount * 0.12) * 0.12;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, -3, 32 * pulse, 10 * pulse, 0, 0, Math.PI * 2);
      ctx.fill();

      // 머리 위 턴 인디케이터 화살표
      const bob = Math.sin(frameCount * 0.14) * 4;
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -70 + bob);
      ctx.lineTo(-8, -82 + bob);
      ctx.lineTo(8, -82 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(cart.tiltAngle);

    // 좌/우 방향 반전 + 모바일/PC 모두 선명한 1.8등신 벨벳 말랑볼 요정단 스케일 (1.28x)
    ctx.save();
    ctx.scale(cart.facing * 1.28, 1.28);

    const idleBob = Math.sin(frameCount * 0.09 + cart.slotIndex * 1.7) * 1.2;
    const stepL = Math.max(0, Math.sin(cart.wheelSpin * 2.8)) * 4.5;
    const stepR = Math.max(0, -Math.sin(cart.wheelSpin * 2.8)) * 4.5;
    const walkTilt = Math.sin(cart.wheelSpin * 2.8) * 0.06;
    const walkHop = Math.abs(Math.sin(cart.wheelSpin * 2.8)) * 3.2;
    const headY = -27 + idleBob;

    const pullNorm = isCurrent && phase === 'AIM' ? Math.max(0, (cart.aimPower - 15) / 85) : 0;
    const isHardPull = isCurrent && phase === 'AIM' && cart.aimPower >= 65;
    const hardRatio = isHardPull ? (cart.aimPower - 65) / 35 : 0;
    const strainShakeX = isHardPull ? Math.sin(frameCount * 1.55) * (0.7 + hardRatio * 1.4) : 0;
    const pullLean = -pullNorm * 0.14 + (cart.recoil > 0 ? cart.recoil * 0.24 : 0);
    ctx.translate(strainShakeX, 0);
    ctx.rotate(walkTilt + pullLean);

    const sprite3d = getCharSprite(cart.spec?.id || cart.charKey);
    if (sprite3d.loaded) {
      // 실제 3D 벨벳·젤리볼 피규어 스프라이트 렌더링 (자기 볼살 2D 탄성 메쉬 워핑 + 발사 반동)
      ctx.save();
      const sx = 1 - pullNorm * 0.07 + cart.recoil * 0.14;
      const sy = 1 + pullNorm * 0.05 - cart.recoil * 0.12;
      ctx.scale(sx, sy);

      let inGameCheekDx = 0;
      let inGameCheekDy = 0;
      if (isCurrent && (phase === 'AIM' || cart.recoil > 0.02)) {
        const rad = (cart.aimElevation * Math.PI) / 180;
        const pullPx = (8 + (cart.aimPower / 100) * 24) * (1 - Math.min(1, cart.recoil * 1.15));
        const snap = cart.recoil > 0 ? Math.sin(cart.recoil * Math.PI * 4) * 7 : 0;
        inGameCheekDx = -Math.cos(rad * 0.65) * (pullPx - snap);
        inGameCheekDy = Math.sin(rad * 0.65) * (pullPx - snap);
      }

      drawWarpedSprite3D(
        ctx,
        sprite3d.img,
        -29,
        -56 + idleBob * 0.5 - walkHop,
        58,
        -8,
        headY + 2,
        inGameCheekDx,
        inGameCheekDy,
        15,
        10
      );
      ctx.restore();
    } else {
      // 1) 캐릭터별 고유 꼬리 (카트 없이 직접 서 있는 아기 동물)
    const outfit = cart.spec.outfit;
    if (['overalls', 'leaf_ribbon', 'saturn_band', 'fairy_wings'].includes(outfit)) {
      ctx.save();
      ctx.translate(-11, -9 + idleBob * 0.4);
      ctx.rotate(-0.15 + Math.sin(frameCount * 0.12) * 0.14);
      ctx.strokeStyle = cart.spec.secondaryColor;
      ctx.lineWidth = 6.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-13, -3, -15, -16);
      ctx.stroke();
      ctx.strokeStyle = cart.spec.primaryColor;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    } else if (outfit === 'leaf_cape') {
      // 아기 다람쥐 복슬 꼬리
      ctx.fillStyle = '#C68B59';
      ctx.strokeStyle = '#5C3A21';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-15, -16, 8, 12, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // 동글동글 아기 솜방울 꼬리
      ctx.fillStyle = cart.spec.primaryColor;
      ctx.strokeStyle = cart.spec.secondaryColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-13, -8, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2) 아장아장 걷는 두 다리 & 젤리 발바닥 (카트/바퀴 완전 제거!)
    for (const [lx, lift] of [[-6, stepL], [6, stepR]]) {
      ctx.fillStyle = cart.spec.primaryColor;
      ctx.strokeStyle = cart.spec.secondaryColor;
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.ellipse(lx, -3.5 - lift, 4.6, 5.0, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 발바닥 분홍 젤리 포인트
      ctx.fillStyle = '#FBCFE8';
      ctx.beginPath();
      ctx.arc(lx + 1, -2.5 - lift, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) 1.8등신 벨벳 물방울 몸통 + 의상 디테일
    ctx.fillStyle = cart.spec.primaryColor;
    ctx.strokeStyle = cart.spec.secondaryColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, -12 + idleBob * 0.4, 12.5, 10.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (outfit === 'bee') {
      // 꿀벌 줄무늬
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-10, -14, 20, 3.5);
      ctx.fillRect(-9, -8, 18, 3);
    } else if (outfit === 'overalls') {
      ctx.fillStyle = '#60A5FA';
      ctx.strokeStyle = '#1E3A8A';
      ctx.lineWidth = 1.6;
      this.roundRect(ctx, -9, -15, 18, 10, 3);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'sky_apron') {
      ctx.fillStyle = '#BAE6FD';
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, -8, -15, 16, 10, 3);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'rainbow_scarf') {
      ctx.fillStyle = '#F43F5E';
      this.roundRect(ctx, -10, -19, 20, 4.5, 2);
      ctx.fill();
    } else if (outfit === 'carrot_vest') {
      ctx.fillStyle = '#FDE68A';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, -8, -16, 16, 10, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(3, -11, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (outfit === 'shell_brooch') {
      ctx.fillStyle = '#E9D5FF';
      ctx.strokeStyle = '#7E22CE';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(4, -11, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'fairy_wings') {
      ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(-12, -15, 6, 3.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'gold_bell') {
      ctx.fillStyle = '#FACC15';
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(2, -15, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'check_ribbon') {
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.arc(2, -16, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4) 귀 + 머리 장식 (20종 테마 반영)
    ctx.fillStyle = cart.spec.primaryColor;
    ctx.strokeStyle = cart.spec.secondaryColor;
    ctx.lineWidth = 2.2;

    if (['overalls', 'saturn_band', 'leaf_ribbon', 'fairy_wings'].includes(outfit)) {
      // 뾰족 고양이/여우 귀 (별사탕 사막여우는 더 큰 귀)
      const earH = outfit === 'fairy_wings' ? 23 : 19;
      ctx.beginPath();
      ctx.moveTo(-11, headY - 6);
      ctx.lineTo(-10, headY - earH);
      ctx.lineTo(-2, headY - 11);
      ctx.moveTo(2, headY - 11);
      ctx.lineTo(10, headY - earH);
      ctx.lineTo(11, headY - 6);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'carrot_vest' || outfit === 'berry_beret') {
      // 토끼 긴 귀
      ctx.beginPath();
      ctx.ellipse(-9, headY - 12, 4.5, 11, -0.2, 0, Math.PI * 2);
      ctx.ellipse(7, headY - 12, 4.5, 11, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'melon_hood') {
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(-6, headY - 14, 3.5, 0, Math.PI * 2);
      ctx.arc(0, headY - 16, 3.8, 0, Math.PI * 2);
      ctx.arc(6, headY - 14, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-10, headY - 10, 5.8, 0, Math.PI * 2);
      ctx.arc(8, headY - 10, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 얼굴 본체 (1.8등신 큰 물방울 머리)
    ctx.fillStyle = cart.spec.primaryColor;
    ctx.strokeStyle = cart.spec.secondaryColor;
    ctx.lineWidth = 2.3;
    ctx.beginPath();
    ctx.ellipse(0, headY, 15.5, 13.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 머리 위 포인트 아이템 (푸딩 베레모, 딸기 베레모, 밀짚모자, 토성 머리띠, 화관, 체리핀)
    if (outfit === 'beret') {
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.ellipse(0, headY - 12, 12, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (outfit === 'berry_beret') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.ellipse(3, headY - 12, 9, 5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (outfit === 'straw_hat') {
      ctx.fillStyle = '#FDE047';
      ctx.strokeStyle = '#A16207';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, headY - 12, 13, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (outfit === 'cherry_pin') {
      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(6, headY - 12, 3, 0, Math.PI * 2);
      ctx.arc(10, headY - 11, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (outfit === 'flower_crown') {
      for (const [fx, fc] of [[-7, '#F472B6'], [0, '#FDE047'], [7, '#C084FC']]) {
        ctx.fillStyle = fc;
        ctx.beginPath();
        ctx.arc(fx, headY - 12, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (outfit === 'saturn_band') {
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, headY - 13, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 코 & 눈
    ctx.fillStyle = '#4A2C2A';
    ctx.beginPath();
    ctx.ellipse(5.5, headY + 0.5, 2.0, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawAnimalFace(ctx, cart.mood, headY, frameCount + cart.slotIndex * 31);
    }

    // 5) 투명 젤리 코어(Jelly-Core) 볼살에 탄환 넣고 쭈욱 잡아당겨 쏘기!
    const showActiveCheek = isCurrent && (phase === 'AIM' || cart.recoil > 0.02);
    if (showActiveCheek) {
      const rad = (cart.aimElevation * Math.PI) / 180;
      const stretchRatio = Math.max(0.15, cart.aimPower / 100);
      const isPulling = phase === 'AIM' && stretchRatio > 0.22;
      const pinchOut = (11 + stretchRatio * 34) * (1 - Math.min(1, cart.recoil * 1.15));
      const cheekSnap = cart.recoil > 0 ? Math.sin(cart.recoil * Math.PI * 4) * 9 : 0;
      const tipX = -pinchOut - 5 + cheekSnap;

      ctx.save();
      ctx.translate(4, headY + 3);
      ctx.rotate(-rad * 0.65);

      // 5-1) 볼 안에 쏙 들어간 탄환 구슬 (반투명 젤리 외피보다 먼저 그려서 볼 속에 들어간 입체감!)
      const activeShell = SHELLS[cart.selectedShell] || SHELLS.ACORN_SPLIT;
      const bulletColor = cart.useUltimate ? '#F97316' : activeShell.color || '#FACC15';
      if (cart.recoil < 0.15) {
        const bGrad = ctx.createRadialGradient(tipX - 2, -2, 1, tipX, 0, 6.2);
        bGrad.addColorStop(0, '#FFFFFF');
        bGrad.addColorStop(0.4, bulletColor);
        bGrad.addColorStop(1, '#1E293B');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(tipX, 0, 5.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5-2) 반투명 3D 젤리 볼살 주머니 (탄환을 감싸고 뒤로 쭈욱 늘어나는 탄성 젤리!)
      const jGrad = ctx.createLinearGradient(6, -8, tipX - 8, 8);
      jGrad.addColorStop(0, 'rgba(255, 209, 226, 0.55)');
      jGrad.addColorStop(0.55, 'rgba(255, 228, 240, 0.68)');
      jGrad.addColorStop(1, 'rgba(251, 113, 133, 0.58)');
      ctx.fillStyle = jGrad;
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(5, -6.5);
      ctx.quadraticCurveTo(tipX * 0.45, -2.8, tipX, -7.8);
      ctx.arc(tipX, 0, 8.2, -Math.PI * 0.5, Math.PI * 0.5, true);
      ctx.quadraticCurveTo(tipX * 0.45, 3.2, 5, 8.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 5-3) 젤리 볼살 고광택 유리 하이라이트 (볼 속에 탄환이 비쳐 보이는 느낌!)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.beginPath();
      ctx.ellipse(tipX * 0.52, -2.8, 5 + stretchRatio * 5, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(tipX - 2.5, -3.5, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 5-4) 당기는 탄성 장력선
      if (isPulling) {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.85)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.lineTo(tipX + 6, 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5-5) 볼살 끝을 꼬집어 당기는 손(앞발)
      ctx.fillStyle = cart.spec.primaryColor;
      ctx.strokeStyle = cart.spec.secondaryColor;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(tipX - 6, isPulling ? 4.5 : 3.5, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 5-6) 발사 순간 '탱!' 반동 젤리 팝 링
      if (cart.recoil > 0.35) {
        ctx.strokeStyle = `rgba(251, 113, 133, ${cart.recoil})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(4, 0, (1 - cart.recoil) * 26 + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6) 쎄게 당길 때(파워 65% 이상)만 나타나는 '으으으!' 힘주는 표정 오버레이 (살살 당길 땐 표정 변화 없음!)
    if (isHardPull && sprite3d.loaded) {
      ctx.save();
      const eyeY = headY - 2;
      // 기존 눈 위에 꽉 감은 '> <' 힘주는 눈 + 찌푸린 눈썹
      ctx.fillStyle = 'rgba(254, 243, 199, 0.72)';
      ctx.beginPath();
      ctx.arc(-6.5, eyeY, 3.6, 0, Math.PI * 2);
      ctx.arc(7.5, eyeY, 3.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 왼쪽 '>'
      ctx.beginPath();
      ctx.moveTo(-8.5, eyeY - 2.3);
      ctx.lineTo(-5.0, eyeY);
      ctx.lineTo(-8.5, eyeY + 2.3);
      ctx.stroke();
      // 오른쪽 '<'
      ctx.beginPath();
      ctx.moveTo(9.5, eyeY - 2.3);
      ctx.lineTo(6.0, eyeY);
      ctx.lineTo(9.5, eyeY + 2.3);
      ctx.stroke();

      // 이마 땀방울 💧 + 힘줄 💢
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.arc(13, headY - 12 + Math.sin(frameCount * 0.3) * 1.2, 2.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FB7185';
      ctx.lineWidth = 1.6;
      const sx = -13;
      const sy = headY - 14;
      ctx.beginPath();
      ctx.moveTo(sx - 2, sy - 2);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx - 2, sy + 2);
      ctx.moveTo(sx + 3, sy - 2);
      ctx.lineTo(sx + 1, sy);
      ctx.lineTo(sx + 3, sy + 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore(); // scale 복구
    ctx.restore(); // tilt 복구

    // 5) 캐릭터 하단 체력바 · 궁극기 게이지 · 이름표
    // 5) 캐릭터 하단 간략 체력바 (상단·하단 메뉴에 상세 정보가 있으므로 전장은 깔끔하고 컴팩트하게!)
    const barW = 40;
    const barH = 5;
    const barY = 9;
    const hpRatio = Math.max(0, cart.hp / cart.maxHp);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    this.roundRect(ctx, -barW / 2 - 1, barY - 1, barW + 2, barH + 2, 3);
    ctx.fill();

    ctx.fillStyle = hpRatio > 0.5 ? '#22C55E' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444';
    if (hpRatio > 0) {
      this.roundRect(ctx, -barW / 2, barY, barW * hpRatio, barH, 2.5);
      ctx.fill();
    }

    ctx.font = 'bold 10.5px "Pretendard", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.lineWidth = 2.6;
    const shortName = cart.spec?.name || cart.displayName;
    const tag = `${shortName} ${cart.hp}`;
    ctx.strokeText(tag, 0, barY + 17);
    ctx.fillText(tag, 0, barY + 17);

    ctx.restore();
  }

  drawAnimalFace(ctx, mood, headY, blinkTick = 0) {
    ctx.strokeStyle = '#1E293B';
    ctx.fillStyle = '#1E293B';
    ctx.lineWidth = 2;

    if (mood === 'hurt') {
      // > < 찡그린 눈
      ctx.beginPath();
      ctx.moveTo(0, headY - 4);
      ctx.lineTo(4, headY - 1);
      ctx.lineTo(0, headY + 2);
      ctx.stroke();
    } else if (mood === 'panic') {
      // 동그란 놀란 눈 + 식은땀 방울
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(3.5, headY - 2, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(4.5, headY - 2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(-9, headY - 4, 2.5, 4.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (mood === 'happy' || blinkTick % 190 > 183) {
      // ^ ^ 웃는 눈 또는 자연스러운 눈 깜빡임
      ctx.beginPath();
      ctx.arc(3.5, headY - 1, 3.6, Math.PI, 0);
      ctx.stroke();
    } else {
      // 초롱초롱 큰 눈 + 반짝이는 하이라이트
      ctx.beginPath();
      ctx.arc(3.8, headY - 2, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(4.8, headY - 3.2, 1.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * 캐릭터 주변 독창적인 플로팅 다이얼 & 스프링 드래그 가이드 렌더링
   */
  drawFloatingAimHUD(ctx, cart, wind, weather, dragState) {
    const muzzle = cart.getMuzzlePosition();
    const ringR = 58;

    ctx.save();
    // 1) 반투명 고각 다이얼 아크
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    if (cart.facing === 1) {
      ctx.arc(muzzle.baseX, muzzle.baseY, ringR, -Math.PI * 0.48, -0.06);
    } else {
      ctx.arc(muzzle.baseX, muzzle.baseY, ringR, -Math.PI + 0.06, -Math.PI * 0.52);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 2) 이전 턴 발사 각도 기억 마커 (영점 보정 보조)
    if (cart.lastElevation !== null) {
      const prevRad = (cart.lastElevation * Math.PI) / 180;
      const px = muzzle.baseX + cart.facing * Math.cos(prevRad) * ringR;
      const py = muzzle.baseY - Math.sin(prevRad) * ringR;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3) 슬링 드래그 중일 때 스프링 당김 밴드 시각화
    if (dragState && dragState.active) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(muzzle.baseX, muzzle.baseY);
      ctx.lineTo(dragState.currentX, dragState.currentY);
      ctx.stroke();

      ctx.fillStyle = '#FEF08A';
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(dragState.currentX, dragState.currentY, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 4) 초반 26% 구간 가이드 점선 궤적 (역풍 감속 및 비 사거리 단축 반영)
    const { vx: ivx, vy: ivy } = cart.getLaunchVelocity();
    const shellSpec = SHELLS[cart.selectedShell] || SHELLS.ACORN_SPLIT;
    const isRain = weather === 'RAIN';
    let sx = muzzle.x;
    let sy = muzzle.y;
    let svx = ivx;
    let svy = ivy;
    const windAx = wind * WORLD.WIND_SCALE * shellSpec.windFactor;
    const grav = WORLD.GRAVITY * (isRain ? WORLD.RAIN_GRAVITY_MULT : 1.0);

    for (let step = 1; step <= 20; step++) {
      svx += windAx;
      if (svx * wind < 0) {
        svx *= Math.max(0.85, 1 - Math.abs(wind) * WORLD.HEADWIND_DRAG * shellSpec.windFactor);
      }
      if (isRain) {
        svx *= WORLD.RAIN_DRAG;
        svy *= WORLD.RAIN_DRAG;
      }
      svy += grav;
      sx += svx;
      sy += svy;
      if (step % 2 === 0) {
        const alpha = Math.max(0.12, 0.9 - step / 22);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.strokeStyle = `rgba(30, 41, 59, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 4.2 - step * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  drawProjectile(ctx, proj, frameCount) {
    // 연기 궤적
    for (let i = 0; i < proj.trail.length; i++) {
      const pt = proj.trail[i];
      const ratio = (i + 1) / proj.trail.length;
      ctx.fillStyle = proj.isUltimate
        ? `rgba(251, 146, 60, ${ratio * 0.72})`
        : proj.isHeavySkill
          ? `rgba(250, 204, 21, ${ratio * 0.65})`
          : proj.drillActive
            ? `rgba(56, 189, 248, ${ratio * 0.55})`
            : `rgba(255, 255, 255, ${ratio * 0.55})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (proj.isUltimate ? 4.5 : 2.5) + ratio * 4.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 볼살에서 뾱! 발사된 슈팅 젤리 미사일 본체 — 비행 방향을 향해 꼬리 불꽃과 함께 날아감!
    ctx.save();
    ctx.translate(proj.x, proj.y);
    const flightAngle = Math.atan2(proj.vy, proj.vx);
    ctx.rotate(proj.reverseSpin ? proj.rotation : flightAngle);

    const sc = proj.isUltimate ? 1.5 : proj.isSubShell ? 0.8 : proj.isHeavySkill ? 1.25 : 1.05;
    ctx.scale(sc, sc);

    // 미사일 추진 불꽃 / 젤리 꼬리
    const flameLen = 11 + Math.sin(frameCount * 0.8) * 3.5;
    ctx.fillStyle = proj.isUltimate ? '#F97316' : '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.lineTo(-6 - flameLen, 0);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();

    // 유선형 젤리 미사일 탄두
    ctx.fillStyle = proj.isUltimate ? '#F97316' : proj.spec.color;
    ctx.strokeStyle = proj.isUltimate ? '#FEF08A' : '#1E293B';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(2, 0, 12, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 말랑 젤리 광택 하이라이트
    ctx.fillStyle = proj.spec.coreColor;
    ctx.beginPath();
    ctx.ellipse(3, -3, 5.5, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 에어 트리거 가능 상태일 때 반짝이는 링 표시
    if (proj.canAirTrigger()) {
      const pulseR = 15 + Math.sin(frameCount * 0.35) * 2.5;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawParticlesAndShockwaves(ctx, particles, shockwaves) {
    for (const sw of shockwaves) {
      ctx.save();
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, sw.alpha);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      if (pt.square) {
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawCloudSea(ctx, frameCount) {
    const seaY = WORLD.SEA_LEVEL;

    // 뒷단 연보라 구름층
    ctx.fillStyle = 'rgba(224, 231, 255, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT);
    for (let x = -20; x <= WORLD.WIDTH + 40; x += 55) {
      const cy = seaY + 8 + Math.sin(frameCount * 0.03 + x * 0.02) * 5;
      ctx.arc(x, cy, 38, Math.PI, 0, false);
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();

    // 앞단 새하얀 폭신 구름 바다
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT);
    for (let x = 0; x <= WORLD.WIDTH + 50; x += 48) {
      const cy = seaY + 22 + Math.cos(frameCount * 0.035 + x * 0.025) * 4;
      ctx.arc(x, cy, 34, Math.PI, 0, false);
    }
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  drawPityCutin(ctx, pityCutin, frameCount) {
    const cart = pityCutin.cart;
    const progress = pityCutin.life / pityCutin.maxLife;
    const alpha = Math.min(1, progress * 3.5);
    const wobble = Math.sin(frameCount * 0.45) * 2.2;

    // 화면 좌측 상단/중앙에 둥근 컷인 버블로 주인을 뚫어져라 쳐다보는 대왕 얼굴 확대!
    const cx = 170;
    const cy = 225;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx + wobble * 0.5, cy + Math.sin(frameCount * 0.25) * 2);

    // 말랑한 컷인 원형 프레임
    ctx.fillStyle = 'rgba(255, 251, 235, 0.94)';
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 확대된 정면 귀
    ctx.fillStyle = cart.spec.primaryColor;
    ctx.strokeStyle = cart.spec.secondaryColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-32, -36, 16, 0, Math.PI * 2);
    ctx.arc(32, -36, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 확대된 정면 얼굴 (주인 쳐다보는 구도)
    ctx.beginPath();
    ctx.ellipse(0, 2, 46, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 크림색 정면 볼 패치
    ctx.fillStyle = cart.spec.id === 'PPUKKU' ? '#EFF6FF' : '#FEF3C7';
    ctx.beginPath();
    ctx.ellipse(0, 16, 33, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 팔자 눈썹 (축 처진 불쌍한 눈썹)
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, -15);
    ctx.lineTo(-10, -21);
    ctx.moveTo(26, -15);
    ctx.lineTo(10, -21);
    ctx.stroke();

    // 정면을 쳐다보는 커다란 글썽글썽 눈망울 + 눈물 그렁그렁
    for (const ex of [-17, 17]) {
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(ex, -4, 9.5, 0, Math.PI * 2);
      ctx.fill();

      // 큰 흰색 반짝임 + 흔들리는 눈물 반짝임
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 2.5, -7, 3.8, 0, Math.PI * 2);
      ctx.arc(ex + 2.5, -0.5, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // 고인 눈물방울 (반짝반짝 흘러내림)
      const tearY = 6 + ((frameCount * 0.4) % 10);
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(ex + (ex < 0 ? -4 : 4), tearY, 3.5, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 오물오물 떨리는 울상 입 ('ㅅ' 모양)
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-7, 15 + wobble * 0.3);
    ctx.quadraticCurveTo(-3, 9, 0, 13);
    ctx.quadraticCurveTo(3, 9, 7, 15 + wobble * 0.3);
    ctx.stroke();

    // 볼 위 귀여운 십자 반창고
    ctx.save();
    ctx.translate(27, 11);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#FED7AA';
    ctx.strokeStyle = '#EA580C';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, -9, -4.5, 18, 9, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 하단 말풍선 대사 ("주인님... 아파요 ㅠㅅㅠ")
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 2.5;
    this.roundRect(ctx, -84, 58, 168, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 13.5px "Jua", "Pretendard", sans-serif';
    ctx.fillStyle = '#9F1239';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('주인님... 아파요 ㅠㅅㅠ', 0, 72);

    ctx.restore();
  }

  drawFloatingTexts(ctx, texts) {
    for (const ft of texts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.life / 24);
      ctx.font = `800 ${ft.size || 18}px "Pretendard", "Malgun Gothic", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color || '#FDE047';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}

/**
 * 3D 벨벳 스퀴시 피규어 스타일 전신 렌더러 (로비 카드 & 대형 전신 프리뷰 공용)
 * 보송한 매트 벨벳 그라데이션 + 림 라이트 + 고광택 투명 젤리 코어 볼살 + 젤리 발바닥 전신
 */
export function drawSpiritAvatar(canvas, spec, isLargePreview = false) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const sprite3d = getCharSprite(spec.id, () => drawSpiritAvatar(canvas, spec, isLargePreview));
  if (sprite3d.loaded) {
    ctx.save();
    // 3D 피규어 바닥 스튜디오 접촉 그림자
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.9, w * 0.28, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();

    const pad = isLargePreview ? 4 : 3;
    const size = Math.min(w - pad * 2, h - pad * 2);
    const dx = (w - size) * 0.5;
    const dy = h - size - pad;
    ctx.drawImage(sprite3d.img, dx, dy, size, size);
    ctx.restore();
    return;
  }

  ctx.save();
  const baseScale = isLargePreview ? 2.45 : 1.05;
  ctx.translate(w * 0.5, h * (isLargePreview ? 0.72 : 0.74));
  ctx.scale(baseScale, baseScale);

  const outfit = spec.outfit;
  const bodyColor = spec.primaryColor;
  const strokeColor = spec.secondaryColor;

  // 3D 벨벳 입체 그라데이션 헬퍼
  const makeVelvetGrad = (cx, cy, r) => {
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.28, bodyColor);
    g.addColorStop(0.88, bodyColor);
    g.addColorStop(1, 'rgba(74, 44, 42, 0.28)');
    return g;
  };

  // 0) 바닥 부드러운 3D 접촉 그림자
  ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 16, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 1) 두 발 (젤리 발바닥 포함 전신 하체)
  for (const lx of [-7, 7]) {
    ctx.fillStyle = makeVelvetGrad(lx, 7, 6.5);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(lx, 7.5, 5.2, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 발바닥 분홍 젤리 패드
    ctx.fillStyle = '#FBCFE8';
    ctx.beginPath();
    ctx.arc(lx, 8.2, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2) 통통한 1.8등신 벨벳 물방울 몸통 + 의상
  ctx.fillStyle = makeVelvetGrad(0, -3, 15);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(0, -3, 13.5, 11.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (outfit === 'bee') {
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-10, -5, 20, 3.2);
    ctx.fillRect(-9, 1, 18, 2.8);
  } else if (outfit === 'overalls') {
    ctx.fillStyle = '#60A5FA';
    ctx.strokeStyle = '#1E3A8A';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-9.5, -5, 19, 11, 4);
    ctx.fill();
    ctx.stroke();
  } else if (outfit === 'sky_apron') {
    ctx.fillStyle = '#BAE6FD';
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-8.5, -5, 17, 10, 4);
    ctx.fill();
    ctx.stroke();
  } else if (outfit === 'carrot_vest') {
    ctx.fillStyle = '#FDE68A';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-8.5, -6, 17, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(3.5, -1, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'shell_brooch') {
    ctx.fillStyle = '#E9D5FF';
    ctx.beginPath();
    ctx.arc(3.5, -1, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'rainbow_scarf') {
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.roundRect(-10, -10, 20, 4.5, 2);
    ctx.fill();
  } else if (outfit === 'gold_bell') {
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, -6, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'check_ribbon') {
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.arc(0, -7, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3) 귀 (전신 비율 머리 기준 headY = -20)
  const headY = -20;
  ctx.fillStyle = makeVelvetGrad(0, headY - 12, 10);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.8;
  if (['overalls', 'saturn_band', 'leaf_ribbon', 'fairy_wings'].includes(outfit)) {
    const earH = outfit === 'fairy_wings' ? 22 : 18;
    ctx.beginPath();
    ctx.moveTo(-10, headY - 5);
    ctx.lineTo(-9, headY - earH);
    ctx.lineTo(-2, headY - 10);
    ctx.moveTo(2, headY - 10);
    ctx.lineTo(9, headY - earH);
    ctx.lineTo(10, headY - 5);
    ctx.fill();
    ctx.stroke();
  } else if (outfit === 'carrot_vest' || outfit === 'berry_beret') {
    ctx.beginPath();
    ctx.ellipse(-9, headY - 11, 4.2, 10, -0.2, 0, Math.PI * 2);
    ctx.ellipse(9, headY - 11, 4.2, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (outfit === 'melon_hood') {
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(-5, headY - 13, 3.2, 0, Math.PI * 2);
    ctx.arc(0, headY - 15, 3.5, 0, Math.PI * 2);
    ctx.arc(5, headY - 13, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-9.5, headY - 9, 5.2, 0, Math.PI * 2);
    ctx.arc(9.5, headY - 9, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 4) 3D 벨벳 물방울 머리
  ctx.fillStyle = makeVelvetGrad(0, headY, 16);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.ellipse(0, headY, 14.8, 12.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 모자/장식
  if (outfit === 'beret') {
    ctx.fillStyle = '#78350F';
    ctx.beginPath();
    ctx.ellipse(0, headY - 11, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'berry_beret') {
    ctx.fillStyle = '#FB7185';
    ctx.beginPath();
    ctx.ellipse(3, headY - 11, 8, 4.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'straw_hat') {
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.ellipse(0, headY - 11, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'cherry_pin') {
    ctx.fillStyle = '#E11D48';
    ctx.beginPath();
    ctx.arc(5, headY - 11, 2.8, 0, Math.PI * 2);
    ctx.arc(9, headY - 10, 2.8, 0, Math.PI * 2);
    ctx.fill();
  } else if (outfit === 'flower_crown') {
    for (const [fx, fc] of [[-6, '#F472B6'], [0, '#FDE047'], [6, '#C084FC']]) {
      ctx.fillStyle = fc;
      ctx.beginPath();
      ctx.arc(fx, headY - 11, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5) 3D 반짝 눈 & 오물오물 입
  for (const ex of [-5, 5]) {
    ctx.fillStyle = '#2A1810';
    ctx.beginPath();
    ctx.arc(ex, headY - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ex - 0.7, headY - 1.8, 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#FB7185';
  ctx.beginPath();
  ctx.ellipse(0, headY + 2.5, 2.2, 1.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 6) 고광택 투명 젤리 코어(Jelly-Core) 볼살 + 양손으로 볼 받침/꼬집기 포즈
  for (const [bx, dir] of [[-9.5, -1], [9.5, 1]]) {
    const jGrad = ctx.createRadialGradient(bx - 1.5, headY + 2, 0.8, bx, headY + 3.5, 6);
    jGrad.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
    jGrad.addColorStop(0.55, 'rgba(255, 200, 220, 0.78)');
    jGrad.addColorStop(1, 'rgba(251, 113, 133, 0.88)');

    ctx.fillStyle = jGrad;
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(bx, headY + 3.5, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 젤리 내부 코어 반짝이 (별/타피오카/딸기)
    ctx.fillStyle = spec.jellyCore === 'boba' ? '#3B1D0A' : '#FEF08A';
    ctx.beginPath();
    ctx.arc(bx + dir * 0.8, headY + 4, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // 유리 광택 하이라이트
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(bx - 1.6, headY + 1.5, 1.8, 0.9, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // 볼 아래로 올라와 볼을 꼬집어 받치고 있는 통통 앞발
    ctx.fillStyle = makeVelvetGrad(bx + dir * 2.5, headY + 9, 4.5);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx + dir * 2.2, headY + 9, 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 내 턴이 아닐 때 캐릭터 터치 시 열리는 돋보기 확대 & 애교·볼꼬집기 교감 렌더러
 */
export function drawPetMagnifierFrame(canvas, spec, petState) {
  if (!canvas || !spec) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const t = petState.frame || 0;
  const pullMag = Math.hypot(petState.dx, petState.dy);
  const isLaughing = petState.pinching || pullMag > 4 || petState.happyTimer > 0;

  ctx.save();
  // 바닥 스튜디오 그림자
  ctx.fillStyle = 'rgba(180, 83, 9, 0.16)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.87, 74, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 캐릭터 애교 갸우뚱 & 말랑 호흡
  const tilt = isLaughing ? Math.sin(t * 0.25) * 0.06 : Math.sin(t * 0.055) * 0.065;
  const bob = Math.sin(t * 0.08) * 3.5;
  const squashX = isLaughing ? 1 + Math.min(0.1, pullMag * 0.0015) : 1;
  const squashY = isLaughing ? 1 - Math.min(0.08, pullMag * 0.0012) : 1;

  ctx.save();
  ctx.translate(w * 0.5, h * 0.56 + bob);
  ctx.rotate(tilt);
  ctx.scale(squashX, squashY);

  const sprite3d = getCharSprite(spec.id);
  if (sprite3d.loaded) {
    const side = petState.side >= 0 ? 1 : -1;
    drawWarpedSprite3D(
      ctx,
      sprite3d.img,
      -112,
      -122,
      224,
      side * 32,
      -6,
      petState.dx * 1.65,
      petState.dy * 1.65,
      25,
      16
    );
  }

  // 표정 오버레이: 애교 반짝 눈 vs 볼 꼬집을 때 환하게 웃는 표정 (^ ◡ ^)
  const eyeY = -20;
  if (isLaughing) {
    // 실제 눈 위치(±20, -20)를 부드럽게 덮고 환한 반달 웃음눈 '^  ^' 표현
    ctx.fillStyle = 'rgba(255, 248, 236, 0.92)';
    ctx.beginPath();
    ctx.arc(-20, eyeY, 9.5, 0, Math.PI * 2);
    ctx.arc(20, eyeY, 9.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    for (const ex of [-20, 20]) {
      ctx.beginPath();
      ctx.arc(ex, eyeY + 3, 7.5, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }

    // 활짝 웃는 귀여운 입
    ctx.fillStyle = '#FB7185';
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, -8, 8.5, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 바깥쪽에서 들어와 늘어난 볼살 끝을 실제로 꼬집어 당기는 3D 손가락(엄지·검지)
    if (pullMag > 2) {
      const side = petState.side >= 0 ? 1 : -1;
      const fx = side * 32 + petState.dx * 1.55;
      const fy = -6 + petState.dy * 1.55;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.atan2(petState.dy, petState.dx || side));

      const fGrad = ctx.createLinearGradient(0, -10, 28, 10);
      fGrad.addColorStop(0, '#FED7AA');
      fGrad.addColorStop(0.6, '#FDBA74');
      fGrad.addColorStop(1, '#FB923C');
      ctx.fillStyle = fGrad;
      ctx.strokeStyle = 'rgba(154, 52, 18, 0.55)';
      ctx.lineWidth = 1.6;

      // 검지 (위쪽에서 볼을 집음)
      ctx.beginPath();
      ctx.ellipse(14, -7, 14, 5.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 엄지 (아래쪽에서 볼을 집음)
      ctx.beginPath();
      ctx.ellipse(14, 7, 14, 5.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // 주인 보며 애교부리는 반짝반짝 별빛 눈동자 + 발그레 볼터치
    for (const ex of [-20, 20]) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - 2, eyeY - 2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(ex + 2, eyeY + 2, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  // 둥실둥실 떠오르는 애교/웃음 하트·음표 파티클
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  const icons = isLaughing ? ['💖', '♪', '✨', '💕'] : ['💕', '✨'];
  icons.forEach((ic, idx) => {
    const phase = (t * 0.025 + idx * 0.35) % 1;
    const ix = w * (0.22 + idx * 0.19) + Math.sin(t * 0.06 + idx) * 10;
    const iy = h * 0.34 - phase * 64;
    ctx.globalAlpha = Math.sin(phase * Math.PI);
    ctx.fillText(ic, ix, iy);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}
