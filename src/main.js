// 말랑포포: 폭신폭신 공성전 — 메인 엔트리 및 입력·UI 바인딩
import { CHARACTERS, CHARACTER_LIST, SHELLS, SKILL_MODES, WORLD } from './config.js?v=27';
import { GameRenderer, drawSpiritAvatar, drawPetMagnifierFrame } from './renderer.js?v=41';
import { GameEngine } from './gameEngine.js?v=45';
import {
  loadUserProfile,
  saveUserProfile,
  loadFriends,
  addFriendById,
  resolveOpponentById,
  pickRandomOpponent,
  shortSchoolLabel,
  buildInviteUrl,
  parseInviteFromUrl,
  searchOpponents,
  sendChallengeSignal,
  subscribeChallenges,
  searchKoreanSchools,
} from './social.js?v=30';
import { initBannerAd, runAdCountdown } from './ads.js?v=46';

const canvas = document.getElementById('gameCanvas');
const renderer = new GameRenderer(canvas);

// DOM 요소 참조
const ui = {
  lobbyScreen: document.getElementById('lobbyScreen'),
  gameScreen: document.getElementById('gameScreen'),
  charAvatarGrid: document.getElementById('charAvatarGrid'),
  selectedCharPreviewCanvas: document.getElementById('selectedCharPreviewCanvas'),
  selectedCharBanner: document.getElementById('selectedCharBanner'),
  genderTabs: Array.from(document.querySelectorAll('.gender-tab')),
  startMatchBtn: document.getElementById('startMatchBtn'),
  backToLobbyBtn: document.getElementById('backToLobbyBtn'),
  modalLobbyBtn: document.getElementById('modalLobbyBtn'),
  turnTimelineBadge: document.getElementById('turnTimelineBadge'),
  rankBadgeBtn: document.getElementById('rankBadgeBtn'),
  windMeterFill: document.getElementById('windMeterFill'),
  windValueText: document.getElementById('windValueText'),
  weatherToggleBtn: document.getElementById('weatherToggleBtn'),
  tornadoTestBtn: document.getElementById('tornadoTestBtn'),
  canvasFrame: document.getElementById('canvasFrame'),
  envAlertStack: document.getElementById('envAlertStack'),
  modeSelect: document.getElementById('modeSelect'),
  charSelect: document.getElementById('charSelect'),
  mapSelect: document.getElementById('mapSelect'),
  aiSelect: document.getElementById('aiSelect'),
  muteBtn: document.getElementById('muteBtn'),
  restartBtn: document.getElementById('restartBtn'),
  floatingAirBtn: document.getElementById('floatingAirBtn'),
  gameOverModal: document.getElementById('gameOverModal'),
  winnerHeadline: document.getElementById('winnerHeadline'),
  modalRestartBtn: document.getElementById('modalRestartBtn'),
  fuelText: document.getElementById('fuelText'),
  fuelBarFill: document.getElementById('fuelBarFill'),
  moveLeftBtn: document.getElementById('moveLeftBtn'),
  moveRightBtn: document.getElementById('moveRightBtn'),
  shellDescText: document.getElementById('shellDescText'),
  shellBtns: Array.from(document.querySelectorAll('.shell-btn')),
  skillBtns: Array.from(document.querySelectorAll('.skill-chip')),
  ultBtn: document.getElementById('ultBtn'),
  ultPctText: document.getElementById('ultPctText'),
  angleMinusBtn: document.getElementById('angleMinusBtn'),
  anglePlusBtn: document.getElementById('anglePlusBtn'),
  angleValueText: document.getElementById('angleValueText'),
  prevShotText: document.getElementById('prevShotText'),
  powerMinusBtn: document.getElementById('powerMinusBtn'),
  powerPlusBtn: document.getElementById('powerPlusBtn'),
  powerRange: document.getElementById('powerRange'),
  powerValueText: document.getElementById('powerValueText'),
  fireActionBtn: document.getElementById('fireActionBtn'),

  // 프로필 · 친구 초대 · 반/학교 대전 · 랜덤 매칭 UI
  profileSummaryText: document.getElementById('profileSummaryText'),
  lobbyBgmBtn: document.getElementById('lobbyBgmBtn'),
  openProfileBtn: document.getElementById('openProfileBtn'),
  profileModal: document.getElementById('profileModal'),
  profileForm: document.getElementById('profileForm'),
  closeProfileModalBtn: document.getElementById('closeProfileModalBtn'),
  profUserId: document.getElementById('profUserId'),
  profNickname: document.getElementById('profNickname'),
  profSchool: document.getElementById('profSchool'),
  profGradeNum: document.getElementById('profGradeNum'),
  profClassNum: document.getElementById('profClassNum'),
  schoolAutocompleteList: document.getElementById('schoolAutocompleteList'),
  targetSchoolAutocomplete: document.getElementById('targetSchoolAutocomplete'),

  socialTabs: Array.from(document.querySelectorAll('.social-tab')),
  hubPanelFriend: document.getElementById('hubPanelFriend'),
  hubPanelSchool: document.getElementById('hubPanelSchool'),
  hubPanelRandom: document.getElementById('hubPanelRandom'),
  modeFieldWrap: document.getElementById('modeSelect')?.closest('.lobby-field'),

  friendIdInput: document.getElementById('friendIdInput'),
  addFriendBtn: document.getElementById('addFriendBtn'),
  friendQuickChips: document.getElementById('friendQuickChips'),
  copyInviteBtn: document.getElementById('copyInviteBtn'),
  inviteCopyToast: document.getElementById('inviteCopyToast'),

  mySchoolClassLabel: document.getElementById('mySchoolClassLabel'),
  schoolModePills: Array.from(document.querySelectorAll('.school-mode-pill')),
  targetClassWrap: document.getElementById('targetClassWrap'),
  targetClassInput: document.getElementById('targetClassInput'),
  targetSchoolWrap: document.getElementById('targetSchoolWrap'),
  targetSchoolInput: document.getElementById('targetSchoolInput'),

  matchmakingOverlay: document.getElementById('matchmakingOverlay'),
  matchmakingSpinner: document.getElementById('matchmakingSpinner'),
  matchmakingTitle: document.getElementById('matchmakingTitle'),
  matchmakingDetail: document.getElementById('matchmakingDetail'),
  cancelMatchmakingBtn: document.getElementById('cancelMatchmakingBtn'),

  petMagnifierOverlay: document.getElementById('petMagnifierOverlay'),
  petMagnifierCanvas: document.getElementById('petMagnifierCanvas'),
  petMoodBadge: document.getElementById('petMoodBadge'),
  closePetMagnifierBtn: document.getElementById('closePetMagnifierBtn'),

  searchScopePills: Array.from(document.querySelectorAll('.search-scope-pill')),
  opponentSearchInput: document.getElementById('opponentSearchInput'),
  opponentSearchList: document.getElementById('opponentSearchList'),

  challengeAlertModal: document.getElementById('challengeAlertModal'),
  challengeAlertTitle: document.getElementById('challengeAlertTitle'),
  challengeAlertText: document.getElementById('challengeAlertText'),
  acceptChallengeBtn: document.getElementById('acceptChallengeBtn'),
  declineChallengeBtn: document.getElementById('declineChallengeBtn'),

  interstitialAdOverlay: document.getElementById('interstitialAdOverlay'),
  closeInterstitialBtn: document.getElementById('closeInterstitialBtn'),
  rewardAdBtn: document.getElementById('rewardAdBtn'),
  rewardAdOverlay: document.getElementById('rewardAdOverlay'),
  closeRewardAdBtn: document.getElementById('closeRewardAdBtn'),
  googleAdContainer: document.querySelector('#googleAdFooterSlot .google-ad-container'),

  hudLeftName: document.getElementById('hudLeftName'),
  hudLeftHp: document.getElementById('hudLeftHp'),
  hudRightName: document.getElementById('hudRightName'),
  hudRightHp: document.getElementById('hudRightHp'),
  shellCycleBtn: document.getElementById('shellCycleBtn'),
  shellPopover: document.getElementById('shellPopover'),
};

const heldKeys = new Set();

const engine = new GameEngine({
  renderer,
  onHudUpdate: syncHud,
});

function syncHud(state) {
  const { turnNumber, wind, weather, tornadoActive, phase, activeActor, carts, projectiles, winnerText, muted, rankInfo, cosmeticEnabled, matchLabel } = state;

  // 내 턴이 돌아오거나 게임 종료 시 돋보기 쓰담기 오버레이 자동 닫기
  const isHumanAimNow = phase === 'AIM' && activeActor?.controller === 'human';
  if ((isHumanAimNow || phase === 'GAME_OVER') && typeof closePetMagnifier === 'function') {
    closePetMagnifier();
  }

  if (rankInfo?.current) {
    const cur = rankInfo.current;
    const nextTxt = rankInfo.next ? ` (${rankInfo.xp}/${rankInfo.next.minXp})` : ' (MAX)';
    ui.rankBadgeBtn.textContent = `${cur.badge} Lv.${cur.level} ${cur.title}${nextTxt}`;
    ui.rankBadgeBtn.classList.toggle('cosmetic-off', !cosmeticEnabled);
    ui.rankBadgeBtn.title = `계급 꾸미기: ${cosmeticEnabled ? '켜짐' : '꺼짐'} (성능 차이 없음 · 클릭해 전환)`;
  }

  // 1) 상단 중앙 플로팅 HUD (내 HP · 턴 · 상대 HP)
  const myCart = carts.find((c) => c.controller === 'human') || carts[0];
  const oppCart = carts.find((c) => c !== myCart) || carts[1];
  if (myCart && ui.hudLeftName && ui.hudLeftHp) {
    ui.hudLeftName.textContent = myCart.spec?.name || myCart.displayName;
    ui.hudLeftHp.textContent = `HP ${Math.max(0, myCart.hp)}`;
  }
  if (oppCart && ui.hudRightName && ui.hudRightHp) {
    ui.hudRightName.textContent = oppCart.spec?.name || oppCart.displayName;
    ui.hudRightHp.textContent = `HP ${Math.max(0, oppCart.hp)}`;
  }
  ui.turnTimelineBadge.textContent = matchLabel ? `${matchLabel} · T${turnNumber}` : `TURN ${turnNumber}`;

  // 2) 바람 게이지 업데이트
  const absWind = Math.abs(wind);
  const pct = Math.min(50, (absWind / WORLD.MAX_WIND) * 50);
  if (absWind < 0.2) {
    ui.windMeterFill.style.left = '50%';
    ui.windMeterFill.style.width = '0%';
    ui.windValueText.textContent = '무풍 0.0';
  } else if (wind > 0) {
    ui.windMeterFill.style.left = '50%';
    ui.windMeterFill.style.width = `${pct}%`;
    ui.windMeterFill.style.backgroundColor = '#38BDF8';
    ui.windValueText.textContent = `우풍 ${absWind.toFixed(1)} ▶`;
  } else {
    ui.windMeterFill.style.left = `${50 - pct}%`;
    ui.windMeterFill.style.width = `${pct}%`;
    ui.windMeterFill.style.backgroundColor = '#FB923C';
    ui.windValueText.textContent = `◀ 좌풍 ${absWind.toFixed(1)}`;
  }

  ui.muteBtn.textContent = muted ? '🔇' : '🔊';

  if (weather === 'RAIN') {
    ui.weatherToggleBtn.textContent = '🌧️';
    ui.weatherToggleBtn.classList.add('rain');
  } else {
    ui.weatherToggleBtn.textContent = '☀️';
    ui.weatherToggleBtn.classList.remove('rain');
  }

  // 2.5) 환경 & 재해 시각적 경고 배너 렌더링 (귀여운 동글체 + 말랑 스티커)
  const alerts = [];
  if (tornadoActive) {
    alerts.push({
      cls: 'tornado',
      text: '🌪️ 앗! 빙글빙글 회오리 주의보~ 날아가면 조준이 풀리니 꼭 붙잡아!',
    });
  }
  if (weather === 'RAIN') {
    alerts.push({
      cls: 'rain',
      text: '🌧️ 주륵주륵 비가 와요! 구슬이 촉촉해져서 멀리 못 날아가요~ (사거리 -20%)',
    });
  }
  if (Math.abs(wind) >= 7.5) {
    const dirTxt = wind > 0 ? '우풍 ▶' : '◀ 좌풍';
    alerts.push({
      cls: 'wind',
      text: `💨 바람이 쌩쌩! (${dirTxt} ${Math.abs(wind).toFixed(1)}) 역풍이면 구슬이 느려지고 블록도 흔들려요~`,
    });
  }

  ui.canvasFrame.classList.toggle('tornado-warning', Boolean(tornadoActive));
  ui.envAlertStack.innerHTML = alerts
    .map((a) => `<div class="env-alert ${a.cls}">${a.text}</div>`)
    .join('');

  // 3) 게임 오버 모달
  if (phase === 'GAME_OVER') {
    ui.winnerHeadline.textContent = winnerText;
    ui.gameOverModal.classList.remove('hidden');
  } else {
    ui.gameOverModal.classList.add('hidden');
  }

  // 4) 플레이어 상태 및 에어 트리거 버튼 전환
  const humanTurn = phase === 'AIM' && activeActor && activeActor.controller === 'human';
  const canPlayerAirTrigger =
    phase === 'FLIGHT' &&
    activeActor?.controller === 'human' &&
    projectiles.some((p) => p.canAirTrigger());

  if (canPlayerAirTrigger) {
    ui.floatingAirBtn.classList.remove('hidden');
    ui.fireActionBtn.disabled = false;
    ui.fireActionBtn.classList.add('air-mode');
    ui.fireActionBtn.textContent = '⚡ 기폭! (SPACE)';
  } else {
    ui.floatingAirBtn.classList.add('hidden');
    ui.fireActionBtn.classList.remove('air-mode');
    ui.fireActionBtn.disabled = !humanTurn;
    ui.fireActionBtn.textContent = humanTurn
      ? '🔥 볼살 발사'
      : phase === 'FLIGHT'
        ? '비행 중...'
        : phase === 'SETTLE'
          ? '판정 중...'
          : '상대 턴...';
  }

  // 5) 하단 조준/연료/탄종 패널 동기화 (내 캐릭터 기준 표시)
  const refActor =
    activeActor?.controller === 'human'
      ? activeActor
      : carts.find((c) => c.controller === 'human') || activeActor;

  if (refActor) {
    const fuelPct = Math.max(0, Math.round((refActor.fuel / refActor.maxFuel) * 100));
    ui.fuelText.textContent = `연료 ${fuelPct}%`;
    ui.fuelBarFill.style.width = `${fuelPct}%`;

    ui.angleValueText.textContent = `${refActor.aimElevation}°`;
    ui.powerRange.value = String(refActor.aimPower);
    ui.powerValueText.textContent = `${refActor.aimPower}%`;

    if (refActor.lastElevation !== null && refActor.lastPower !== null) {
      ui.prevShotText.textContent = `이전: ${refActor.lastElevation}° / ${refActor.lastPower}%`;
    } else {
      ui.prevShotText.textContent = '이전 영점: --';
    }

    // 캐릭터별 고유 스킬 슬롯 동적 반영
    const slots = refActor.spec.skillSlots || ['TORI_SMASH', 'TORI_DOUBLE'];
    const skill1 = SKILL_MODES[slots[0]] || SKILL_MODES.TORI_SMASH;
    const skill2 = SKILL_MODES[slots[1]] || SKILL_MODES.TORI_DOUBLE;

    const btn1 = ui.skillBtns[1];
    const btn2 = ui.skillBtns[2];
    if (btn1) {
      btn1.dataset.skill = skill1.id;
      btn1.textContent = skill1.name;
      btn1.title = skill1.badge;
    }
    if (btn2) {
      btn2.dataset.skill = skill2.id;
      btn2.textContent = skill2.name;
      btn2.title = skill2.badge;
    }

    const curShell = SHELLS[refActor.selectedShell] || SHELLS.ACORN_SPLIT;
    ui.shellDescText.textContent = refActor.useUltimate
      ? `🔥 ${refActor.spec.ultimateName}`
      : curShell.name;

    for (const btn of ui.shellBtns) {
      btn.classList.toggle('active', !refActor.useUltimate && btn.dataset.shell === refActor.selectedShell);
    }

    for (const btn of ui.skillBtns) {
      btn.classList.toggle('active', !refActor.useUltimate && btn.dataset.skill === refActor.skillMode);
    }

    const ultReady = refActor.ultGauge >= 100;
    ui.ultPctText.textContent = ultReady ? 'READY' : `${refActor.ultGauge}%`;
    ui.ultBtn.disabled = !humanTurn || !ultReady;
    ui.ultBtn.classList.toggle('ready', ultReady && !refActor.useUltimate);
    ui.ultBtn.classList.toggle('active', Boolean(refActor.useUltimate));
  }
}

ui.shellCycleBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  ui.shellPopover?.classList.toggle('hidden');
});
for (const btn of ui.shellBtns) {
  btn.addEventListener('click', () => {
    ui.shellPopover?.classList.add('hidden');
  });
}
document.addEventListener('pointerdown', (e) => {
  if (ui.shellPopover && !ui.shellPopover.contains(e.target) && !ui.shellCycleBtn?.contains(e.target)) {
    ui.shellPopover.classList.add('hidden');
  }
});
let pointerAnchor = null;

function toWorldCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * WORLD.WIDTH,
    y: ((clientY - rect.top) / rect.height) * WORLD.HEIGHT,
  };
}

// --- 내 턴 아닐 때 캐릭터 터치 시 돋보기 확대 & 볼꼬집기 교감 ---
const petState = {
  open: false,
  spec: null,
  pinching: false,
  side: 1,
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
  happyTimer: 0,
  frame: 0,
  rafId: null,
};

function renderPetLoop() {
  if (!petState.open) return;
  petState.frame++;
  if (!petState.pinching) {
    petState.dx *= 0.76;
    petState.dy *= 0.76;
    if (Math.abs(petState.dx) < 0.4) petState.dx = 0;
    if (Math.abs(petState.dy) < 0.4) petState.dy = 0;
  }
  if (petState.happyTimer > 0) {
    petState.happyTimer--;
    if (petState.happyTimer === 0 && !petState.pinching && ui.petMoodBadge) {
      ui.petMoodBadge.textContent = '💕 주인님~ 내 턴 기다리는 중!';
    }
  }
  drawPetMagnifierFrame(ui.petMagnifierCanvas, petState.spec, petState);
  petState.rafId = requestAnimationFrame(renderPetLoop);
}

function openPetMagnifier(cart) {
  if (!cart || !ui.petMagnifierOverlay) return;
  petState.open = true;
  petState.spec = cart.spec;
  petState.pinching = false;
  petState.dx = 0;
  petState.dy = 0;
  petState.happyTimer = 0;
  if (ui.petMoodBadge) {
    ui.petMoodBadge.textContent = `💕 ${cart.spec.name}: 주인님~ 내 턴 기다리는 중!`;
  }
  ui.petMagnifierOverlay.classList.remove('hidden');
  engine.audio.playCuteSqueak(false);
  if (!petState.rafId) {
    petState.rafId = requestAnimationFrame(renderPetLoop);
  }
}

function closePetMagnifier() {
  if (!petState.open) return;
  petState.open = false;
  petState.pinching = false;
  if (petState.rafId) {
    cancelAnimationFrame(petState.rafId);
    petState.rafId = null;
  }
  ui.petMagnifierOverlay?.classList.add('hidden');
}

ui.closePetMagnifierBtn?.addEventListener('click', closePetMagnifier);
ui.petMagnifierOverlay?.addEventListener('pointerdown', (e) => {
  if (e.target === ui.petMagnifierOverlay) closePetMagnifier();
});

ui.petMagnifierCanvas?.addEventListener('pointerdown', (e) => {
  if (!petState.open) return;
  engine.audio.ensureContext();
  ui.petMagnifierCanvas.setPointerCapture(e.pointerId);
  const rect = ui.petMagnifierCanvas.getBoundingClientRect();
  const lx = ((e.clientX - rect.left) / rect.width) * ui.petMagnifierCanvas.width;
  petState.side = lx >= ui.petMagnifierCanvas.width * 0.5 ? 1 : -1;
  petState.pinching = true;
  petState.startX = e.clientX;
  petState.startY = e.clientY;
  petState.dx = petState.side * 6;
  petState.dy = 0;
  petState.happyTimer = 45;
  if (ui.petMoodBadge) {
    ui.petMoodBadge.textContent = `😆 ${petState.spec?.name || '요정'}: 히히~ 말랑말랑 간지러워요!`;
  }
  engine.audio.playCuteSqueak(false);
});

ui.petMagnifierCanvas?.addEventListener('pointermove', (e) => {
  if (!petState.open || !petState.pinching) return;
  const rawDx = e.clientX - petState.startX;
  const rawDy = e.clientY - petState.startY;
  const dist = Math.hypot(rawDx, rawDy);
  const maxPull = 86;
  const scale = dist > maxPull ? maxPull / dist : 1;
  petState.dx = rawDx * scale;
  petState.dy = rawDy * scale;
});

function releasePetPinch() {
  if (!petState.pinching) return;
  petState.pinching = false;
  petState.happyTimer = 50;
  engine.audio.playCuteSqueak(true);
}
ui.petMagnifierCanvas?.addEventListener('pointerup', releasePetPinch);
ui.petMagnifierCanvas?.addEventListener('pointercancel', releasePetPinch);

canvas.addEventListener('pointerdown', (e) => {
  engine.audio.ensureContext();
  const pt = toWorldCoords(e.clientX, e.clientY);
  const isMyTurn = engine.phase === 'AIM' && engine.activeActor?.controller === 'human';

  // 내 턴이 아닐 때 내 캐릭터를 터치하면 돋보기 확대 & 볼꼬집기 교감 모드 오픈!
  if (!isMyTurn) {
    const myCart = engine.carts.find((c) => c.alive && c.controller === 'human');
    if (myCart && Math.hypot(pt.x - myCart.x, pt.y - (myCart.y - 28)) <= 68) {
      openPetMagnifier(myCart);
      return;
    }
  }

  // 비행 중 클릭 시 즉시 에어 트리거 기폭!
  if (engine.phase === 'FLIGHT' && engine.activeActor?.controller === 'human') {
    engine.triggerAirSkill();
    return;
  }

  if (!isMyTurn) return;

  canvas.setPointerCapture(e.pointerId);
  pointerAnchor = pt;

  const muzzle = engine.activeActor.getMuzzlePosition();
  engine.dragState.active = true;
  engine.dragState.currentX = muzzle.baseX;
  engine.dragState.currentY = muzzle.baseY;
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointerAnchor || !engine.dragState.active || engine.phase !== 'AIM') return;
  const actor = engine.activeActor;
  if (!actor || actor.controller !== 'human') return;

  const pt = toWorldCoords(e.clientX, e.clientY);
  const dx = pointerAnchor.x - pt.x;
  const dy = pointerAnchor.y - pt.y;
  const pullDist = Math.hypot(dx, dy);

  const muzzle = actor.getMuzzlePosition();
  const clampedPull = Math.min(110, pullDist * 0.65);
  const pullAngle = Math.atan2(dy, dx);
  engine.dragState.currentX = muzzle.baseX - Math.cos(pullAngle) * clampedPull;
  engine.dragState.currentY = muzzle.baseY - Math.sin(pullAngle) * clampedPull;

  if (pullDist >= 16) {
    actor.facing = dx >= 0 ? 1 : -1;
    const rawElev = (Math.atan2(Math.max(6, -dy), Math.max(8, Math.abs(dx))) * 180) / Math.PI;
    actor.aimElevation = Math.min(85, Math.max(5, Math.round(rawElev)));
    actor.aimPower = Math.min(100, Math.max(15, Math.round((pullDist / 165) * 100)));
    engine.notifyHud();
  }
});

function endPointerDrag(e) {
  if (!pointerAnchor || !engine.dragState.active) return;
  const pt = toWorldCoords(e.clientX, e.clientY);
  const pullDist = Math.hypot(pointerAnchor.x - pt.x, pointerAnchor.y - pt.y);

  pointerAnchor = null;
  engine.dragState.active = false;

  // 충분히 당겼다가 놓았을 때 즉시 발사 (짧게 취소하면 조준값만 유지)
  if (pullDist >= 28 && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.fireActiveActor();
  } else {
    engine.notifyHud();
  }
}

canvas.addEventListener('pointerup', endPointerDrag);
canvas.addEventListener('pointercancel', () => {
  pointerAnchor = null;
  engine.dragState.active = false;
});

// --- UI 버튼 이벤트 바인딩 ---
function bindHoldButton(btn, virtualKey) {
  const start = (e) => {
    e.preventDefault();
    heldKeys.add(virtualKey);
  };
  const stop = () => heldKeys.delete(virtualKey);
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
}

bindHoldButton(ui.moveLeftBtn, 'UI_LEFT');
bindHoldButton(ui.moveRightBtn, 'UI_RIGHT');

for (const btn of ui.shellBtns) {
  btn.addEventListener('click', () => {
    const actor = engine.activeActor;
    if (engine.phase === 'AIM' && actor?.controller === 'human') {
      actor.selectedShell = btn.dataset.shell;
      actor.useUltimate = false;
      engine.notifyHud();
    }
  });
}

for (const btn of ui.skillBtns) {
  btn.addEventListener('click', () => {
    const actor = engine.activeActor;
    if (engine.phase === 'AIM' && actor?.controller === 'human') {
      actor.skillMode = btn.dataset.skill;
      actor.useUltimate = false;
      if (actor.skillMode !== 'NORMAL') {
        engine.audio.playSkillCharge();
      }
      engine.notifyHud();
    }
  });
}

ui.ultBtn.addEventListener('click', () => {
  const actor = engine.activeActor;
  if (engine.phase === 'AIM' && actor?.controller === 'human' && actor.ultGauge >= 100) {
    actor.useUltimate = !actor.useUltimate;
    if (actor.useUltimate) {
      engine.audio.playSkillCharge();
    }
    engine.notifyHud();
  }
});

ui.angleMinusBtn.addEventListener('click', () => {
  const actor = engine.activeActor;
  if (engine.phase === 'AIM' && actor?.controller === 'human') {
    actor.aimElevation = Math.max(5, actor.aimElevation - 1);
    engine.notifyHud();
  }
});

ui.anglePlusBtn.addEventListener('click', () => {
  const actor = engine.activeActor;
  if (engine.phase === 'AIM' && actor?.controller === 'human') {
    actor.aimElevation = Math.min(85, actor.aimElevation + 1);
    engine.notifyHud();
  }
});

ui.powerMinusBtn.addEventListener('click', () => {
  const actor = engine.activeActor;
  if (engine.phase === 'AIM' && actor?.controller === 'human') {
    actor.aimPower = Math.max(15, actor.aimPower - 1);
    engine.notifyHud();
  }
});

ui.powerPlusBtn.addEventListener('click', () => {
  const actor = engine.activeActor;
  if (engine.phase === 'AIM' && actor?.controller === 'human') {
    actor.aimPower = Math.min(100, actor.aimPower + 1);
    engine.notifyHud();
  }
});

ui.powerRange.addEventListener('input', () => {
  const actor = engine.activeActor;
  if (engine.phase === 'AIM' && actor?.controller === 'human') {
    actor.aimPower = Number(ui.powerRange.value);
    engine.notifyHud();
  }
});

function handlePrimaryAction() {
  engine.audio.ensureContext();
  if (engine.phase === 'FLIGHT' && engine.activeActor?.controller === 'human') {
    engine.triggerAirSkill();
  } else if (engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.fireActiveActor();
  }
}

ui.fireActionBtn.addEventListener('click', handlePrimaryAction);
ui.floatingAirBtn.addEventListener('click', () => engine.triggerAirSkill());

// --- 소셜 매칭 · 회원가입 · 친구 초대 · 반/학교 대전 · 랜덤 만나기 상태 ---
let currentSocialHub = 'classic'; // 'classic' | 'friend' | 'school' | 'random'
let currentSchoolMode = 'same_class'; // 'same_class' | 'other_class' | 'other_school'
let activeCustomMatch = null;
let pendingAfterProfile = null;
let matchmakingTimer = null;

function getSafeProfile() {
  return (
    loadUserProfile() || {
      userId: 'guest_mochi',
      nickname: '나',
      schoolName: '말랑초등학교',
      className: '3학년 2반',
    }
  );
}

function refreshProfileUi() {
  const prof = loadUserProfile();
  if (prof) {
    ui.profileSummaryText.textContent = `🏫 ${shortSchoolLabel(prof.schoolName)} ${prof.className} · @${prof.userId} (${prof.nickname})`;
    ui.openProfileBtn.textContent = '✏️ 내 정보';
    ui.mySchoolClassLabel.textContent = `${prof.schoolName} · ${prof.className} (${prof.nickname})`;
  } else {
    ui.profileSummaryText.textContent = '학교 · 반 정보 등록 필요';
    ui.openProfileBtn.textContent = '✏️ 내 정보';
    ui.mySchoolClassLabel.textContent = '미등록';
  }
}

function openProfileModal(onDone = null, forceRequired = false) {
  pendingAfterProfile = onDone;
  const prof = loadUserProfile();
  ui.profUserId.value = prof?.userId || '';
  ui.profNickname.value = prof?.nickname || '';
  ui.profSchool.value = prof?.schoolName || '';
  const m = String(prof?.className || '').match(/(\d+)\s*학년\s*(\d+)\s*반/);
  ui.profGradeNum.value = m ? m[1] : '';
  ui.profClassNum.value = m ? m[2] : '';
  ui.schoolAutocompleteList?.classList.add('hidden');
  if (ui.closeProfileModalBtn) {
    ui.closeProfileModalBtn.classList.toggle('hidden', forceRequired && !prof);
  }
  ui.profileModal.classList.remove('hidden');
}

function bindSchoolAutocomplete(inputEl, listEl) {
  if (!inputEl || !listEl) return;
  let timer = null;
  let lastReq = 0;

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim();
    if (timer) clearTimeout(timer);
    if (q.length < 1) {
      listEl.classList.add('hidden');
      listEl.innerHTML = '';
      return;
    }
    timer = setTimeout(async () => {
      const reqId = ++lastReq;
      const items = await searchKoreanSchools(q);
      if (reqId !== lastReq) return;
      listEl.innerHTML = '';
      if (items.length === 0) {
        listEl.classList.add('hidden');
        return;
      }
      for (const item of items) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'school-ac-item';
        const sub = [item.region, item.address].filter(Boolean).join(' · ');
        btn.innerHTML = `<strong>🏫 ${item.name}</strong>${sub ? `<span>${sub}</span>` : ''}`;
        btn.addEventListener('click', () => {
          inputEl.value = item.name;
          listEl.classList.add('hidden');
        });
        listEl.appendChild(btn);
      }
      listEl.classList.remove('hidden');
    }, 180);
  });

  document.addEventListener('pointerdown', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.classList.add('hidden');
    }
  });
}

bindSchoolAutocomplete(ui.profSchool, ui.schoolAutocompleteList);
bindSchoolAutocomplete(ui.targetSchoolInput, ui.targetSchoolAutocomplete);

let currentSearchScope = 'school';
let pendingIncomingChallenge = null;

function renderOpponentSearchList() {
  if (!ui.opponentSearchList) return;
  const prof = loadUserProfile();
  const list = searchOpponents({
    scope: currentSearchScope,
    query: ui.opponentSearchInput?.value || '',
    myProfile: prof,
  });

  ui.opponentSearchList.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'social-hint';
    empty.textContent =
      currentSearchScope === 'class'
        ? '우리 반에 등록된 다른 상대가 아직 없어요. 전체 검색을 눌러보세요!'
        : '검색 조건에 맞는 상대가 없습니다.';
    ui.opponentSearchList.appendChild(empty);
    return;
  }

  for (const opp of list) {
    const row = document.createElement('div');
    row.className = 'opponent-row';

    const meta = document.createElement('div');
    meta.className = 'opponent-meta';
    meta.innerHTML = `<strong>${opp.nickname} (@${opp.userId})</strong><span>🏫 ${shortSchoolLabel(opp.schoolName)} · ${opp.className}</span>`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'challenge-btn';
    btn.textContent = '⚔️ 도전!';
    btn.addEventListener('click', () => challengeSpecificOpponent(opp));

    row.appendChild(meta);
    row.appendChild(btn);
    ui.opponentSearchList.appendChild(row);
  }
}

function challengeSpecificOpponent(opp) {
  const prof = loadUserProfile();
  if (!prof) {
    openProfileModal(() => challengeSpecificOpponent(opp), true);
    return;
  }

  sendChallengeSignal(prof, opp, { mapPreset: ui.mapSelect.value });

  const playerChar = ui.charSelect.value;
  const oppChar = opp.charKey === playerChar ? pickDistinctChars(playerChar, 1)[0] : opp.charKey;
  const myShort = shortSchoolLabel(prof.schoolName);
  const oppShort = shortSchoolLabel(opp.schoolName);

  // 도전 알림 전송 연출 후 바로 대전 진입
  if (ui.matchmakingOverlay) {
    ui.matchmakingSpinner.textContent = '⚔️';
    ui.matchmakingTitle.textContent = '도전장을 보냈어요!';
    ui.matchmakingDetail.textContent = `[${oppShort} ${opp.className}] @${opp.userId} (${opp.nickname})님에게 "${prof.nickname}님이 도전하였습니다!" 알림창을 띄웠습니다.`;
    ui.matchmakingOverlay.classList.remove('hidden');
    setTimeout(() => {
      ui.matchmakingOverlay.classList.add('hidden');
      launchMatchSpec({
        gameMode: '1v1_ai',
        matchLabel: `⚔️ 도전전 (${prof.nickname} vs ${opp.nickname})`,
        customRoster: [
          { teamId: 1, charKey: playerChar, x: 275, facing: 1, controller: 'human', name: `[${myShort} ${prof.className}] ${prof.nickname}` },
          { teamId: 2, charKey: oppChar, x: 1325, facing: -1, controller: 'ai', name: `[${oppShort} ${opp.className}] ${opp.nickname}` },
        ],
      });
    }, 950);
  }
}

function renderFriendChips() {
  const friends = loadFriends();
  ui.friendQuickChips.innerHTML = '';
  for (const f of friends) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'quick-chip';
    chip.textContent = `@${f.userId} (${shortSchoolLabel(f.schoolName)})`;
    chip.addEventListener('click', () => {
      ui.friendIdInput.value = f.userId;
      for (const c of ui.friendQuickChips.querySelectorAll('.quick-chip')) {
        c.classList.toggle('active', c === chip);
      }
    });
    ui.friendQuickChips.appendChild(chip);
  }
}

function switchSocialHub(hub) {
  currentSocialHub = hub;
  for (const tab of ui.socialTabs) {
    tab.classList.toggle('active', tab.dataset.hub === hub);
  }
  ui.hubPanelFriend.classList.toggle('hidden', hub !== 'friend');
  ui.hubPanelSchool.classList.toggle('hidden', hub !== 'school');
  ui.hubPanelRandom.classList.toggle('hidden', hub !== 'random');
  if (ui.modeFieldWrap) {
    ui.modeFieldWrap.classList.toggle('hidden', hub !== 'classic');
  }
  const labels = {
    classic: '🎮 게임 시작!',
    friend: '🤝 친구와 대전 시작!',
    school: '🏫 반·학교 대전 시작!',
    random: '🎲 랜덤 상대 만나기!',
  };
  ui.startMatchBtn.textContent = labels[hub] || '🎮 게임 시작!';
}

function switchSchoolMode(mode) {
  currentSchoolMode = mode;
  for (const pill of ui.schoolModePills) {
    pill.classList.toggle('active', pill.dataset.schoolMode === mode);
  }
  ui.targetClassWrap.classList.toggle('hidden', mode !== 'other_class');
  ui.targetSchoolWrap.classList.toggle('hidden', mode !== 'other_school');
}

function pickDistinctChars(playerChar, count) {
  const pool = CHARACTER_LIST.map((c) => c.id).filter((id) => id !== playerChar);
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function buildHubMatchSpec() {
  const playerChar = ui.charSelect.value;
  const prof = getSafeProfile();
  const myShort = shortSchoolLabel(prof.schoolName);

  if (currentSocialHub === 'classic') {
    return { gameMode: ui.modeSelect.value, customRoster: null, matchLabel: '' };
  }

  if (currentSocialHub === 'friend') {
    const friendId = (ui.friendIdInput.value || '').trim() || loadFriends()[0]?.userId || 'berry_queen';
    const opp = resolveOpponentById(friendId, prof.schoolName, prof.className);
    addFriendById(opp.userId, opp);
    renderFriendChips();
    const playStyle = document.querySelector('input[name="friendPlayStyle"]:checked')?.value || 'local2p';
    const oppCtrl = playStyle === 'local2p' ? 'human' : 'ai';
    const oppChar = opp.charKey === playerChar ? pickDistinctChars(playerChar, 1)[0] : opp.charKey;
    return {
      gameMode: oppCtrl === 'human' ? '1v1_local' : '1v1_ai',
      matchLabel: `🤝 친구대전 @${opp.userId}`,
      customRoster: [
        { teamId: 1, charKey: playerChar, x: 265, facing: 1, controller: 'human', name: `${prof.nickname} (@${prof.userId})` },
        { teamId: 2, charKey: oppChar, x: 1335, facing: -1, controller: oppCtrl, name: `${opp.nickname} (@${opp.userId})` },
      ],
    };
  }

  if (currentSocialHub === 'school') {
    const teamSize = document.querySelector('input[name="schoolTeamSize"]:checked')?.value || '1v1';
    const chars = pickDistinctChars(playerChar, 3);
    let oppSchool = prof.schoolName;
    let oppClass = prof.className;
    let matchLabel = '';

    if (currentSchoolMode === 'same_class') {
      matchLabel = `🎓 반내전 (${myShort} ${prof.className})`;
    } else if (currentSchoolMode === 'other_class') {
      oppClass = (ui.targetClassInput.value || '').trim() || '3학년 1반';
      matchLabel = `⚡ 반대전 (${prof.className} vs ${oppClass})`;
    } else {
      oppSchool = (ui.targetSchoolInput.value || '').trim() || '푸딩초등학교';
      oppClass = '대표팀';
      matchLabel = `🏫 학교대전 (${myShort} vs ${shortSchoolLabel(oppSchool)})`;
    }

    const oppShort = shortSchoolLabel(oppSchool);
    if (teamSize === '2v2') {
      return {
        gameMode: '2v2_team',
        matchLabel,
        customRoster: [
          { teamId: 1, charKey: playerChar, x: 225, facing: 1, controller: 'human', name: `[${myShort} ${prof.className}] ${prof.nickname}` },
          { teamId: 2, charKey: chars[0], x: 1185, facing: -1, controller: 'ai', name: `[${oppShort} ${oppClass}] 에이스` },
          { teamId: 1, charKey: chars[1], x: 405, facing: 1, controller: 'ai', name: `[${myShort} ${prof.className}] 단짝` },
          { teamId: 2, charKey: chars[2], x: 1375, facing: -1, controller: 'ai', name: `[${oppShort} ${oppClass}] 루키` },
        ],
      };
    }

    return {
      gameMode: '1v1_ai',
      matchLabel,
      customRoster: [
        { teamId: 1, charKey: playerChar, x: 275, facing: 1, controller: 'human', name: `[${myShort} ${prof.className}] ${prof.nickname}` },
        { teamId: 2, charKey: chars[0], x: 1325, facing: -1, controller: 'ai', name: `[${oppShort} ${oppClass}] 대표` },
      ],
    };
  }

  // random
  const teamSize = document.querySelector('input[name="randomTeamSize"]:checked')?.value || '1v1';
  const opp = pickRandomOpponent(prof.schoolName, prof.className);
  const chars = pickDistinctChars(playerChar, 3);
  const oppShort = shortSchoolLabel(opp.schoolName);
  const matchLabel = `🎲 랜덤매칭 (${oppShort} ${opp.className})`;

  if (teamSize === '2v2') {
    return {
      gameMode: '2v2_team',
      matchLabel,
      customRoster: [
        { teamId: 1, charKey: playerChar, x: 225, facing: 1, controller: 'human', name: `[${myShort}] ${prof.nickname}` },
        { teamId: 2, charKey: opp.charKey === playerChar ? chars[0] : opp.charKey, x: 1185, facing: -1, controller: 'ai', name: `[${oppShort}] @${opp.userId}` },
        { teamId: 1, charKey: chars[1], x: 405, facing: 1, controller: 'ai', name: `[랜덤팀] ${CHARACTERS[chars[1]].name}` },
        { teamId: 2, charKey: chars[2], x: 1375, facing: -1, controller: 'ai', name: `[${oppShort}] 친구` },
      ],
    };
  }

  return {
    gameMode: '1v1_ai',
    matchLabel,
    customRoster: [
      { teamId: 1, charKey: playerChar, x: 275, facing: 1, controller: 'human', name: `[${myShort}] ${prof.nickname}` },
      { teamId: 2, charKey: opp.charKey === playerChar ? chars[0] : opp.charKey, x: 1325, facing: -1, controller: 'ai', name: `[${oppShort} ${opp.className}] ${opp.nickname}` },
    ],
  };
}

function launchMatchSpec(spec) {
  activeCustomMatch = spec;
  engine.audio.stopLobbyBgm();
  ui.lobbyScreen.classList.add('hidden');
  ui.gameScreen.classList.remove('hidden');
  engine.startMatch({
    gameMode: spec.gameMode,
    mapPreset: ui.mapSelect.value,
    aiPreset: ui.aiSelect.value,
    playerCharKey: ui.charSelect.value,
    customRoster: spec.customRoster,
    matchLabel: spec.matchLabel,
  });
}

function restartWithCurrentOptions() {
  if (ui.rewardAdBtn) {
    ui.rewardAdBtn.disabled = false;
    ui.rewardAdBtn.textContent = '📺 광고 보고 +50 XP';
  }
  const spec = activeCustomMatch || {
    gameMode: ui.modeSelect.value,
    customRoster: null,
    matchLabel: '',
  };
  engine.startMatch({
    gameMode: spec.gameMode,
    mapPreset: ui.mapSelect.value,
    aiPreset: ui.aiSelect.value,
    playerCharKey: ui.charSelect.value,
    customRoster: spec.customRoster,
    matchLabel: spec.matchLabel,
  });
}

function enterGameFromLobby() {
  // 반·학교 대전인데 아직 회원가입 전이면 등록 모달 먼저 표시
  if (currentSocialHub === 'school' && !loadUserProfile()) {
    openProfileModal(() => enterGameFromLobby());
    return;
  }

  const spec = buildHubMatchSpec();

  if (currentSocialHub === 'random') {
    if (matchmakingTimer) clearTimeout(matchmakingTimer);
    ui.matchmakingSpinner.textContent = '🎲';
    ui.matchmakingTitle.textContent = '랜덤 상대 찾는 중...';
    ui.matchmakingDetail.textContent = '전국 말랑 요정 네트워크에서 비슷한 실력의 상대를 찾고 있어요!';
    ui.matchmakingOverlay.classList.remove('hidden');

    matchmakingTimer = setTimeout(() => {
      ui.matchmakingSpinner.textContent = '✨';
      ui.matchmakingTitle.textContent = '매칭 완료!';
      ui.matchmakingDetail.textContent = `${spec.customRoster[1].name} 님과 대결을 시작합니다!`;
      matchmakingTimer = setTimeout(() => {
        ui.matchmakingOverlay.classList.add('hidden');
        launchMatchSpec(spec);
      }, 650);
    }, 800);
    return;
  }

  launchMatchSpec(spec);
}

function returnToLobby() {
  ui.gameScreen.classList.add('hidden');
  ui.lobbyScreen.classList.remove('hidden');
  engine.audio.startLobbyBgm();
}

function updateLobbyBgmBtn() {
  if (!ui.lobbyBgmBtn) return;
  const on = engine.audio.bgmEnabled && !engine.audio.muted;
  ui.lobbyBgmBtn.textContent = on ? '🎵 BGM ON' : '🔇 BGM OFF';
}

ui.lobbyBgmBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  engine.audio.ensureContext();
  engine.audio.toggleBgm();
  updateLobbyBgmBtn();
});

// 브라우저 자동재생 정책 해제: 로비 첫 클릭/터치/키 입력 시 신나는 로비 배경음 자동 시작
function unlockLobbyBgmOnce() {
  if (!ui.lobbyScreen.classList.contains('hidden')) {
    engine.audio.startLobbyBgm();
    updateLobbyBgmBtn();
  }
}
ui.lobbyScreen?.addEventListener('pointerdown', unlockLobbyBgmOnce, { once: true });
window.addEventListener('keydown', unlockLobbyBgmOnce, { once: true });
updateLobbyBgmBtn();

ui.openProfileBtn?.addEventListener('click', () => openProfileModal());
ui.closeProfileModalBtn?.addEventListener('click', () => {
  pendingAfterProfile = null;
  ui.profileModal.classList.add('hidden');
});
ui.profileForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const gNum = String(ui.profGradeNum.value || '').replace(/\D/g, '') || '3';
  const cNum = String(ui.profClassNum.value || '').replace(/\D/g, '') || '1';
  saveUserProfile({
    userId: ui.profUserId.value,
    nickname: ui.profNickname.value,
    schoolName: ui.profSchool.value,
    className: `${gNum}학년 ${cNum}반`,
  });
  refreshProfileUi();
  renderOpponentSearchList();
  ui.profileModal.classList.add('hidden');
  ui.lobbyScreen.classList.remove('hidden');
  const cb = pendingAfterProfile;
  pendingAfterProfile = null;
  if (typeof cb === 'function') cb();
});

for (const tab of ui.socialTabs) {
  tab.addEventListener('click', () => switchSocialHub(tab.dataset.hub));
}
for (const pill of ui.schoolModePills) {
  pill.addEventListener('click', () => switchSchoolMode(pill.dataset.schoolMode));
}
for (const chip of document.querySelectorAll('.target-class-chip')) {
  chip.addEventListener('click', () => {
    ui.targetClassInput.value = chip.dataset.val;
  });
}
for (const chip of document.querySelectorAll('.target-school-chip')) {
  chip.addEventListener('click', () => {
    ui.targetSchoolInput.value = chip.dataset.val;
  });
}

ui.addFriendBtn?.addEventListener('click', () => {
  const val = (ui.friendIdInput.value || '').trim();
  if (!val) return;
  addFriendById(val);
  renderFriendChips();
});

ui.copyInviteBtn?.addEventListener('click', async () => {
  const prof = getSafeProfile();
  const roomCode = Math.random().toString(36).slice(2, 7).toUpperCase();
  const url = buildInviteUrl(prof, roomCode);
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // ignore clipboard permission errors in headless/http
  }
  ui.inviteCopyToast.textContent = `초대 링크가 준비되었어요! (방 코드: ${roomCode})`;
  ui.inviteCopyToast.classList.remove('hidden');
  setTimeout(() => ui.inviteCopyToast.classList.add('hidden'), 3000);
});

ui.cancelMatchmakingBtn?.addEventListener('click', () => {
  if (matchmakingTimer) clearTimeout(matchmakingTimer);
  matchmakingTimer = null;
  ui.matchmakingOverlay.classList.add('hidden');
});

ui.startMatchBtn.addEventListener('click', enterGameFromLobby);
ui.backToLobbyBtn.addEventListener('click', returnToLobby);
ui.modalLobbyBtn.addEventListener('click', returnToLobby);

ui.restartBtn.addEventListener('click', restartWithCurrentOptions);
let completedMatchCount = 0;
ui.modalRestartBtn.addEventListener('click', () => {
  completedMatchCount++;
  // 2판마다 1회 판 종료 후 전면 광고 표시
  if (completedMatchCount % 2 === 0 && ui.interstitialAdOverlay && ui.closeInterstitialBtn) {
    runAdCountdown({
      overlayEl: ui.interstitialAdOverlay,
      closeBtnEl: ui.closeInterstitialBtn,
      seconds: 3,
      waitLabel: (s) => `⏳ ${s}초 후 닫기`,
      readyLabel: '✕ 광고 닫고 다음 판',
      onComplete: restartWithCurrentOptions,
    });
    return;
  }
  restartWithCurrentOptions();
});

ui.rewardAdBtn?.addEventListener('click', () => {
  runAdCountdown({
    overlayEl: ui.rewardAdOverlay,
    closeBtnEl: ui.closeRewardAdBtn,
    seconds: 5,
    waitLabel: (s) => `⏳ ${s}초 후 보상 받기`,
    readyLabel: '🎁 +50 XP 보상 받기!',
    onComplete: () => {
      engine.grantXp(50, '보상형 광고');
      engine.audio.playSkillCharge();
      if (ui.rewardAdBtn) {
        ui.rewardAdBtn.disabled = true;
        ui.rewardAdBtn.textContent = '✅ +50 XP 지급됨!';
      }
    },
  });
});
ui.modeSelect.addEventListener('change', () => {
  activeCustomMatch = null;
  restartWithCurrentOptions();
});
ui.charSelect.addEventListener('change', restartWithCurrentOptions);
ui.mapSelect.addEventListener('change', restartWithCurrentOptions);
ui.aiSelect.addEventListener('change', () => {
  engine.aiPreset = ui.aiSelect.value;
  engine.notifyHud();
});

for (const pill of ui.searchScopePills) {
  pill.addEventListener('click', () => {
    currentSearchScope = pill.dataset.scope;
    for (const p of ui.searchScopePills) p.classList.toggle('active', p === pill);
    renderOpponentSearchList();
  });
}
ui.opponentSearchInput?.addEventListener('input', renderOpponentSearchList);

ui.acceptChallengeBtn?.addEventListener('click', () => {
  const chg = pendingIncomingChallenge;
  pendingIncomingChallenge = null;
  ui.challengeAlertModal?.classList.add('hidden');
  if (!chg?.from) return;
  const prof = getSafeProfile();
  const from = chg.from;
  const playerChar = ui.charSelect.value;
  const oppChar = pickDistinctChars(playerChar, 1)[0];
  launchMatchSpec({
    gameMode: '1v1_ai',
    matchLabel: `⚔️ 도전 수락 (${prof.nickname} vs ${from.nickname})`,
    customRoster: [
      { teamId: 1, charKey: playerChar, x: 275, facing: 1, controller: 'human', name: `[${shortSchoolLabel(prof.schoolName)} ${prof.className}] ${prof.nickname}` },
      { teamId: 2, charKey: oppChar, x: 1325, facing: -1, controller: 'ai', name: `[${shortSchoolLabel(from.schoolName)} ${from.className}] ${from.nickname}` },
    ],
  });
});

ui.declineChallengeBtn?.addEventListener('click', () => {
  pendingIncomingChallenge = null;
  ui.challengeAlertModal?.classList.add('hidden');
});

subscribeChallenges(
  () => loadUserProfile()?.userId || '',
  (payload) => {
    pendingIncomingChallenge = payload;
    const from = payload.from || {};
    if (ui.challengeAlertTitle) {
      ui.challengeAlertTitle.textContent = '⚔️ 도전장이 도착했어요!';
    }
    if (ui.challengeAlertText) {
      ui.challengeAlertText.textContent = `[${shortSchoolLabel(from.schoolName)} ${from.className}] @${from.userId} (${from.nickname})님이 도전하였습니다!`;
    }
    engine.audio.playSkillCharge();
    ui.challengeAlertModal?.classList.remove('hidden');
  }
);

refreshProfileUi();
renderFriendChips();
renderOpponentSearchList();

function enterLoginOrLobbyAfterAd() {
  if (!loadUserProfile()) {
    ui.lobbyScreen.classList.add('hidden');
    openProfileModal(null, true);
  } else {
    ui.lobbyScreen.classList.remove('hidden');
  }
}

initBannerAd(ui.googleAdContainer);

// 최초 구동 시 구글 전면 광고(3초 카운트다운) 시청 후 로그인/회원가입 화면으로 진입
if (ui.interstitialAdOverlay && sessionStorage.getItem('puffpuff_intro_ad_shown') !== '1') {
  ui.lobbyScreen.classList.add('hidden');
  runAdCountdown({
    overlayEl: ui.interstitialAdOverlay,
    closeBtnEl: ui.closeInterstitialBtn,
    seconds: 3,
    waitLabel: (s) => `⏳ ${s}초 후 닫기`,
    readyLabel: '✕ 광고 닫고 입장하기',
    onComplete: () => {
      sessionStorage.setItem('puffpuff_intro_ad_shown', '1');
      enterLoginOrLobbyAfterAd();
    },
  });
} else {
  ui.interstitialAdOverlay?.classList.add('hidden');
  enterLoginOrLobbyAfterAd();
}
const incomingInvite = parseInviteFromUrl();
if (incomingInvite) {
  addFriendById(incomingInvite.hostId, {
    nickname: incomingInvite.hostNick,
    schoolName: incomingInvite.hostSchool,
    className: incomingInvite.hostClass,
  });
  renderFriendChips();
  ui.friendIdInput.value = incomingInvite.hostId;
  switchSocialHub('friend');
}

ui.muteBtn.addEventListener('click', () => {
  engine.audio.toggleMute();
  engine.notifyHud();
});

ui.weatherToggleBtn.addEventListener('click', () => {
  engine.setWeather(engine.weather === 'RAIN' ? 'CLEAR' : 'RAIN');
});

ui.tornadoTestBtn.addEventListener('click', () => {
  engine.spawnTornado(engine.activeActor);
});

ui.rankBadgeBtn.addEventListener('click', () => {
  engine.toggleCosmetic();
});

// --- 키보드 단축키 바인딩 ---
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  heldKeys.add(e.code);

  if (e.repeat) return;

  if (e.code === 'Space') {
    handlePrimaryAction();
  } else if (e.code === 'Digit1' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.activeActor.selectedShell = 'ACORN_SPLIT';
    engine.notifyHud();
  } else if (e.code === 'Digit2' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.activeActor.selectedShell = 'AQUA_DRILL';
    engine.notifyHud();
  } else if (e.code === 'Digit3' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.activeActor.selectedShell = 'CHEESE_BOUNCE';
    engine.activeActor.useUltimate = false;
    engine.notifyHud();
  } else if (e.code === 'KeyQ' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    const slots = engine.activeActor.spec.skillSlots || ['TORI_SMASH', 'TORI_DOUBLE'];
    const order = ['NORMAL', slots[0], slots[1]];
    const idx = order.indexOf(engine.activeActor.skillMode);
    engine.activeActor.skillMode = order[(idx + 1) % order.length];
    engine.activeActor.useUltimate = false;
    if (engine.activeActor.skillMode !== 'NORMAL') engine.audio.playSkillCharge();
    engine.notifyHud();
  } else if (e.code === 'KeyE' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    if (engine.activeActor.ultGauge >= 100) {
      engine.activeActor.useUltimate = !engine.activeActor.useUltimate;
      if (engine.activeActor.useUltimate) engine.audio.playSkillCharge();
      engine.notifyHud();
    }
  }
});

window.addEventListener('keyup', (e) => {
  heldKeys.delete(e.code);
});

// --- 고정 60Hz 타임스텝 메인 루프 ---
let lastTime = performance.now();
let accumulator = 0;
const FIXED_DT = 1000 / 60;

function gameLoop(now) {
  const delta = Math.min(64, now - lastTime);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= FIXED_DT) {
    engine.tick(heldKeys);
    accumulator -= FIXED_DT;
  }
  requestAnimationFrame(gameLoop);
}

// --- 로비 20종 캐릭터 아바타 카드 그리드 렌더링 ---
let currentGenderFilter = 'ALL';

function renderLobbyCharGrid() {
  const selectedId = ui.charSelect.value;
  const list = CHARACTER_LIST.filter((c) =>
    currentGenderFilter === 'ALL' ? true : c.gender === currentGenderFilter
  );

  ui.charAvatarGrid.innerHTML = '';
  for (const spec of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `char-card-btn${spec.id === selectedId ? ' active' : ''}`;
    btn.dataset.charId = spec.id;

    const cvs = document.createElement('canvas');
    cvs.width = 68;
    cvs.height = 70;
    drawSpiritAvatar(cvs, spec, false);

    const lbl = document.createElement('span');
    lbl.className = 'char-card-name';
    lbl.textContent = `${spec.num} ${spec.name}`;

    btn.appendChild(cvs);
    btn.appendChild(lbl);
    btn.addEventListener('click', () => {
      ui.charSelect.value = spec.id;
      updateSelectedCharBanner(spec);
      renderLobbyCharGrid();
    });
    ui.charAvatarGrid.appendChild(btn);
  }
}

function updateSelectedCharBanner(spec) {
  if (!spec) return;
  if (ui.selectedCharPreviewCanvas) {
    drawSpiritAvatar(ui.selectedCharPreviewCanvas, spec, true);
  }
  ui.selectedCharBanner.innerHTML = `<strong>${spec.num} ${spec.name}</strong> · ${spec.species}<br/><span>🔥 궁극기: ${spec.ultimateName}</span>`;
}

for (const tab of ui.genderTabs) {
  tab.addEventListener('click', () => {
    currentGenderFilter = tab.dataset.gender;
    for (const t of ui.genderTabs) t.classList.toggle('active', t === tab);
    renderLobbyCharGrid();
  });
}

renderLobbyCharGrid();
updateSelectedCharBanner(CHARACTERS[ui.charSelect.value]);

// 초기 매치 구동 (백그라운드 초기화 후 로비 대기)
restartWithCurrentOptions();
requestAnimationFrame(gameLoop);
