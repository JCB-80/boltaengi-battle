// 볼탱이 대전 — 서버 권위형 물리 · 턴제 · 실물 빵 마스크 시뮬레이션 엔진
import fs from 'node:fs';
import Matter from 'matter-js';
import { CHARACTERS, SHELLS, WORLD } from './src/config.js';

const MASKS_JSON = JSON.parse(
  fs.readFileSync(new URL('./assets/maps/masks.json', import.meta.url), 'utf8')
);

export class ServerTerrain {
  constructor(mapKey = 'archipelago') {
    this.cols = Math.floor(WORLD.WIDTH / WORLD.CELL_SIZE);
    this.rows = Math.floor(WORLD.HEIGHT / WORLD.CELL_SIZE);
    this.mask = new Uint8Array(this.cols * this.rows);
    this.craters = [];
    this.nextCraterId = 1;
    this.loadMap(mapKey);
  }

  loadMap(mapKey) {
    if (MASKS_JSON[mapKey]) {
      this.mapKey = mapKey;
      this.mask.fill(0);
      const buf = Buffer.from(MASKS_JSON[mapKey], 'base64');
      const total = this.cols * this.rows;
      if (buf.length * 8 === total) {
        for (let i = 0; i < total; i++) {
          const byte = buf[i >> 3];
          const bit = 7 - (i & 7);
          this.mask[i] = (byte >> bit) & 1;
        }
      } else if (buf.length * 8 === 400 * 225) {
        // 400x225 (CELL_SIZE=4) 마스크를 현재 800x450 (CELL_SIZE=2) 격자로 업스케일 매핑
        const srcCols = 400;
        const srcRows = 225;
        const scaleX = this.cols / srcCols;
        const scaleY = this.rows / srcRows;
        for (let sy = 0; sy < srcRows; sy++) {
          for (let sx = 0; sx < srcCols; sx++) {
            const idx = sy * srcCols + sx;
            const val = (buf[idx >> 3] >> (7 - (idx & 7))) & 1;
            if (!val) continue;
            const gx0 = Math.floor(sx * scaleX);
            const gx1 = Math.min(this.cols, Math.ceil((sx + 1) * scaleX));
            const gy0 = Math.floor(sy * scaleY);
            const gy1 = Math.min(this.rows, Math.ceil((sy + 1) * scaleY));
            for (let gy = gy0; gy < gy1; gy++) {
              for (let gx = gx0; gx < gx1; gx++) {
                this.mask[gy * this.cols + gx] = 1;
              }
            }
          }
        }
      }
      return;
    }

    // 절차적 신규 4종 맵 서버 충돌 마스크 생성
    this.mapKey = mapKey;
    this.mask.fill(0);
    for (let gx = 0; gx < this.cols; gx++) {
      const wx = gx * WORLD.CELL_SIZE;
      const nx = wx / WORLD.WIDTH;
      if (wx < 75 || wx > WORLD.WIDTH - 75) continue;
      if (mapKey === 'honey_waffle' && nx > 0.44 && nx < 0.56) continue;
      if (mapKey === 'blueberry_tart' && ((nx > 0.31 && nx < 0.38) || (nx > 0.62 && nx < 0.69))) continue;

      let surfaceY = 560;
      let underY = 765;
      if (mapKey === 'honey_waffle') {
        const leftPeak = Math.exp(-Math.pow((nx - 0.25) / 0.13, 2)) * 105;
        const rightPeak = Math.exp(-Math.pow((nx - 0.75) / 0.13, 2)) * 115;
        surfaceY = 585 - leftPeak - rightPeak + Math.sin(nx * 14) * 14;
      } else if (mapKey === 'blueberry_tart') {
        const midIsland = Math.exp(-Math.pow((nx - 0.5) / 0.08, 2)) * 115;
        const sideL = Math.exp(-Math.pow((nx - 0.19) / 0.09, 2)) * 65;
        const sideR = Math.exp(-Math.pow((nx - 0.81) / 0.09, 2)) * 75;
        surfaceY = 580 - midIsland - sideL - sideR;
      } else if (mapKey === 'matcha_cliff') {
        const step = nx < 0.35 ? 0 : nx < 0.65 ? -85 : -155;
        surfaceY = 635 + step + Math.sin(nx * 16) * 14;
        underY = 785 + step * 0.25;
      } else {
        // melon_soda
        const h1 = Math.exp(-Math.pow((nx - 0.24) / 0.13, 2)) * 75;
        const h2 = Math.exp(-Math.pow((nx - 0.5) / 0.14, 2)) * 95;
        const h3 = Math.exp(-Math.pow((nx - 0.76) / 0.13, 2)) * 85;
        surfaceY = 615 - h1 - h2 - h3 + Math.sin(nx * Math.PI * 4) * 12;
      }

      const topGy = Math.max(0, Math.floor(surfaceY / WORLD.CELL_SIZE));
      const botGy = Math.min(this.rows - 1, Math.floor(underY / WORLD.CELL_SIZE));
      for (let gy = topGy; gy <= botGy; gy++) {
        this.mask[gy * this.cols + gx] = 1;
      }
    }
  }

  isSolid(wx, wy) {
    if (wx < 0 || wx >= WORLD.WIDTH || wy < 0 || wy >= WORLD.HEIGHT) return false;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const gy = Math.floor(wy / WORLD.CELL_SIZE);
    return this.mask[gy * this.cols + gx] === 1;
  }

  findTopSurface(wx, minY = 265) {
    if (wx < 10 || wx >= WORLD.WIDTH - 10) return null;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const startGy = Math.max(0, Math.floor(minY / WORLD.CELL_SIZE));
    for (let gy = startGy; gy < this.rows; gy++) {
      if (this.mask[gy * this.cols + gx] === 1) {
        return gy * WORLD.CELL_SIZE;
      }
    }
    return null;
  }

  findSafeSpawnX(preferredX) {
    if (this.findTopSurface(preferredX) !== null) return preferredX;
    for (let offset = 12; offset < 460; offset += 12) {
      if (preferredX - offset > 100 && this.findTopSurface(preferredX - offset) !== null) {
        return preferredX - offset;
      }
      if (preferredX + offset < WORLD.WIDTH - 100 && this.findTopSurface(preferredX + offset) !== null) {
        return preferredX + offset;
      }
    }
    return preferredX;
  }

  findSurfaceNear(wx, refY, maxClimb = 24, maxStepDown = 28) {
    if (wx < 10 || wx >= WORLD.WIDTH - 10) return null;
    const gx = Math.floor(wx / WORLD.CELL_SIZE);
    const startGy = Math.max(0, Math.floor((refY - maxClimb) / WORLD.CELL_SIZE));
    const endGy = Math.min(this.rows - 1, Math.floor((refY + maxStepDown) / WORLD.CELL_SIZE));
    for (let gy = startGy; gy <= endGy; gy++) {
      if (this.mask[gy * this.cols + gx] === 1) {
        if (gy === 0 || this.mask[(gy - 1) * this.cols + gx] === 0) {
          return gy * WORLD.CELL_SIZE;
        }
      }
    }
    return null;
  }

  carveCrater(cx, cy, radius) {
    const cell = WORLD.CELL_SIZE;
    const minGx = Math.max(0, Math.floor((cx - radius) / cell));
    const maxGx = Math.min(this.cols - 1, Math.ceil((cx + radius) / cell));
    const minGy = Math.max(0, Math.floor((cy - radius) / cell));
    const maxGy = Math.min(this.rows - 1, Math.ceil((cy + radius) / cell));
    const r2 = radius * radius;
    let carved = 0;
    for (let gy = minGy; gy <= maxGy; gy++) {
      const py = gy * cell + cell * 0.5;
      for (let gx = minGx; gx <= maxGx; gx++) {
        const px = gx * cell + cell * 0.5;
        if ((px - cx) ** 2 + (py - cy) ** 2 <= r2) {
          const idx = gy * this.cols + gx;
          if (this.mask[idx] === 1) {
            this.mask[idx] = 0;
            carved++;
          }
        }
      }
    }
    this.craters.push({
      id: this.nextCraterId++,
      cx: Math.round(cx),
      cy: Math.round(cy),
      r: Math.round(radius),
    });
    return carved;
  }
}

export class OnlineSimulation {
  constructor({ mapPreset = 'archipelago', players = [] } = {}) {
    const mapPool = [
      'bridge',
      'twin_peaks',
      'archipelago',
      'citadel',
      'matcha_cliff',
      'honey_waffle',
      'blueberry_tart',
      'melon_soda',
    ];
    const mapKey = mapPool.includes(mapPreset)
      ? mapPreset
      : mapPool[Math.floor(Math.random() * mapPool.length)];
    this.mapKey = mapKey;
    this.terrain = new ServerTerrain(mapKey);
    this.matterEngine = Matter.Engine.create({ enableSleeping: false });

    this.turnNumber = 1;
    this.activeSlot = 0;
    this.phase = 'AIM'; // 'AIM' | 'FLIGHT' | 'SETTLE' | 'GAME_OVER'
    this.turnTimerFrames = 20 * 60;
    this.winnerSlot = null;
    this.winnerText = '';
    this.wind = 0;
    this.weather = 'CLEAR';
    this.frameCount = 0;
    this.settleCounter = 0;

    this.projectiles = [];
    this.nextProjId = 1;
    this.fixedBoxes = [];
    this.skyBox = { active: true, x: 800, y: 145, baseY: 145, vx: 1.15, phase: 0 };
    this.tornado = { active: false, x: 0, y: 0, vx: 0, life: 0, alertFrames: 0 };

    const count = Math.max(2, Math.min(3, players.length || 2));
    this.turnOrder = Array.from({ length: count }, (_, idx) => idx);
    for (let i = this.turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
    }
    this.turnOrderIdx = 0;
    this.activeSlot = this.turnOrder[0];

    const defaults = [
      { charKey: 'M01_MOCHI', name: '1P', x: 260, facing: 1 },
      { charKey: 'M05_SODAPIN', name: '2P', x: 1340, facing: -1 },
      { charKey: 'M02_PUDDING', name: '3P', x: 800, facing: -1 },
    ];
    const spawnXs = count === 3 ? [260, 800, 1340] : [275, 1325];
    const spawnFacings = count === 3 ? [1, 1, -1] : [1, -1];

    this.carts = [];
    for (let i = 0; i < count; i++) {
      const p = players[i] || defaults[i];
      const sx = this.terrain.findSafeSpawnX(spawnXs[i]);
      this.carts.push(this._createCart(i, p, sx, spawnFacings[i]));
    }

    this._spawnFixedBoxes();
    this._rollWind();
  }

  addPlayer(info) {
    const slot = this.carts.length;
    const sx = this.terrain.findSafeSpawnX(slot === 2 ? 800 : 1340);
    const cart = this._createCart(slot, info, sx, slot === 1 ? -1 : 1);
    this.carts.push(cart);
    return cart;
  }

  _createCart(slot, info, x, facing) {
    const charKey = CHARACTERS[info.charKey] ? info.charKey : 'M01_MOCHI';
    const y = this.terrain.findTopSurface(x) ?? 500;
    return {
      id: `slot_${slot}`,
      slot,
      charKey,
      name: String(info.name || CHARACTERS[charKey].name).slice(0, 18),
      x,
      y,
      vx: 0,
      vy: 0,
      facing,
      hp: 120,
      maxHp: 120,
      fuel: 100,
      maxFuel: 100,
      aimElevation: 45,
      aimPower: 62,
      selectedShell: 'ACORN_SPLIT',
      ultGauge: 35,
      useUltimate: false,
      powerUpTurns: 0,
      recoil: 0,
      alive: true,
    };
  }

  _spawnFixedBoxes() {
    this.fixedBoxes = [];
    for (const cx of [560, 800, 1040]) {
      if (this.fixedBoxes.length >= 2) break;
      if (this.carts.some((c) => Math.abs(c.x - cx) < 130)) continue;
      const y = this.terrain.findTopSurface(cx);
      if (y === null || y > WORLD.SEA_LEVEL - 70) continue;
      this.fixedBoxes.push({ id: `box_${this.fixedBoxes.length}`, active: true, x: cx, y: y - 16 });
    }
  }

  _rollWind() {
    this.wind = Math.round((Math.random() * 14 - 7) * 10) / 10;
  }

  act(slot, action) {
    if (this.phase === 'GAME_OVER') throw new Error('GAME_OVER');
    if (slot !== this.activeSlot) throw new Error('NOT_YOUR_TURN');
    const actor = this.carts[slot];
    if (!actor || !actor.alive) throw new Error('ACTOR_DEAD');

    const type = String(action?.type || '').toUpperCase();

    if (type === 'AIR_TRIGGER') {
      if (this.phase !== 'FLIGHT') throw new Error('NOT_IN_FLIGHT');
      for (const p of this.projectiles) {
        if (p.active && !p.airTriggered) {
          p.airTriggered = true;
          if (p.shellKey === 'ACORN_SPLIT') {
            p.active = false;
            for (const offsetX of [-16, 0, 16]) {
              this.projectiles.push({
                id: this.nextProjId++,
                ownerSlot: slot,
                shellKey: p.shellKey,
                x: p.x + offsetX,
                y: p.y,
                vx: offsetX * 0.08,
                vy: 15.0,
                damage: Math.round(p.damage * 0.52),
                craterRadius: Math.round(p.craterRadius * 0.72),
                bouncesLeft: 0,
                airTriggered: true,
                active: true,
                ageFrames: 0,
                tornadoCooldown: 0,
              });
            }
          } else {
            p.vx = 0;
            p.vy = 16.5;
          }
        }
      }
      return { ok: true };
    }

    if (this.phase !== 'AIM') throw new Error('NOT_IN_AIM_PHASE');

    if (type === 'MOVE') {
      const dir = action.dir === -1 ? -1 : 1;
      if (actor.fuel <= 0) return { ok: true, moved: false };
      actor.facing = dir;
      const nextX = actor.x + dir * 3.0;
      if (nextX > 48 && nextX < WORLD.WIDTH - 48) {
        const nextY = this.terrain.findSurfaceNear(nextX, actor.y);
        if (nextY !== null) {
          actor.x = nextX;
          actor.y = nextY;
          actor.fuel = Math.max(0, actor.fuel - 1.5);
        }
      }
      return { ok: true };
    }

    if (type === 'AIM') {
      if (action.elevation !== undefined) {
        const el = Number(action.elevation);
        if (!Number.isFinite(el) || el < 5 || el > 85) throw new Error('INVALID_ANGLE');
        actor.aimElevation = Math.round(el);
      }
      if (action.power !== undefined) {
        const pw = Number(action.power);
        if (!Number.isFinite(pw) || pw < 15 || pw > 100) throw new Error('INVALID_POWER');
        actor.aimPower = Math.round(pw);
      }
      if (action.facing === 1 || action.facing === -1) {
        actor.facing = action.facing;
      }
      if (action.shellKey && SHELLS[action.shellKey]) {
        actor.selectedShell = action.shellKey;
      }
      if (typeof action.useUltimate === 'boolean') {
        actor.useUltimate = action.useUltimate && actor.ultGauge >= 100;
      }
      return { ok: true };
    }

    if (type === 'FIRE') {
      if (action.elevation !== undefined) {
        const el = Number(action.elevation);
        if (!Number.isFinite(el) || el < 5 || el > 85) throw new Error('INVALID_ANGLE');
        actor.aimElevation = Math.round(el);
      }
      if (action.power !== undefined) {
        const pw = Number(action.power);
        if (!Number.isFinite(pw) || pw < 15 || pw > 100) throw new Error('INVALID_POWER');
        actor.aimPower = Math.round(pw);
      }
      if (action.facing === 1 || action.facing === -1) actor.facing = action.facing;
      if (action.shellKey && SHELLS[action.shellKey]) actor.selectedShell = action.shellKey;

      const shell = SHELLS[actor.selectedShell] || SHELLS.ACORN_SPLIT;
      const rad = (actor.aimElevation * Math.PI) / 180;
      const speed = 5.5 + (actor.aimPower / 100) * 20.5;
      const vx = Math.cos(rad) * speed * actor.facing;
      const vy = -Math.sin(rad) * speed;
      const mult = actor.powerUpTurns > 0 ? 1.5 : 1;
      if (actor.powerUpTurns > 0) actor.powerUpTurns = 0;

      const isUlt = actor.useUltimate && actor.ultGauge >= 100;
      if (isUlt) {
        actor.ultGauge = 0;
        actor.useUltimate = false;
      }

      this.projectiles.push({
        id: this.nextProjId++,
        ownerSlot: slot,
        shellKey: actor.selectedShell,
        x: actor.x + actor.facing * 20,
        y: actor.y - 34,
        vx,
        vy,
        damage: Math.round(shell.damage * mult * (isUlt ? 1.65 : 1)),
        craterRadius: Math.round(shell.craterRadius * (isUlt ? 1.45 : 1)),
        bouncesLeft: shell.bounces || 0,
        airTriggered: isUlt,
        isUltimate: isUlt,
        active: true,
        ageFrames: 0,
        tornadoCooldown: 0,
      });

      actor.recoil = 1.0;
      this.phase = 'FLIGHT';
      return { ok: true };
    }

    throw new Error('UNKNOWN_ACTION');
  }

  tick() {
    this.frameCount++;

    for (const c of this.carts) {
      if (c.recoil > 0) c.recoil = Math.max(0, c.recoil - 0.08);
      if (!c.alive) continue;
      // 중력 안착 체크
      const below = this.terrain.findSurfaceNear(c.x, c.y, 8, 120);
      if (below !== null) {
        if (c.y < below) {
          c.vy += 0.6;
          c.y = Math.min(below, c.y + c.vy);
          if (c.y >= below) c.vy = 0;
        } else {
          c.y = below;
          c.vy = 0;
        }
      } else {
        c.vy += 0.6;
        c.y += c.vy;
        if (c.y >= WORLD.SEA_LEVEL) {
          c.hp = 0;
          c.alive = false;
        }
      }
    }

    if (this.skyBox.active) {
      this.skyBox.x += this.skyBox.vx;
      this.skyBox.phase += 0.05;
      this.skyBox.y = this.skyBox.baseY + Math.sin(this.skyBox.phase) * 16;
      if (this.skyBox.x < 240 || this.skyBox.x > WORLD.WIDTH - 240) this.skyBox.vx *= -1;
    }

    if (this.phase === 'AIM') {
      if (this.turnTimerFrames > 0) {
        this.turnTimerFrames--;
        if (this.turnTimerFrames <= 0) {
          this._advanceTurn();
          return;
        }
      }
    } else if (this.phase === 'FLIGHT') {
      let anyActive = false;
      for (const p of this.projectiles) {
        if (!p.active) continue;
        anyActive = true;
        p.ageFrames++;
        const steps = 3;
        for (let s = 0; s < steps; s++) {
          p.vx += (this.wind * 0.008) / steps;
          p.vy += (0.34 / steps);
          p.x += p.vx / steps;
          p.y += p.vy / steps;

          if (p.x < -80 || p.x > WORLD.WIDTH + 80 || p.y > WORLD.SEA_LEVEL + 40) {
            p.active = false;
            break;
          }

          // 고정 선물박스 명중 체크
          for (const box of this.fixedBoxes) {
            if (!box.active) continue;
            if (Math.hypot(p.x - box.x, p.y - box.y) <= 28) {
              box.active = false;
              const owner = this.carts[p.ownerSlot];
              if (owner && owner.alive) {
                owner.powerUpTurns = 1;
                owner.ultGauge = Math.min(100, owner.ultGauge + 25);
              }
            }
          }

          // 캐릭터 직격 체크
          let hit = false;
          for (const c of this.carts) {
            if (!c.alive) continue;
            if (p.ageFrames < 5 && c.slot === p.ownerSlot) continue;
            if (Math.hypot(p.x - c.x, p.y - (c.y - 22)) <= 24) {
              this._detonate(p.x, p.y, p.craterRadius, p.damage, p.ownerSlot);
              p.active = false;
              hit = true;
              break;
            }
          }
          if (hit) break;

          // 지형 충돌 체크
          if (this.terrain.isSolid(p.x, p.y)) {
            if (p.bouncesLeft > 0) {
              p.bouncesLeft--;
              p.vy = -Math.abs(p.vy) * 0.72;
              p.y -= 6;
            } else {
              this._detonate(p.x, p.y, p.craterRadius, p.damage, p.ownerSlot);
              p.active = false;
              break;
            }
          }
        }
      }

      if (!anyActive || !this.projectiles.some((p) => p.active)) {
        this.projectiles = [];
        this.phase = 'SETTLE';
        this.settleCounter = 24;
      }
    } else if (this.phase === 'SETTLE') {
      this.settleCounter--;
      if (this.settleCounter <= 0) {
        this._advanceTurn();
      }
    }
  }

  _detonate(cx, cy, radius, maxDamage, ownerSlot) {
    this.terrain.carveCrater(cx, cy, radius);
    const blastR = radius * 1.45;
    for (const c of this.carts) {
      if (!c.alive) continue;
      const d = Math.hypot(c.x - cx, (c.y - 22) - cy);
      if (d <= blastR) {
        const falloff = Math.max(0.25, 1 - d / (blastR + 12));
        const dmg = Math.max(4, Math.round(maxDamage * falloff));
        c.hp = Math.max(0, c.hp - dmg);
        if (c.hp <= 0) c.alive = false;
        const attacker = this.carts[ownerSlot];
        if (attacker && c.slot !== ownerSlot) {
          attacker.ultGauge = Math.min(100, attacker.ultGauge + 20);
        }
      }
    }
  }

  _advanceTurn() {
    const alive = this.carts.filter((c) => c.alive);
    if (alive.length <= 1) {
      this.phase = 'GAME_OVER';
      if (alive.length === 1) {
        this.winnerSlot = alive[0].slot;
        this.winnerText = `${alive[0].name} 승리!`;
      } else {
        this.winnerText = '무승부!';
      }
      return;
    }

    this.turnNumber++;
    for (let step = 1; step <= this.turnOrder.length; step++) {
      const nextIdx = (this.turnOrderIdx + step) % this.turnOrder.length;
      const cand = this.turnOrder[nextIdx];
      if (this.carts[cand]?.alive) {
        this.turnOrderIdx = nextIdx;
        this.activeSlot = cand;
        break;
      }
    }
    this.carts[this.activeSlot].fuel = this.carts[this.activeSlot].maxFuel;
    this._rollWind();
    this.phase = 'AIM';
    this.turnTimerFrames = 20 * 60;
  }

  snapshot() {
    return {
      mapKey: this.mapKey,
      turnNumber: this.turnNumber,
      turnTimeLeft: Math.max(0, Math.ceil(this.turnTimerFrames / 60)),
      activeSlot: this.activeSlot,
      turnOrder: this.turnOrder,
      phase: this.phase,
      wind: this.wind,
      weather: this.weather,
      winnerSlot: this.winnerSlot,
      winnerText: this.winnerText,
      carts: this.carts.map((c) => ({ ...c })),
      projectiles: this.projectiles.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        shellKey: p.shellKey,
        isUltimate: Boolean(p.isUltimate),
      })),
      craters: this.terrain.craters,
      fixedBoxes: this.fixedBoxes,
      skyBox: this.skyBox,
    };
  }
}
