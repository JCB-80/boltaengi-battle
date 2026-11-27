// 말랑포포: 폭신폭신 공성전 — 메인 엔트리 및 입력·UI 바인딩
import { CHARACTERS, CHARACTER_LIST, SHELLS, SKILL_MODES, WORLD } from './config.js?v=27';
import { drawSpiritAvatar, drawPetMagnifierFrame } from './renderer.js?v=41';
import { GameRenderer3D } from './renderer3d.js?v=3';
import { GameEngine } from './gameEngine.js?v=48';
import { initBakeryCommercialUi } from './bakeryUi.js?v=6';
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
import { OnlineBattleClient } from './onlineAdapter.js';

const canvas = document.getElementById('gameCanvas');
const renderer = new GameRenderer3D(canvas);

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
  deleteAccountBtn: document.getElementById('deleteAccountBtn'),
  accountStatusText: document.getElementById('accountStatusText'),
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

  hudLeftAvatar: document.getElementById('hudLeftAvatar'),
  hudLeftName: document.getElementById('hudLeftName'),
  hudLeftHp: document.getElementById('hudLeftHp'),
  hudLeftHpBar: document.getElementById('hudLeftHpBar'),
  hudRightAvatar: document.getElementById('hudRightAvatar'),
  hudRightName: document.getElementById('hudRightName'),
  hudRightHp: document.getElementById('hudRightHp'),
  hudRightHpBar: document.getElementById('hudRightHpBar'),
  shellCycleBtn: document.getElementById('shellCycleBtn'),
  shellPopover: document.getElementById('shellPopover'),

  createOnlineRoomBtn: document.getElementById('createOnlineRoomBtn'),
  onlineMaxPlayers: document.getElementById('onlineMaxPlayers'),
  onlineRoomTitleInput: document.getElementById('onlineRoomTitleInput'),
  onlineInviteInput: document.getElementById('onlineInviteInput'),
  joinOnlineRoomBtn: document.getElementById('joinOnlineRoomBtn'),
  onlineRoomStatusBox: document.getElementById('onlineRoomStatusBox'),
  onlineRoomStatusText: document.getElementById('onlineRoomStatusText'),
  approveOnlineRoomBtn: document.getElementById('approveOnlineRoomBtn'),
  cancelOnlineRoomBtn: document.getElementById('cancelOnlineRoomBtn'),
  lanOpenRoomsList: document.getElementById('lanOpenRoomsList'),
  schoolOnlineMaxPlayers: document.getElementById('schoolOnlineMaxPlayers'),
  schoolRoomTitleInput: document.getElementById('schoolRoomTitleInput'),
  createClassOnlineRoomBtn: document.getElementById('createClassOnlineRoomBtn'),
  schoolOpenRoomsList: document.getElementById('schoolOpenRoomsList'),
  schoolTopBanner: document.getElementById('schoolTopBanner'),
  classTopBanner: document.getElementById('classTopBanner'),
  lbScopeBtns: document.querySelectorAll('.lb-scope-btn'),
  leaderboardList: document.getElementById('leaderboardList'),

  partyRoomModal: document.getElementById('partyRoomModal'),
  partyRoomTitle: document.getElementById('partyRoomTitle'),
  partyRoomMode: document.getElementById('partyRoomMode'),
  partyRoomCode: document.getElementById('partyRoomCode'),
  copyPartyCodeBtn: document.getElementById('copyPartyCodeBtn'),
  partySlotsGrid: document.getElementById('partySlotsGrid'),
  partyRoomHint: document.getElementById('partyRoomHint'),
  partyApproveBtn: document.getElementById('partyApproveBtn'),
  leavePartyRoomBtn: document.getElementById('leavePartyRoomBtn'),
};

const heldKeys = new Set();
const onlineClient = new OnlineBattleClient();

const engine = new GameEngine({
  renderer,
  onHudUpdate: syncHud,
  onRemoteAction: (action) => {
    if (engine.isRemoteMatch) {
      onlineClient.sendAction(action).catch(() => {});
    }
  },
});

let prevAlertWeather = 'CLEAR';
let rainBannerUntil = 0;
let windBannerUntil = 0;
let tornadoBannerUntil = 0;
let tipBannerUntil = 0;
let lastWindAlertKey = '';
let prevTornadoActive = false;
let lastTipTurnKey = '';
let alertDismissTimer = null;

function scheduleAlertCleanup() {
  if (alertDismissTimer) clearTimeout(alertDismissTimer);
  alertDismissTimer = setTimeout(() => {
    const now = Date.now();
    if (ui.envAlertStack) {
      if (now >= rainBannerUntil) ui.envAlertStack.querySelectorAll('.env-alert.rain').forEach((el) => el.remove());
      if (now >= windBannerUntil) ui.envAlertStack.querySelectorAll('.env-alert.wind').forEach((el) => el.remove());
      if (now >= tornadoBannerUntil) ui.envAlertStack.querySelectorAll('.env-alert.tornado').forEach((el) => el.remove());
      if (now >= tipBannerUntil) ui.envAlertStack.querySelectorAll('.env-alert.tip').forEach((el) => el.remove());
    }
  }, 3050);
}

function syncHud(state) {
  const { turnNumber, turnTimeLeft, wind, weather, tornadoActive, phase, activeActor, carts, projectiles, winnerText, muted, rankInfo, cosmeticEnabled, matchLabel } = state;

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
    const hpVal = Math.max(0, myCart.hp);
    const maxHp = Math.max(1, myCart.maxHp || 120);
    ui.hudLeftHp.textContent = `${hpVal}`;
    if (ui.hudLeftHpBar) ui.hudLeftHpBar.style.width = `${Math.min(100, Math.round((hpVal / maxHp) * 100))}%`;
    const charId = myCart.spec?.id || myCart.charKey || 'M01_MOCHI';
    if (ui.hudLeftAvatar && ui.hudLeftAvatar.dataset.char !== charId) {
      ui.hudLeftAvatar.dataset.char = charId;
      ui.hudLeftAvatar.src = `./assets/chars/${encodeURIComponent(charId)}.png`;
    }
  }
  if (oppCart && ui.hudRightName && ui.hudRightHp) {
    ui.hudRightName.textContent = oppCart.spec?.name || oppCart.displayName;
    const hpVal = Math.max(0, oppCart.hp);
    const maxHp = Math.max(1, oppCart.maxHp || 120);
    ui.hudRightHp.textContent = `${hpVal}`;
    if (ui.hudRightHpBar) ui.hudRightHpBar.style.width = `${Math.min(100, Math.round((hpVal / maxHp) * 100))}%`;
    const charId = oppCart.spec?.id || oppCart.charKey || 'F11_BERRY';
    if (ui.hudRightAvatar && ui.hudRightAvatar.dataset.char !== charId) {
      ui.hudRightAvatar.dataset.char = charId;
      ui.hudRightAvatar.src = `./assets/chars/${encodeURIComponent(charId)}.png`;
    }
  }
  const timerText = phase === 'AIM' && Number.isFinite(turnTimeLeft) ? ` · ⏱ ${turnTimeLeft}초` : '';
  const compactHud = window.innerHeight <= 540;
  ui.turnTimelineBadge.textContent =
    matchLabel && !compactHud ? `${matchLabel} · T${turnNumber}${timerText}` : `T${turnNumber}${timerText}`;
  ui.turnTimelineBadge.classList.toggle('urgent', phase === 'AIM' && turnTimeLeft <= 5);
  ui.turnTimelineBadge.style.color = '';

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
    ui.weatherToggleBtn.textContent = '🌧️ 비(바람+50%)';
    ui.weatherToggleBtn.classList.add('rain');
  } else {
    ui.weatherToggleBtn.textContent = '☀️ 맑음';
    ui.weatherToggleBtn.classList.remove('rain');
  }

  // 2.5) 환경 & 재해 시각적 경고 배너 렌더링 (모든 경보·팁은 3초만 표시 후 자동 사라짐)
  const nowMs = Date.now();
  const alerts = [];
  if (tornadoActive) {
    if (!prevTornadoActive) {
      tornadoBannerUntil = nowMs + 3000;
      scheduleAlertCleanup();
    }
    if (nowMs < tornadoBannerUntil) {
      alerts.push({
        cls: 'tornado',
        text: '🌪️ 회오리 주의! 구멍으로 대피하세요!',
      });
    }
  } else {
    tornadoBannerUntil = 0;
  }
  prevTornadoActive = Boolean(tornadoActive);

  if (weather === 'RAIN') {
    if (prevAlertWeather !== 'RAIN') {
      rainBannerUntil = nowMs + 3000;
      scheduleAlertCleanup();
    }
    if (nowMs < rainBannerUntil) {
      alerts.push({
        cls: 'rain',
        text: '🌧️ 비가 와요! (사거리 -20%)',
      });
    }
  } else {
    rainBannerUntil = 0;
  }
  prevAlertWeather = weather;

  if (Math.abs(wind) >= 7.5) {
    const dirTxt = wind > 0 ? '우풍 ▶' : '◀ 좌풍';
    const wKey = `${turnNumber}:${dirTxt}`;
    if (wKey !== lastWindAlertKey) {
      lastWindAlertKey = wKey;
      windBannerUntil = nowMs + 3000;
      scheduleAlertCleanup();
    }
    if (nowMs < windBannerUntil) {
      alerts.push({
        cls: 'wind',
        text: `💨 강풍 경보 (${dirTxt} ${Math.abs(wind).toFixed(1)})`,
      });
    }
  } else {
    lastWindAlertKey = '';
    windBannerUntil = 0;
  }

  // 내 턴 조준 시작 시 3초간만 1줄 탄도 팁 표시 후 자동 숨김
  if (phase === 'AIM' && activeActor?.controller === 'human') {
    const tKey = `${turnNumber}:${activeActor.slotIndex}:${weather}:${Math.round(wind * 10)}`;
    if (tKey !== lastTipTurnKey) {
      lastTipTurnKey = tKey;
      tipBannerUntil = nowMs + 3000;
      scheduleAlertCleanup();
    }
    if (nowMs < tipBannerUntil) {
      const windWithMe = wind * (activeActor.facing || 1);
      const windName = wind >= 0 ? '우풍' : '좌풍';
      let tipText = '';
      if (weather === 'RAIN' && windWithMe < -2.0) {
        tipText = `💡 팁: 비 + ${windName}(맞바람)! 파워 +20% 추천`;
      } else if (weather === 'RAIN') {
        tipText = '💡 팁: 비 때문에 무거워요! 파워 +10~15% 추천';
      } else if (windWithMe >= 2.5) {
        tipText = `💡 팁: ${windName}(순풍)! 파워 -10% 추천`;
      } else if (windWithMe <= -2.5) {
        tipText = `💡 팁: ${windName}(맞바람)! 파워 +10~15% 추천`;
      } else {
        tipText = '💡 팁: 화면을 뒤로 당겼다 놓으면 발사돼요!';
      }
      alerts.push({ cls: 'tip', text: tipText });
    }
  }

  ui.canvasFrame.classList.toggle('tornado-warning', Boolean(tornadoActive));
  ui.envAlertStack.innerHTML = alerts
    .map((a) => `<div class="env-alert ${a.cls}">${a.text}</div>`)
    .join('');

  // 3) 게임 오버 모달 (승리 시 경험치 + 계급 반영 표시)
  if (phase === 'GAME_OVER') {
    if (!matchOutcomeRecorded) {
      matchOutcomeRecorded = true;
      recordCurrentMatchOutcome(state);
    }
    const rk = engine.getRankInfo?.()?.current;
    const rankTxt = rk ? `${rk.badge} Lv.${rk.level} ${rk.title}` : '';
    const statsTxt = formatWinRateText(getCachedAccountStats());
    ui.winnerHeadline.textContent = `${winnerText} · ${rankTxt} (${statsTxt})`;
    ui.gameOverModal.classList.remove('hidden');
  } else {
    matchOutcomeRecorded = false;
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
    const stepsLeft = Math.ceil(Math.max(0, refActor.fuel) / 5);
    ui.fuelText.textContent = `남은 걸음 ${stepsLeft}걸음`;
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

  // 비행 중 클릭 시 즉시 에어 트리거 기폭!
  if (engine.phase === 'FLIGHT' && engine.activeActor?.controller === 'human') {
    engine.triggerAirSkill();
    return;
  }

  const isMyTurn = engine.phase === 'AIM' && engine.activeActor?.controller === 'human';
  if (!isMyTurn) {
    // 2:2 팀전에서 내 턴이 아닐 때 캔버스 클릭 시 "여기 쏴! 🎯" 전술 핑 표시
    if (engine.gameMode === '2v2_team' && engine.phase === 'AIM') {
      engine.addTacticalPing(pt.x, pt.y, '여기 쏴! 🎯');
    }
    return;
  }

  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // ignore pointer capture errors
  }
  pointerAnchor = { ...pt, clientX: e.clientX, clientY: e.clientY };

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
  const screenPull = Math.hypot(pointerAnchor.clientX - e.clientX, pointerAnchor.clientY - e.clientY);

  pointerAnchor = null;
  engine.dragState.active = false;

  // 충분히 당겼다가 놓았을 때 즉시 발사 (짧게 취소하면 조준값만 유지)
  if (pullDist >= 28 && screenPull >= 12 && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
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

let matchOutcomeRecorded = false;

function getStatsStorageKey(userId) {
  return `puffpuff_stats_${String(userId || 'guest').trim().toLowerCase()}`;
}

function getCachedAccountStats(userId = loadUserProfile()?.userId) {
  try {
    const raw = localStorage.getItem(getStatsStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      const wins = Math.max(0, Number(parsed.wins) || 0);
      const matches = Math.max(0, Number(parsed.matches) || 0);
      const score = typeof parsed.score === 'number' ? Math.max(0, parsed.score) : wins * 100 + Math.max(0, matches - wins) * 10;
      return { wins, matches, score };
    }
  } catch {
    // ignore
  }
  return { wins: 0, matches: 0, score: 0 };
}

function saveCachedAccountStats(userId, stats) {
  if (!userId || !stats) return;
  try {
    const wins = Math.max(0, Number(stats.wins) || 0);
    const matches = Math.max(0, Number(stats.matches) || 0);
    const score = typeof stats.score === 'number' ? Math.max(0, stats.score) : wins * 100 + Math.max(0, matches - wins) * 10;
    localStorage.setItem(
      getStatsStorageKey(userId),
      JSON.stringify({ wins, matches, score })
    );
  } catch {
    // ignore
  }
}

function formatWinRateText(stats) {
  const wins = Math.max(0, Number(stats?.wins) || 0);
  const matches = Math.max(0, Number(stats?.matches) || 0);
  const score = typeof stats?.score === 'number' ? Math.max(0, stats.score) : wins * 100 + Math.max(0, matches - wins) * 10;
  const pct = matches > 0 ? Math.round((wins / matches) * 100) : 0;
  return `${score}점 · ${matches}전 ${wins}승 (${pct}%)`;
}

let accountDeletionInProgress = false;
const pendingAccountSyncs = new Set();
async function syncProfileWithServer(prof) {
  if (!prof?.userId || accountDeletionInProgress) return;
  const sync = (async () => {
  try {
    const acc = await onlineClient.syncAccount(prof);
    if (acc) {
      saveCachedAccountStats(prof.userId, { wins: acc.wins, matches: acc.matches, score: acc.score });
      refreshProfileUi();
      refreshLeaderboard?.(true);
    }
  } catch (err) {
    if (err.message === 'ACCOUNT_RECOVERY_REQUIRED' || err.message === 'USER_ID_TAKEN' || err.message === 'UNAUTHORIZED') {
      if (ui.accountStatusText) ui.accountStatusText.textContent = '기존 계정의 인증을 확인할 수 없습니다. 개인정보 안내의 문의처로 계정 복구 또는 삭제를 요청해 주세요.';
      ui.profileSummaryText.textContent = '계정 인증 확인 필요 · 내 정보에서 안내 확인';
    }
  }
  })();
  pendingAccountSyncs.add(sync);
  try { await sync; } finally { pendingAccountSyncs.delete(sync); }
}

async function recordCurrentMatchOutcome(state) {
  const carts = Array.isArray(state?.carts) ? state.carts : [];
  const aliveHumans = carts.filter((c) => c.alive && c.controller === 'human');
  const won = aliveHumans.length > 0;

  // 1) 로컬·온라인 공통: 승리할 때마다 경험치 획득 & 계급 시스템 즉시 반영
  const xpGain = engine.isRemoteMatch ? (won ? 120 : 35) : (won ? 100 : 25);
  engine.grantXp?.(xpGain, won ? '승리 보너스' : '참가 보너스');

  const prof = loadUserProfile();
  if (!prof?.userId) return;

  if (engine.isRemoteMatch) {
    // 온라인 대전은 server.mjs finishRoomIfEnded가 서버 권위로 공식 정산함 -> 최신 전적/랭킹 동기화
    setTimeout(async () => {
      try {
        const acc = await onlineClient.fetchMyAccount();
        if (acc) {
          saveCachedAccountStats(prof.userId, { wins: acc.wins, matches: acc.matches, score: acc.score });
          if (typeof acc.xp === 'number' && acc.xp > engine.xp) {
            engine.xp = acc.xp;
            localStorage.setItem('puffpuff_xp', String(engine.xp));
            engine.notifyHud?.();
          }
          refreshProfileUi();
          refreshLeaderboard?.(true);
        }
      } catch {
        // ignore
      }
    }, 350);
    return;
  }

  const prev = getCachedAccountStats(prof.userId);
  const optimistic = {
    wins: prev.wins + (won ? 1 : 0),
    matches: prev.matches + 1,
  };
  saveCachedAccountStats(prof.userId, optimistic);
  refreshProfileUi();
  refreshLeaderboard?.(true);
}

function refreshProfileUi() {
  const prof = loadUserProfile();
  if (prof) {
    const winTxt = formatWinRateText(getCachedAccountStats(prof.userId));
    ui.profileSummaryText.textContent = `🏫 ${shortSchoolLabel(prof.schoolName)} ${prof.className} · @${prof.userId} (${prof.nickname}) · 비공식 기록 ${winTxt}`;
    ui.openProfileBtn.textContent = '✏️ 내 정보';
    ui.mySchoolClassLabel.textContent = `${prof.schoolName} · ${prof.className} (${prof.nickname}) · 비공식 기록 ${winTxt}`;
  } else {
    ui.profileSummaryText.textContent = '학교 · 반 정보 등록 필요';
    ui.openProfileBtn.textContent = '✏️ 내 정보';
    ui.mySchoolClassLabel.textContent = '미등록';
  }
}

const DEVICE_BOUND_UID_KEY = 'puffpuff_bound_device_uid_v1';
function getBoundDeviceUserId() {
  try {
    const bound = (localStorage.getItem(DEVICE_BOUND_UID_KEY) || '').trim();
    if (bound) return bound;
    const existing = loadUserProfile()?.userId;
    if (existing) {
      localStorage.setItem(DEVICE_BOUND_UID_KEY, existing);
      return existing;
    }
  } catch {
    // ignore
  }
  return '';
}

function openProfileModal(onDone = null, forceRequired = false) {
  pendingAfterProfile = onDone;
  const prof = loadUserProfile();
  const boundUid = getBoundDeviceUserId();
  ui.profUserId.value = boundUid || prof?.userId || '';
  ui.profUserId.readOnly = Boolean(boundUid);
  ui.profUserId.style.opacity = boundUid ? '0.78' : '1';
  if (ui.accountStatusText) {
    ui.accountStatusText.textContent = boundUid
      ? `🔒 비밀번호 없이 자동 로그인 중 (@${boundUid}) · 이 기기에서는 계정 삭제 전까지 추가 아이디를 만들 수 없습니다.`
      : '✨ 비밀번호 없이 아이디·학교·반만 입력하면 바로 등록됩니다. (1기기 1계정)';
  }
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
        btn.innerHTML = `<strong>🏫 ${escapePartyHtml(item.name)}</strong>${sub ? `<span>${escapePartyHtml(sub)}</span>` : ''}`;
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
    meta.innerHTML = `<strong>${escapePartyHtml(opp.nickname)} (@${escapePartyHtml(opp.userId)})</strong><span>🏫 ${escapePartyHtml(shortSchoolLabel(opp.schoolName))} · ${escapePartyHtml(opp.className)}</span>`;

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
  onlineMatchEntered = false;
  onlineClient.clearSession();
  engine.isRemoteMatch = false;
  ui.onlineRoomStatusBox?.classList.add('hidden');
  ui.partyRoomModal?.classList.add('hidden');
  activeCustomMatch = spec;
  window.AndroidBridge?.setOrientation?.('landscape');
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
  engine.audio.startBattleBgm(engine.terrain?.activeMapKey || ui.mapSelect.value);
}

function restartWithCurrentOptions() {
  onlineMatchEntered = false;
  onlineClient.clearSession();
  engine.isRemoteMatch = false;
  ui.onlineRoomStatusBox?.classList.add('hidden');
  ui.partyRoomModal?.classList.add('hidden');
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
  engine.audio.startBattleBgm(engine.terrain?.activeMapKey || ui.mapSelect.value);
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
  onlineMatchEntered = false;
  onlineClient.clearSession();
  engine.isRemoteMatch = false;
  engine.phase = 'IDLE';
  engine.projectiles = [];
  ui.gameOverModal?.classList.add('hidden');
  ui.onlineRoomStatusBox?.classList.add('hidden');
  ui.partyRoomModal?.classList.add('hidden');
  window.AndroidBridge?.setOrientation?.('portrait');
  ui.gameScreen.classList.add('hidden');
  ui.lobbyScreen.classList.remove('hidden');
  engine.audio.startLobbyBgm();
  lastLanRoomsJson = '';
  refreshLanOpenRooms();
  refreshLeaderboard(true);
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
ui.deleteAccountBtn?.addEventListener('click', async () => {
  const profile = loadUserProfile();
  if (!profile || profile.userId !== onlineClient.accountAuth?.userId) {
    ui.accountStatusText.textContent = '이 기기에서 확인 가능한 계정 인증이 없습니다. 아래 삭제 요청 안내를 이용해 주세요.';
    return;
  }
  if (!window.confirm('계정과 서버 전적을 삭제할까요? 삭제한 전적은 복구할 수 없습니다.')) return;
  ui.deleteAccountBtn.disabled = true;
  accountDeletionInProgress = true;
  try {
    await Promise.allSettled([...pendingAccountSyncs]);
    if (profile.userId !== onlineClient.accountAuth?.userId) throw new Error('ACCOUNT_CHANGED');
    const deletion = await onlineClient.deleteAccount();
    let localCleanupFailed = Boolean(deletion?.localCleanupFailed);
    try {
      onlineClient.clearSession();
      sessionStorage.removeItem('puffpuff_user_profile_v1');
      localStorage.removeItem('puffpuff_user_profile_v1');
      localStorage.removeItem(DEVICE_BOUND_UID_KEY);
      localStorage.removeItem(getStatsStorageKey(profile.userId));
      const key = 'puffpuff_community_users_v1';
      const directory = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(directory)) localStorage.setItem(key, JSON.stringify(directory.filter((p) => p.userId !== profile.userId)));
    } catch {
      localCleanupFailed = true;
    }
    refreshProfileUi();
    renderOpponentSearchList();
    refreshLeaderboard(true);
    ui.accountStatusText.textContent = localCleanupFailed
      ? '서버 계정은 삭제했습니다. 기기 정보는 앱 저장공간을 삭제해 정리해 주세요.'
      : '계정 및 서버 전적을 삭제했습니다. 이제 새 아이디를 만들 수 있습니다.';
    ui.profUserId.value = '';
    ui.profUserId.readOnly = false;
    ui.profUserId.style.opacity = '1';
    ui.profNickname.value = '';
    ui.profSchool.value = '';
    ui.profGradeNum.value = '';
    ui.profClassNum.value = '';
  } catch {
    ui.accountStatusText.textContent = '삭제하지 못했습니다. 연결 상태를 확인하거나 삭제 요청 안내를 이용해 주세요.';
  } finally {
    accountDeletionInProgress = false;
    ui.deleteAccountBtn.disabled = false;
  }
});
ui.profileForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (accountDeletionInProgress) return;
  const boundUid = getBoundDeviceUserId();
  const inputUid = String(ui.profUserId.value || '').trim();
  if (boundUid && inputUid.toLowerCase() !== boundUid.toLowerCase()) {
    if (ui.accountStatusText) {
      ui.accountStatusText.textContent = `🔒 이 기기에는 이미 @${boundUid} 계정이 등록되어 있습니다. 새 아이디를 만들려면 먼저 계정을 삭제하세요.`;
    }
    ui.profUserId.value = boundUid;
    return;
  }
  const gNum = String(ui.profGradeNum.value || '').replace(/\D/g, '') || '3';
  const cNum = String(ui.profClassNum.value || '').replace(/\D/g, '') || '1';
  const savedProf = saveUserProfile({
    userId: boundUid || inputUid,
    nickname: ui.profNickname.value,
    schoolName: ui.profSchool.value,
    className: `${gNum}학년 ${cNum}반`,
  });
  try {
    if (savedProf?.userId) localStorage.setItem(DEVICE_BOUND_UID_KEY, savedProf.userId);
  } catch {
    // ignore
  }
  refreshProfileUi();
  syncProfileWithServer(savedProf);
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
ui.modalRestartBtn.addEventListener('click', restartWithCurrentOptions);
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

ui.acceptChallengeBtn?.addEventListener('click', async () => {
  const chg = pendingIncomingChallenge;
  pendingIncomingChallenge = null;
  ui.challengeAlertModal?.classList.add('hidden');
  if (!chg?.from) return;

  if (chg.id && chg.inviteCode) {
    try {
      await fetch(`/api/battle/challenges/${chg.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${onlineClient.getActiveAccountAuth()?.accountToken || ''}` },
        body: JSON.stringify({ accept: true }),
      }).then((response) => { if (!response.ok) throw new Error('도전장이 만료되었거나 인증이 필요합니다.'); });
      if (ui.onlineInviteInput) ui.onlineInviteInput.value = chg.inviteCode;
      ui.joinOnlineRoomBtn?.click();
    } catch (err) {
      ui.onlineRoomStatusBox?.classList.remove('hidden');
      if (ui.onlineRoomStatusText) ui.onlineRoomStatusText.textContent = err.message;
    }
    return;
  }

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
  const chg = pendingIncomingChallenge;
  pendingIncomingChallenge = null;
  ui.challengeAlertModal?.classList.add('hidden');
  if (chg?.id) {
    fetch(`/api/battle/challenges/${chg.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${onlineClient.getActiveAccountAuth()?.accountToken || ''}` },
      body: JSON.stringify({ accept: false }),
    }).catch(() => {});
  }
});

let lastSeenServerChallengeId = '';
async function pollServerChallenges() {
  const myId = loadUserProfile()?.userId || '';
  const token = onlineClient.getActiveAccountAuth()?.accountToken;
  if (!myId || !token || ui.lobbyScreen?.classList.contains('hidden')) return;
  try {
    const res = await fetch(`/api/battle/challenges/pending?userId=${encodeURIComponent(myId)}`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    const ch = data.challenge;
    if (!ch || ch.id === lastSeenServerChallengeId) return;
    lastSeenServerChallengeId = ch.id;
    pendingIncomingChallenge = ch;
    const from = ch.from || {};
    if (ui.challengeAlertTitle) ui.challengeAlertTitle.textContent = '⚔️ 실시간 대결 요청이 왔어요!';
    if (ui.challengeAlertText) {
      ui.challengeAlertText.textContent = `[${shortSchoolLabel(from.schoolName)} ${from.className}] @${from.userId} (${from.nickname})님이 실시간 1:1 대결을 신청했어요!`;
    }
    engine.audio.playSkillCharge();
    ui.challengeAlertModal?.classList.remove('hidden');
  } catch {
    // ignore
  }
}
setInterval(pollServerChallenges, 2200);

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
syncProfileWithServer(loadUserProfile());
renderFriendChips();
renderOpponentSearchList();

function enterLoginOrLobbyAfterAd() {
  ui.profileModal?.classList.add('hidden');
  ui.lobbyScreen.classList.remove('hidden');
}



// --- 실시간 온라인 방 대전 (/api/battle/*) 바인딩 & 재접속 ---
let onlineMatchEntered = false;
let lastPartyModalSig = '';

function escapePartyHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPartyRoomModal(res) {
  if (!ui.partyRoomModal || !res) return;
  const maxP = Math.max(2, Number(res.maxPlayers) || 2);
  const players = Array.isArray(res.players) ? res.players : [];
  const code = String(res.inviteCode || onlineClient.inviteCode || '------').toUpperCase();
  const title = (res.roomTitle || '').trim() || (players[0]?.name ? `${players[0].name}의 파티방` : '볼탱이 파티방');
  const isHost = onlineClient.slot === 0;
  const isApproval = res.status === 'WAITING_APPROVAL';

  ui.partyRoomModal.classList.remove('hidden');

  const sig = JSON.stringify({
    status: res.status,
    title,
    code,
    maxP,
    slot: onlineClient.slot,
    players: players.map((p) => [p.slot, p.name, p.charKey]),
  });
  if (sig === lastPartyModalSig) return;
  lastPartyModalSig = sig;

  if (ui.partyRoomTitle) ui.partyRoomTitle.textContent = title;
  if (ui.partyRoomMode) {
    const modeLabel = maxP === 3 ? '1:1:1 삼파전' : '1:1 대전';
    ui.partyRoomMode.textContent = `${modeLabel} · ${players.length}/${maxP}명`;
  }
  if (ui.partyRoomCode) ui.partyRoomCode.textContent = code;

  if (ui.partySlotsGrid) {
    const cards = [];
    for (let i = 0; i < maxP; i++) {
      const p = players[i];
      if (p) {
        const isMe = i === onlineClient.slot;
        const safeName = escapePartyHtml(p.name || `플레이어 ${i + 1}`);
        const safeChar = encodeURIComponent(CHARACTERS[p.charKey] ? p.charKey : 'M01_MOCHI');
        const badgeClass = i === 0 ? 'host' : 'ready';
        const badgeText = i === 0 ? '👑 방장' : '✅ 입장 완료';
        cards.push(
          `<div class="party-slot-card joined${isMe ? ' me' : ''}">` +
            `<div class="party-slot-avatar"><img src="./assets/chars/${safeChar}.png" alt="${safeName}" /></div>` +
            `<div class="party-slot-name">${safeName}${isMe ? ' (나)' : ''}</div>` +
            `<span class="party-slot-badge ${badgeClass}">${badgeText}</span>` +
          `</div>`
        );
      } else {
        cards.push(
          `<div class="party-slot-card empty">` +
            `<div class="party-slot-avatar">⏳</div>` +
            `<div class="party-slot-name">참가자 대기 중...</div>` +
            `<span class="party-slot-badge waiting">빈 슬롯 ${i + 1}</span>` +
          `</div>`
        );
      }
    }
    ui.partySlotsGrid.innerHTML = cards.join('');
  }

  if (ui.partyRoomHint) {
    if (isApproval) {
      ui.partyRoomHint.textContent = isHost
        ? '🔔 참가자가 준비되었습니다! 아래 [🔥 대전 시작!]을 눌러 시작하세요.'
        : '방장의 대전 시작 승인을 기다리고 있어요...';
    } else {
      const remain = Math.max(0, maxP - players.length);
      ui.partyRoomHint.textContent = remain > 0
        ? `앞으로 ${remain}명만 더 들어오면 자동으로 대전이 시작됩니다!`
        : '모든 참가자가 모였습니다! 곧 대전이 시작됩니다...';
    }
  }

  if (ui.partyApproveBtn) {
    ui.partyApproveBtn.classList.toggle('hidden', !(isApproval && isHost));
  }
}

ui.copyPartyCodeBtn?.addEventListener('click', async () => {
  const code = (ui.partyRoomCode?.textContent || '').trim();
  if (!code || code === '------') return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code);
    } else {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    ui.copyPartyCodeBtn.textContent = '✅ 복사됨!';
    setTimeout(() => {
      if (ui.copyPartyCodeBtn) ui.copyPartyCodeBtn.textContent = '📋 코드 복사';
    }, 1800);
  } catch {
    ui.copyPartyCodeBtn.textContent = `코드: ${code}`;
  }
});

ui.partyApproveBtn?.addEventListener('click', () => {
  ui.approveOnlineRoomBtn?.click();
});

ui.leavePartyRoomBtn?.addEventListener('click', () => {
  ui.cancelOnlineRoomBtn?.click();
});

function handleOnlineRoomState(res) {
  if (!res) return;
  let connectionStatus = document.getElementById('onlineConnectionStatus');
  if (!connectionStatus) {
    connectionStatus = document.createElement('div');
    connectionStatus.id = 'onlineConnectionStatus';
    connectionStatus.setAttribute('role', 'status');
    Object.assign(connectionStatus.style, {
      position: 'fixed', top: 'max(8px, env(safe-area-inset-top))', left: '50%',
      transform: 'translateX(-50%)', zIndex: '10000', background: '#222',
      color: '#fff', padding: '8px 14px', borderRadius: '8px', display: 'none',
    });
    document.body.appendChild(connectionStatus);
  }
  if (res.connectionError) {
    connectionStatus.textContent = res.disconnected
      ? '대전방 연결이 종료됐습니다. 로비로 돌아가 주세요.'
      : '연결이 끊겨 다시 연결하는 중입니다.';
    connectionStatus.style.display = 'block';
    return;
  }
  connectionStatus.style.display = 'none';
  if (res.status === 'WAITING_GUEST') {
    const joinedCount = res.players?.length || 1;
    const maxP = res.maxPlayers || 2;
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent =
      onlineClient.slot === 0
        ? `방 코드 [${res.inviteCode}] — 참가자 입장 대기 중 (${joinedCount}/${maxP}명)...`
        : `입장 완료! 다른 참가자 대기 중 (${joinedCount}/${maxP}명)...`;
    ui.approveOnlineRoomBtn?.classList.add('hidden');
    renderPartyRoomModal(res);
    return;
  }
  if (res.status === 'WAITING_APPROVAL') {
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    const joinedCount = res.players?.length || 2;
    const maxP = res.maxPlayers || 2;
    if (onlineClient.slot === 0) {
      const names = (res.players || []).slice(1).map((p) => p.name).join(', ');
      const needMore = joinedCount < maxP ? ` (코드 [${res.inviteCode}] · ${joinedCount}/${maxP}명)` : ` (${joinedCount}/${maxP}명 완료!)`;
      ui.onlineRoomStatusText.textContent = `🔔 ${names} 입장!${needMore}`;
      ui.approveOnlineRoomBtn?.classList.remove('hidden');
    } else {
      ui.onlineRoomStatusText.textContent = `방장 시작 승인 대기 중... (${joinedCount}/${maxP}명)`;
      ui.approveOnlineRoomBtn?.classList.add('hidden');
    }
    renderPartyRoomModal(res);
    return;
  }
  if ((res.status === 'ACTIVE' || res.status === 'FINISHED') && res.snapshot) {
    lastPartyModalSig = '';
    ui.partyRoomModal?.classList.add('hidden');
    engine.isRemoteMatch = true;
    if (!onlineMatchEntered) {
      onlineMatchEntered = true;
      window.AndroidBridge?.setOrientation?.('landscape');
      engine.audio.startBattleBgm(res.snapshot.mapKey);
      ui.interstitialAdOverlay?.classList.add('hidden');
      ui.profileModal?.classList.add('hidden');
      ui.lobbyScreen.classList.add('hidden');
      ui.gameScreen.classList.remove('hidden');
    }
    onlineClient.applySnapshotToEngine(engine, res.snapshot);
  }
}

ui.cancelOnlineRoomBtn?.addEventListener('click', () => {
  onlineMatchEntered = false;
  lastPartyModalSig = '';
  onlineClient.clearSession();
  engine.isRemoteMatch = false;
  ui.onlineRoomStatusBox?.classList.add('hidden');
  ui.partyRoomModal?.classList.add('hidden');
  lastLanRoomsJson = '';
  refreshLanOpenRooms();
});

ui.createOnlineRoomBtn?.addEventListener('click', async () => {
  onlineMatchEntered = false;
  lastPartyModalSig = '';
  const prof = getSafeProfile();
  const roomTitle = (ui.onlineRoomTitleInput?.value || '').trim();
  const maxPlayers = Number(ui.onlineMaxPlayers?.value || 2);
  try {
    const res = await onlineClient.createRoom({
      mapPreset: ui.mapSelect.value,
      charKey: ui.charSelect.value,
      name: prof.nickname,
      roomTitle,
      maxPlayers,
      schoolName: prof.schoolName || '',
      className: prof.className || '',
      scope: 'all',
    });
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `방 생성 완료! 초대 코드: ${res.inviteCode}`;
    renderPartyRoomModal({
      status: 'WAITING_GUEST',
      inviteCode: res.inviteCode,
      roomTitle: res.roomTitle || roomTitle,
      maxPlayers: res.maxPlayers || maxPlayers,
      players: [{ slot: 0, name: prof.nickname, charKey: ui.charSelect.value }],
    });
    onlineClient.startPolling(handleOnlineRoomState, 65);
  } catch (err) {
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `방 생성 오류: ${err.message}`;
  }
});

ui.createClassOnlineRoomBtn?.addEventListener('click', async () => {
  onlineMatchEntered = false;
  lastPartyModalSig = '';
  const prof = getSafeProfile();
  const roomTitle = (ui.schoolRoomTitleInput?.value || '').trim();
  const maxPlayers = Number(ui.schoolOnlineMaxPlayers?.value || 2);
  try {
    const res = await onlineClient.createRoom({
      mapPreset: ui.mapSelect.value,
      charKey: ui.charSelect.value,
      name: prof.nickname,
      roomTitle,
      maxPlayers,
      schoolName: prof.schoolName || '',
      className: prof.className || '',
      scope: 'class',
    });
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `🎓 [${shortSchoolLabel(prof.schoolName)} ${prof.className}] 반 대전 방 생성! 코드: ${res.inviteCode}`;
    renderPartyRoomModal({
      status: 'WAITING_GUEST',
      inviteCode: res.inviteCode,
      roomTitle: res.roomTitle || roomTitle || `${shortSchoolLabel(prof.schoolName)} ${prof.className} 반 대전`,
      maxPlayers: res.maxPlayers || maxPlayers,
      players: [{ slot: 0, name: prof.nickname, charKey: ui.charSelect.value }],
    });
    onlineClient.startPolling(handleOnlineRoomState, 65);
  } catch (err) {
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `방 생성 오류: ${err.message}`;
  }
});

ui.joinOnlineRoomBtn?.addEventListener('click', async () => {
  onlineMatchEntered = false;
  lastPartyModalSig = '';
  const code = (ui.onlineInviteInput?.value || '').trim().toUpperCase();
  if (!code) return;
  const prof = getSafeProfile();
  try {
    const res = await onlineClient.joinRoom({
      inviteCode: code,
      charKey: ui.charSelect.value,
      name: prof.nickname,
    });
    if (res?.status === 'ACTIVE' && res?.snapshot) {
      onlineClient.startPolling(handleOnlineRoomState, 65);
      handleOnlineRoomState(res);
      return;
    }
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = '입장 완료! 다른 참가자/시작 대기 중...';
    onlineClient.startPolling(handleOnlineRoomState, 65);
  } catch (err) {
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `입장 실패: ${err.message}`;
  }
});

ui.approveOnlineRoomBtn?.addEventListener('click', async () => {
  try {
    const res = await onlineClient.approveRoom();
    if (res?.snapshot) {
      handleOnlineRoomState({ status: 'ACTIVE', snapshot: res.snapshot });
    }
  } catch (err) {
    ui.onlineRoomStatusText.textContent = `시작 실패: ${err.message}`;
  }
});

// 같은 네트워크 열린 대기방 목록 자동 조회 & 1클릭 입장
let lastLanRoomsJson = '';
async function refreshLanOpenRooms() {
  if (!ui.lanOpenRoomsList || ui.lobbyScreen?.classList.contains('hidden')) return;
  try {
    const res = await fetch('/api/battle/rooms/open', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const list = (data.rooms || []).filter((r) => r.roomId !== onlineClient.roomId);
    const prof = loadUserProfile();
    const mySchool = String(prof?.schoolName || '').trim();
    const myClass = String(prof?.className || '').trim();
    const sig = JSON.stringify({ list, mySchool, myClass });
    if (sig === lastLanRoomsJson) return;
    lastLanRoomsJson = sig;
    const renderRoomRow = (r) => {
      const classTag = r.schoolName && r.className ? ` · ${escapePartyHtml(shortSchoolLabel(r.schoolName))} ${escapePartyHtml(r.className)}` : '';
      const titleLabel = escapePartyHtml(r.roomTitle || `${r.hostName}의 방`);
      const icon = r.scope === 'class' ? '🎓' : '🏠';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(15,23,42,0.45);padding:6px 8px;border-radius:8px;">
        <span style="font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${icon} <b>${titleLabel}</b> <span style="opacity:0.75;">(${escapePartyHtml(r.hostName)}${classTag} · ${escapePartyHtml(r.playersCount)}/${escapePartyHtml(r.maxPlayers)}명)</span></span>
        <button type="button" class="social-mini-btn lan-join-btn" data-code="${escapePartyHtml(r.inviteCode)}" style="flex:0 0 auto;">입장</button>
      </div>`;
    };
    const bindJoinBtns = (container) => {
      container.querySelectorAll('.lan-join-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (ui.onlineInviteInput) ui.onlineInviteInput.value = btn.dataset.code || '';
          ui.joinOnlineRoomBtn?.click();
        });
      });
    };

    if (!list.length) {
      ui.lanOpenRoomsList.innerHTML = '<span style="font-size:11.5px; opacity:0.7;">열린 방이 없습니다. 방 만들기를 누르세요!</span>';
    } else {
      ui.lanOpenRoomsList.innerHTML = list.map(renderRoomRow).join('');
      bindJoinBtns(ui.lanOpenRoomsList);
    }

    if (ui.schoolOpenRoomsList) {
      const classRooms = list.filter((r) => {
        if (!mySchool || !myClass) return r.scope === 'class';
        return r.schoolName === mySchool && r.className === myClass;
      });
      if (!classRooms.length) {
        ui.schoolOpenRoomsList.innerHTML = '<span style="font-size:11.5px; opacity:0.7;">현재 열린 우리 반 온라인 방이 없습니다.</span>';
      } else {
        ui.schoolOpenRoomsList.innerHTML = classRooms.map(renderRoomRow).join('');
        bindJoinBtns(ui.schoolOpenRoomsList);
      }
    }
  } catch {
    // ignore transient poll error
  }
}
const STATIC_HOST = /github\.io$|^(127\.0\.0\.1|localhost)$/.test(window.location.hostname);
if (!STATIC_HOST) {
  refreshLanOpenRooms();
  setInterval(refreshLanOpenRooms, 2200);
}

let currentLbScope = 'all';
for (const btn of ui.lbScopeBtns || []) {
  btn.addEventListener('click', () => {
    currentLbScope = btn.dataset.lbScope || 'all';
    for (const b of ui.lbScopeBtns) b.classList.toggle('active', b === btn);
    refreshLeaderboard(true);
  });
}

async function sendChallengeToPlayer(targetUserId, targetNickname) {
  onlineMatchEntered = false;
  const prof = getSafeProfile();
  try {
    const accountToken = onlineClient.getActiveAccountAuth()?.accountToken;
    if (!accountToken) throw new Error('도전장을 보내려면 계정 등록이 필요합니다.');
    const res = await onlineClient.createRoom({
      mapPreset: ui.mapSelect.value,
      charKey: ui.charSelect.value,
      name: prof.nickname,
      maxPlayers: 2,
      schoolName: prof.schoolName || '',
      className: prof.className || '',
      scope: 'all',
    });
    const challengeResponse = await fetch('/api/battle/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({
        targetUserId,
        inviteCode: res.inviteCode,
        roomId: res.roomId,
        fromUserId: prof.userId,
        fromNickname: prof.nickname,
        fromSchool: prof.schoolName,
        fromClass: prof.className,
      }),
    });
    if (!challengeResponse.ok) throw new Error('도전장을 전송하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `⚔️ ${targetNickname}(@${targetUserId})님에게 대결 요청 전송 완료! 수락 대기 중... [${res.inviteCode}]`;
    onlineClient.startPolling(handleOnlineRoomState, 65);
  } catch (err) {
    onlineClient.clearSession();
    ui.onlineRoomStatusBox?.classList.remove('hidden');
    ui.onlineRoomStatusText.textContent = `대결 요청 오류: ${err.message}`;
  }
}

let lastLeaderboardJson = '';
async function refreshLeaderboard(force = false) {
  if (!ui.leaderboardList) return;
  if (!force && ui.lobbyScreen?.classList.contains('hidden')) return;
  try {
    const prof = loadUserProfile();
    const myId = prof?.userId || '';
    const mySchool = prof?.schoolName || '';
    const myClass = prof?.className || '';
    const qs = new URLSearchParams({
      scope: currentLbScope,
      schoolName: mySchool,
      className: myClass,
    });
    const res = await fetch(`/api/battle/leaderboard?${qs.toString()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.rankedRewardsEnabled === false) {
      if (ui.schoolTopBanner) ui.schoolTopBanner.textContent = '공식 랭킹 집계가 일시 중단되었습니다.';
      ui.leaderboardList.textContent = '공정한 대전을 준비하는 동안 순위와 경기 보상은 제공되지 않습니다.';
      return;
    }
    const list = data.leaderboard || [];
    const schoolTop = data.schoolTop || null;
    const classTop = data.classTop || null;
    const sig = JSON.stringify({ list, schoolTop, classTop, myId, currentLbScope });
    if (!force && sig === lastLeaderboardJson) return;
    lastLeaderboardJson = sig;

    if (ui.schoolTopBanner) {
      if (schoolTop) {
        const rkTxt = `${schoolTop.rankBadge || '🌱'} Lv.${schoolTop.rankLevel || 1}`;
        ui.schoolTopBanner.textContent = `👑 우리 학교 1등 (${shortSchoolLabel(mySchool)}): ${rkTxt} ${schoolTop.nickname} (@${schoolTop.userId}) · ${schoolTop.score ?? 0}점 (${schoolTop.matches}전 ${schoolTop.wins}승 · ${schoolTop.winRate}%)`;
      } else if (mySchool) {
        ui.schoolTopBanner.textContent = `👑 ${shortSchoolLabel(mySchool)} 우리 학교 첫 1등에 도전해보세요!`;
      } else {
        ui.schoolTopBanner.textContent = '👑 학교 정보를 등록하면 우리 학교 1등을 볼 수 있어요!';
      }
    }

    if (ui.classTopBanner) {
      if (classTop) {
        const rkTxt = `${classTop.rankBadge || '🌱'} Lv.${classTop.rankLevel || 1}`;
        ui.classTopBanner.textContent = `🎓 우리 반 1등 (${shortSchoolLabel(mySchool)} ${myClass}): ${rkTxt} ${classTop.nickname} (@${classTop.userId}) · ${classTop.score ?? 0}점 (${classTop.matches}전 ${classTop.wins}승 · ${classTop.winRate}%)`;
      } else if (mySchool && myClass) {
        ui.classTopBanner.textContent = `🎓 ${shortSchoolLabel(mySchool)} ${myClass} 우리 반 첫 1등에 도전해보세요!`;
      } else {
        ui.classTopBanner.textContent = '🎓 반 정보를 등록하면 우리 반 1등을 볼 수 있어요!';
      }
    }

    if (!list.length) {
      ui.leaderboardList.innerHTML = '<span style="font-size:11.5px; opacity:0.7;">아직 기록된 전적이 없습니다. 첫 대전을 시작해보세요!</span>';
      return;
    }
    ui.leaderboardList.innerHTML = list
      .map((item) => {
        const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `${escapePartyHtml(item.rank)}위`;
        const rkBadge = `${escapePartyHtml(item.rankBadge || '🌱')}Lv.${escapePartyHtml(item.rankLevel || 1)}`;
        const isMe = myId && item.userId === myId;
        const bg = isMe ? 'rgba(250,204,21,0.18); border:1px solid rgba(250,204,21,0.45);' : 'rgba(15,23,42,0.45);';
        const challengeBtn = !isMe
          ? `<button type="button" class="social-mini-btn lb-challenge-btn" data-uid="${escapePartyHtml(item.userId)}" data-nick="${escapePartyHtml(item.nickname)}" style="padding:3px 7px;font-size:11px;flex:0 0 auto;">⚔️ 대결</button>`
          : '';
        return `<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;background:${bg}padding:5px 8px;border-radius:8px;font-size:12px;">
          <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${medal} <span style="opacity:0.9;">${rkBadge}</span> <b>${escapePartyHtml(item.nickname)}</b> <span style="opacity:0.7;">@${escapePartyHtml(item.userId)}</span></span>
          <div style="display:flex;align-items:center;gap:6px;flex:0 0 auto;">
            <span style="white-space:nowrap;font-weight:700;color:#FDE047;">${escapePartyHtml(item.score ?? 0)}점 · ${escapePartyHtml(item.matches)}전 ${escapePartyHtml(item.wins)}승 (${escapePartyHtml(item.winRate)}%)</span>
            ${challengeBtn}
          </div>
        </div>`;
      })
      .join('');
    ui.leaderboardList.querySelectorAll('.lb-challenge-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        sendChallengeToPlayer(btn.dataset.uid, btn.dataset.nick || btn.dataset.uid);
      });
    });
  } catch {
    // ignore transient error
  }
}
if (!STATIC_HOST) {
  refreshLeaderboard(true);
  setInterval(() => refreshLeaderboard(false), 5000);
}

// 새로고침 후 진행 중인 온라인 대전 세션이 있으면 자동 재접속
(async () => {
  const saved = onlineClient.loadSession();
  if (!saved) return;
  try {
    const st = await onlineClient.fetchState();
    if (st && (st.status === 'ACTIVE' || st.status === 'WAITING_GUEST' || st.status === 'WAITING_APPROVAL')) {
      handleOnlineRoomState(st);
      onlineClient.startPolling(handleOnlineRoomState, 65);
    } else {
      onlineClient.clearSession();
    }
  } catch {
    onlineClient.clearSession();
  }
})();

// 실제 광고 SDK가 준비되기 전에는 광고 없이 바로 로비로 진입합니다.
enterLoginOrLobbyAfterAd();
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

// Phase 2/3 상용 UI 초기화 (4대 소셜 원클릭 로그인 · 3카드 다이어트 로비 · 실시간 서버 친구초대 · 누적 랭커 · Non-P2W 코스메틱 상점)
initBakeryCommercialUi({
  engine,
  ui,
  launchMatchSpec,
  saveUserProfile,
  loadUserProfile,
  onlineClient,
  handleOnlineRoomState,
});

// 초기 매치 구동 (백그라운드 초기화 후 로비 대기)
restartWithCurrentOptions();
requestAnimationFrame(gameLoop);
