// Boltaengi Battle — Phase 2/3 Commercial UI Controller
// 1) 4-Social One-Click Login (Google / Apple / Kakao / Naver — ZERO ID/PW, ZERO Guest, ZERO COPPA grade/class)
// 2) 3-Card Diet Main Lobby (1v1 Quick / 2v2 Friend Duo / National School TOP 100)
// 3) 2:2 Duo 4-Digit Party Code (?party=XXXX) & Ghost Support Bar
// 4) Non-P2W Cosmetic Shop + 3x/Day Golden Oven Gacha + Rewarded 2x/Rewind Ads

const SOCIAL_SESSION_KEY = 'boltaengi_social_session_v2';
const ECONOMY_KEY = 'boltaengi_economy_v2';
const TAKEN_NICKS_KEY = 'boltaengi_taken_nicknames_v1';

const DEFAULT_TOP_RANKERS = [
  { name: '번지마스터_K', score: 42800, bestSec: 16, wins: 14 },
  { name: '크루아상원샷', score: 36450, bestSec: 19, wins: 12 },
  { name: '딸기잼스나이퍼', score: 31200, bestSec: 21, wins: 10 },
  { name: '모찌펀치99', score: 26850, bestSec: 23, wins: 9 },
  { name: '버터식빵킬러', score: 22400, bestSec: 25, wins: 8 },
  { name: '시럽폭격기', score: 18900, bestSec: 27, wins: 7 },
  { name: '마카롱에이스', score: 14550, bestSec: 30, wins: 5 },
  { name: '푸딩트릭샷', score: 10200, bestSec: 34, wins: 4 },
  { name: '와플저격수', score: 6400, bestSec: 39, wins: 2 },
  { name: '초코도넛루키', score: 3100, bestSec: 45, wins: 1 },
];

const COSMETIC_ITEMS = {
  hats: [
    { id: 'hat_chef', name: '👨‍🍳 마스터 파티시에 모자', price: 300, rarity: 'RARE', desc: '스탯 보너스 0% · 순수 꾸미기' },
    { id: 'hat_crown', name: '👑 버터 크루아상 왕관', price: 650, rarity: 'EPIC', desc: '스탯 보너스 0% · 황금 광택' },
    { id: 'hat_strawberry', name: '🍓 생딸기 베레모', price: 400, rarity: 'RARE', desc: '스탯 보너스 0% · 달콤 솜털' },
    { id: 'hat_macaron', name: '🎀 파스텔 마카롱 리본', price: 500, rarity: 'EPIC', desc: '스탯 보너스 0% · 젤리 흔들림' },
  ],
  trails: [
    { id: 'trail_strawberry', name: '🍓 딸기 잼 시럽 궤적', price: 350, rarity: 'RARE', desc: '탄환 비행 시 딸기 시럽 반짝임' },
    { id: 'trail_choco', name: '🍫 벨기에 초코 퐁듀 궤적', price: 450, rarity: 'EPIC', desc: '초콜릿 리본 + 골드 스파클' },
    { id: 'trail_rainbow', name: '🌈 무지개 슈가파우더', price: 700, rarity: 'LEGEND', desc: '파스텔 레인보우 반짝이 트레일' },
  ],
  bungee: [
    { id: 'vfx_confetti', name: '🎉 베이커리 꽃가루 폭죽', price: 400, rarity: 'RARE', desc: '번지 아웃 시 마카롱 폭죽 연출' },
    { id: 'vfx_milk', name: '🥛 생크림 대폭발 스플래시', price: 550, rarity: 'EPIC', desc: '번지 아웃 시 거대 크림 파도' },
    { id: 'vfx_star', name: '⭐ 슈가 스타 피날레', price: 800, rarity: 'LEGEND', desc: '번지 아웃 시 황금 별빛 피날레' },
  ],
};

function loadEconomy() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const raw = JSON.parse(localStorage.getItem(ECONOMY_KEY) || '{}');
    const gachaDate = raw.gachaDate === today ? today : today;
    const gachaUsed = raw.gachaDate === today ? Number(raw.gachaUsed || 0) : 0;
    return {
      coins: Number.isFinite(raw.coins) ? raw.coins : 500,
      owned: Array.isArray(raw.owned) ? raw.owned : ['hat_chef'],
      equipped: raw.equipped || { hats: 'hat_chef', trails: null, bungee: null },
      gachaDate,
      gachaUsed,
      seasonPassLevel: Number(raw.seasonPassLevel || 1),
      cumulativeScore: Number(raw.cumulativeScore || 0),
      bestClearSec: Number(raw.bestClearSec || 0),
      totalWins: Number(raw.totalWins || 0),
    };
  } catch {
    return {
      coins: 500,
      owned: ['hat_chef'],
      equipped: { hats: 'hat_chef', trails: null, bungee: null },
      gachaDate: today,
      gachaUsed: 0,
      seasonPassLevel: 1,
      cumulativeScore: 0,
      bestClearSec: 0,
      totalWins: 0,
    };
  }
}

function saveEconomy(econ) {
  try {
    localStorage.setItem(ECONOMY_KEY, JSON.stringify(econ));
  } catch {}
}

export function loadSocialSession() {
  try {
    const raw = localStorage.getItem(SOCIAL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSocialSession(session) {
  try {
    localStorage.setItem(SOCIAL_SESSION_KEY, JSON.stringify(session));
  } catch {}
}

function normalizeNick(nick) {
  return String(nick || '').trim().toLowerCase().replace(/\s+/g, '');
}

function getTakenNickMap() {
  const map = {};
  for (const r of DEFAULT_TOP_RANKERS) {
    map[normalizeNick(r.name)] = 'system_ranker';
  }
  try {
    const saved = JSON.parse(localStorage.getItem(TAKEN_NICKS_KEY) || '{}');
    if (saved && typeof saved === 'object') {
      Object.assign(map, saved);
    }
  } catch {}
  return map;
}

function isNicknameTaken(nick, myUserId = '') {
  const key = normalizeNick(nick);
  if (!key) return false;
  const map = getTakenNickMap();
  const owner = map[key];
  return Boolean(owner && owner !== myUserId);
}

function reserveNickname(nick, myUserId, oldNick = '') {
  const key = normalizeNick(nick);
  if (!key || !myUserId) return;
  try {
    const saved = JSON.parse(localStorage.getItem(TAKEN_NICKS_KEY) || '{}');
    const oldKey = normalizeNick(oldNick);
    if (oldKey && oldKey !== key && saved[oldKey] === myUserId) {
      delete saved[oldKey];
    }
    saved[key] = myUserId;
    localStorage.setItem(TAKEN_NICKS_KEY, JSON.stringify(saved));
  } catch {}
}

export function initBakeryCommercialUi({ engine, ui, launchMatchSpec, saveUserProfile, loadUserProfile, onlineClient = null, handleOnlineRoomState = null }) {
  let econ = loadEconomy();
  let currentShopTab = 'hats';
  let activePartyCode = '';
  let serverOnline = false;

  const el = {
    loginOverlay: document.getElementById('socialLoginOverlay'),
    loginBtns: Array.from(document.querySelectorAll('.social-oauth-btn')),
    loginSchoolInput: document.getElementById('socialLoginSchoolInput'),
    coinBalancePill: document.getElementById('coinBalancePill'),
    openShopBtn: document.getElementById('openShopBtn'),
    quick1v1Card: document.getElementById('heroCard1v1'),
    duo2v2Card: document.getElementById('heroCard2v2'),
    schoolWarCard: document.getElementById('heroCardSchool'),
    duoPartyModal: document.getElementById('duoPartyModal'),
    duoServerBadge: document.getElementById('duoServerBadge'),
    duoCodeDisplay: document.getElementById('duoCodeDisplay'),
    duoJoinInput: document.getElementById('duoJoinInput'),
    duoJoinCodeBtn: document.getElementById('duoJoinCodeBtn'),
    duoCopyLinkBtn: document.getElementById('duoCopyLinkBtn'),
    duoCopyToast: document.getElementById('duoCopyToast'),
    duoStartBattleBtn: document.getElementById('duoStartBattleBtn'),
    duoCloseBtn: document.getElementById('duoCloseBtn'),
    duoAllySlotName: document.getElementById('duoAllySlotName'),
    schoolTopModal: document.getElementById('schoolTopModal'),
    schoolTopList: document.getElementById('schoolTopList'),
    myRankerSummaryBox: document.getElementById('myRankerSummaryBox'),
    schoolMyInput: document.getElementById('schoolMyAffiliationInput'),
    schoolSaveBtn: document.getElementById('schoolSaveAffiliationBtn'),
    schoolStartBtn: document.getElementById('schoolStartBattleBtn'),
    schoolCloseBtn: document.getElementById('schoolCloseBtn'),
    scoreBreakdownText: document.getElementById('scoreBreakdownText'),
    shopModal: document.getElementById('shopModal'),
    shopCloseBtn: document.getElementById('shopCloseBtn'),
    shopTabs: Array.from(document.querySelectorAll('.shop-tab-btn')),
    shopItemsGrid: document.getElementById('shopItemsGrid'),
    shopCoinText: document.getElementById('shopCoinText'),
    goldenOvenBtn: document.getElementById('goldenOvenGachaBtn'),
    goldenOvenStatus: document.getElementById('goldenOvenStatus'),
    ghostSupportBar: document.getElementById('ghostSupportBar'),
    ghostWindBtn: document.getElementById('ghostWindShieldBtn'),
    ghostSugarBtn: document.getElementById('ghostSugarBoostBtn'),
    doubleRewardAdBtn: document.getElementById('doubleRewardAdBtn'),
    rewindAdBtn: document.getElementById('rewindTurnAdBtn'),
    rewardAdToast: document.getElementById('rewardAdToast'),
    mapQuickPills: Array.from(document.querySelectorAll('.map-quick-pill')),
  };

  function updateEconomyHud() {
    if (el.coinBalancePill) el.coinBalancePill.textContent = `🪙 ${econ.coins.toLocaleString()}`;
    if (el.shopCoinText) el.shopCoinText.textContent = `보유 코인: 🪙 ${econ.coins.toLocaleString()}`;
    const remain = Math.max(0, 3 - econ.gachaUsed);
    if (el.goldenOvenBtn) {
      el.goldenOvenBtn.textContent = remain > 0
        ? `🎰 황금 오븐 무료 뽑기 (오늘 ${remain}/3회 남음)`
        : '🎰 오늘의 황금 오븐 완료 (내일 다시!)';
      el.goldenOvenBtn.disabled = remain <= 0;
    }
  }

  function applySessionToProfile(session) {
    if (!session) return;
    const providerLabels = { google: 'Google', apple: 'Apple', kakao: 'Kakao', naver: 'Naver' };
    const badge = providerLabels[session.provider] || 'Social';
    if (ui.profileSummaryText) {
      ui.profileSummaryText.textContent = `[${badge}] ${session.nickname} · 🏆 ${econ.cumulativeScore.toLocaleString()}점`;
    }
    try {
      saveUserProfile?.({
        userId: session.userId,
        nickname: session.nickname,
        schoolName: '',
        className: '',
      });
    } catch {}
  }

  // 1) 4-Social One-Click Login Flow (Google / Apple / Kakao / Naver)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === '1') {
    try { localStorage.removeItem(SOCIAL_SESSION_KEY); } catch {}
    urlParams.delete('logout');
    const cleanUrl = `${window.location.pathname}${urlParams.toString() ? '?' + urlParams.toString() : ''}`;
    try { window.history.replaceState({}, '', cleanUrl); } catch {}
  }
  const existingSession = loadSocialSession();
  if (existingSession) {
    el.loginOverlay?.classList.add('hidden');
    applySessionToProfile(existingSession);
  } else {
    el.loginOverlay?.classList.remove('hidden');
  }

  document.getElementById('socialLogoutBtn')?.addEventListener('click', () => {
    try { localStorage.removeItem(SOCIAL_SESSION_KEY); } catch {}
    engine.audio.stopBgm();
    el.loginOverlay?.classList.remove('hidden');
  });

  const loginErrorEl = document.getElementById('socialLoginError');
  el.loginSchoolInput?.addEventListener('input', () => {
    const val = (el.loginSchoolInput.value || '').trim();
    if (!loginErrorEl) return;
    if (val.length < 2) {
      loginErrorEl.classList.add('hidden');
      return;
    }
    if (isNicknameTaken(val)) {
      loginErrorEl.style.color = '#FB7185';
      loginErrorEl.textContent = '⚠️ 이미 사용 중인 랭커 닉네임입니다! 다른 닉네임을 입력해 주세요.';
      loginErrorEl.classList.remove('hidden');
    } else {
      loginErrorEl.style.color = '#4ADE80';
      loginErrorEl.textContent = '✅ 사용 가능한 랭커 닉네임입니다! 아래 로그인 방법을 눌러주세요.';
      loginErrorEl.classList.remove('hidden');
    }
  });

  el.loginBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider || 'google';
      const customNick = (el.loginSchoolInput?.value || '').trim().slice(0, 16);
      if (customNick.length < 2) {
        if (loginErrorEl) {
          loginErrorEl.style.color = '#FB7185';
          loginErrorEl.textContent = '⚠️ 닉네임을 2자 이상 먼저 입력한 뒤 로그인 방법을 눌러주세요!';
          loginErrorEl.classList.remove('hidden');
        }
        el.loginSchoolInput?.focus();
        return;
      }
      if (isNicknameTaken(customNick)) {
        if (loginErrorEl) {
          loginErrorEl.style.color = '#FB7185';
          loginErrorEl.textContent = '⚠️ 이미 사용 중인 랭커 닉네임입니다! 중복되지 않는 닉네임을 입력해 주세요.';
          loginErrorEl.classList.remove('hidden');
        }
        el.loginSchoolInput?.focus();
        return;
      }
      loginErrorEl?.classList.add('hidden');
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const userId = `${provider}_${randNum}`;
      reserveNickname(customNick, userId);
      const session = {
        provider,
        userId,
        nickname: customNick,
        loggedInAt: Date.now(),
      };
      saveSocialSession(session);
      applySessionToProfile(session);
      el.loginOverlay?.classList.add('hidden');
      engine.audio.ensureContext();
      engine.audio.startLobbyBgm();
      engine.audio.playSkillCharge();
    });
  });

  // 2) Map Quick Picker Pills (8 Bakery Maps + Random)
  el.mapQuickPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const mapId = pill.dataset.map || 'random';
      if (ui.mapSelect) ui.mapSelect.value = mapId;
      el.mapQuickPills.forEach((p) => p.classList.toggle('active', p === pill));
      engine.audio.ensureContext();
      if (mapId !== 'random') {
        engine.audio.startBattleBgm(mapId);
      } else {
        engine.audio.startLobbyBgm();
      }
    });
  });

  // 3) 3-Card Diet Main Lobby Handlers
  // Card 1: 1:1 Quick Battle
  el.quick1v1Card?.addEventListener('click', () => {
    engine.audio.ensureContext();
    if (ui.modeSelect) ui.modeSelect.value = '1v1_ai';
    launchMatchSpec({
      gameMode: '1v1_ai',
      matchLabel: '🔥 1:1 빠른 대전',
      customRoster: null,
    });
  });

  // Card 2: Real-Time Server Friend Invite & 2:2 Duo
  async function checkBattleServerHealth() {
    try {
      const res = await fetch('/api/battle/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        serverOnline = Boolean(data?.ok);
        return serverOnline;
      }
    } catch {}
    serverOnline = false;
    return false;
  }

  async function joinServerInviteCode(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!code || code.length < 4) {
      if (el.duoCopyToast) {
        el.duoCopyToast.style.color = '#FB7185';
        el.duoCopyToast.textContent = '⚠️ 친구 초대 코드를 정확히 입력해 주세요!';
        el.duoCopyToast.classList.remove('hidden');
      }
      return;
    }
    const online = await checkBattleServerHealth();
    if (online && onlineClient && handleOnlineRoomState) {
      const sess = loadSocialSession();
      const myNick = sess?.nickname || '게스트볼탱';
      const playerChar = ui.charSelect?.value || 'M01_MOCHI';
      try {
        await onlineClient.joinRoom({ inviteCode: code, charKey: playerChar, name: myNick });
        el.duoPartyModal?.classList.add('hidden');
        if (el.duoCopyToast) {
          el.duoCopyToast.style.color = '#4ADE80';
          el.duoCopyToast.textContent = `✅ 서버 방 [${code}] 입장 성공! 호스트 승인을 기다립니다...`;
          el.duoCopyToast.classList.remove('hidden');
        }
        const st = await onlineClient.fetchState();
        handleOnlineRoomState(st);
        onlineClient.startPolling(handleOnlineRoomState, 65);
        return;
      } catch (err) {
        if (el.duoCopyToast) {
          el.duoCopyToast.style.color = '#FB7185';
          el.duoCopyToast.textContent = `❌ 방 입장 실패: ${err.message}`;
          el.duoCopyToast.classList.remove('hidden');
        }
        return;
      }
    }
    // Static host fallback
    activePartyCode = code;
    if (el.duoCodeDisplay) el.duoCodeDisplay.textContent = code;
    if (el.duoAllySlotName) el.duoAllySlotName.textContent = `초대 친구 (#${code}) 합류 완료!`;
  }

  async function openDuoPartyModal(prefillCode = '') {
    el.duoCopyToast?.classList.add('hidden');
    el.duoPartyModal?.classList.remove('hidden');
    if (el.duoServerBadge) el.duoServerBadge.textContent = '📡 실시간 서버 연결 확인 중...';

    const online = await checkBattleServerHealth();
    if (online && onlineClient && handleOnlineRoomState) {
      if (el.duoServerBadge) {
        el.duoServerBadge.style.color = '#4ADE80';
        el.duoServerBadge.textContent = '🟢 실시간 권위형 서버 연결됨 (/api/battle)';
      }
      if (prefillCode) {
        if (el.duoJoinInput) el.duoJoinInput.value = prefillCode;
        await joinServerInviteCode(prefillCode);
        return;
      }
      const sess = loadSocialSession();
      const myNick = sess?.nickname || '호스트볼탱';
      const playerChar = ui.charSelect?.value || 'M01_MOCHI';
      try {
        const res = await onlineClient.createRoom({
          mapPreset: ui.mapSelect?.value || 'random',
          charKey: playerChar,
          name: myNick,
          roomTitle: `${myNick}의 친구 초대방`,
          maxPlayers: 2,
        });
        activePartyCode = res.inviteCode;
        if (el.duoCodeDisplay) el.duoCodeDisplay.textContent = activePartyCode;
        if (el.duoAllySlotName) el.duoAllySlotName.textContent = '🔵 친구 입장 대기 중... (코드/링크 공유)';
        onlineClient.startPolling((st) => {
          if (st?.players?.length >= 2 && el.duoAllySlotName) {
            el.duoAllySlotName.textContent = `✅ ${st.players[1].name} 입장 완료!`;
            el.duoPartyModal?.classList.add('hidden');
          }
          handleOnlineRoomState(st);
        }, 120);
        return;
      } catch (err) {
        if (el.duoServerBadge) {
          el.duoServerBadge.style.color = '#FBBF24';
          el.duoServerBadge.textContent = `🟡 서버 방 생성 실패(${err.message}) — 로컬 AI 듀오 모드`;
        }
      }
    } else if (el.duoServerBadge) {
      el.duoServerBadge.style.color = '#FBBF24';
      el.duoServerBadge.textContent = '🟡 정적 호스팅 모드 (AI 듀오 즉시 출격 지원)';
    }

    activePartyCode = prefillCode || String(Math.floor(1000 + Math.random() * 9000));
    if (el.duoCodeDisplay) el.duoCodeDisplay.textContent = activePartyCode;
    if (el.duoJoinInput && prefillCode) el.duoJoinInput.value = prefillCode;
    if (el.duoAllySlotName) {
      el.duoAllySlotName.textContent = prefillCode
        ? `초대 친구 (#${prefillCode}) 합류 완료!`
        : '단짝 친구 대기 중 (바로 출격 시 AI 파트너 합류)';
    }
  }

  el.duo2v2Card?.addEventListener('click', () => {
    engine.audio.ensureContext();
    openDuoPartyModal('');
  });

  el.duoJoinCodeBtn?.addEventListener('click', () => {
    joinServerInviteCode(el.duoJoinInput?.value || '');
  });

  el.duoCopyLinkBtn?.addEventListener('click', async () => {
    const code = (el.duoJoinInput?.value || '').trim().toUpperCase().slice(0, 8) || activePartyCode;
    const url = new URL(window.location.href);
    url.searchParams.set('party', code);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {}
    if (el.duoCopyToast) {
      el.duoCopyToast.style.color = '#4ADE80';
      el.duoCopyToast.textContent = `🔗 초대 링크 복사 완료! (?party=${code}) 친구에게 공유하세요!`;
      el.duoCopyToast.classList.remove('hidden');
    }
  });

  el.duoStartBattleBtn?.addEventListener('click', () => {
    const code = (el.duoJoinInput?.value || '').trim().toUpperCase().slice(0, 8) || activePartyCode;
    el.duoPartyModal?.classList.add('hidden');
    if (onlineClient?.roomId) onlineClient.clearSession();
    const sess = loadSocialSession();
    const myNick = sess?.nickname || '나';
    const playerChar = ui.charSelect?.value || 'M01_MOCHI';
    launchMatchSpec({
      gameMode: '2v2_team',
      matchLabel: `🤝 2:2 듀오 팀전 (#${code})`,
      customRoster: [
        { teamId: 1, charKey: playerChar, x: 225, facing: 1, controller: 'human', name: `[블루1] ${myNick}` },
        { teamId: 2, charKey: 'F11_BERRY', x: 1185, facing: -1, controller: 'ai', name: '[레드1] 크림에이스' },
        { teamId: 1, charKey: 'M03_CHOCO', x: 405, facing: 1, controller: 'ai', name: `[블루2] 듀오파트너` },
        { teamId: 2, charKey: 'F14_MACARON', x: 1375, facing: -1, controller: 'ai', name: '[레드2] 마카롱킹' },
      ],
    });
  });

  el.duoCloseBtn?.addEventListener('click', () => {
    el.duoPartyModal?.classList.add('hidden');
    if (onlineClient?.roomId) onlineClient.clearSession();
  });

  // Auto-open Friend Invite modal if ?party=XXXX is in URL!
  const urlParty = new URLSearchParams(window.location.search).get('party');
  if (urlParty && /^[A-Za-z0-9]{4,8}$/.test(urlParty)) {
    openDuoPartyModal(urlParty.toUpperCase());
  }

  // Card 3: Speed-Kill Cumulative Score Ranker Leaderboard
  function renderScoreRankers() {
    if (!el.schoolTopList) return;
    const sess = loadSocialSession();
    const myNick = sess?.nickname || '말랑랭커';
    if (el.schoolMyInput && !el.schoolMyInput.value) el.schoolMyInput.value = myNick;

    const list = DEFAULT_TOP_RANKERS.map((r) => ({ ...r, isMine: false }));
    list.push({
      name: myNick,
      score: econ.cumulativeScore,
      bestSec: econ.bestClearSec || 0,
      wins: econ.totalWins || 0,
      isMine: true,
    });
    list.sort((a, b) => b.score - a.score);

    const myRankIdx = list.findIndex((r) => r.isMine);
    const myRankNum = myRankIdx >= 0 ? myRankIdx + 1 : list.length;
    if (el.myRankerSummaryBox) {
      const bestTxt = econ.bestClearSec > 0 ? `⚡ 최단 ${econ.bestClearSec}초 컷` : '첫 빠른 처치 도전!';
      el.myRankerSummaryBox.innerHTML = `
        <span class="sr-rank">${myRankNum}위</span>
        <span class="sr-name"><b>${myNick}</b> · ${bestTxt} (${econ.totalWins}승)</span>
        <span class="sr-score">${econ.cumulativeScore.toLocaleString()}점</span>
      `;
    }

    el.schoolTopList.innerHTML = list.map((r, idx) => {
      const rank = idx + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}위`;
      const secTag = r.bestSec > 0 ? `<small style="opacity:0.75;margin-left:4px;">⚡${r.bestSec}초</small>` : '';
      return `<div class="school-rank-row${r.isMine ? ' mine' : ''}">
        <span class="sr-rank">${medal}</span>
        <span class="sr-name">${r.name} ${r.isMine ? '<em class="sr-me-tag">나</em>' : ''}${secTag}</span>
        <span class="sr-score">${r.score.toLocaleString()}점</span>
      </div>`;
    }).join('');
  }

  el.schoolWarCard?.addEventListener('click', () => {
    engine.audio.ensureContext();
    renderScoreRankers();
    el.schoolTopModal?.classList.remove('hidden');
  });

  el.schoolSaveBtn?.addEventListener('click', () => {
    const newNick = (el.schoolMyInput?.value || '').trim().slice(0, 16);
    if (newNick.length < 2) {
      if (el.myRankerSummaryBox) el.myRankerSummaryBox.querySelector('.sr-name').textContent = '⚠️ 닉네임은 2자 이상 입력해 주세요.';
      return;
    }
    const sess = loadSocialSession() || { provider: 'google', userId: 'player', nickname: newNick };
    if (isNicknameTaken(newNick, sess.userId)) {
      if (el.myRankerSummaryBox) {
        const nameEl = el.myRankerSummaryBox.querySelector('.sr-name');
        if (nameEl) nameEl.innerHTML = `<span style="color:#FB7185;">⚠️ "${newNick}"은(는) 이미 사용 중인 랭커 닉네임입니다!</span>`;
      }
      return;
    }
    const oldNick = sess.nickname || '';
    reserveNickname(newNick, sess.userId, oldNick);
    sess.nickname = newNick;
    saveSocialSession(sess);
    applySessionToProfile(sess);
    renderScoreRankers();
  });

  el.schoolStartBtn?.addEventListener('click', () => {
    el.schoolTopModal?.classList.add('hidden');
    const sess = loadSocialSession();
    const myNick = sess?.nickname || '랭커도전자';
    const topRival = DEFAULT_TOP_RANKERS[Math.floor(Math.random() * 5)];
    const playerChar = ui.charSelect?.value || 'M01_MOCHI';
    launchMatchSpec({
      gameMode: '1v1_ai',
      matchLabel: `🏆 랭커전 (${myNick} vs ${topRival.name})`,
      customRoster: [
        { teamId: 1, charKey: playerChar, x: 275, facing: 1, controller: 'human', name: myNick },
        { teamId: 2, charKey: 'F11_BERRY', x: 1325, facing: -1, controller: 'ai', name: `👑 ${topRival.name}` },
      ],
    });
  });

  el.schoolCloseBtn?.addEventListener('click', () => el.schoolTopModal?.classList.add('hidden'));

  // 4) Non-P2W Cosmetic Shop & 3x/Day Golden Oven Gacha
  function renderShop() {
    updateEconomyHud();
    if (!el.shopItemsGrid) return;
    const items = COSMETIC_ITEMS[currentShopTab] || [];
    el.shopItemsGrid.innerHTML = items.map((item) => {
      const owned = econ.owned.includes(item.id);
      const equipped = econ.equipped[currentShopTab] === item.id;
      const btnLabel = equipped ? '✅ 장착 중' : owned ? '장착하기' : `🪙 ${item.price}`;
      return `<div class="shop-item-card${equipped ? ' equipped' : ''}">
        <div class="shop-item-head">
          <span class="shop-rarity ${item.rarity.toLowerCase()}">${item.rarity}</span>
          <strong>${item.name}</strong>
        </div>
        <p class="shop-item-desc">${item.desc}</p>
        <button type="button" class="shop-buy-btn${equipped ? ' active' : ''}" data-item-id="${item.id}" data-price="${item.price}">
          ${btnLabel}
        </button>
      </div>`;
    }).join('');

    el.shopItemsGrid.querySelectorAll('.shop-buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.itemId;
        const price = Number(btn.dataset.price || 0);
        if (econ.owned.includes(id)) {
          econ.equipped[currentShopTab] = id;
          saveEconomy(econ);
          engine.audio.playSkillCharge();
          renderShop();
        } else if (econ.coins >= price) {
          econ.coins -= price;
          econ.owned.push(id);
          econ.equipped[currentShopTab] = id;
          saveEconomy(econ);
          engine.audio.playApplause();
          renderShop();
        } else if (el.goldenOvenStatus) {
          el.goldenOvenStatus.textContent = '🪙 코인이 부족해요! 대전 승리 또는 황금 오븐 무료 뽑기를 이용해보세요!';
        }
      });
    });
  }

  el.openShopBtn?.addEventListener('click', () => {
    engine.audio.ensureContext();
    renderShop();
    el.shopModal?.classList.remove('hidden');
  });
  el.shopCloseBtn?.addEventListener('click', () => el.shopModal?.classList.add('hidden'));

  el.shopTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      currentShopTab = tab.dataset.shopTab || 'hats';
      el.shopTabs.forEach((t) => t.classList.toggle('active', t === tab));
      renderShop();
    });
  });

  el.goldenOvenBtn?.addEventListener('click', () => {
    if (econ.gachaUsed >= 3) return;
    econ.gachaUsed++;
    const allItems = [...COSMETIC_ITEMS.hats, ...COSMETIC_ITEMS.trails, ...COSMETIC_ITEMS.bungee];
    const unowned = allItems.filter((it) => !econ.owned.includes(it.id));
    if (unowned.length > 0 && Math.random() < 0.65) {
      const won = unowned[Math.floor(Math.random() * unowned.length)];
      econ.owned.push(won.id);
      if (el.goldenOvenStatus) el.goldenOvenStatus.textContent = `🎉 황금 오븐 대박! [${won.name}] 획득! (스탯 0% 순수 꾸미기)`;
    } else {
      const bonus = 150 + Math.floor(Math.random() * 150);
      econ.coins += bonus;
      if (el.goldenOvenStatus) el.goldenOvenStatus.textContent = `✨ 황금 크루아상 보상! +${bonus}🪙 코인 획득!`;
    }
    saveEconomy(econ);
    engine.audio.playApplause();
    renderShop();
  });

  // 5) 2v2 Ghost Support Bar + Post-Match 2x Rewarded Ad & Single-Player Rewind Ad
  el.ghostWindBtn?.addEventListener('click', () => engine.useGhostSupport('wind_shield'));
  el.ghostSugarBtn?.addEventListener('click', () => engine.useGhostSupport('sugar_boost'));

  let doubledThisMatch = false;
  let scoreRecordedThisMatch = false;
  let lastEarnedScore = 0;

  el.doubleRewardAdBtn?.addEventListener('click', () => {
    if (doubledThisMatch) return;
    doubledThisMatch = true;
    const bonusScore = Math.max(200, lastEarnedScore);
    econ.coins += 200;
    econ.cumulativeScore += bonusScore;
    saveEconomy(econ);
    updateEconomyHud();
    applySessionToProfile(loadSocialSession());
    engine.audio.playApplause();
    if (el.rewardAdToast) {
      el.rewardAdToast.textContent = `🎬 2배 보상 완료! 코인 +200🪙 & 스코어 +${bonusScore.toLocaleString()}점 추가 누적 (총 ${econ.cumulativeScore.toLocaleString()}점)!`;
      el.rewardAdToast.classList.remove('hidden');
    }
    el.doubleRewardAdBtn.disabled = true;
    el.doubleRewardAdBtn.textContent = '✅ 2배 보상 수령 완료!';
  });

  el.rewindAdBtn?.addEventListener('click', () => {
    if (engine.gameMode !== '1v1_ai') return;
    const me = engine.carts[0];
    if (me) {
      me.alive = true;
      me.droppedOut = false;
      me.hp = Math.max(45, Math.round(me.maxHp * 0.45));
      me.y = Math.min(me.y, 460);
      engine.phase = 'AIM';
      engine.activeActor = me;
      engine.turnTimerFrames = 18 * 60;
      engine.turnTimeLeft = 18;
      ui.gameOverModal?.classList.add('hidden');
      engine.spawnFloatingText(me.x, me.y - 70, '⏪ 1턴 되감기 부활! 역전 찬스!', '#38BDF8', 22);
      engine.audio.playSkillCharge();
      engine.notifyHud();
    }
  });

  // Sync Ghost Support Bar, Speed-Kill Cumulative Score & Rewarded Ad buttons
  const origOnHudUpdate = engine.onHudUpdate;
  engine.onHudUpdate = (state) => {
    origOnHudUpdate?.(state);
    if (el.ghostSupportBar) {
      const hasGhost = state.gameMode === '2v2_team' &&
        state.phase !== 'GAME_OVER' &&
        state.carts?.some((c) => c.teamId === 1 && !c.alive && c.ghostSupportReady) &&
        state.carts?.some((c) => c.teamId === 1 && c.alive);
      el.ghostSupportBar.classList.toggle('hidden', !hasGhost);
    }
    if (state.phase === 'GAME_OVER') {
      if (!scoreRecordedThisMatch && state.lastMatchScoreInfo) {
        scoreRecordedThisMatch = true;
        const info = state.lastMatchScoreInfo;
        lastEarnedScore = info.totalScore;
        econ.cumulativeScore += info.totalScore;
        econ.coins += info.won ? 150 : 40;
        if (info.won) {
          econ.totalWins = (econ.totalWins || 0) + 1;
          if (!econ.bestClearSec || info.elapsedSec < econ.bestClearSec) {
            econ.bestClearSec = info.elapsedSec;
          }
        }
        saveEconomy(econ);
        updateEconomyHud();
        applySessionToProfile(loadSocialSession());
        if (el.scoreBreakdownText) {
          if (info.won) {
            const bungeeTxt = info.bungeeBonus > 0 ? ` + 번지 +${info.bungeeBonus}` : '';
            el.scoreBreakdownText.textContent = `🏆 +${info.totalScore.toLocaleString()}점 누적! (기본 ${info.baseScore} + ⚡빠른 처치 보너스 +${info.speedBonus.toLocaleString()}${bungeeTxt} · ${info.elapsedSec}초/${info.turns}턴 컷 | 총 ${econ.cumulativeScore.toLocaleString()}점)`;
          } else {
            el.scoreBreakdownText.textContent = `참여 점수 +${info.totalScore}점 누적 (총 ${econ.cumulativeScore.toLocaleString()}점)`;
          }
        }
      }
      if (el.doubleRewardAdBtn && !doubledThisMatch) {
        el.doubleRewardAdBtn.disabled = false;
        el.doubleRewardAdBtn.textContent = '🎬 광고 보고 코인·스코어 2배!';
      }
      if (el.rewindAdBtn) {
        const lostSingle = state.gameMode === '1v1_ai' && state.carts?.[0] && !state.carts[0].alive;
        el.rewindAdBtn.classList.toggle('hidden', !lostSingle);
      }
    } else {
      doubledThisMatch = false;
      scoreRecordedThisMatch = false;
      lastEarnedScore = 0;
      el.rewardAdToast?.classList.add('hidden');
      if (el.scoreBreakdownText) el.scoreBreakdownText.textContent = '';
    }
  };

  updateEconomyHud();
}
