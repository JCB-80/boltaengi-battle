// 말랑포포: 폭신폭신 공성전 — 메인 엔트리 및 입력·UI 바인딩
import { CHARACTERS, CHARACTER_LIST, SHELLS, SKILL_MODES, WORLD } from './config.js?v=27';
import { GameRenderer, drawSpiritAvatar, drawPetMagnifierFrame } from './renderer.js?v=42';
import { renderOpenRooms, renderRankings } from './lobbyLists.js';
import { GameEngine } from './gameEngine.js?v=47';
import { loadUserProfile, migrateLocalProfiles } from './social.js?v=31';
import { createProfileLogin } from './profileLogin.js?v=1';
import { OnlineBattleClient } from './onlineAdapter.js?v=4';

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
  onlineSkillNote: document.getElementById('onlineSkillNote'),
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

  // 프로필과 닉네임 초대
  profileSummaryText: document.getElementById('profileSummaryText'),
  lobbyBgmBtn: document.getElementById('lobbyBgmBtn'),
  openProfileBtn: document.getElementById('openProfileBtn'),
  profileModal: document.getElementById('profileModal'),
  socialTabs: Array.from(document.querySelectorAll('.social-tab')),
  hubPanelFriend: document.getElementById('hubPanelFriend'),
  modeFieldWrap: document.getElementById('modeSelect')?.closest('.lobby-field'),
  aiFieldWrap: document.getElementById('aiSelect')?.closest('.lobby-field'),
  nicknameInviteForm: document.getElementById('nicknameInviteForm'),
  inviteNickname: document.getElementById('inviteNickname'),

  petMagnifierOverlay: document.getElementById('petMagnifierOverlay'),
  petMagnifierCanvas: document.getElementById('petMagnifierCanvas'),
  petMoodBadge: document.getElementById('petMoodBadge'),
  closePetMagnifierBtn: document.getElementById('closePetMagnifierBtn'),

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

  battleRoster: document.getElementById('battleRoster'),
  bottomHpHud: document.getElementById('bottomHpHud'),
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
  leaderboardList: document.getElementById('leaderboardList'),
  leaderboardBox: document.getElementById('leaderboardBox'),
  rankingQuery: document.getElementById('rankingQuery'),
  rankingStatus: document.getElementById('rankingStatus'),
  showMyRank: document.getElementById('showMyRank'),
  clearRankingQuery: document.getElementById('clearRankingQuery'),
  charPicker: document.querySelector('.lobby-char-picker'),
  lobbyGrid: document.querySelector('.lobby-grid'),

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

function syncBattleRoster(carts, activeActor, phase) {
  const showRoster = carts.length > 2;
  ui.bottomHpHud.classList.toggle('has-roster', showRoster);
  if (!showRoster) return;

  const roster = ui.battleRoster;
  const hasTeams = new Set(carts.map(cart => cart.teamId)).size < carts.length;
  if (roster.children.length !== carts.length) {
    roster.replaceChildren();
    for (let index = 0; index < carts.length; index++) {
      const card = document.createElement('div');
      card.className = 'roster-card';
      card.setAttribute('role', 'listitem');
      card.innerHTML = '<div><b class="roster-seat"></b><span class="roster-name"></span></div>' +
        '<div><progress aria-label="체력"></progress><b class="roster-hp"></b></div>';
      roster.appendChild(card);
    }
  }
  for (const [index, cart] of carts.entries()) {
    const card = roster.children[index];
    const seat = `${index + 1}P`;
    const team = hasTeams ? (cart.teamId === 1 ? 'A팀 ' : 'B팀 ') : '';
    const current = phase !== 'GAME_OVER' && cart.alive && cart === activeActor;
    card.classList.toggle('is-current', current);
    card.classList.toggle('is-out', !cart.alive);
    card.dataset.team = String(cart.teamId);
    card.querySelector('.roster-seat').textContent = team + seat;
    card.querySelector('.roster-name').textContent = engine.isRemoteMatch ? cart.displayName : cart.spec.name;
    const hp = Math.max(0, Math.ceil(cart.hp));
    const gauge = card.querySelector('progress');
    gauge.max = Math.max(1, cart.maxHp);
    gauge.value = hp;
    card.querySelector('.roster-hp').textContent = cart.alive ? String(hp) : '탈락';
    if (current) card.setAttribute('aria-current', 'true');
    else card.removeAttribute('aria-current');
  }
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
  syncBattleRoster(carts, activeActor, phase);
  const myCart = carts.find((c) => c.controller === 'human') || carts[0];
  const oppCart = carts.find((c) => c !== myCart) || carts[1];
  if (myCart && ui.hudLeftName && ui.hudLeftHp) {
    ui.hudLeftName.textContent = engine.isRemoteMatch ? myCart.displayName : (myCart.spec?.name || myCart.displayName);
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
    ui.hudRightName.textContent = engine.isRemoteMatch ? oppCart.displayName : (oppCart.spec?.name || oppCart.displayName);
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
  const currentSeat = carts.indexOf(activeActor);
  const turnOwner = phase === 'AIM' && currentSeat >= 0 ? `${currentSeat + 1}P 차례 · ` : '';
  ui.turnTimelineBadge.textContent = `${matchLabel && !compactHud ? matchLabel + ' · ' : ''}${turnOwner}T${turnNumber}${timerText}`;
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

  ui.weatherToggleBtn.disabled = engine.isRemoteMatch;
  ui.weatherToggleBtn.title = engine.isRemoteMatch ? '온라인 대전 날씨는 서버에서 정합니다' : '날씨 전환';
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
      recordCurrentMatchOutcome();
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

    ui.onlineSkillNote.classList.toggle('hidden', !engine.isRemoteMatch);
    for (const btn of ui.skillBtns) {
      btn.disabled = !humanTurn || (engine.isRemoteMatch && btn.dataset.skill !== 'NORMAL');
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
  if (!e.isPrimary || e.button !== 0 || pointerAnchor) return;
  engine.audio.ensureContext();
  const pt = toWorldCoords(e.clientX, e.clientY);

  // 비행 중 클릭 시 즉시 에어 트리거 기폭!
  if (engine.phase === 'FLIGHT' && engine.activeActor?.controller === 'human') {
    engine.triggerAirSkill();
    return;
  }

  const isMyTurn = engine.phase === 'AIM' && engine.activeActor?.controller === 'human';
  if (!isMyTurn) return;

  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // ignore pointer capture errors
  }
  pointerAnchor = {
    ...pt, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId,
    actor: engine.activeActor, turn: engine.turnNumber,
  };

  const muzzle = engine.activeActor.getMuzzlePosition();
  engine.dragState.active = true;
  engine.dragState.currentX = muzzle.baseX;
  engine.dragState.currentY = muzzle.baseY;
});

canvas.addEventListener('pointermove', (e) => {
  if (pointerAnchor?.pointerId !== e.pointerId || !engine.dragState.active ||
      engine.phase !== 'AIM' || pointerAnchor.actor !== engine.activeActor || pointerAnchor.turn !== engine.turnNumber) return;
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
  if (pointerAnchor?.pointerId !== e.pointerId) return;
  if (!engine.dragState.active || pointerAnchor.actor !== engine.activeActor || pointerAnchor.turn !== engine.turnNumber) {
    cancelAimDrag();
    return;
  }
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
function cancelAimDrag(e) {
  if (!pointerAnchor || (e && e.pointerId !== pointerAnchor.pointerId)) return;
  pointerAnchor = null;
  engine.dragState.active = false;
}
canvas.addEventListener('pointercancel', cancelAimDrag);
canvas.addEventListener('lostpointercapture', cancelAimDrag);
function clearBattleInput() {
  heldKeys.clear();
  cancelAimDrag();
}
window.addEventListener('blur', clearBattleInput);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearBattleInput();
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

// 로컬 대전 · 온라인 대전 로비
let currentSocialHub = 'classic';


function hasOnlineProfile() {
  const profile = loadUserProfile();
  return Boolean(profile?.provider && !profile.needsNickname &&
    onlineClient.getActiveAccountAuth()?.userId === profile.userId);
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

async function syncProfileWithServer(profile) {
  if (!profile) return;
  try {
    const account = await onlineClient.syncAccount(profile);
    if (account) profileLogin.refresh(account);
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      onlineClient.forgetAccount();
      refreshProfileUi();
    }
  }
}

async function recordCurrentMatchOutcome() {
  const won = engine.didLocalPlayerWin();

  // 1) 로컬·온라인 공통: 승리할 때마다 경험치 획득 & 계급 시스템 즉시 반영
  const xpGain = engine.isRemoteMatch ? (won ? 120 : 35) : (won ? 100 : 25);
  const roomReceipt = engine.isRemoteMatch ? `${onlineClient.roomId}:${onlineClient.slot}` : null;
  if (!engine.isRemoteMatch || !hasOnlineProfile()) engine.grantXp(xpGain, won ? '승리 보너스' : '참가 보너스', roomReceipt);

  const prof = loadUserProfile();
  if (!prof?.userId) return;

  if (engine.isRemoteMatch) {
    // 온라인 대전은 server.mjs finishRoomIfEnded가 서버 권위로 공식 정산함 -> 최신 전적/랭킹 동기화
    setTimeout(async () => {
      try {
        const acc = await onlineClient.fetchMyAccount();
        if (acc && acc.userId === loadUserProfile()?.userId) {
          saveCachedAccountStats(prof.userId, { wins: acc.wins, matches: acc.matches, score: acc.score });
          engine.setProgressOwner(acc.userId, acc.xp);
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
  const profile = loadUserProfile();
  const linked = hasOnlineProfile();
  ui.profileSummaryText.textContent = linked ? profile.nickname : '게스트';
  ui.openProfileBtn.textContent = linked ? '내 계정' : '가입 · 로그인';
}

const profileLogin = createProfileLogin({
  client: onlineClient,
  onProfile(account, previous) {
    saveCachedAccountStats(account.userId, account);
    engine.setProgressOwner(account.userId, account.xp, previous?.userId === account.userId && !previous.provider);
    refreshProfileUi();
    refreshLeaderboard(true);
  },
  onSignOut(removedUserId) {
    if (removedUserId && engine.progressOwner === removedUserId) localStorage.removeItem(engine.progressKey);
    engine.setProgressOwner(null);
    pendingIncomingChallenge = null;
    ui.challengeAlertModal.classList.add('hidden');
    refreshProfileUi();
    refreshLeaderboard(true);
  },
});

function openProfileModal(afterLogin) {
  return profileLogin.open(afterLogin);
}

let pendingIncomingChallenge = null;
let checkingInvites = false;
let respondingToInvite = false;

function switchSocialHub(hub) {
  currentSocialHub = hub;
  const online = hub === 'friend';
  const ranking = hub === 'ranking';
  for (const tab of ui.socialTabs) {
    const selected = tab.dataset.hub === hub;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-pressed', String(selected));
  }
  ui.hubPanelFriend.classList.toggle('hidden', !online);
  ui.modeFieldWrap?.classList.toggle('hidden', online);
  ui.aiFieldWrap?.classList.toggle('hidden', online);
  ui.startMatchBtn.classList.toggle('hidden', hub !== 'classic');
  ui.charPicker.classList.toggle('hidden', ranking);
  ui.lobbyGrid.classList.toggle('hidden', ranking);
  ui.leaderboardBox.classList.toggle('hidden', !ranking);
  if (ranking) refreshLeaderboard(true);
  if (online) refreshLanOpenRooms();
}

function restartWithCurrentOptions() {
  if (engine.isRemoteMatch || ui.gameScreen.classList.contains('hidden')) return;
  engine.startMatch({
    gameMode: ui.modeSelect.value,
    mapPreset: ui.mapSelect.value,
    aiPreset: ui.aiSelect.value,
    playerCharKey: ui.charSelect.value,
    matchLabel: '',
  });
  engine.audio.startBattleBgm(engine.terrain?.activeMapKey || ui.mapSelect.value);
}

function enterGameFromLobby() {
  if (currentSocialHub !== 'classic' || onlineClient.roomId || roomActionPending) return;
  onlineMatchEntered = false;
  engine.isRemoteMatch = false;
  ui.onlineRoomStatusBox.classList.add('hidden');
  window.AndroidBridge?.setOrientation?.('landscape');
  ui.lobbyScreen.classList.add('hidden');
  ui.gameScreen.classList.remove('hidden');
  restartWithCurrentOptions();
}

function returnToLobby() {
  clearBattleInput();
  onlineMatchEntered = false;
  onlineClient.clearSession();
  engine.isRemoteMatch = false;
  engine.phase = 'IDLE';
  engine.projectiles = [];
  finishedOnlineRoom = null;
  ui.restartBtn.disabled = false;
  ui.restartBtn.title = '새 판 리셋';
  ui.backToLobbyBtn.textContent = '로비';
  ui.modalRestartBtn.textContent = '다시 하기';
  document.getElementById('onlineConnectionStatus')?.remove();
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

ui.openProfileBtn.addEventListener('click', () => openProfileModal());

for (const tab of ui.socialTabs) {
  tab.addEventListener('click', () => switchSocialHub(tab.dataset.hub));
}
ui.nicknameInviteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendChallengeToPlayer(ui.inviteNickname.value.trim());
});

ui.startMatchBtn.addEventListener('click', enterGameFromLobby);
ui.backToLobbyBtn.addEventListener('click', returnToLobby);
ui.modalLobbyBtn.addEventListener('click', returnToLobby);

ui.restartBtn.addEventListener('click', restartWithCurrentOptions);
ui.modalRestartBtn.addEventListener('click', () => {
  if (!engine.isRemoteMatch) return restartWithCurrentOptions();
  const room = finishedOnlineRoom;
  const host = onlineClient.slot === 0;
  returnToLobby();
  switchSocialHub('friend');
  if (host && room?.scope === 'all') {
    createOnlineRoom(room);
  } else if (host && room?.scope === 'invite' && room.opponentNickname) {
    sendChallengeToPlayer(room.opponentNickname, room);
  } else if (host) {
    // Older rooms with an unknown or retired scope require a fresh choice.
    ui.inviteNickname.focus();
  } else {
    ui.onlineInviteInput.value = '';
    ui.onlineInviteInput.focus();
  }
});
ui.modeSelect.addEventListener('change', restartWithCurrentOptions);
ui.charSelect.addEventListener('change', restartWithCurrentOptions);
ui.mapSelect.addEventListener('change', restartWithCurrentOptions);
ui.aiSelect.addEventListener('change', () => {
  engine.aiPreset = ui.aiSelect.value;
  engine.notifyHud();
});

ui.acceptChallengeBtn.addEventListener('click', () => respondToInvite(true));
ui.declineChallengeBtn.addEventListener('click', () => respondToInvite(false));

async function respondToInvite(accept) {
  const invite = pendingIncomingChallenge;
  if (!invite || respondingToInvite) return;
  respondingToInvite = true;
  const accountToken = onlineClient.getActiveAccountAuth()?.accountToken;
  pendingIncomingChallenge = null;
  ui.challengeAlertModal.classList.add('hidden');
  try {
    const res = await fetch(`/api/battle/challenges/${encodeURIComponent(invite.id)}/respond`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
      body: JSON.stringify({ accept }),
    });
    if (!res.ok) throw new Error('초대가 만료되었거나 취소됐어요.');
    if (accept && onlineClient.getActiveAccountAuth()?.accountToken === accountToken) {
      switchSocialHub('friend');
      ui.onlineInviteInput.value = invite.inviteCode;
      await joinOnlineRoom(invite.inviteCode);
    }
  } catch (error) {
    showRoomMessage(error.message);
  } finally {
    respondingToInvite = false;
  }
}

async function pollServerChallenges() {
  const lobbyAvailable = () => !onlineClient.roomId && !roomActionPending && !respondingToInvite &&
    !ui.lobbyScreen.classList.contains('hidden') && ui.profileModal.classList.contains('hidden');
  if (checkingInvites || !lobbyAvailable() || !hasOnlineProfile()) return;
  const token = onlineClient.getActiveAccountAuth().accountToken;
  checkingInvites = true;
  try {
    const res = await fetch('/api/battle/challenges/pending', {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { challenge } = await res.json();
    if (!lobbyAvailable() || token !== onlineClient.getActiveAccountAuth()?.accountToken) return;
    if (!challenge) {
      pendingIncomingChallenge = null;
      ui.challengeAlertModal.classList.add('hidden');
      return;
    }
    if (challenge.id === pendingIncomingChallenge?.id) return;
    pendingIncomingChallenge = challenge;
    ui.challengeAlertTitle.textContent = '1:1 대전 초대';
    ui.challengeAlertText.textContent = `${challenge.from.nickname}님이 대전에 초대했어요.`;
    engine.audio.playSkillCharge();
    ui.challengeAlertModal.classList.remove('hidden');
  } catch { /* The next lobby poll will retry. */ }
  finally { checkingInvites = false; }
}
setInterval(pollServerChallenges, 2200);

migrateLocalProfiles();
const initialProfile = loadUserProfile();
if (initialProfile?.provider) engine.setProgressOwner(initialProfile.userId);
refreshProfileUi();
syncProfileWithServer(initialProfile);

function enterLoginOrLobbyAfterAd() {
  ui.profileModal?.classList.add('hidden');
  ui.lobbyScreen.classList.remove('hidden');
}



// --- 실시간 온라인 방 대전 (/api/battle/*) 바인딩 & 재접속 ---
let onlineMatchEntered = false;
let roomActionPending = false;
let finishedOnlineRoom = null;
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
  const isInviteRoom = onlineClient.roomScope === 'invite';

  ui.partyRoomModal.classList.remove('hidden');

  const sig = JSON.stringify({
    status: res.status,
    title,
    code,
    scope: onlineClient.roomScope,
    inviteStatus: res.inviteStatus,
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
  ui.partyRoomCode.closest('.party-code-bar').classList.toggle('hidden', isInviteRoom);
  ui.partyRoomCode.textContent = code;

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
    if (isInviteRoom && isHost && players.length < maxP) {
      const target = ui.inviteNickname.value.trim() || '친구';
      ui.partyRoomHint.textContent = res.inviteStatus === 'ACCEPTED'
        ? `${target}님이 초대를 수락했어요. 입장을 기다리고 있어요.` : `${target}님의 초대 수락을 기다리고 있어요.`;
    } else if (isApproval) {
      ui.partyRoomHint.textContent = isHost
        ? '🔔 참가자가 준비되었습니다! 아래 [🔥 대전 시작!]을 눌러 시작하세요.'
        : '방장의 대전 시작 승인을 기다리고 있어요...';
    } else {
      const remain = Math.max(0, maxP - players.length);
      ui.partyRoomHint.textContent = remain > 0
        ? `다른 참가자 ${remain}명을 기다리고 있어요.`
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
    if (res.disconnected && !ui.lobbyScreen.classList.contains('hidden')) {
      connectionStatus.style.display = 'none';
      ui.partyRoomModal.classList.add('hidden');
      showRoomMessage('대기방이 닫혔어요. 다시 초대하거나 다른 방에 입장해 주세요.');
      return;
    }
    connectionStatus.textContent = res.disconnected
      ? '대전방 연결이 종료됐습니다. 로비로 돌아가 주세요.'
      : '연결이 끊겨 다시 연결하는 중입니다.';
    connectionStatus.style.display = 'block';
    return;
  }
  connectionStatus.style.display = 'none';
  if (res.inviteStatus === 'DECLINED' || res.inviteStatus === 'EXPIRED') {
    ui.cancelOnlineRoomBtn.click();
    showRoomMessage(res.inviteStatus === 'DECLINED' ? '친구가 초대를 거절했어요.' : '응답이 없어 초대가 만료됐어요.');
    return;
  }
  if (res.status === 'WAITING_GUEST' || res.status === 'WAITING_APPROVAL') {
    ui.cancelOnlineRoomBtn.classList.remove('hidden');
  }
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
      finishedOnlineRoom = null;
      ui.restartBtn.disabled = true;
      ui.restartBtn.title = '진행 중인 온라인 대전';
      ui.backToLobbyBtn.textContent = '기권 · 로비';
      onlineMatchEntered = true;
      window.AndroidBridge?.setOrientation?.('landscape');
      engine.audio.startBattleBgm(res.snapshot.mapKey);
      ui.interstitialAdOverlay?.classList.add('hidden');
      ui.profileModal?.classList.add('hidden');
      ui.lobbyScreen.classList.add('hidden');
      ui.gameScreen.classList.remove('hidden');
    }
    if (res.status === 'FINISHED') {
      finishedOnlineRoom = {
        scope: onlineClient.roomScope,
        opponentNickname: res.players?.find(player => player.slot !== onlineClient.slot)?.name,
        roomTitle: res.roomTitle,
        maxPlayers: res.maxPlayers || res.snapshot.carts.length,
        mapPreset: res.snapshot.mapKey,
        charKey: res.snapshot.carts[onlineClient.slot]?.charKey || ui.charSelect.value,
      };
      const hostAction = finishedOnlineRoom.scope === 'all' ? '새 공개 방 만들기'
        : finishedOnlineRoom.scope === 'invite' && finishedOnlineRoom.opponentNickname ? '상대에게 다시 초대 보내기' : '로비에서 대전 선택';
      ui.modalRestartBtn.textContent = onlineClient.slot === 0 ? hostAction : '새 초대 코드로 입장';
      ui.backToLobbyBtn.textContent = '로비';
      onlineClient.stopPolling();
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

function showRoomMessage(message) {
  ui.onlineRoomStatusText.textContent = message;
  ui.onlineRoomStatusBox.classList.remove('hidden');
  ui.cancelOnlineRoomBtn.classList.toggle('hidden', !onlineClient.roomId);
  ui.approveOnlineRoomBtn.classList.add('hidden');
}

const roomErrorMessages = {
  INVALID_NICKNAME: '친구의 닉네임을 확인해 주세요.',
  NICKNAME_NOT_FOUND: '해당 닉네임을 찾지 못했어요. 친구의 게임 닉네임을 확인해 주세요.',
  SELF_CHALLENGE: '자신을 초대할 수 없어요.',
  ROOM_NOT_FOUND: '방을 찾을 수 없어요. 코드를 확인해 주세요.',
  ROOM_FULL: '이미 정원이 찬 방이에요.',
  SOCIAL_LOGIN_REQUIRED: '소셜 로그인 후 온라인 대전을 이용해 주세요.',
};

async function enterOnlineRoom(action) {
  if (roomActionPending || onlineClient.roomId) return;
  if (!hasOnlineProfile()) {
    openProfileModal(() => enterOnlineRoom(action), true);
    return;
  }
  roomActionPending = true;
  showRoomMessage('대전 서버에 연결 중…');
  try {
    await action(loadUserProfile().nickname);
    onlineClient.startPolling(handleOnlineRoomState, 65);
  } catch (error) {
    onlineClient.clearSession();
    showRoomMessage(roomErrorMessages[error.message] || '방에 연결하지 못했어요. 방 정보와 네트워크를 확인해 주세요.');
  } finally {
    roomActionPending = false;
  }
}

function createOnlineRoom(previous = {}) {
  return enterOnlineRoom(async (nickname) => {
    const roomTitle = previous.roomTitle || ui.onlineRoomTitleInput.value.trim();
    const charKey = previous.charKey || ui.charSelect.value;
    const res = await onlineClient.createRoom({
      mapPreset: previous.mapPreset || ui.mapSelect.value,
      charKey, name: nickname, roomTitle, maxPlayers: previous.maxPlayers || Number(ui.onlineMaxPlayers.value), scope: 'all',
    });
    handleOnlineRoomState({ ...res, roomTitle, players: [{ slot: 0, name: nickname, charKey }] });
  });
}

function joinOnlineRoom(code) {
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    showRoomMessage('6자리 방 코드를 입력해 주세요.');
    return;
  }
  return enterOnlineRoom(async (nickname) => {
    const res = await onlineClient.joinRoom({ inviteCode: code, charKey: ui.charSelect.value, name: nickname });
    if (res.snapshot) handleOnlineRoomState(res);
    else showRoomMessage('입장했어요. 참가자를 기다리고 있어요.');
  });
}

ui.createOnlineRoomBtn.addEventListener('click', () => createOnlineRoom());
ui.joinOnlineRoomBtn.addEventListener('click', () => joinOnlineRoom(ui.onlineInviteInput.value.trim().toUpperCase()));

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

// 공개 방과 개인 순위에는 서버가 반환한 실제 참가자와 기록만 표시한다.
let lastLanRoomsJson = '';
async function refreshLanOpenRooms() {
  if (currentSocialHub !== 'friend' || ui.lobbyScreen.classList.contains('hidden')) return;
  try {
    const res = await fetch('/api/battle/rooms/open', { cache: 'no-store' });
    if (!res.ok) return;
    const { rooms } = await res.json();
    const list = rooms.filter(room => room.scope === 'all' && room.roomId !== onlineClient.roomId);
    const sig = JSON.stringify(list);
    if (sig === lastLanRoomsJson) return;
    lastLanRoomsJson = sig;
    renderOpenRooms(ui.lanOpenRoomsList, list, joinOnlineRoom);
  } catch { /* Refresh on the next poll. */ }
}
setInterval(refreshLanOpenRooms, 2200);

function sendChallengeToPlayer(targetNickname, previous = {}) {
  if (!targetNickname) return;
  switchSocialHub('friend');
  ui.inviteNickname.value = targetNickname;
  return enterOnlineRoom(async (nickname) => {
    const res = await onlineClient.createRoom({
      mapPreset: previous.mapPreset || ui.mapSelect.value,
      charKey: previous.charKey || ui.charSelect.value, name: nickname, maxPlayers: 2, scope: 'invite',
    });
    const response = await fetch('/api/battle/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${onlineClient.getActiveAccountAuth().accountToken}` },
      body: JSON.stringify({ targetNickname, inviteCode: res.inviteCode, roomId: res.roomId }),
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      throw new Error(details.error || 'INVITE_FAILED');
    }
    handleOnlineRoomState({
      ...res, players: [{ slot: 0, name: nickname, charKey: previous.charKey || ui.charSelect.value }],
    });
    showRoomMessage(`${targetNickname}님에게 초대를 보냈어요.`);
  });
}

let lastLeaderboardJson = '';
let rankingFetch = null;
let rankingTimer;
let ownRank = false;

function changeRankingFilter(value, own = false, delay = 0) {
  clearTimeout(rankingTimer);
  rankingFetch?.abort();
  ownRank = own;
  if (ui.rankingQuery.value !== value) ui.rankingQuery.value = value;
  ui.clearRankingQuery.classList.toggle('hidden', !value.trim());
  ui.rankingStatus.textContent = '순위를 불러오는 중…';
  ui.leaderboardList.replaceChildren();
  rankingTimer = setTimeout(() => refreshLeaderboard(true), delay);
}

ui.rankingQuery.addEventListener('input', () => changeRankingFilter(ui.rankingQuery.value, false, 150));
ui.clearRankingQuery.addEventListener('click', () => {
  changeRankingFilter('');
  ui.rankingQuery.focus();
});
ui.showMyRank.addEventListener('click', () => {
  if (hasOnlineProfile()) changeRankingFilter(loadUserProfile().nickname, true);
});

async function refreshLeaderboard(force = false) {
  if (currentSocialHub !== 'ranking' || ui.lobbyScreen.classList.contains('hidden')) return;
  const myNickname = hasOnlineProfile() ? loadUserProfile().nickname : '';
  ui.showMyRank.classList.toggle('hidden', !myNickname);
  if (ownRank) {
    ui.rankingQuery.value = myNickname;
    ownRank = Boolean(myNickname);
  }
  const query = ui.rankingQuery.value.trim();
  ui.clearRankingQuery.classList.toggle('hidden', !query);
  if (rankingFetch && !force) return;
  rankingFetch?.abort();
  const controller = new AbortController();
  rankingFetch = controller;
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (ownRank) params.set('exact', '1');
  const path = '/api/battle/leaderboard' + (query ? `?${params}` : '');
  try {
    const res = await fetch(path, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error('랭킹 조회 실패');
    const data = await res.json();
    if (controller.signal.aborted || currentSocialHub !== 'ranking') return;
    if (data.rankedRewardsEnabled === false) {
      lastLeaderboardJson = '';
      ui.rankingStatus.textContent = '공식 랭킹 집계가 일시 중단되었어요.';
      ui.leaderboardList.replaceChildren();
      return;
    }
    const list = data.leaderboard || [];
    const sig = JSON.stringify([query, ownRank, myNickname, list]);
    if (!force && sig === lastLeaderboardJson) return;
    lastLeaderboardJson = sig;
    ui.rankingStatus.textContent = ownRank ? '내 전체 순위' : query ? `‘${query}’ 닉네임 검색 결과` : '전체 상위 20명';
    if (!list.length) {
      ui.leaderboardList.replaceChildren();
      ui.rankingStatus.textContent = ownRank ? '아직 내 랭킹 기록이 없어요.'
        : query ? `‘${query}’와 일치하는 닉네임이 없어요.` : '아직 기록된 온라인 전적이 없어요.';
      return;
    }
    renderRankings(ui.leaderboardList, list, myNickname, sendChallengeToPlayer);
  } catch {
    if (controller.signal.aborted || currentSocialHub !== 'ranking') return;
    lastLeaderboardJson = '';
    ui.leaderboardList.replaceChildren();
    ui.rankingStatus.textContent = '랭킹에 연결하지 못했어요. 잠시 후 다시 조회합니다.';
  } finally {
    if (rankingFetch === controller) rankingFetch = null;
  }
}
setInterval(() => refreshLeaderboard(false), 5000);

// Restore the same room after navigation. Polling already retries temporary network failures.
if (onlineClient.loadSession()) onlineClient.startPolling(handleOnlineRoomState, 65);

// 실제 광고 SDK가 준비되기 전에는 광고 없이 바로 로비로 진입합니다.
enterLoginOrLobbyAfterAd();
profileLogin.resume();
const incomingCode = new URLSearchParams(location.search).get('invite');
if (incomingCode && /^[a-z0-9]{6}$/i.test(incomingCode) && !onlineClient.roomId) {
  switchSocialHub('friend');
  ui.onlineInviteInput.value = incomingCode.toUpperCase();
}

ui.muteBtn.addEventListener('click', () => {
  engine.audio.toggleMute();
  engine.notifyHud();
});

ui.weatherToggleBtn.addEventListener('click', () => {
  if (!engine.isRemoteMatch) engine.setWeather(engine.weather === 'RAIN' ? 'CLEAR' : 'RAIN');
});

ui.tornadoTestBtn.addEventListener('click', () => {
  if (!engine.isRemoteMatch) engine.spawnTornado(engine.activeActor);
});

ui.rankBadgeBtn.addEventListener('click', () => {
  engine.toggleCosmetic();
});

// --- 키보드 단축키 바인딩 ---
window.addEventListener('keydown', (e) => {
  if (ui.gameScreen.classList.contains('hidden') || engine.phase === 'GAME_OVER' || e.isComposing) return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
  heldKeys.add(e.code);

  if (e.repeat) return;

  if (e.code === 'Space') {
    handlePrimaryAction();
  } else if (e.code === 'Digit1' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.activeActor.selectedShell = 'ACORN_SPLIT';
    engine.activeActor.useUltimate = false;
    engine.notifyHud();
  } else if (e.code === 'Digit2' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.activeActor.selectedShell = 'AQUA_DRILL';
    engine.activeActor.useUltimate = false;
    engine.notifyHud();
  } else if (e.code === 'Digit3' && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
    engine.activeActor.selectedShell = 'CHEESE_BOUNCE';
    engine.activeActor.useUltimate = false;
    engine.notifyHud();
  } else if (e.code === 'KeyQ' && !engine.isRemoteMatch && engine.phase === 'AIM' && engine.activeActor?.controller === 'human') {
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

requestAnimationFrame(gameLoop);
