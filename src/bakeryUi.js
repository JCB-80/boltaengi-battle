// Boltaengi Battle — Phase 2/3 Commercial UI Controller
// 1) 4-Social One-Click Login (Google / Apple / Kakao / Naver — ZERO ID/PW, ZERO Guest, ZERO COPPA grade/class)
// 2) 3-Card Diet Main Lobby (1v1 Quick / 2v2 Friend Duo / National School TOP 100)
// 3) 2:2 Duo 4-Digit Party Code (?party=XXXX) & Ghost Support Bar
// 4) Non-P2W Cosmetic Shop + 3x/Day Golden Oven Gacha + Rewarded 2x/Rewind Ads

const SOCIAL_SESSION_KEY = 'boltaengi_social_session_v2';
const ECONOMY_KEY = 'boltaengi_economy_v2';

const DEFAULT_SCHOOLS_TOP = [
  { rank: 1, name: '서울하늘초등학교', score: 148200, wins: 1240, region: '서울' },
  { rank: 2, name: '부산마린중학교', score: 139650, wins: 1185, region: '부산' },
  { rank: 3, name: '경기판교초등학교', score: 131400, wins: 1092, region: '경기' },
  { rank: 4, name: '인천송도중학교', score: 124900, wins: 1014, region: '인천' },
  { rank: 5, name: '대전둔산고등학교', score: 119300, wins: 968, region: '대전' },
  { rank: 6, name: '대구수성초등학교', score: 112800, wins: 905, region: '대구' },
  { rank: 7, name: '광주첨단중학교', score: 108450, wins: 874, region: '광주' },
  { rank: 8, name: '제주한라초등학교', score: 103100, wins: 822, region: '제주' },
  { rank: 9, name: '울산삼산고등학교', score: 98750, wins: 780, region: '울산' },
  { rank: 10, name: '세종아름초등학교', score: 94200, wins: 745, region: '세종' },
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
      schoolPoints: Number(raw.schoolPoints || 120),
    };
  } catch {
    return {
      coins: 500,
      owned: ['hat_chef'],
      equipped: { hats: 'hat_chef', trails: null, bungee: null },
      gachaDate: today,
      gachaUsed: 0,
      seasonPassLevel: 1,
      schoolPoints: 120,
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

export function initBakeryCommercialUi({ engine, ui, launchMatchSpec, saveUserProfile, loadUserProfile }) {
  let econ = loadEconomy();
  let currentShopTab = 'hats';
  let activePartyCode = '';

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
    duoCodeDisplay: document.getElementById('duoCodeDisplay'),
    duoJoinInput: document.getElementById('duoJoinInput'),
    duoCopyLinkBtn: document.getElementById('duoCopyLinkBtn'),
    duoCopyToast: document.getElementById('duoCopyToast'),
    duoStartBattleBtn: document.getElementById('duoStartBattleBtn'),
    duoCloseBtn: document.getElementById('duoCloseBtn'),
    duoAllySlotName: document.getElementById('duoAllySlotName'),
    schoolTopModal: document.getElementById('schoolTopModal'),
    schoolTopList: document.getElementById('schoolTopList'),
    schoolMyInput: document.getElementById('schoolMyAffiliationInput'),
    schoolSaveBtn: document.getElementById('schoolSaveAffiliationBtn'),
    schoolStartBtn: document.getElementById('schoolStartBattleBtn'),
    schoolCloseBtn: document.getElementById('schoolCloseBtn'),
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
      const sch = session.schoolName ? `🏫 ${session.schoolName}` : '🏫 학교 미설정';
      ui.profileSummaryText.textContent = `[${badge}] ${session.nickname} · ${sch}`;
    }
    try {
      saveUserProfile?.({
        userId: session.userId,
        nickname: session.nickname,
        schoolName: session.schoolName || '베이커리 아카데미',
        className: '', // COPPA 안전: 학년·반 절대 미수집!
      });
    } catch {}
  }

  // 1) 4-Social One-Click Login Flow (Google / Apple / Kakao / Naver)
  const existingSession = loadSocialSession();
  if (existingSession) {
    el.loginOverlay?.classList.add('hidden');
    applySessionToProfile(existingSession);
  } else {
    el.loginOverlay?.classList.remove('hidden');
  }

  el.loginBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider || 'google';
      const schoolInput = (el.loginSchoolInput?.value || '').trim().slice(0, 24);
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const nickPrefixes = { google: '구글모찌', apple: '애플슈가', kakao: '카카오볼탱', naver: '네이버크림' };
      const session = {
        provider,
        userId: `${provider}_${randNum}`,
        nickname: `${nickPrefixes[provider] || '말랑볼탱'}${randNum}`,
        schoolName: schoolInput || '서울하늘초등학교',
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

  // Card 2: 2:2 Friend Duo (4-digit party code + ?party=XXXX)
  function openDuoPartyModal(prefillCode = '') {
    activePartyCode = prefillCode || String(Math.floor(1000 + Math.random() * 9000));
    if (el.duoCodeDisplay) el.duoCodeDisplay.textContent = activePartyCode;
    if (el.duoJoinInput && prefillCode) el.duoJoinInput.value = prefillCode;
    if (el.duoAllySlotName) {
      el.duoAllySlotName.textContent = prefillCode
        ? `초대 친구 (#${prefillCode}) 합류 완료!`
        : '단짝 친구 대기 중 (바로 출격 시 AI 파트너 합류)';
    }
    el.duoCopyToast?.classList.add('hidden');
    el.duoPartyModal?.classList.remove('hidden');
  }

  el.duo2v2Card?.addEventListener('click', () => {
    engine.audio.ensureContext();
    openDuoPartyModal('');
  });

  el.duoCopyLinkBtn?.addEventListener('click', async () => {
    const code = (el.duoJoinInput?.value || '').trim().replace(/\D/g, '').slice(0, 4) || activePartyCode;
    const url = new URL(window.location.href);
    url.searchParams.set('party', code);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {}
    if (el.duoCopyToast) {
      el.duoCopyToast.textContent = `🔗 초대 링크 복사 완료! (?party=${code}) 카톡/메신저에 붙여넣기 하세요!`;
      el.duoCopyToast.classList.remove('hidden');
    }
  });

  el.duoStartBattleBtn?.addEventListener('click', () => {
    const code = (el.duoJoinInput?.value || '').trim().replace(/\D/g, '').slice(0, 4) || activePartyCode;
    el.duoPartyModal?.classList.add('hidden');
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

  el.duoCloseBtn?.addEventListener('click', () => el.duoPartyModal?.classList.add('hidden'));

  // Auto-open 2:2 Duo modal if ?party=XXXX is in URL!
  const urlParty = new URLSearchParams(window.location.search).get('party');
  if (urlParty && /^\d{4}$/.test(urlParty)) {
    openDuoPartyModal(urlParty);
  }

  // Card 3: National School TOP 100 (COPPA-safe: School Affiliation ONLY, zero grade/class!)
  function renderSchoolTop100() {
    if (!el.schoolTopList) return;
    const sess = loadSocialSession();
    const mySchool = sess?.schoolName || '서울하늘초등학교';
    if (el.schoolMyInput && !el.schoolMyInput.value) el.schoolMyInput.value = mySchool;

    const list = DEFAULT_SCHOOLS_TOP.map((s) => ({ ...s }));
    const existing = list.find((s) => s.name === mySchool);
    if (existing) {
      existing.score += econ.schoolPoints;
    } else if (mySchool) {
      list.push({ rank: 11, name: mySchool, score: 88400 + econ.schoolPoints, wins: 690, region: '내 학교' });
    }
    list.sort((a, b) => b.score - a.score);

    el.schoolTopList.innerHTML = list.map((s, idx) => {
      const rank = idx + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}위`;
      const isMine = s.name === mySchool;
      return `<div class="school-rank-row${isMine ? ' mine' : ''}">
        <span class="sr-rank">${medal}</span>
        <span class="sr-name">${s.name} ${isMine ? '<em class="sr-me-tag">내 학교</em>' : ''}</span>
        <span class="sr-score">${s.score.toLocaleString()}점</span>
      </div>`;
    }).join('');
  }

  el.schoolWarCard?.addEventListener('click', () => {
    engine.audio.ensureContext();
    renderSchoolTop100();
    el.schoolTopModal?.classList.remove('hidden');
  });

  el.schoolSaveBtn?.addEventListener('click', () => {
    const newSchool = (el.schoolMyInput?.value || '').trim().slice(0, 24);
    if (!newSchool) return;
    const sess = loadSocialSession() || { provider: 'google', userId: 'player', nickname: '볼탱이' };
    sess.schoolName = newSchool;
    saveSocialSession(sess);
    applySessionToProfile(sess);
    renderSchoolTop100();
  });

  el.schoolStartBtn?.addEventListener('click', () => {
    el.schoolTopModal?.classList.add('hidden');
    const sess = loadSocialSession();
    const mySchool = sess?.schoolName || '서울하늘초등학교';
    const rival = DEFAULT_SCHOOLS_TOP.find((s) => s.name !== mySchool)?.name || '부산마린중학교';
    const playerChar = ui.charSelect?.value || 'M01_MOCHI';
    launchMatchSpec({
      gameMode: '2v2_team',
      matchLabel: `🏫 ${mySchool} vs ${rival}`,
      customRoster: [
        { teamId: 1, charKey: playerChar, x: 225, facing: 1, controller: 'human', name: `[${mySchool}] ${sess?.nickname || '대표'}` },
        { teamId: 2, charKey: 'F12_PUDDING', x: 1185, facing: -1, controller: 'ai', name: `[${rival}] 대표1` },
        { teamId: 1, charKey: 'M05_WAFFLE', x: 405, facing: 1, controller: 'ai', name: `[${mySchool}] 파트너` },
        { teamId: 2, charKey: 'M08_CINNA', x: 1375, facing: -1, controller: 'ai', name: `[${rival}] 대표2` },
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
  el.doubleRewardAdBtn?.addEventListener('click', () => {
    if (doubledThisMatch) return;
    doubledThisMatch = true;
    econ.coins += 200;
    econ.schoolPoints += 120;
    saveEconomy(econ);
    updateEconomyHud();
    engine.audio.playApplause();
    if (el.rewardAdToast) {
      el.rewardAdToast.textContent = '🎬 보상형 광고 완료! 코인 +200🪙 & 학교 점수 +120점 (2배 적립)!';
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

  // Sync Ghost Support Bar & Rewarded Ad buttons whenever HUD updates
  const origOnHudUpdate = engine.onHudUpdate;
  engine.onHudUpdate = (state) => {
    origOnHudUpdate?.(state);
    // Ghost Support Bar visibility (2v2 eliminated ally with ready support)
    if (el.ghostSupportBar) {
      const hasGhost = state.gameMode === '2v2_team' &&
        state.phase !== 'GAME_OVER' &&
        state.carts?.some((c) => c.teamId === 1 && !c.alive && c.ghostSupportReady) &&
        state.carts?.some((c) => c.teamId === 1 && c.alive);
      el.ghostSupportBar.classList.toggle('hidden', !hasGhost);
    }
    if (state.phase === 'GAME_OVER') {
      if (el.doubleRewardAdBtn && !doubledThisMatch) {
        el.doubleRewardAdBtn.disabled = false;
        el.doubleRewardAdBtn.textContent = '🎬 광고 보고 코인·학교점수 2배!';
      }
      if (el.rewindAdBtn) {
        const lostSingle = state.gameMode === '1v1_ai' && state.carts?.[0] && !state.carts[0].alive;
        el.rewindAdBtn.classList.toggle('hidden', !lostSingle);
      }
    } else {
      doubledThisMatch = false;
      el.rewardAdToast?.classList.add('hidden');
    }
  };

  updateEconomyHud();
}
