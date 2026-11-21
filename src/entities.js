// 소동물 통통카(CoasterCart) 및 캡슐탄(CapsuleProjectile) 엔티티 모듈
import { CHARACTERS, SHELLS, WORLD } from './config.js';

const Matter = window.Matter;

export class CoasterCart {
  constructor({ slotIndex, teamId, charKey, x, y, facing = 1, controller = 'human', nameOverride = null }) {
    const spec = CHARACTERS[charKey] || CHARACTERS.TORI;
    this.id = `cart_${slotIndex}`;
    this.slotIndex = slotIndex;
    this.teamId = teamId;
    this.controller = controller; // 'human' | 'ai'
    this.spec = spec;
    this.displayName = nameOverride || spec.name;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.grounded = true;
    this.facing = facing; // 1: 우측, -1: 좌측
    this.tiltAngle = 0;

    this.maxHp = spec.maxHp;
    this.hp = spec.maxHp;
    this.alive = true;
    this.droppedOut = false;

    this.maxFuel = spec.maxFuel;
    this.fuel = spec.maxFuel;

    // 조준 상태 및 이전 턴 영점 기억 마커
    this.aimElevation = 45; // 5° ~ 85°
    this.aimPower = 62; // 15% ~ 100%
    this.lastElevation = null;
    this.lastPower = null;
    this.selectedShell = spec.defaultShell;

    // 스킬 모드 & 궁극기 게이지 (0~100) & 하늘 박스 1턴 성능업 버프
    this.skillMode = 'NORMAL';
    this.ultGauge = 35;
    this.useUltimate = false;
    this.powerUpTurns = 0;

    // 타임라인 행동 무게 누적치 (낮을수록 다음 턴이 빨리 돌아옴)
    this.timelineTick = slotIndex * 15;

    // 표정/리액션 및 발사 반동(Recoil) 상태
    this.mood = 'idle';
    this.moodTimer = 0;
    this.wheelSpin = 0;
    this.recoil = 0; // 0 ~ 1.0 (발사 시 뒤로 밀렸다가 스프링 복원)
    this.tornadoImmuneFrames = 0; // 회오리로 인한 낙사 방지 보호 타이머
    this.blockHitCooldowns = new Map();
  }

  getMuzzlePosition() {
    const rad = (this.aimElevation * Math.PI) / 180;
    const baseX = this.x + this.facing * 8;
    const baseY = this.y - 24;
    return {
      x: baseX + this.facing * Math.cos(rad) * 20,
      y: baseY - Math.sin(rad) * 20,
      baseX,
      baseY,
    };
  }

  getLaunchVelocity(elevation = this.aimElevation, power = this.aimPower, facing = this.facing) {
    const rad = (elevation * Math.PI) / 180;
    const speed = 5.5 + (power / 100) * 20.5;
    return {
      vx: facing * Math.cos(rad) * speed,
      vy: -Math.sin(rad) * speed,
    };
  }

  setMood(mood, frames = 80) {
    this.mood = mood;
    this.moodTimer = frames;
  }

  /**
   * 좌우 주행 (연료 소모 및 경사면 등반)
   */
  drive(dir, terrain) {
    if (!this.alive || !this.grounded || this.fuel <= 0) return false;
    this.facing = dir >= 0 ? 1 : -1;

    const stepX = this.facing * 2.3;
    const nextX = this.x + stepX;
    if (nextX < 28 || nextX > WORLD.WIDTH - 28) return false;

    const nextSurfaceY = terrain.findSurfaceNear(nextX, this.y, 16, 22);
    if (nextSurfaceY !== null) {
      // 가파른 수직 벽(14px 이상 급경사) 등반 제한
      if (this.y - nextSurfaceY > 14) return false;
      this.x = nextX;
      this.y = nextSurfaceY;
      this.fuel = Math.max(0, this.fuel - 0.85);
      this.wheelSpin += this.facing * 0.25;
      this.tiltAngle = terrain.getSlopeAngle(this.x, this.y);
      return true;
    } else {
      // 절벽 끝으로 전진 시 자연스럽게 공중 낙하 전환
      this.x = nextX;
      this.grounded = false;
      this.fuel = Math.max(0, this.fuel - 0.85);
      return true;
    }
  }

  applyKnockback(ix, iy) {
    this.vx += ix;
    this.vy += iy;
    this.grounded = false;
  }

  addUltGauge(amount) {
    if (!this.alive || amount <= 0) return;
    this.ultGauge = Math.min(100, this.ultGauge + Math.round(amount));
  }

  takeDamage(amount) {
    if (!this.alive || amount <= 0) return;
    this.hp = Math.max(0, this.hp - Math.round(amount));
    this.addUltGauge(Math.max(12, Math.round(amount * 0.7)));
    this.setMood('hurt', 95);
    if (this.hp <= 0) {
      this.alive = false;
    }
  }

  /**
   * 매 프레임 지형 안착, 낙하, 절벽 위기 표정, 구름 바다 드롭아웃 판정
   */
  update(terrain, onDropOut) {
    if (!this.alive) return;

    if (this.recoil > 0) {
      this.recoil = Math.max(0, this.recoil - 0.032);
    }
    if (this.tornadoImmuneFrames > 0) {
      this.tornadoImmuneFrames--;
    }

    if (this.moodTimer > 0) {
      this.moodTimer--;
      if (this.moodTimer === 0) this.mood = 'idle';
    }

    // 발밑 지형이 폭발로 사라졌는지 확인
    if (this.grounded) {
      let surfaceY = terrain.findSurfaceNear(this.x, this.y, 18, 16);
      if (surfaceY === null && terrain.isSolid(this.x, this.y)) {
        surfaceY = terrain.findSurfaceUpward(this.x, this.y, 48);
      }
      if (surfaceY === null) {
        this.grounded = false;
      } else {
        this.y = surfaceY;
        const targetTilt = terrain.getSlopeAngle(this.x, this.y);
        this.tiltAngle += (targetTilt - this.tiltAngle) * 0.25;

        // 절벽 끝에 아슬아슬하게 서 있으면 땀 흘리는 패닉 표정
        if (this.mood === 'idle') {
          const leftGround = terrain.findSurfaceNear(this.x - 18, this.y, 24, 45);
          const rightGround = terrain.findSurfaceNear(this.x + 18, this.y, 24, 45);
          if (leftGround === null || rightGround === null) {
            this.mood = 'panic';
          }
        }
      }
    }

    if (!this.grounded) {
      this.vy += WORLD.GRAVITY;
      this.vx *= 0.985;

      const subSteps = 6;
      for (let s = 0; s < subSteps; s++) {
        this.x += this.vx / subSteps;
        this.y += this.vy / subSteps;

        // 지형에 닿았을 때 땅속으로 파고들지 않도록 실제 표면으로 즉시 끌어올려 안착
        if (this.vy >= 0 && terrain.isSolid(this.x, this.y)) {
          const landY =
            terrain.findSurfaceUpward(this.x, this.y, 44) ??
            terrain.findSurfaceNear(this.x, this.y, 28, 14) ??
            this.y;
          this.y = landY;
          if (Math.abs(this.vy) > 4.5) {
            this.vy = -this.vy * 0.2;
            this.vx *= 0.55;
          } else {
            this.vx = 0;
            this.vy = 0;
            this.grounded = true;
            this.tiltAngle = terrain.getSlopeAngle(this.x, this.y);
            break;
          }
        }
      }

      // 구름 바다 아래로 추락 -> 회오리 보호 중이면 절대 죽지 않고 안전 육지로 복귀!
      if (this.y > WORLD.SEA_LEVEL) {
        if (this.tornadoImmuneFrames > 0) {
          const safeX = terrain.findSafeSpawnX(Math.min(WORLD.WIDTH - 140, Math.max(140, this.x)));
          const safeY = terrain.findTopSurface(safeX) ?? 460;
          this.x = safeX;
          this.y = safeY - 12;
          this.vx = 0;
          this.vy = 0;
          this.grounded = false;
        } else {
          this.alive = false;
          this.hp = 0;
          this.droppedOut = true;
          onDropOut?.(this);
        }
      }
    }
  }
}

export class CapsuleProjectile {
  constructor({
    ownerId,
    shellKey,
    x,
    y,
    vx,
    vy,
    isSubShell = false,
    overrideDamage = null,
    overrideRadius = null,
    extraBounces = 0,
    skillEffect = 'NORMAL',
    isHeavySkill = false,
    isUltimate = false,
    ultCharId = null,
  }) {
    const spec = SHELLS[shellKey] || SHELLS.ACORN_SPLIT;
    this.ownerId = ownerId;
    this.shellKey = shellKey;
    this.spec = spec;

    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    this.damage = overrideDamage ?? spec.damage;
    this.craterRadius = overrideRadius ?? spec.craterRadius;
    this.bouncesLeft = spec.bounces + extraBounces;
    this.jellyBounces = 0;

    this.isSubShell = isSubShell;
    this.skillEffect = skillEffect;
    this.isHeavySkill = isHeavySkill;
    this.isUltimate = isUltimate;
    this.ultCharId = ultCharId;

    this.airTriggered = isSubShell || isUltimate; // 궁극탄/자탄은 공중 분열 대신 착탄 임팩트 집중
    this.drillActive = false;
    this.reverseSpin = false;

    this.ageFrames = 0;
    this.active = true;
    this.rotation = 0;
    this.trail = [];
  }

  canAirTrigger() {
    return this.active && !this.airTriggered && this.ageFrames >= 2;
  }

  /**
   * 비행 중 에어 트리거 발동 (탄종별 고유 공중 기믹)
   * @returns {CapsuleProjectile[]} 추가 생성된 자탄 배열
   */
  triggerAirSkill() {
    if (!this.canAirTrigger()) return [];
    this.airTriggered = true;

    const spawned = [];
    if (this.shellKey === 'ACORN_SPLIT') {
      // 공중 터치 시 수직 낙하 (3갈래 도토리 수직 투하)
      this.vx = 0;
      this.vy = 15.0;
      this.damage = 20;
      this.craterRadius = 30;

      for (const offsetX of [-16, 16]) {
        spawned.push(
          new CapsuleProjectile({
            ownerId: this.ownerId,
            shellKey: this.shellKey,
            x: this.x + offsetX,
            y: this.y,
            vx: offsetX * 0.08,
            vy: 15.0,
            isSubShell: true,
            overrideDamage: 18,
            overrideRadius: 27,
          })
        );
      }
    } else if (this.shellKey === 'AQUA_DRILL') {
      // 수평 정지 후 초고속 수직 급강하 지형 굴착
      this.vx = 0;
      this.vy = 17.5;
      this.craterRadius = 74;
      this.damage = 34;
      this.drillActive = true;
    } else {
      // 치즈 바운스 등 기타 탄종도 화면 터치 시 수직 낙하
      this.vx = 0;
      this.vy = 15.5;
    }

    return spawned;
  }

  /**
   * 서브스테핑 탄도 적분 및 지형·블록·통통카 충돌 검사
   * (역풍 감속 저항 + 비 올 때 사거리 단축 물리 반영)
   */
  step(wind, weather, terrain, structureManager, carts, skyBox, callbacks) {
    if (!this.active) return;
    this.ageFrames++;
    this.rotation += (this.reverseSpin ? -0.35 : 0.22);

    if (this.ageFrames % 2 === 0) {
      this.trail.push({ x: this.x, y: this.y, alpha: 1.0 });
      if (this.trail.length > 26) this.trail.shift();
    }

    const subSteps = 4;
    const dt = 1 / subSteps;
    const isRain = weather === 'RAIN';
    const windMult = this.isPowerUp ? 0.5 : 1.0;
    const windAccel = this.drillActive ? 0 : wind * WORLD.WIND_SCALE * this.spec.windFactor * windMult;
    const grav = WORLD.GRAVITY * (isRain ? WORLD.RAIN_GRAVITY_MULT : 1.0);
    const rainDragStep = isRain ? Math.pow(WORLD.RAIN_DRAG, dt) : 1.0;

    for (let s = 0; s < subSteps; s++) {
      // 1) 바람 가속도 + 역풍 시 공기 저항 감속(포가 느려지는 현상)
      this.vx += windAccel * dt;
      if (!this.drillActive && this.vx * wind < 0) {
        const headwindFactor = Math.max(0.85, 1 - Math.abs(wind) * WORLD.HEADWIND_DRAG * this.spec.windFactor * windMult * dt);
        this.vx *= headwindFactor;
      }

      // 2) 비 올 때 빗물 저항 및 무게로 인한 사거리 단축
      if (isRain) {
        this.vx *= rainDragStep;
        this.vy *= rainDragStep;
      }

      this.vy += grav * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 0) 하늘 보급 풍선 박스 명중 체크 (관통하며 1턴 성능업 버프 획득!)
      if (skyBox && skyBox.active) {
        const dBox = Math.hypot(this.x - skyBox.x, this.y - skyBox.y);
        if (dBox < 24) {
          callbacks.onHitSkyBox?.(this);
        }
      }

      // 맵 바깥 또는 구름 바다 추락
      if (this.x < -140 || this.x > WORLD.WIDTH + 140 || this.y > WORLD.SEA_LEVEL + 35) {
        this.active = false;
        callbacks.onSplashOut?.(this);
        return;
      }

      // 1) 캐릭터 통통카 직격 검사
      for (const cart of carts) {
        if (!cart.alive) continue;
        if (cart.id === this.ownerId && this.ageFrames < 15) continue;

        const dist = Math.hypot(this.x - cart.x, this.y - (cart.y - 16));
        if (dist < 21) {
          this.active = false;
          callbacks.onDetonate?.(this, this.x, this.y, true);
          return;
        }
      }

      // 2) 물리 구조물 블록 충돌 검사
      for (const blk of structureManager.blocks) {
        if (blk.destroyed) continue;
        if (Matter.Vertices.contains(blk.body.vertices, { x: this.x, y: this.y })) {
          // 통통 젤리 블록은 포탄을 강하게 반사!
          if (blk.mat.id === 'JELLY' && this.jellyBounces < 5) {
            this.reflectFromBlock(blk, 1.06);
            this.jellyBounces++;
            blk.wobble = 1.0;
            callbacks.onBounce?.(this.x, this.y, true);
            break;
          }

          // 도탄 횟수가 남아 있는 치즈탄 처리
          if (this.bouncesLeft > 0 && !blk.mat.explosive) {
            this.reflectFromBlock(blk, 0.8);
            this.bouncesLeft--;
            blk.pendingImpactDmg += 10;
            callbacks.onBounce?.(this.x, this.y, false);
            break;
          }

          this.active = false;
          callbacks.onDetonate?.(this, this.x, this.y, false);
          return;
        }
      }

      if (!this.active) return;

      // 3) 파괴 가능한 섬 지형 충돌 검사
      if (terrain.isSolid(this.x, this.y)) {
        if (this.bouncesLeft > 0) {
          const n = terrain.getSurfaceNormal(this.x, this.y);
          const dot = this.vx * n.x + this.vy * n.y;
          if (dot < 0) {
            this.vx = (this.vx - 2 * dot * n.x) * 0.78;
            this.vy = (this.vy - 2 * dot * n.y) * 0.78;
          } else {
            this.vy = -Math.abs(this.vy) * 0.75;
          }
          this.x += n.x * 6;
          this.y += n.y * 6;
          this.bouncesLeft--;
          callbacks.onBounce?.(this.x, this.y, false);
        } else {
          this.active = false;
          callbacks.onDetonate?.(this, this.x, this.y, false);
          return;
        }
      }
    }
  }

  reflectFromBlock(blk, restitution = 0.85) {
    // 블록 로컬 좌표계로 변환해 가장 가까운 면의 법선 벡터 산출
    const dx = this.x - blk.body.position.x;
    const dy = this.y - blk.body.position.y;
    const cos = Math.cos(-blk.body.angle);
    const sin = Math.sin(-blk.body.angle);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    const penX = blk.w * 0.5 - Math.abs(lx);
    const penY = blk.h * 0.5 - Math.abs(ly);

    let lnx = 0;
    let lny = 0;
    if (penX < penY) {
      lnx = lx >= 0 ? 1 : -1;
    } else {
      lny = ly >= 0 ? 1 : -1;
    }

    const wCos = Math.cos(blk.body.angle);
    const wSin = Math.sin(blk.body.angle);
    const nx = lnx * wCos - lny * wSin;
    const ny = lnx * wSin + lny * wCos;

    const dot = this.vx * nx + this.vy * ny;
    this.vx = (this.vx - 2 * dot * nx) * restitution;
    this.vy = (this.vy - 2 * dot * ny) * restitution;
    this.x += nx * 7;
    this.y += ny * 7;
  }
}
