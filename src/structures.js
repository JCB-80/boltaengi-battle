// 강체 물리 블록 구조물 시스템 (Matter.js 기반 연쇄 붕괴 · 폭약통 유폭 · 압사 판정)
import { MATERIALS, WORLD } from './config.js';

const Matter = window.Matter;

export class StructureManager {
  constructor(matterEngine, terrain) {
    this.engine = matterEngine;
    this.matterWorld = matterEngine.world;
    this.terrain = terrain;
    this.blocks = []; // { id, body, mat, hp, maxHp, w, h, wobble }
    this.nextId = 1;
    this.spawnGraceFrames = 0;

    this.bindCollisions();
  }

  bindCollisions() {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      if (this.spawnGraceFrames > 0) return;

      for (const pair of event.pairs) {
        const blockA = pair.bodyA.plugin?.blockRef;
        const blockB = pair.bodyB.plugin?.blockRef;
        if (!blockA && !blockB) continue;

        const relVx = pair.bodyA.velocity.x - pair.bodyB.velocity.x;
        const relVy = pair.bodyA.velocity.y - pair.bodyB.velocity.y;
        const impactSpeed = Math.hypot(relVx, relVy);

        if (impactSpeed > 5.2) {
          const dmg = (impactSpeed - 4.8) * 4.2;
          if (blockA && !blockA.mat.indestructible) blockA.pendingImpactDmg += dmg;
          if (blockB && !blockB.mat.indestructible) blockB.pendingImpactDmg += dmg;
        }
        if (blockA && blockA.mat.id === 'JELLY') blockA.wobble = 1.0;
        if (blockB && blockB.mat.id === 'JELLY') blockB.wobble = 1.0;
      }
    });
  }

  clear() {
    for (const blk of this.blocks) {
      Matter.Composite.remove(this.matterWorld, blk.body);
    }
    this.blocks = [];
  }

  addBlock(x, y, w, h, materialKey, angle = 0) {
    const mat = MATERIALS[materialKey] || MATERIALS.WOOD;
    const body = Matter.Bodies.rectangle(x, y, w, h, {
      density: mat.density,
      friction: Math.max(0.45, mat.friction),
      frictionStatic: 0.9,
      frictionAir: 0.015,
      restitution: mat.restitution,
      angle,
      label: `block_${mat.id}`,
    });

    const blk = {
      id: this.nextId++,
      body,
      mat,
      w,
      h,
      hp: mat.maxHp,
      maxHp: mat.maxHp,
      pendingImpactDmg: 0,
      wobble: 0,
      destroyed: false,
    };
    body.plugin = { blockRef: blk };

    this.blocks.push(blk);
    Matter.Composite.add(this.matterWorld, body);
    return blk;
  }

  /**
   * 지형 표면(wx) 위에 독창적인 공성 필드 오브젝트(통나무 방벽 · 마법 수정 · 통통 버섯 · 폭약 배럴) 배치
   */
  buildTowerAt(centerX, style = 'barricade') {
    const groundY = this.terrain.findTopSurface(centerX);
    if (groundY === null) return;

    if (style === 'watchtower' || style === 'crystal_cluster') {
      // 마법 수정 기둥 클러스터 + 별사탕 폭약 배럴
      this.addBlock(centerX - 24, groundY - 28, 22, 56, 'ICE');
      this.addBlock(centerX + 24, groundY - 22, 22, 44, 'ICE');
      this.addBlock(centerX, groundY - 17, 30, 34, 'TNT');
    } else if (style === 'bunker' || style === 'barricade') {
      // 통나무 바리케이드 성벽 + 둥근 쿠키 방패석
      this.addBlock(centerX - 18, groundY - 24, 24, 48, 'WOOD');
      this.addBlock(centerX + 18, groundY - 20, 24, 40, 'STONE');
      this.addBlock(centerX, groundY - 56, 46, 20, 'WOOD');
    } else if (style === 'jelly_arch' || style === 'mushroom_post') {
      // 통통 버섯 반사 패드 + 보호 통나무 & 폭약 배럴
      this.addBlock(centerX - 30, groundY - 19, 20, 38, 'WOOD');
      this.addBlock(centerX + 30, groundY - 19, 20, 38, 'WOOD');
      this.addBlock(centerX, groundY - 16, 28, 32, 'TNT');
      this.addBlock(centerX, groundY - 46, 66, 24, 'JELLY');
    } else if (style === 'single_barrel') {
      // 단독 별사탕 폭약 배럴 (연쇄 폭발 지뢰)
      this.addBlock(centerX, groundY - 18, 32, 36, 'TNT');
    } else if (style === 'single_mushroom') {
      // 단독 통통 버섯 반사 패드
      this.addBlock(centerX, groundY - 14, 58, 24, 'JELLY');
    } else if (style === 'crystal_wall') {
      // 높은 수정 방패벽
      this.addBlock(centerX - 12, groundY - 32, 22, 64, 'ICE');
      this.addBlock(centerX + 14, groundY - 24, 22, 48, 'STONE');
    }
  }

  /**
   * 맵 랜덤 스팟(2~5개)에 다채로운 장애물 오브젝트를 랜덤 배치합니다.
   */
  populateForPreset(preset = 'random', terraceXs = [], avoidXs = []) {
    this.clear();
    this.spawnGraceFrames = 55; // 초기 물리 안착 중 자가 파손 방지

    const styles = [
      'barricade',
      'crystal_cluster',
      'mushroom_post',
      'single_barrel',
      'single_mushroom',
      'crystal_wall',
    ];

    const spots = terraceXs.length > 0 ? terraceXs : [545, 835, 1085];
    for (const tx of spots) {
      if (avoidXs.some((ax) => Math.abs(ax - tx) < 88)) continue;
      const pick = styles[Math.floor(Math.random() * styles.length)];
      this.buildTowerAt(tx, pick);
    }
  }

  /**
   * 폭발 반경 내 블록 데미지, 파쇄, 강체 임펄스(날리기), 화약통 유폭 예약
   */
  applyExplosion(cx, cy, radius, baseDamage, bonusMultiplier = 1.0, outChainExplosions = []) {
    const affectRadius = radius * 2.05;

    for (const blk of this.blocks) {
      if (blk.destroyed) continue;
      const bx = blk.body.position.x;
      const by = blk.body.position.y;
      const dist = Math.hypot(bx - cx, by - cy);

      if (dist < affectRadius + Math.max(blk.w, blk.h) * 0.5) {
        Matter.Sleeping.set(blk.body, false);

        // 물리 폭발 밀쳐내기 임펄스
        const falloff = Math.max(0.12, 1 - dist / (affectRadius + 30));
        const angle = Math.atan2(by - cy - 10, bx - cx);
        const forceMag = 0.048 * blk.body.mass * falloff * (radius / 42);
        Matter.Body.applyForce(blk.body, blk.body.position, {
          x: Math.cos(angle) * forceMag,
          y: Math.sin(angle) * forceMag - 0.012 * blk.body.mass * falloff,
        });

        if (blk.mat.id === 'JELLY') {
          blk.wobble = 1.0;
        }

        // 유효 타격 반경 내 블록 내구도 차감
        if (!blk.mat.indestructible && dist < radius * 1.45 + Math.max(blk.w, blk.h) * 0.4) {
          const dmgRatio = Math.max(0.25, 1 - dist / (radius * 1.65));
          blk.hp -= baseDamage * bonusMultiplier * dmgRatio;
          if (blk.hp <= 0) {
            this.destroyBlock(blk, outChainExplosions);
          }
        }
      }
    }
  }

  destroyBlock(blk, outChainExplosions = []) {
    if (blk.destroyed) return;
    blk.destroyed = true;
    const pos = { x: blk.body.position.x, y: blk.body.position.y };
    Matter.Composite.remove(this.matterWorld, blk.body);

    if (blk.mat.explosive) {
      outChainExplosions.push({
        x: pos.x,
        y: pos.y,
        radius: blk.mat.blastRadius,
        damage: blk.mat.blastDamage,
        color: '#FF6B5B',
        label: '폭약통 유폭!',
      });
    }
  }

  /**
   * 건물이 기울어지거나 넘어질 때 바람의 수평 외력을 적용합니다.
   * (가벼운 나무/얼음 블록일수록 바람에 크게 날리며, 넘어지는 중에는 풍력이 증폭됨)
   */
  applyWind(wind) {
    if (this.spawnGraceFrames > 0 || Math.abs(wind) < 0.8) return;

    for (const blk of this.blocks) {
      if (blk.destroyed) continue;
      const isToppling =
        blk.body.speed > 0.28 ||
        blk.body.angularSpeed > 0.014 ||
        Math.abs(blk.body.angle) > 0.08;

      if (!isToppling && Math.abs(wind) < 6.5) continue;

      // 재질 밀도 반비례(가벼울수록 바람에 잘 날림), 넘어지는 중엔 2.4배 풍력
      const lightness = blk.mat.id === 'STONE' ? 0.35 : blk.mat.id === 'ICE' ? 1.15 : 1.0;
      const motionMult = isToppling ? 2.4 : 0.45;
      const forceX = wind * 0.000018 * lightness * motionMult * (blk.w * blk.h * 0.001 + 0.5);

      Matter.Sleeping.set(blk.body, false);
      Matter.Body.applyForce(
        blk.body,
        { x: blk.body.position.x, y: blk.body.position.y - blk.h * 0.22 },
        { x: forceX, y: 0 }
      );
    }
  }

  /**
   * 매 프레임 블록 내구도 업데이트, 구름 바다 낙하 제거, 통통카 압사(Crush) 데미지 판정
   */
  update(carts, onBlockBroken, onCartCrushed, outChainExplosions) {
    if (this.spawnGraceFrames > 0) this.spawnGraceFrames--;

    const now = performance.now();

    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const blk = this.blocks[i];
      if (blk.destroyed) {
        this.blocks.splice(i, 1);
        continue;
      }

      if (blk.wobble > 0) {
        blk.wobble = Math.max(0, blk.wobble - 0.06);
      }

      // 충돌 누적 데미지 반영
      if (blk.pendingImpactDmg > 0) {
        blk.hp -= blk.pendingImpactDmg;
        blk.pendingImpactDmg = 0;
        if (blk.hp <= 0) {
          onBlockBroken?.(blk);
          this.destroyBlock(blk, outChainExplosions);
          this.blocks.splice(i, 1);
          continue;
        }
      }

      // 구름 바다 아래로 떨어진 블록 정리
      if (blk.body.position.y > WORLD.SEA_LEVEL + 75) {
        blk.destroyed = true;
        Matter.Composite.remove(this.matterWorld, blk.body);
        this.blocks.splice(i, 1);
        continue;
      }

      // 무너지는 물리 블록이 캐릭터 통통카를 덮쳤을 때 압사(Crush) 데미지 판정
      const speed = blk.body.speed;
      if (this.spawnGraceFrames === 0 && speed > 2.2) {
        const bx = blk.body.position.x;
        const by = blk.body.position.y;
        const approxR = Math.max(blk.w, blk.h) * 0.48;

        for (const cart of carts) {
          if (!cart.alive) continue;
          const dist = Math.hypot(bx - cart.x, by - (cart.y - 14));
          if (dist < approxR + 20) {
            const lastHit = cart.blockHitCooldowns.get(blk.id) || 0;
            if (now - lastHit > 520) {
              cart.blockHitCooldowns.set(blk.id, now);
              const rawCrush = Math.round(
                Math.min(34, Math.max(6, speed * 2.6 * blk.mat.crushMultiplier))
              );
              onCartCrushed?.(cart, blk, rawCrush);

              // 블록 반작용 감속
              Matter.Body.setVelocity(blk.body, {
                x: blk.body.velocity.x * 0.45 + (bx >= cart.x ? 1.4 : -1.4),
                y: -Math.abs(blk.body.velocity.y) * 0.35 - 1.2,
              });
            }
          }
        }
      }
    }
  }

  /**
   * 모든 동적 블록이 안정 상태(정지)인지 확인
   */
  areAllBlocksSettled() {
    for (const blk of this.blocks) {
      if (blk.destroyed) continue;
      if (blk.body.speed > 0.38 || blk.body.angularSpeed > 0.045) {
        return false;
      }
    }
    return true;
  }
}
