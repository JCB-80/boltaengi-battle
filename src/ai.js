// 5단계 인간형 탄도 AI 컨트롤러 + 스킬 모드/궁극기 판단
import { SHELLS, WORLD } from './config.js';

export const AI_PRESETS = {
  dummy: {
    id: 'dummy',
    label: '훈련 허수아비 (턴 스킵)',
    passive: true,
  },
  lv1: {
    id: 'lv1',
    label: 'Lv.1 입문 (훈련봇)',
    angleNoise: 7.5,
    powerNoise: 11.0,
    windAwareness: 0.0,
    useAirTrigger: 0.1,
    skillChance: 0.0,
  },
  lv2: {
    id: 'lv2',
    label: 'Lv.2 쉬움 (초보 발명가)',
    angleNoise: 4.8,
    powerNoise: 6.8,
    windAwareness: 0.45,
    useAirTrigger: 0.25,
    skillChance: 0.15,
  },
  lv3: {
    id: 'lv3',
    label: 'Lv.3 보통 (숙련 포수)',
    angleNoise: 2.3,
    powerNoise: 3.4,
    windAwareness: 0.88,
    useAirTrigger: 0.65,
    skillChance: 0.35,
  },
  lv4: {
    id: 'lv4',
    label: 'Lv.4 어려움 (엘리트 크루)',
    angleNoise: 1.0,
    powerNoise: 1.4,
    windAwareness: 1.0,
    useAirTrigger: 0.88,
    skillChance: 0.55,
  },
  lv5: {
    id: 'lv5',
    label: 'Lv.5 마스터 (전설의 공학자)',
    angleNoise: 0.35,
    powerNoise: 0.5,
    windAwareness: 1.0,
    useAirTrigger: 0.96,
    skillChance: 0.75,
  },
};

// 기존 키 별칭 호환
AI_PRESETS.easy = AI_PRESETS.lv2;
AI_PRESETS.normal = AI_PRESETS.lv3;
AI_PRESETS.hard = AI_PRESETS.lv4;

/**
 * 가상 탄도 시뮬레이션을 통해 최적 발사 각도·파워·탄종·스킬 모드·에어트리거를 탐색합니다.
 */
export function computeAIShot({ actor, carts, wind, weather = 'CLEAR', terrain, presetKey = 'lv3' }) {
  const preset = AI_PRESETS[presetKey] || AI_PRESETS.lv3;
  if (preset.passive) {
    return { skipTurn: true };
  }

  const enemies = carts.filter((c) => c.alive && c.teamId !== actor.teamId);
  if (enemies.length === 0) return { skipTurn: true };

  // 다자전(1:1:1 등)에서는 가장 체력이 적거나 가까운 적을 우선 타겟팅
  const target = enemies.reduce((best, cur) => {
    const scoreCur = Math.hypot(cur.x - actor.x, cur.y - actor.y) + cur.hp * 2.5;
    const scoreBest = Math.hypot(best.x - actor.x, best.y - actor.y) + best.hp * 2.5;
    return scoreCur < scoreBest ? cur : best;
  }, enemies[0]);

  const facing = target.x >= actor.x ? 1 : -1;
  const shellKeys = Object.keys(SHELLS);
  const chosenShell =
    Math.random() < 0.62
      ? actor.spec.defaultShell
      : shellKeys[Math.floor(Math.random() * shellKeys.length)];
  const shellSpec = SHELLS[chosenShell];

  const perceivedWind = wind * preset.windAwareness;
  const muzzleX = actor.x + facing * 14;
  const muzzleY = actor.y - 28;

  let bestPlan = {
    elevation: 48,
    power: 65,
    distErr: Infinity,
    flightFrames: 60,
  };

  for (let elev = 30; elev <= 76; elev += 4) {
    const rad = (elev * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    for (let pwr = 26; pwr <= 98; pwr += 3) {
      const speed = 4.2 + (pwr / 100) * 14.8;
      let x = muzzleX;
      let y = muzzleY;
      let vx = facing * cosA * speed;
      let vy = -sinA * speed;
      const windAx = perceivedWind * WORLD.WIND_SCALE * shellSpec.windFactor;
      const awareRain = weather === 'RAIN' && preset.windAwareness >= 0.7;
      const grav = WORLD.GRAVITY * (awareRain ? WORLD.RAIN_GRAVITY_MULT : 1.0);

      let hitTerrainEarly = false;
      for (let f = 1; f <= 190; f++) {
        vx += windAx;
        if (vx * perceivedWind < 0) {
          vx *= Math.max(0.85, 1 - Math.abs(perceivedWind) * WORLD.HEADWIND_DRAG * shellSpec.windFactor);
        }
        if (awareRain) {
          vx *= WORLD.RAIN_DRAG;
          vy *= WORLD.RAIN_DRAG;
        }
        vy += grav;
        x += vx;
        y += vy;

        const dTarget = Math.hypot(x - target.x, y - (target.y - 16));
        if (dTarget < bestPlan.distErr) {
          bestPlan = {
            elevation: elev,
            power: pwr,
            distErr: dTarget,
            flightFrames: f,
          };
        }

        if (f > 8 && terrain.isSolid(x, y)) {
          const dImpact = Math.hypot(x - target.x, y - (target.y - 14));
          if (dImpact < bestPlan.distErr) {
            bestPlan = {
              elevation: elev,
              power: pwr,
              distErr: dImpact,
              flightFrames: f,
            };
          }
          hitTerrainEarly = true;
          break;
        }
        if (y > WORLD.SEA_LEVEL + 20 || x < -50 || x > WORLD.WIDTH + 50) break;
      }
      if (!hitTerrainEarly && bestPlan.distErr < 14) break;
    }
  }

  const randSigned = () => (Math.random() - 0.5) + (Math.random() - 0.5);
  const finalElevation = Math.round(
    Math.min(84, Math.max(12, bestPlan.elevation + randSigned() * preset.angleNoise))
  );
  const finalPower = Math.round(
    Math.min(100, Math.max(18, bestPlan.power + randSigned() * preset.powerNoise))
  );

  // 궁극기 또는 전술 스킬 사용 판단
  let useUltimate = false;
  let skillMode = 'NORMAL';
  if (actor.ultGauge >= 100 && bestPlan.distErr < 75 && Math.random() < Math.max(0.5, preset.skillChance)) {
    useUltimate = true;
  } else if (bestPlan.distErr < 55 && Math.random() < preset.skillChance) {
    skillMode = Math.random() < 0.55 ? 'POWER_BOOST' : 'DOUBLE_SNAP';
  }

  // 에어 트리거 발동 프레임 계산
  let airTriggerFrame = null;
  if (!useUltimate && Math.random() < preset.useAirTrigger && bestPlan.flightFrames > 22) {
    if (chosenShell === 'ACORN_SPLIT') {
      airTriggerFrame = Math.max(12, Math.floor(bestPlan.flightFrames * 0.68));
    } else if (chosenShell === 'AQUA_DRILL') {
      airTriggerFrame = Math.max(15, Math.floor(bestPlan.flightFrames * 0.88));
    }
  }

  // 지형 가장자리에 몰렸을 때 안전한 쪽으로 소폭 주행
  let moveDir = 0;
  let moveFrames = 0;
  const leftSafe = terrain.findSurfaceNear(actor.x - 24, actor.y, 20, 40) !== null;
  const rightSafe = terrain.findSurfaceNear(actor.x + 24, actor.y, 20, 40) !== null;
  if (!leftSafe && rightSafe) {
    moveDir = 1;
    moveFrames = 16;
  } else if (!rightSafe && leftSafe) {
    moveDir = -1;
    moveFrames = 16;
  } else if (Math.random() < 0.45) {
    moveDir = Math.random() < 0.5 ? -1 : 1;
    moveFrames = 10 + Math.floor(Math.random() * 14);
  }

  return {
    skipTurn: false,
    facing,
    shellKey: chosenShell,
    elevation: finalElevation,
    power: finalPower,
    airTriggerFrame,
    skillMode,
    useUltimate,
    moveDir,
    moveFrames,
  };
}
