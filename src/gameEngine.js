// 코어 물리 & 타임라인 턴제 게임 엔진 (스킬 모드 · 궁극기 · 다자전 · 계급 꾸미기 통합)
import { CHARACTERS, CHARACTER_LIST, RANKS, SHELLS, SKILL_MODES, WORLD } from './config.js';
import { ToyAudio } from './audio.js?v=20';
import { DestructibleTerrain } from './terrain.js?v=45';
import { StructureManager } from './structures.js';
import { CapsuleProjectile, CoasterCart } from './entities.js';
import { computeAIShot } from './ai.js';

const Matter = window.Matter;

export class GameEngine {
  constructor({ renderer, onHudUpdate, onRemoteAction = null }) {
    this.renderer = renderer;
    this.onHudUpdate = onHudUpdate;
    this.onRemoteAction = onRemoteAction;
    this.isRemoteMatch = false;
    this.audio = new ToyAudio();

    this.matterEngine = Matter.Engine.create({
      enableSleeping: false,
    });
    this.matterEngine.gravity.y = 0.92;

    this.terrain = new DestructibleTerrain(this.matterEngine.world);
    this.structures = new StructureManager(this.matterEngine, this.terrain);

    this.gameMode = '1v1_ai';
    this.mapPreset = 'random';
    this.aiPreset = 'lv3';
    this.playerCharKey = 'M01_MOCHI';

    this.carts = [];
    this.projectiles = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.chainExplosionQueue = [];
    this.pendingFollowUpShots = []; // 더블 스냅 2연발 대기 큐

    this.wind = 0;
    this.weather = 'CLEAR'; // 'CLEAR' | 'RAIN'
    this.tornado = {
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      life: 0,
      alertFrames: 0,
      hitCartIds: new Set(),
    };
    this.skyBox = {
      active: false,
      x: 800,
      y: 145,
      baseY: 145,
      vx: 1.15,
      phase: 0,
      respawnIn: 0,
    };
    this.fixedBoxes = [];
    this.pityCutin = {
      active: false,
      cart: null,
      life: 0,
      maxLife: 105,
    };
    this.turnNumber = 1;
    this.phase = 'AIM'; // 'AIM' | 'FLIGHT' | 'SETTLE' | 'GAME_OVER'
    this.turnTimerFrames = 20 * 60;
    this.turnTimeLeft = 20;
    this.activeActor = null;
    this.winnerText = '';

    this.settleCounter = 0;
    this.settleElapsed = 0;
    this.hitstopFrames = 0;
    this.frameCount = 0;

    // 계급(레벨) & 외형 꾸미기 (성능 차이 0% — 순수 명예/코스메틱)
    this.playerXp = Number(localStorage.getItem('puffpuff_xp') || '0');
    this.cosmeticEnabled = localStorage.getItem('puffpuff_cosmetic') !== 'off';

    // 드래그 조준 상태
    this.dragState = {
      active: false,
      currentX: 0,
      currentY: 0,
    };

    // AI 실행 스케줄 상태
    this.aiState = {
      plan: null,
      waitFrames: 0,
      flightTicks: 0,
    };
  }

  /**
   * 선택한 대전 모드(1:1, 1:1:1, 4인 난투, 2:2 팀전)에 맞춰 참가자 슬롯을 생성합니다.
   */
  buildRoster(mode, playerChar) {
    const others = CHARACTER_LIST.map((c) => c.id).filter((k) => k !== playerChar);
    const pick = (i) => others[(i * 3 + Math.floor(Math.random() * 4)) % others.length];
    const c1 = pick(0);
    const c2 = pick(1) === c1 ? pick(2) : pick(1);
    const c3 = pick(3) === c1 || pick(3) === c2 ? pick(4) : pick(3);

    if (mode === '1v1_local') {
      return [
        { teamId: 1, charKey: playerChar, x: 265, facing: 1, controller: 'human', name: `1P ${CHARACTERS[playerChar].name}` },
        { teamId: 2, charKey: c1, x: 1335, facing: -1, controller: 'human', name: `2P ${CHARACTERS[c1].name}` },
      ];
    }
    if (mode === '1v1v1_ffa') {
      return [
        { teamId: 1, charKey: playerChar, x: 235, facing: 1, controller: 'human', name: `나 (${CHARACTERS[playerChar].name})` },
        { teamId: 2, charKey: c1, x: 800, facing: -1, controller: 'ai', name: `AI ${CHARACTERS[c1].name}` },
        { teamId: 3, charKey: c2, x: 1365, facing: -1, controller: 'ai', name: `AI ${CHARACTERS[c2].name}` },
      ];
    }
    if (mode === '4p_ffa') {
      return [
        { teamId: 1, charKey: playerChar, x: 215, facing: 1, controller: 'human', name: `나 (${CHARACTERS[playerChar].name})` },
        { teamId: 2, charKey: c1, x: 640, facing: -1, controller: 'ai', name: `AI ${CHARACTERS[c1].name}` },
        { teamId: 3, charKey: c2, x: 980, facing: -1, controller: 'ai', name: `AI ${CHARACTERS[c2].name}` },
        { teamId: 4, charKey: c3, x: 1385, facing: -1, controller: 'ai', name: `AI ${CHARACTERS[c3].name}` },
      ];
    }
    if (mode === '2v2_team') {
      return [
        { teamId: 1, charKey: playerChar, x: 225, facing: 1, controller: 'human', name: `[A팀] 나` },
        { teamId: 2, charKey: c1, x: 1185, facing: -1, controller: 'ai', name: `[B팀] ${CHARACTERS[c1].name}` },
        { teamId: 1, charKey: c2, x: 405, facing: 1, controller: 'ai', name: `[A팀] ${CHARACTERS[c2].name}` },
        { teamId: 2, charKey: playerChar, x: 1375, facing: -1, controller: 'ai', name: `[B팀] ${CHARACTERS[playerChar].name}` },
      ];
    }
    // 기본 1v1_ai
    return [
      { teamId: 1, charKey: playerChar, x: 275, facing: 1, controller: 'human', name: `나 (${CHARACTERS[playerChar].name})` },
      { teamId: 2, charKey: c1, x: 1325, facing: -1, controller: 'ai', name: this.aiPreset === 'dummy' ? '훈련봇' : `AI ${CHARACTERS[c1].name}` },
    ];
  }

  startMatch({
    gameMode = this.gameMode,
    mapPreset = this.mapPreset,
    aiPreset = this.aiPreset,
    playerCharKey = this.playerCharKey,
    customRoster = null,
    matchLabel = '',
  } = {}) {
    this.gameMode = gameMode;
    this.mapPreset = mapPreset;
    this.aiPreset = aiPreset;
    this.playerCharKey = playerCharKey;
    this.customRoster = customRoster;
    this.matchLabel = matchLabel;

    this.projectiles = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.chainExplosionQueue = [];
    this.pendingFollowUpShots = [];
    this.winnerText = '';
    this.turnNumber = 1;
    this.hitstopFrames = 0;

    const terraces = this.terrain.generate(this.mapPreset);
    const roster = Array.isArray(customRoster) && customRoster.length >= 2
      ? customRoster
      : this.buildRoster(this.gameMode, this.playerCharKey);
    const rankInfo = this.getRankInfo();
    this.carts = roster.map((entry, idx) => {
      const safeX = this.terrain.findSafeSpawnX(entry.x);
      const spawnY = this.terrain.findTopSurface(safeX) ?? 500;
      const cart = new CoasterCart({
        slotIndex: idx,
        teamId: entry.teamId,
        charKey: entry.charKey,
        x: safeX,
        y: spawnY,
        facing: entry.facing,
        controller: entry.controller,
        nameOverride: entry.name,
      });
      if (idx === 0) {
        cart.rankInfo = rankInfo;
        cart.cosmeticEnabled = this.cosmeticEnabled;
      }
      return cart;
    });

    const cartXs = this.carts.map((c) => c.x);
    this.structures.populateForPreset(this.mapPreset, terraces, cartXs);

    this.rollWind(true);
    this.weather = 'CLEAR';
    this.tornado.active = false;
    this.spawnSkyBox();
    this.spawnFixedBoxes(cartXs);
    this.beginNextTurn(true);
  }

  spawnFixedBoxes(cartXs = []) {
    const candidates = [520, 800, 1080, 650, 950];
    this.fixedBoxes = [];
    for (const cx of candidates) {
      if (this.fixedBoxes.length >= 2) break;
      const rx = cx + Math.round((Math.random() - 0.5) * 60);
      if (cartXs.some((x) => Math.abs(x - rx) < 120)) continue;
      const y = this.terrain.findTopSurface(rx);
      if (y === null || y > WORLD.SEA_LEVEL - 70) continue;
      this.fixedBoxes.push({
        active: true,
        x: rx,
        y: y - 16,
      });
    }
  }

  spawnSkyBox() {
    const startX = Math.round(420 + Math.random() * 760);
    const baseY = Math.round(108 + Math.random() * 58);
    this.skyBox = {
      active: true,
      x: startX,
      y: baseY,
      baseY,
      vx: (Math.random() < 0.5 ? 1 : -1) * (1.05 + Math.random() * 0.55),
      phase: Math.random() * Math.PI * 2,
      respawnIn: 0,
    };
  }

  setWeather(weatherKey) {
    this.weather = weatherKey === 'RAIN' ? 'RAIN' : 'CLEAR';
    this.spawnFloatingText(
      WORLD.WIDTH * 0.5,
      120,
      this.weather === 'RAIN' ? '🌧️ 비가 내립니다! (사거리 -20%)' : '☀️ 하늘이 맑아졌습니다!',
      '#E0F2FE',
      20
    );
    this.notifyHud();
  }

  spawnTornado(targetCart = null) {
    const alive = this.carts.filter((c) => c.alive);
    if (alive.length === 0) return;
    const anchor = targetCart || alive[Math.floor(Math.random() * alive.length)];

    // 맵의 충분히 먼 반대편/외곽에서 출발해 피하거나 구멍으로 대피할 시간 제공
    const dir = anchor.x < WORLD.WIDTH * 0.5 ? -1 : 1;
    const startX = dir === 1 ? 110 : WORLD.WIDTH - 110;
    const groundY = this.terrain.findTopSurface(startX) ?? 560;

    this.tornado = {
      active: true,
      x: startX,
      y: groundY,
      vx: dir * 2.8, // 천천히 다가와 회피/대피 가능
      life: 490,
      alertFrames: 180, // 정확히 3초(60fps * 3)만 경고 배너 표시 후 사라짐
      hitCartIds: new Set(),
    };

    this.renderer.addShake(7);
    this.audio.playTornadoBreeze(2.0);
    this.spawnFloatingText(
      Math.min(WORLD.WIDTH - 230, Math.max(230, startX + dir * 80)),
      groundY - 120,
      '🌪️ 저 멀리서 태풍이 다가와요! 구멍으로 피하세요!',
      '#A5F3FC',
      21
    );
    this.notifyHud();
  }

  /**
   * 캐릭터가 파인 구멍(참호) 안이나 지붕/블록 엄폐물 아래에 대피해 있는지 판정
   */
  isShelteredInPit(cart) {
    // 1) 바로 위(지붕/동굴/공중 발판)에 지형이 덮여 있는 경우
    for (let dy = 42; dy <= 160; dy += 12) {
      if (this.terrain.isSolid(cart.x, cart.y - dy)) return true;
    }

    // 2) 좌우 양쪽 모두 캐릭터 키보다 높은 땅(파인 구멍/크레이터 내부)으로 둘러싸인 경우
    const leftWall =
      this.terrain.isSolid(cart.x - 24, cart.y - 14) ||
      this.terrain.isSolid(cart.x - 36, cart.y - 20);
    const rightWall =
      this.terrain.isSolid(cart.x + 24, cart.y - 14) ||
      this.terrain.isSolid(cart.x + 36, cart.y - 20);
    if (leftWall && rightWall) return true;

    // 3) 물리 블록 구조물 아래/사이에 들어가 있는 경우
    for (const blk of this.structures.blocks) {
      if (blk.destroyed) continue;
      if (
        Math.abs(blk.body.position.x - cart.x) < blk.w * 0.65 + 18 &&
        blk.body.position.y < cart.y - 16 &&
        blk.body.position.y > cart.y - 110
      ) {
        return true;
      }
    }
    return false;
  }

  getRankInfo() {
    let cur = RANKS[0];
    let next = RANKS[1] || null;
    for (let i = 0; i < RANKS.length; i++) {
      if (this.playerXp >= RANKS[i].minXp) {
        cur = RANKS[i];
        next = RANKS[i + 1] || null;
      }
    }
    return { current: cur, next, xp: this.playerXp };
  }

  grantXp(amount, reason = '') {
    if (amount <= 0) return;
    const prevLv = this.getRankInfo().current.level;
    this.playerXp += amount;
    localStorage.setItem('puffpuff_xp', String(this.playerXp));
    const after = this.getRankInfo();
    if (this.carts[0]) {
      this.carts[0].rankInfo = after;
    }
    if (after.current.level > prevLv) {
      this.audio.playSkillCharge();
      this.spawnFloatingText(
        WORLD.WIDTH * 0.5,
        175,
        `🎉 계급 승급! ${after.current.badge} Lv.${after.current.level} ${after.current.title}!`,
        after.current.color,
        24
      );
    }
    this.notifyHud();
  }

  toggleCosmetic() {
    this.cosmeticEnabled = !this.cosmeticEnabled;
    localStorage.setItem('puffpuff_cosmetic', this.cosmeticEnabled ? 'on' : 'off');
    if (this.carts[0]) {
      this.carts[0].cosmeticEnabled = this.cosmeticEnabled;
    }
    this.notifyHud();
  }

  rollWind(initial = false) {
    if (initial) {
      this.wind = Math.round((Math.random() * 14 - 7) * 10) / 10;
    } else {
      const delta = (Math.random() - 0.5) * 8;
      this.wind = Math.max(
        -WORLD.MAX_WIND,
        Math.min(WORLD.MAX_WIND, Math.round((this.wind + delta) * 10) / 10)
      );
    }
  }

  beginNextTurn(firstTurn = false) {
    if (this.checkVictory()) return;

    const aliveCarts = this.carts.filter((c) => c.alive);
    aliveCarts.sort((a, b) => a.timelineTick - b.timelineTick);
    this.activeActor = aliveCarts[0];

    if (!firstTurn) {
      this.turnNumber++;
      if (this.turnNumber % 2 === 1) {
        this.rollWind(false);
      }
      // 매 3턴마다 날씨 랜덤 변경 (맑음 <-> 비)
      if (this.turnNumber % 3 === 0) {
        const nextWeather = Math.random() < 0.45 ? 'RAIN' : 'CLEAR';
        if (nextWeather !== this.weather) {
          this.setWeather(nextWeather);
        }
      }
      // 초반 1~3턴 제외, 최소 5턴 쿨타임 후 12% 확률로만 드물게 회오리 발생
      if (
        this.turnNumber >= 4 &&
        this.turnNumber - (this.lastTornadoTurn || 0) >= 5 &&
        Math.random() < 0.12
      ) {
        this.lastTornadoTurn = this.turnNumber;
        this.spawnTornado(this.activeActor);
      }

      // 터진 하늘 보급 박스 리스폰 카운트
      if (!this.skyBox.active) {
        if (this.skyBox.respawnIn > 0) this.skyBox.respawnIn--;
        if (this.skyBox.respawnIn <= 0) {
          this.spawnSkyBox();
        }
      }
    }

    this.activeActor.fuel = this.activeActor.powerUpTurns > 0 ? 150 : this.activeActor.maxFuel;
    this.activeActor.useUltimate = false;
    this.phase = 'AIM';
    this.turnTimerFrames = 20 * 60;
    this.turnTimeLeft = 20;
    this.dragState.active = false;

    this.spawnFloatingText(
      this.activeActor.x,
      this.activeActor.y - 78,
      `${this.activeActor.displayName} 차례!`,
      '#FEF08A',
      17
    );

    if (this.activeActor.controller === 'ai') {
      this.prepareAITurn();
    }

    this.notifyHud();
  }

  prepareAITurn() {
    const plan = computeAIShot({
      actor: this.activeActor,
      carts: this.carts,
      wind: this.wind,
      weather: this.weather,
      terrain: this.terrain,
      presetKey: this.aiPreset,
    });
    this.aiState.plan = plan;
    this.aiState.waitFrames = 32;
    this.aiState.flightTicks = 0;
  }

  /**
   * 현재 액터의 캡슐탄 발사 (반동 · 발사 진동 · 전술 스킬 · 궁극탄 처리)
   */
  playLaunchJuice(actor, muzzle, { isHeavy = false, isUltimate = false } = {}) {
    const powerRatio = Math.max(0.15, Math.min(1, (actor.aimPower || 60) / 100));
    const vibMs = isUltimate ? 70 : powerRatio >= 0.75 || isHeavy ? 45 : 25;
    try {
      window.AndroidBridge?.vibrate?.(vibMs);
      navigator.vibrate?.(vibMs);
    } catch {
      // ignore
    }

    actor.recoil = isUltimate ? 1.35 : isHeavy ? 1.15 : 0.9 + powerRatio * 0.25;
    const launchShake = isUltimate
      ? 14
      : isHeavy
        ? 10
        : 4.5 + powerRatio * 5.5;
    this.renderer.addShake(launchShake);
    if (isUltimate || isHeavy || powerRatio >= 0.7) {
      this.renderer.addFlash(isUltimate ? '#FDBA74' : '#FEF08A', isUltimate ? 0.18 : 0.1);
      if (!this.isRemoteMatch) {
        this.hitstopFrames = Math.max(this.hitstopFrames, isUltimate ? 3 : 1);
      }
    }

    this.audio.playLaunch(powerRatio, isHeavy || isUltimate);
    this.shockwaves.push({
      x: muzzle.x,
      y: muzzle.y,
      r: 4,
      maxR: isUltimate ? 48 : isHeavy ? 38 : 26 + powerRatio * 10,
      alpha: 0.92,
      color: isUltimate ? '#F97316' : '#FEF08A',
    });
    this.shockwaves.push({
      x: muzzle.x,
      y: muzzle.y,
      r: 2,
      maxR: isUltimate ? 28 : 18,
      alpha: 0.85,
      color: '#FFFFFF',
    });
    // 포구 전방 방향성 스파크 + 연기 분출
    const rad = actor.getFireAngleRad ? actor.getFireAngleRad() : -Math.PI * 0.25;
    const sparkCount = isUltimate ? 24 : isHeavy ? 18 : 14;
    for (let i = 0; i < sparkCount; i++) {
      const spread = (Math.random() - 0.5) * 0.65;
      const spd = 2.6 + Math.random() * (4.2 + powerRatio * 3.5);
      this.particles.push({
        x: muzzle.x,
        y: muzzle.y,
        vx: Math.cos(rad + spread) * spd,
        vy: Math.sin(rad + spread) * spd,
        size: 2.2 + Math.random() * 3.4,
        color: i % 3 === 0 ? '#FFFFFF' : isUltimate ? '#FB923C' : '#FDE047',
        life: 16 + Math.floor(Math.random() * 14),
        maxLife: 30,
        gravity: 0.12,
      });
    }
  }

  fireActiveActor() {
    if (this.phase !== 'AIM' || !this.activeActor || !this.activeActor.alive) return false;

    const actor = this.activeActor;
    if (this.isRemoteMatch) {
      const muzzle = actor.getMuzzlePosition();
      this.playLaunchJuice(actor, muzzle, { isHeavy: actor.useUltimate, isUltimate: actor.useUltimate });
      this.onRemoteAction?.({
        type: 'FIRE',
        elevation: actor.aimElevation,
        power: actor.aimPower,
        facing: actor.facing,
        shellKey: actor.selectedShell,
      });
      return true;
    }
    const shellSpec = SHELLS[actor.selectedShell] || SHELLS.ACORN_SPLIT;
    const skillSpec = SKILL_MODES[actor.skillMode] || SKILL_MODES.NORMAL;
    const isUltimate = actor.useUltimate && actor.ultGauge >= 100;

    // 이전 턴 영점 기억 저장
    actor.lastElevation = actor.aimElevation;
    actor.lastPower = actor.aimPower;

    // 행동 무게(탄종 + 스킬 무게 + 연료 소모) 타임라인 반영
    const fuelUsed = actor.maxFuel - actor.fuel;
    actor.timelineTick +=
      shellSpec.weightCost +
      (isUltimate ? 45 : skillSpec.extraWeight) +
      Math.round(fuelUsed * 0.35);

    if (isUltimate) {
      actor.ultGauge = 0;
      actor.useUltimate = false;
      actor.skillMode = 'NORMAL';
      this.spawnFloatingText(actor.x, actor.y - 84, `🔥 ${actor.spec.ultimateName}!`, '#F97316', 21);
    } else if (skillSpec.id !== 'NORMAL') {
      this.spawnFloatingText(actor.x, actor.y - 80, `💥 ${skillSpec.name}!`, skillSpec.color, 19);
    }

    // 실제 첫 발 발사 (하늘 보급 박스 1턴 성능업 적용 여부 확인)
    const hadPowerUp = actor.powerUpTurns > 0;
    this.spawnSingleShot(actor, shellSpec, skillSpec, isUltimate, 0, hadPowerUp);

    // 더블 스냅(2연발)일 경우 14프레임 뒤 후속탄 예약
    if (!isUltimate && skillSpec.shots === 2) {
      this.pendingFollowUpShots.push({
        delayFrames: 14,
        actor,
        shellSpec,
        skillSpec,
        hadPowerUp,
      });
    }

    if (hadPowerUp) {
      actor.powerUpTurns = 0;
    }

    // 발사 후 다음 턴을 위해 스킬 모드 자동 초기화
    if (!isUltimate && actor.skillMode !== 'NORMAL') {
      actor.skillMode = 'NORMAL';
    }

    this.phase = 'FLIGHT';
    this.dragState.active = false;
    this.aiState.flightTicks = 0;
    this.notifyHud();
    return true;
  }

  spawnSingleShot(actor, shellSpec, skillSpec, isUltimate, powerOffset = 0, hadPowerUp = false) {
    const muzzle = actor.getMuzzlePosition();
    const { vx, vy } = actor.getLaunchVelocity(
      actor.aimElevation,
      Math.min(100, Math.max(15, actor.aimPower + powerOffset)),
      actor.facing
    );

    const isHeavySkill =
      isUltimate ||
      hadPowerUp ||
      ['POWER_BOOST', 'AQUA_DIG', 'MAGNET_PULL', 'BUBBLE_LIFT'].includes(skillSpec.effectId);
    const dmgMult = hadPowerUp ? 1.5 : 1.0;
    const radMult = hadPowerUp ? 1.4 : 1.0;
    const dmg = Math.round((isUltimate ? 54 : shellSpec.damage * skillSpec.damageMult) * dmgMult);
    const radius = Math.round((isUltimate ? 68 : shellSpec.craterRadius * skillSpec.radiusMult) * radMult);

    const proj = new CapsuleProjectile({
      ownerId: actor.id,
      shellKey: actor.selectedShell,
      x: muzzle.x,
      y: muzzle.y,
      vx,
      vy,
      overrideDamage: dmg,
      overrideRadius: radius,
      extraBounces: isUltimate ? 0 : (skillSpec.extraBounces || 0),
      skillEffect: isUltimate ? 'ULTIMATE' : (skillSpec.effectId || 'NORMAL'),
      isHeavySkill,
      isUltimate,
      ultCharId: isUltimate ? actor.spec.id : null,
    });
    proj.isPowerUp = hadPowerUp;

    this.projectiles.push(proj);

    // 발사 손맛: 탄성 반동 + 진동 + 포구 충격파 2중 링 + 전방 스파크 콘 + 카메라 킥!
    this.playLaunchJuice(actor, muzzle, { isHeavy: isHeavySkill, isUltimate });
  }

  triggerAirSkill() {
    if (this.phase !== 'FLIGHT') return false;
    if (this.isRemoteMatch) {
      this.audio.playAirTrigger();
      this.onRemoteAction?.({ type: 'AIR_TRIGGER' });
      return true;
    }
    let triggeredAny = false;
    const newlySpawned = [];

    for (const proj of this.projectiles) {
      if (proj.canAirTrigger()) {
        const children = proj.triggerAirSkill();
        newlySpawned.push(...children);
        triggeredAny = true;
        this.renderer.addShake(4.5);
        this.spawnBurst(proj.x, proj.y, '#38BDF8', 16, 4.5);
        this.spawnFloatingText(proj.x, proj.y - 24, proj.spec.triggerLabel, '#38BDF8', 18);
      }
    }

    if (triggeredAny) {
      this.projectiles.push(...newlySpawned);
      this.audio.playAirTrigger();
      this.notifyHud();
    }
    return triggeredAny;
  }

  /**
   * 폭발 처리: 지형 굴착 + 물리 블록 타격 + 통통카 피해 + 강한 스킬 화면 떨림 & 히트스탑
   */
  detonateAt(
    cx,
    cy,
    radius,
    damage,
    blockBonus = 1.0,
    color = '#FB923C',
    customLabel = null,
    { isHeavySkill = false, isUltimate = false, ultCharId = null, skillEffect = 'NORMAL' } = {}
  ) {
    if (isUltimate || isHeavySkill) {
      this.audio.playHeavyImpact();
      this.renderer.addShake(isUltimate ? 28 : 19);
      this.renderer.addFlash(isUltimate ? '#FDBA74' : '#FEF08A', isUltimate ? 0.44 : 0.25);
      this.hitstopFrames = isUltimate ? 6 : 3;
    } else {
      this.audio.playExplosion(radius);
      this.renderer.addShake(Math.min(20, Math.max(10, radius * 0.4)));
      this.renderer.addFlash('#FEF3C7', customLabel ? 0.22 : 0.13);
      this.hitstopFrames = customLabel ? 3 : 2;
    }

    // 1) 지형 실시간 원형 굴착 + 물리 지반 진동 & 분출 효과
    const carvedCells = this.terrain.carveCrater(cx, cy, radius);
    if (carvedCells > 0) {
      const vibMs = isUltimate ? 200 : isHeavySkill ? 140 : 90;
      try {
        window.AndroidBridge?.vibrate?.(vibMs);
        navigator.vibrate?.(isUltimate ? [70, 30, 120] : [55, 22, 65]);
      } catch {
        // ignore vibration errors
      }
      this.spawnGroundImpactFx(cx, cy, radius, color, isHeavySkill || isUltimate);
      // 지반 충격으로 근처 캐릭터가 땅 울림에 살짝 '통!' 튀어오르는 물리 반응
      const tremorRadius = radius * 2.1;
      for (const c of this.carts) {
        if (!c.alive || !c.grounded) continue;
        const d = Math.hypot(c.x - cx, c.y - cy);
        if (d >= radius * 1.35 && d < tremorRadius) {
          const tRatio = 1 - d / tremorRadius;
          c.applyKnockback((c.x >= cx ? 1 : -1) * 1.4 * tRatio, -2.8 * tRatio);
        }
      }
    }

    // 2) 물리 블록 충격파 및 연쇄 폭약통 유폭 체크
    this.structures.applyExplosion(
      cx,
      cy,
      radius,
      damage,
      blockBonus * (isUltimate ? 1.6 : 1.0),
      this.chainExplosionQueue
    );

    // 3) 캐릭터 통통카 범위 피해 & 물리 넉백 (스킬별 특수 물리 효과 반영)
    const dmgRadius = radius * (skillEffect === 'MAGNET_PULL' ? 2.1 : 1.52);
    let hitEnemyCount = 0;

    for (const cart of this.carts) {
      if (!cart.alive) continue;
      const dist = Math.hypot(cart.x - cx, cart.y - 14 - cy);
      if (dist < dmgRadius) {
        const ratio = Math.max(0.24, 1 - dist / (dmgRadius + 12));
        const finalDmg = Math.max(5, Math.round(damage * ratio));
        cart.takeDamage(finalDmg);

        const ang = Math.atan2(cart.y - 16 - cy, cart.x - cx);
        if (skillEffect === 'MAGNET_PULL') {
          // 치치 중력 자석탄: 적을 폭발 중심 쪽으로 끌어당김!
          const pullAng = Math.atan2(cy - (cart.y - 14), cx - cart.x);
          cart.applyKnockback(Math.cos(pullAng) * 6.5 * ratio, -3.2 * ratio);
        } else if (skillEffect === 'BUBBLE_LIFT' || (isUltimate && ultCharId === 'PPUKKU')) {
          // 뿌꾸 버블 부양탄 / 간헐천: 적을 하늘 높이 띄워 낙사 유도!
          const knock = 4.2 * ratio;
          cart.applyKnockback(Math.cos(ang) * knock, -8.2 * ratio);
        } else {
          const knock = 6.5 * ratio * (radius / 42);
          cart.applyKnockback(Math.cos(ang) * knock, Math.sin(ang) * knock - 2.6 * ratio);
        }

        this.spawnFloatingText(cart.x, cart.y - 46, `-${finalDmg}`, '#F87171', isHeavySkill ? 23 : 20);

        // 크게 맞았을 때(22 이상 피해) 주인을 쳐다보는 불쌍한 얼굴 확대 컷인 발동!
        if (finalDmg >= 22 && cart.alive) {
          this.pityCutin = {
            active: true,
            cart,
            life: 105,
            maxLife: 105,
          };
        }

        if (this.activeActor && this.activeActor.teamId !== cart.teamId) {
          hitEnemyCount++;
          this.activeActor.setMood('happy', 100);
        }
      }
    }

    if (hitEnemyCount > 0 && this.activeActor && !isUltimate) {
      this.activeActor.addUltGauge(hitEnemyCount * 24);
    }
    if (hitEnemyCount > 0 && this.activeActor?.slotIndex === 0) {
      this.grantXp(hitEnemyCount * 15, '명중');
    }

    if (customLabel) {
      this.spawnFloatingText(cx, cy - 34, customLabel, '#FDE047', isHeavySkill ? 22 : 19);
    }

    // 4) 다중 쇼크웨이브 및 파편 폭발
    this.shockwaves.push({ x: cx, y: cy, r: 8, maxR: radius * 1.45, alpha: 0.98, color });
    if (isHeavySkill || isUltimate) {
      this.shockwaves.push({ x: cx, y: cy, r: 4, maxR: radius * 2.0, alpha: 0.75, color: '#FEF08A' });
    }
    this.spawnBurst(cx, cy, color, isUltimate ? 38 : 24, isUltimate ? 7.8 : 5.8);
    this.spawnBurst(cx, cy, '#D99B66', isUltimate ? 20 : 12, 5.0, true);

    // 토리 궁극기: 착탄 직후 메가 해머 2차 지반 충격 예약
    if (isUltimate && ultCharId === 'TORI') {
      this.chainExplosionQueue.push({
        x: cx,
        y: cy + 20,
        radius: 52,
        damage: 24,
        color: '#FACC15',
        label: '메가 해머 2차 충격!',
        isHeavySkill: true,
      });
    }
  }

  /**
   * 바닥 착탄 시 물리적인 지반 분출(위로 솟구치는 빵/크림 덩어리 + 좌우 먼지 기둥 + 3중 충격파)
   */
  spawnGroundImpactFx(cx, cy, radius, color = '#FB923C', isHeavy = false) {
    // 1) 다중 충격파 링 (화이트 플래시 코어 + 컬러 링 + 외곽 지반 파동)
    this.shockwaves.push({ x: cx, y: cy, r: 5, maxR: radius * 1.15, alpha: 0.98, color: '#FFFFFF' });
    this.shockwaves.push({ x: cx, y: cy, r: 10, maxR: radius * (isHeavy ? 2.15 : 1.75), alpha: 0.9, color });

    // 2) 위로 솟구쳤다가 중력으로 떨어지는 빵 부스러기·크림·화염 파편 분수
    const crumbColors = ['#D99B66', '#B45309', '#FEF3C7', '#FDE68A', color];
    const fountainCount = isHeavy ? 30 : 20;
    for (let i = 0; i < fountainCount; i++) {
      const spread = (Math.random() - 0.5) * Math.PI * 0.85; // 위쪽 부채꼴 (-76° ~ +76°)
      const ang = -Math.PI * 0.5 + spread;
      const spd = (isHeavy ? 4.2 : 3.0) + Math.random() * (isHeavy ? 6.5 : 4.8);
      const life = 28 + Math.floor(Math.random() * 26);
      this.particles.push({
        x: cx + (Math.random() - 0.5) * radius * 0.45,
        y: cy - 2,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.5,
        size: 3.4 + Math.random() * 5.2,
        color: crumbColors[i % crumbColors.length],
        square: i % 3 !== 0,
        rot: Math.random() * Math.PI,
        life,
        maxLife: life,
      });
    }

    // 3) 바닥을 타고 좌우로 낮게 밀려나는 몽글 연기/먼지 기둥
    const dustCount = isHeavy ? 14 : 9;
    for (let i = 0; i < dustCount; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const spd = 1.6 + Math.random() * (isHeavy ? 5.2 : 3.8);
      const life = 22 + Math.floor(Math.random() * 18);
      this.particles.push({
        x: cx + dir * (4 + Math.random() * 10),
        y: cy - 3,
        vx: dir * spd,
        vy: -(0.6 + Math.random() * 1.8),
        size: 6.5 + Math.random() * 6.5,
        color: i % 3 === 0 ? '#FFFBEB' : '#E2E8F0',
        square: false,
        rot: 0,
        life,
        maxLife: life,
      });
    }
  }

  spawnBurst(x, y, color, count = 14, maxSpeed = 4.5, square = false) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * maxSpeed;
      const life = 22 + Math.floor(Math.random() * 24);
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.2,
        size: 3 + Math.random() * 4.8,
        color,
        square,
        rot: Math.random() * Math.PI,
        life,
        maxLife: life,
      });
    }
  }

  spawnFloatingText(x, y, text, color = '#FDE047', size = 18) {
    this.floatingTexts.push({
      x,
      y,
      text,
      color,
      size,
      life: 58,
    });
  }

  checkVictory() {
    const aliveTeams = new Set(this.carts.filter((c) => c.alive).map((c) => c.teamId));
    if (aliveTeams.size <= 1) {
      this.phase = 'GAME_OVER';
      const survivors = this.carts.filter((c) => c.alive);
      if (survivors.length === 0) {
        this.winnerText = '무승부! 동시 아웃!';
      } else if (this.gameMode === '2v2_team') {
        const winTeam = survivors[0].teamId === 1 ? 'A팀' : 'B팀';
        this.winnerText = `${winTeam} 승리!`;
      } else {
        const winCart = survivors[0];
        const dropWin = this.carts.some((c) => !c.alive && c.droppedOut && c.teamId !== winCart.teamId);
        this.winnerText = dropWin
          ? `${winCart.displayName} 추락 완승!`
          : `${winCart.displayName} 승리!`;
      }
      if (this.carts[0]?.alive) {
        this.grantXp(50, '승리');
      } else {
        this.grantXp(15, '참여');
      }
      this.notifyHud();
      return true;
    }
    return false;
  }

  tick(heldKeys) {
    this.frameCount++;

    if (this.isRemoteMatch) {
      if (this.phase === 'AIM' && this.activeActor?.controller === 'human' && this.frameCount % 4 === 0) {
        if (heldKeys.has('ArrowLeft') || heldKeys.has('KeyA') || heldKeys.has('UI_LEFT')) {
          this.onRemoteAction?.({ type: 'MOVE', dir: -1 });
        } else if (heldKeys.has('ArrowRight') || heldKeys.has('KeyD') || heldKeys.has('UI_RIGHT')) {
          this.onRemoteAction?.({ type: 'MOVE', dir: 1 });
        }
      }
      // 60fps 부드러운 온라인 캐릭터 위치 보간 + 발사체 외삽 이동
      for (const c of this.carts) {
        if (typeof c._targetX === 'number' && typeof c._targetY === 'number') {
          const dx = c._targetX - c.x;
          const dy = c._targetY - c.y;
          if (Math.hypot(dx, dy) > 120) {
            c.x = c._targetX;
            c.y = c._targetY;
          } else {
            c.x += dx * 0.35;
            c.y += dy * 0.35;
          }
        }
      }
      for (const p of this.projectiles) {
        if (!p.active) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += WORLD.GRAVITY;
        p.rotation = (p.rotation || 0) + 0.22;
        if (this.frameCount % 2 === 0) {
          p.trail.push({ x: p.x, y: p.y, alpha: 1.0 });
          if (p.trail.length > 22) p.trail.shift();
        }
      }
      this.updateVisualEffects();
      this.renderer.render({
        terrain: this.terrain,
        structures: this.structures,
        carts: this.carts,
        projectiles: this.projectiles,
        particles: this.particles,
        shockwaves: this.shockwaves,
        floatingTexts: this.floatingTexts,
        wind: this.wind,
        weather: this.weather,
        tornado: this.tornado,
        skyBox: this.skyBox,
        fixedBoxes: this.fixedBoxes,
        pityCutin: this.pityCutin,
        phase: this.phase,
        activeActor: this.activeActor,
        dragState: this.dragState,
        frameCount: this.frameCount,
      });
      return;
    }

    // 강한 스킬 임팩트 히트스탑 (찰나의 정지로 타격감 극대화)
    if (this.hitstopFrames > 0) {
      this.hitstopFrames--;
      this.renderer.render({
        terrain: this.terrain,
        structures: this.structures,
        carts: this.carts,
        projectiles: this.projectiles,
        particles: this.particles,
        shockwaves: this.shockwaves,
        floatingTexts: this.floatingTexts,
        wind: this.wind,
        phase: this.phase,
        activeActor: this.activeActor,
        dragState: this.dragState,
        frameCount: this.frameCount,
      });
      return;
    }

    // 1) Matter.js 강체 물리 스텝 + 넘어지는 건물 바람 외력 적용
    this.structures.applyWind(this.wind);
    Matter.Engine.update(this.matterEngine, 1000 / 60);

    // 1.5) 랜덤 회오리 & 하늘 보급 박스 둥실 이동
    if (this.tornado.alertFrames > 0) {
      this.tornado.alertFrames--;
      if (this.tornado.alertFrames === 0) this.notifyHud();
    }
    if (this.tornado.active) {
      this.stepTornado();
    }
    if (this.skyBox.active) {
      this.skyBox.x += this.skyBox.vx;
      this.skyBox.phase += 0.05;
      this.skyBox.y = this.skyBox.baseY + Math.sin(this.skyBox.phase) * 16;
      if (this.skyBox.x < 240 || this.skyBox.x > WORLD.WIDTH - 240) {
        this.skyBox.vx *= -1;
      }
    }

    // 2) 구조물 블록 상태 및 낙하 압사(Crush) 체크
    this.structures.update(
      this.carts,
      (brokenBlk) => {
        this.audio.playBlockBreak();
        if (this.activeActor) this.activeActor.addUltGauge(6);
        this.spawnBurst(
          brokenBlk.body.position.x,
          brokenBlk.body.position.y,
          brokenBlk.mat.fill,
          10,
          3.8,
          true
        );
      },
      (crushedCart, blk, crushDmg) => {
        crushedCart.takeDamage(crushDmg);
        this.renderer.addShake(8);
        this.audio.playBlockBreak();
        this.spawnFloatingText(
          crushedCart.x,
          crushedCart.y - 52,
          `블록 압사! -${crushDmg}`,
          '#FB923C',
          18
        );
      },
      this.chainExplosionQueue
    );

    // 예약된 폭약통 유폭 / 2차 충격 실행
    while (this.chainExplosionQueue.length > 0) {
      const ex = this.chainExplosionQueue.shift();
      this.detonateAt(ex.x, ex.y, ex.radius, ex.damage, 1.35, ex.color, ex.label, {
        isHeavySkill: true,
      });
    }

    // 더블 스냅 후속탄 발사 처리
    for (let i = this.pendingFollowUpShots.length - 1; i >= 0; i--) {
      const item = this.pendingFollowUpShots[i];
      item.delayFrames--;
      if (item.delayFrames <= 0) {
        this.pendingFollowUpShots.splice(i, 1);
        if (item.actor.alive) {
          this.spawnSingleShot(item.actor, item.shellSpec, item.skillSpec, false, 3, item.hadPowerUp);
        }
      }
    }

    // 3) 캐릭터 통통카 중력·안착·드롭아웃 업데이트
    for (const cart of this.carts) {
      cart.update(this.terrain, (fallenCart) => {
        this.audio.playDropOut();
        this.renderer.addShake(15);
        this.spawnBurst(fallenCart.x, WORLD.SEA_LEVEL - 6, '#FFFFFF', 28, 6.4);
        this.spawnFloatingText(
          Math.min(WORLD.WIDTH - 120, Math.max(120, fallenCart.x)),
          WORLD.SEA_LEVEL - 42,
          `${fallenCart.displayName} 구름 아래로 추락!!`,
          '#38BDF8',
          23
        );
        this.notifyHud();
      });
    }

    // 4) 페이즈별 진행 로직
    let handledHumanMove = false;
    if (this.phase === 'AIM' && this.activeActor) {
      if (!this.activeActor.alive) {
        this.enterSettlePhase();
      } else if (this.activeActor.controller === 'human') {
        this.handleHumanContinuousInput(heldKeys);
        handledHumanMove = true;
        if (this.turnTimerFrames > 0) {
          this.turnTimerFrames--;
          const sec = Math.max(0, Math.ceil(this.turnTimerFrames / 60));
          if (sec !== this.turnTimeLeft) {
            this.turnTimeLeft = sec;
            if (sec >= 1 && sec <= 5) {
              this.audio.playMove?.();
            }
            this.notifyHud();
          }
          if (this.turnTimerFrames <= 0) {
            this.spawnFloatingText(
              this.activeActor.x,
              this.activeActor.y - 78,
              '⏱ 시간 초과! 턴 넘김!',
              '#FB7185',
              19
            );
            this.activeActor.timelineTick += 100;
            this.enterSettlePhase();
          }
        }
      } else {
        this.stepAITurn();
      }
    } else if (this.phase === 'FLIGHT') {
      this.stepProjectiles();
    } else if (this.phase === 'SETTLE') {
      this.stepSettlePhase();
    }

    // 4.5) 회오리가 다가올 때는 내 턴이 아니어도(AI 턴·비행·판정 중) 언제든 좌우 대피 이동 허용!
    if (this.tornado.active && !handledHumanMove && this.phase !== 'GAME_OVER') {
      const humanCart = this.carts.find((c) => c.controller === 'human' && c.alive);
      if (humanCart) {
        const prevFuel = humanCart.fuel;
        if (humanCart.fuel < 2) humanCart.fuel = 2;
        let moved = false;
        if (heldKeys.has('ArrowLeft') || heldKeys.has('KeyA') || heldKeys.has('UI_LEFT')) {
          if (humanCart.drive(-1, this.terrain)) moved = true;
          else humanCart.facing = -1;
        } else if (heldKeys.has('ArrowRight') || heldKeys.has('KeyD') || heldKeys.has('UI_RIGHT')) {
          if (humanCart.drive(1, this.terrain)) moved = true;
          else humanCart.facing = 1;
        }
        humanCart.fuel = prevFuel;
        if (moved) this.notifyHud();
      }
    }

    // 5) 이펙트 파티클 및 플로팅 텍스트 감쇠
    this.updateVisualEffects();

    // 6) 화면 렌더링
    this.renderer.render({
      terrain: this.terrain,
      structures: this.structures,
      carts: this.carts,
      projectiles: this.projectiles,
      particles: this.particles,
      shockwaves: this.shockwaves,
      floatingTexts: this.floatingTexts,
      wind: this.wind,
      weather: this.weather,
      tornado: this.tornado,
      skyBox: this.skyBox,
      fixedBoxes: this.fixedBoxes,
      pityCutin: this.pityCutin,
      phase: this.phase,
      activeActor: this.activeActor,
      dragState: this.dragState,
      frameCount: this.frameCount,
    });
  }

  stepTornado() {
    const t = this.tornado;
    t.x += t.vx;
    t.life--;
    if (t.life > 40 && t.life % 115 === 0) {
      this.audio.playTornadoBreeze(1.5);
    }
    const surfY = this.terrain.findTopSurface(t.x);
    if (surfY !== null) t.y = surfY;

    // 회오리 주변 블록 흔들기
    for (const blk of this.structures.blocks) {
      if (blk.destroyed) continue;
      if (Math.abs(blk.body.position.x - t.x) < 58) {
        Matter.Sleeping.set(blk.body, false);
        Matter.Body.applyForce(blk.body, blk.body.position, {
          x: t.vx * 0.0008,
          y: -0.0012,
        });
      }
    }

    // 회오리에 걸린 비행 탄환을 경기장 안쪽 랜덤 방향으로 튕겨 날리기!
    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      if (proj.tornadoCooldown > 0) {
        proj.tornadoCooldown--;
        continue;
      }
      if (Math.abs(proj.x - t.x) < 58 && proj.y >= t.y - 290 && proj.y <= t.y + 30) {
        proj.tornadoCooldown = 36;
        // 경기장 안전 범위(180 ~ WORLD.WIDTH - 180) 내 랜덤 착탄 지점을 향해 날림
        const targetX = 180 + Math.random() * (WORLD.WIDTH - 360);
        const flightFrames = 44 + Math.random() * 34;
        proj.vx = Math.max(-16.5, Math.min(16.5, (targetX - proj.x) / flightFrames));
        proj.vy = -(7.5 + Math.random() * 7.5);
        proj.drillActive = false;

        this.audio.playBounce();
        this.renderer.addShake(6);
        this.spawnBurst(proj.x, proj.y, '#A5F3FC', 16, 4.8);
        this.spawnFloatingText(proj.x, proj.y - 28, '🌪️ 회오리 튕김! 랜덤 비행!', '#67E8F9', 18);
      }
    }

    // 회오리에 휩쓸린 캐릭터 위치 강제 이동 + 기존 영점 조준 무효화 (구멍 안 대피 시 면역!)
    for (const cart of this.carts) {
      if (!cart.alive || t.hitCartIds.has(cart.id)) continue;
      if (Math.abs(cart.x - t.x) < 42 && Math.abs(cart.y - t.y) < 110) {
        t.hitCartIds.add(cart.id);

        if (this.isShelteredInPit(cart)) {
          this.spawnFloatingText(cart.x, cart.y - 68, '🛡️ 구멍 대피! 태풍 회피!', '#4ADE80', 19);
          continue;
        }

        // 회오리는 캐릭터를 밀어 떨어뜨리지 않고(위치 고정!), 기존 조준(각도·파워)만 리셋!
        cart.tornadoImmuneFrames = 300;
        cart.setMood('panic', 110);

        // 기존 맞춰둔 영점 조준(각도 · 이전 파워) 완전 리셋! (똑같이 못 쏘도록 최소 ±14도 / ±15% 강제 변경)
        cart.lastElevation = null;
        cart.lastPower = null;
        const elevDelta = 14 + Math.floor(Math.random() * 14);
        const elevDir = cart.aimElevation + elevDelta <= 80 ? (Math.random() < 0.5 && cart.aimElevation - elevDelta >= 15 ? -1 : 1) : -1;
        cart.aimElevation = Math.min(80, Math.max(15, cart.aimElevation + elevDir * elevDelta));

        const powerDelta = 15 + Math.floor(Math.random() * 15);
        const powerDir = cart.aimPower + powerDelta <= 95 ? (Math.random() < 0.5 && cart.aimPower - powerDelta >= 20 ? -1 : 1) : -1;
        cart.aimPower = Math.min(95, Math.max(20, cart.aimPower + powerDir * powerDelta));

        this.renderer.addShake(11);
        this.audio.playBounce();
        this.spawnBurst(cart.x, cart.y - 20, '#A5F3FC', 18, 5.2);
        this.spawnFloatingText(cart.x, cart.y - 72, '🌪️ 회오리! 각도·파워 리셋!', '#38BDF8', 20);
        this.notifyHud();
      }
    }

    if (t.life <= 0 || t.x < 60 || t.x > WORLD.WIDTH - 60) {
      t.active = false;
    }
  }

  handleHumanContinuousInput(heldKeys) {
    const actor = this.activeActor;
    let changed = false;

    if (heldKeys.has('ArrowLeft') || heldKeys.has('KeyA') || heldKeys.has('UI_LEFT')) {
      if (actor.drive(-1, this.terrain)) changed = true;
      else if (actor.facing !== -1) {
        actor.facing = -1;
        changed = true;
      }
    } else if (heldKeys.has('ArrowRight') || heldKeys.has('KeyD') || heldKeys.has('UI_RIGHT')) {
      if (actor.drive(1, this.terrain)) changed = true;
      else if (actor.facing !== 1) {
        actor.facing = 1;
        changed = true;
      }
    }

    if (this.frameCount % 3 === 0) {
      if (heldKeys.has('ArrowUp') || heldKeys.has('KeyW')) {
        actor.aimElevation = Math.min(85, actor.aimElevation + 1);
        changed = true;
      } else if (heldKeys.has('ArrowDown') || heldKeys.has('KeyS')) {
        actor.aimElevation = Math.max(5, actor.aimElevation - 1);
        changed = true;
      }
    }

    if (changed) this.notifyHud();
  }

  stepAITurn() {
    const plan = this.aiState.plan;
    const actor = this.activeActor;
    if (!plan || plan.skipTurn) {
      actor.timelineTick += 90;
      this.beginNextTurn(false);
      return;
    }

    if (this.aiState.waitFrames > 0) {
      this.aiState.waitFrames--;
      return;
    }

    if (plan.moveFrames > 0) {
      actor.drive(plan.moveDir, this.terrain);
      plan.moveFrames--;
      return;
    }

    actor.facing = plan.facing;
    actor.selectedShell = plan.shellKey;
    actor.aimElevation = plan.elevation;
    actor.aimPower = plan.power;
    actor.skillMode = plan.skillMode || 'NORMAL';
    actor.useUltimate = Boolean(plan.useUltimate);
    this.fireActiveActor();
  }

  stepProjectiles() {
    this.aiState.flightTicks++;
    if (this.aiState.flightTicks === 3) {
      this.notifyHud();
    }

    if (
      this.activeActor?.controller === 'ai' &&
      this.aiState.plan?.airTriggerFrame &&
      this.aiState.flightTicks === this.aiState.plan.airTriggerFrame
    ) {
      this.triggerAirSkill();
    }

    for (const proj of this.projectiles) {
      if (!proj.active) continue;

      // 지형 위 고정 랜덤 선물박스 명중 체크!
      for (const box of this.fixedBoxes) {
        if (!box.active) continue;
        if (Math.hypot(proj.x - box.x, proj.y - box.y) <= 28) {
          box.active = false;
          const owner = this.carts.find((c) => c.id === proj.ownerId);
          const roll = Math.floor(Math.random() * 4);
          let rewardText = '🎁 랜덤 선물! +50% 파워업!';
          if (owner && owner.alive) {
            owner.setMood('happy', 110);
            if (roll === 0) {
              owner.powerUpTurns = 1;
              rewardText = '🎁 랜덤 선물! 다음 턴 파워 +50%!';
            } else if (roll === 1) {
              owner.hp = Math.min(owner.maxHp, owner.hp + 25);
              rewardText = '💖 랜덤 선물! 체력 +25 회복!';
            } else if (roll === 2) {
              owner.addUltGauge(35);
              rewardText = '🔥 랜덤 선물! 궁극기 +35% 충전!';
            } else {
              owner.fuel = owner.maxFuel;
              rewardText = '💨 랜덤 선물! 남은 걸음 20걸음 충전!';
            }
          }
          this.audio.playSkillCharge();
          this.renderer.addShake(7);
          this.spawnBurst(box.x, box.y, '#F472B6', 24, 5.6);
          this.spawnFloatingText(box.x, box.y - 26, rewardText, '#FDE047', 20);
          this.notifyHud();
          break;
        }
      }

      proj.step(this.wind, this.weather, this.terrain, this.structures, this.carts, this.skyBox, {
        onHitSkyBox: (p) => {
          if (!this.skyBox.active) return;
          this.skyBox.active = false;
          this.skyBox.respawnIn = 3;
          const owner = this.carts.find((c) => c.id === p.ownerId);
          if (owner && owner.alive) {
            owner.powerUpTurns = 1;
            owner.setMood('happy', 120);
            if (owner.slotIndex === 0) this.grantXp(25, '하늘 보급');
          }
          this.audio.playSkillCharge();
          this.renderer.addShake(8);
          this.spawnBurst(this.skyBox.x, this.skyBox.y, '#FACC15', 26, 6.0);
          this.shockwaves.push({
            x: this.skyBox.x,
            y: this.skyBox.y,
            r: 6,
            maxR: 54,
            alpha: 0.95,
            color: '#FACC15',
          });
          this.spawnFloatingText(
            this.skyBox.x,
            this.skyBox.y - 24,
            '🎁 하늘 보급 명중! 다음 1턴 성능 UP! (+50%)',
            '#FDE047',
            21
          );
          this.notifyHud();
        },
        onDetonate: (p, x, y, directHit) => {
          if (directHit || p.isUltimate) {
            this.audio.playApplause();
          }
          this.detonateAt(
            x,
            y,
            p.craterRadius,
            directHit ? Math.round(p.damage * 1.15) : p.damage,
            p.spec.blockBonus,
            p.isUltimate ? '#F97316' : p.spec.color,
            p.isUltimate ? '🔥 궁극기 명중!' : directHit ? '👏 정통 직격!' : null,
            {
              isHeavySkill: p.isHeavySkill,
              isUltimate: p.isUltimate,
              ultCharId: p.ultCharId,
              skillEffect: p.skillEffect,
            }
          );
        },
        onBounce: (x, y, isJelly) => {
          this.audio.playBounce();
          this.renderer.addShake(2.5);
          this.spawnBurst(x, y, isJelly ? '#FF85B3' : '#FACC15', 8, 3.0);
          if (isJelly) {
            this.spawnFloatingText(x, y - 20, '통통 반사!', '#FF85B3', 16);
          }
        },
        onSplashOut: (p) => {
          this.spawnBurst(
            Math.min(WORLD.WIDTH - 20, Math.max(20, p.x)),
            WORLD.SEA_LEVEL,
            '#FFFFFF',
            10,
            3.2
          );
        },
      });
    }

    const anyActive = this.projectiles.some((p) => p.active);
    if (!anyActive && this.pendingFollowUpShots.length === 0) {
      this.projectiles = [];
      this.enterSettlePhase();
    }
  }

  enterSettlePhase() {
    this.phase = 'SETTLE';
    this.settleCounter = 0;
    this.settleElapsed = 0;
    this.notifyHud();
  }

  stepSettlePhase() {
    this.settleElapsed++;
    const cartsGrounded = this.carts.every((c) => !c.alive || c.grounded);
    const blocksQuiet = this.structures.areAllBlocksSettled();

    if (cartsGrounded && blocksQuiet && this.chainExplosionQueue.length === 0) {
      this.settleCounter++;
    } else {
      this.settleCounter = 0;
    }

    if (this.settleCounter >= 20 || this.settleElapsed >= 195) {
      this.beginNextTurn(false);
    }
  }

  updateVisualEffects() {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.r += (sw.maxR - sw.r) * 0.24;
      sw.alpha -= 0.06;
      if (sw.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += 0.14;
      pt.rot += 0.08;
      pt.life--;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 0.75;
      ft.life--;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.pityCutin.active) {
      this.pityCutin.life--;
      if (this.pityCutin.life <= 0) {
        this.pityCutin.active = false;
      }
    }
  }

  notifyHud() {
    this.onHudUpdate?.({
      turnNumber: this.turnNumber,
      turnTimeLeft: this.turnTimeLeft,
      wind: this.wind,
      weather: this.weather,
      tornadoActive: this.tornado.alertFrames > 0,
      phase: this.phase,
      activeActor: this.activeActor,
      carts: this.carts,
      projectiles: this.projectiles,
      winnerText: this.winnerText,
      gameMode: this.gameMode,
      mapPreset: this.mapPreset,
      aiPreset: this.aiPreset,
      playerCharKey: this.playerCharKey,
      muted: this.audio.muted,
      rankInfo: this.getRankInfo(),
      cosmeticEnabled: this.cosmeticEnabled,
      matchLabel: this.matchLabel || '',
    });
  }
}
