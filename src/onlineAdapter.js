// 볼탱이 대전 — /api/battle/* 온라인 대전 클라이언트 스냅샷 어댑터 (재접속 · 크레이터 동기화 · 턴 교대)
import { CHARACTERS, SHELLS } from './config.js';
import { CoasterCart, CapsuleProjectile } from './entities.js';

const SESSION_KEY = 'boltaengi_online_session_v1';
const ACCOUNT_KEY = 'boltaengi_account_auth_v1';
const ACCOUNT_KEY_PREFIX = 'boltaengi_account_auth_v2:';

export class OnlineBattleClient {
  constructor() {
    this.roomId = null;
    this.token = null;
    this.slot = null;
    this.seq = 0;
    this.pollTimer = null;
    this.appliedCraterIds = new Set();
    this.initializedMapKey = null;
    this.lastPhase = null;
    this.accountAuth = this._loadAccountAuth();
    this._accountSyncGeneration = 0;
    this._activeProfileUserId = null;
    this._accountEpochs = new Map();
  }

  _loadAccountAuth() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _savedAccountFor(userId) {
    try {
      const saved = localStorage.getItem(ACCOUNT_KEY_PREFIX + encodeURIComponent(userId));
      if (saved) return JSON.parse(saved);
    } catch {
      // Fall back to the existing single-account record.
    }
    const legacy = this._loadAccountAuth();
    return legacy?.userId === userId ? legacy : null;
  }

  _saveAccountAuth(auth, activate = true) {
    // Preserve the old single-account record before switching identities. Each
    // account has its own entry; a slow response must not erase another token.
    const previous = this._loadAccountAuth();
    if (previous?.userId && previous.accountToken) {
      localStorage.setItem(ACCOUNT_KEY_PREFIX + encodeURIComponent(previous.userId), JSON.stringify(previous));
    }
    localStorage.setItem(ACCOUNT_KEY_PREFIX + encodeURIComponent(auth.userId), JSON.stringify(auth));
    if (activate) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(auth));
      this.accountAuth = auth;
    }
  }

  async syncAccount(profile) {
    if (!profile?.userId) return null;
    const generation = ++this._accountSyncGeneration;
    this._activeProfileUserId = profile.userId;
    const epoch = this._accountEpochs.get(profile.userId) || 0;
    const headers = { 'Content-Type': 'application/json' };
    const savedAuth = this._savedAccountFor(profile.userId);
    if (savedAuth?.accountToken) {
      headers.Authorization = `Bearer ${savedAuth.accountToken}`;
    }
    const response = await fetch('/api/battle/accounts', {
      method: 'POST', headers,
      body: JSON.stringify({
        userId: profile.userId,
        nickname: profile.nickname,
        schoolName: profile.schoolName,
        className: profile.className,
      }),
    });
    const res = await response.json();
    const isCurrent = generation === this._accountSyncGeneration;
    // Keep credentials from successful delayed registration, but never make
    // an outdated profile active or restore credentials after its deletion.
    if (response.ok && res?.account && res?.accountToken &&
        res.account.userId === profile.userId && (this._accountEpochs.get(profile.userId) || 0) === epoch) {
      this._saveAccountAuth({
        userId: res.account.userId,
        accountId: res.account.accountId,
        accountToken: res.accountToken,
      }, isCurrent);
    }
    if (!isCurrent) return null;
    if (!response.ok) throw new Error(res.error || `HTTP ${response.status}`);
    return res?.account || null;
  }

  async fetchMyAccount() {
    const auth = this.getActiveAccountAuth();
    if (!auth?.accountToken) return null;
    const res = await fetch('/api/battle/accounts/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${auth.accountToken}` },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.account || null;
  }

  async recordLocalMatchReward({ win = false, deltaXp = 40, matchId = '' } = {}) {
    // Local results are kept locally; only server-ended online matches enter the leaderboard.
    return null;
  }

  async deleteAccount() {
    const auth = this.getActiveAccountAuth();
    if (!auth?.accountToken) throw new Error('UNAUTHORIZED');
    this._accountSyncGeneration++;
    this._accountEpochs.set(auth.userId, (this._accountEpochs.get(auth.userId) || 0) + 1);
    const response = await fetch('/api/battle/accounts/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.accountToken}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    this.accountAuth = null;
    try {
      localStorage.removeItem(ACCOUNT_KEY_PREFIX + encodeURIComponent(auth.userId));
      if (this._loadAccountAuth()?.userId === auth.userId) localStorage.removeItem(ACCOUNT_KEY);
      return data;
    } catch {
      return { ...data, localCleanupFailed: true };
    }
  }

  getActiveAccountAuth() {
    return this._activeProfileUserId && this.accountAuth?.userId === this._activeProfileUserId
      ? this.accountAuth : null;
  }

  saveSession() {
    if (this.roomId && this.token) {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ roomId: this.roomId, token: this.token, slot: this.slot, seq: this.seq })
      );
    }
  }

  loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s?.roomId || !s?.token) return null;
      this.roomId = s.roomId;
      this.token = s.token;
      this.slot = s.slot;
      this.seq = s.seq || 0;
      return s;
    } catch {
      return null;
    }
  }

  clearSession({ notifyServer = true } = {}) {
    const roomId = this.roomId;
    const token = this.token;
    this.stopPolling();
    this.roomId = null;
    this.token = null;
    this.slot = null;
    this.seq = 0;
    this.appliedCraterIds.clear();
    this.initializedMapKey = null;
    sessionStorage.removeItem(SESSION_KEY);
    if (notifyServer && roomId && token) {
      // Capture credentials before clearing local state; keepalive also covers
      // navigation away. A failed request is handled by server-side timeout.
      fetch(`/api/battle/rooms/${encodeURIComponent(roomId)}/leave`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      }).catch(() => {});
    }
  }

  async _post(url, body = {}, useAuth = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (useAuth && this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async _get(url) {
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { method: 'GET', headers, cache: 'no-store', signal: controller.signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async createRoom({ mapPreset, charKey, name, roomTitle = '', maxPlayers = 2, schoolName = '', className = '', scope = 'all' }) {
    this.clearSession();
    const res = await this._post('/api/battle/rooms', {
      mapPreset,
      charKey,
      name,
      roomTitle,
      maxPlayers,
      schoolName,
      className,
      scope,
      accountToken: this.getActiveAccountAuth()?.accountToken || undefined,
    }, false);
    this.roomId = res.roomId;
    this.token = res.memberToken;
    this.slot = res.slot;
    this.seq = 0;
    this.saveSession();
    return res;
  }

  async joinRoom({ inviteCode, charKey, name }) {
    this.clearSession();
    const res = await this._post('/api/battle/rooms/join', {
      inviteCode,
      charKey,
      name,
      accountToken: this.getActiveAccountAuth()?.accountToken || undefined,
    }, false);
    this.roomId = res.roomId;
    this.token = res.memberToken;
    this.slot = res.slot;
    this.seq = 0;
    this.saveSession();
    return res;
  }

  async approveRoom() {
    if (!this.roomId) throw new Error('NO_ROOM');
    return this._post(`/api/battle/rooms/${this.roomId}/approve`, {}, true);
  }

  async fetchState() {
    if (!this.roomId || !this.token) return null;
    return this._get(`/api/battle/rooms/${this.roomId}/state`);
  }

  async sendAction(payload) {
    if (!this.roomId || !this.token) return null;
    this.seq += 1;
    this.saveSession();
    return this._post(
      `/api/battle/rooms/${this.roomId}/action`,
      { seq: this.seq, ...payload },
      true
    );
  }

  startPolling(onState, intervalMs = 65) {
    this.stopPolling();
    this._fetching = false;
    let failures = 0;
    let retryAt = 0;
    const tick = async () => {
      if (this._fetching || Date.now() < retryAt) return;
      const reqRoomId = this.roomId;
      const reqToken = this.token;
      if (!reqRoomId || !this.token) return;
      this._fetching = true;
      try {
        const state = await this.fetchState();
        if (state && this.roomId === reqRoomId && this.token === reqToken) {
          failures = 0;
          retryAt = 0;
          onState(state);
        }
      } catch (err) {
        if (this.roomId !== reqRoomId || this.token !== reqToken) return;
        if (err?.message === 'ROOM_NOT_FOUND' || err?.message === 'UNAUTHORIZED') {
          this.clearSession({ notifyServer: false });
          onState({ connectionError: err.message, disconnected: true });
        } else {
          failures++;
          retryAt = Date.now() + Math.min(5000, 500 * 2 ** Math.min(failures - 1, 4));
          if (failures === 1) onState({ connectionError: 'RECONNECTING' });
        }
      } finally {
        this._fetching = false;
      }
    };
    tick();
    this.pollTimer = setInterval(tick, intervalMs);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * 서버 스냅샷을 로컬 GameEngine/GameRenderer에 동기화 (지형 파임·캐릭터·탄환·턴 반영)
   */
  applySnapshotToEngine(engine, snap) {
    if (!engine || !snap) return;

    const firstSnapshot = this.initializedMapKey !== snap.mapKey;
    if (firstSnapshot) {
      this.initializedMapKey = snap.mapKey;
      this.appliedCraterIds.clear();
      engine.mapPreset = snap.mapKey;
      engine.matchLabel = '온라인 대전';
      engine.projectiles = [];
      engine.terrain.generate(snap.mapKey);
      this.waitingForMapImage = Boolean(engine.terrain.pendingImageApply);
      engine.structures.blocks = [];
      engine.particles = [];
      engine.shockwaves = [];
      engine.floatingTexts = [];
    }

    // A late map image replaces the provisional terrain mask. Restore the same holes on it.
    const imageArrived = this.waitingForMapImage && !engine.terrain.pendingImageApply;
    if (imageArrived) {
      this.waitingForMapImage = false;
      this.appliedCraterIds.clear();
    }

    // 1) 서버 크레이터를 로컬 빵 지형에 동기화 적용
    if (Array.isArray(snap.craters)) {
      for (const cr of snap.craters) {
        if (this.appliedCraterIds.has(cr.id)) continue;
        this.appliedCraterIds.add(cr.id);
        const carved = engine.terrain.carveCrater(cr.cx, cr.cy, cr.r);
        if (firstSnapshot || imageArrived) continue;
        const isHeavy = cr.r > 50;
        engine.spawnBurst(cr.cx, cr.cy, '#FDE68A', isHeavy ? 26 : 16, isHeavy ? 6.2 : 4.8);
        engine.renderer.addShake(isHeavy ? 20 : 13);
        engine.renderer.addFlash('#FEF3C7', isHeavy ? 0.28 : 0.14);
        engine.audio.playImpact?.(isHeavy);
        if (carved > 0) {
          engine.spawnGroundImpactFx?.(cr.cx, cr.cy, cr.r, '#FB923C', isHeavy);
          const vibMs = isHeavy ? 150 : 90;
          try {
            window.AndroidBridge?.vibrate?.(vibMs);
            navigator.vibrate?.(isHeavy ? [70, 30, 110] : [55, 22, 65]);
          } catch {
            // ignore
          }
        }
      }
    }

    // 2) 캐릭터 2~3인 상태 동기화 (내 슬롯만 controller='human', 상대는 'remote')
    if (Array.isArray(snap.carts) && snap.carts.length >= 2) {
      if (firstSnapshot || engine.carts.length !== snap.carts.length) {
        engine.carts = snap.carts.map((sc, idx) => {
          const c = new CoasterCart({
            slotIndex: idx,
            teamId: idx + 1,
            charKey: sc.charKey,
            x: sc.x,
            y: sc.y,
            facing: sc.facing,
            controller: idx === this.slot ? 'human' : 'remote',
            nameOverride: sc.name,
          });
          return c;
        });
      }

      snap.carts.forEach((sc, idx) => {
        const local = engine.carts[idx];
        if (!local) return;
        local.controller = idx === this.slot ? 'human' : 'remote';
        // 내가 현재 조준 중인 턴에는 로컬 드래그 조작감이 튀지 않게 hp/recoil만 반영하고, 그 외엔 서버 좌표 동기화
        const isMyAim = !firstSnapshot && engine.turnNumber === snap.turnNumber &&
          idx === this.slot && snap.phase === 'AIM' && snap.activeSlot === this.slot;
        local._targetX = sc.x;
        local._targetY = sc.y;
        if (!isMyAim) {
          local.facing = sc.facing;
          local.aimElevation = sc.aimElevation;
          local.aimPower = sc.aimPower;
          local.selectedShell = sc.selectedShell;
          local.useUltimate = sc.useUltimate;
        }
        local.hp = sc.hp;
        local.maxHp = sc.maxHp;
        local.fuel = sc.fuel;
        local.ultGauge = sc.ultGauge;
        local.recoil = sc.recoil;
        local.alive = sc.alive;
      });
    }

    // 3) 탄환, 선물박스, 바람, 턴, 승패 동기화
    engine.turnNumber = snap.turnNumber;
    engine.turnTimeLeft = snap.turnTimeLeft ?? 20;
    engine.phase = snap.phase;
    engine.wind = snap.wind;
    engine.weather = snap.weather;
    engine.winnerText = snap.winnerText || '';
    engine.activeActor = engine.carts[snap.activeSlot] || null;
    engine.fixedBoxes = snap.fixedBoxes || [];
    if (snap.skyBox) engine.skyBox = snap.skyBox;

    const previousShots = new Map(engine.projectiles.map(p => [p.serverId, p]));
    engine.projectiles = (snap.projectiles || []).map(sp => {
      const projectile = previousShots.get(sp.id) || new CapsuleProjectile({
        ownerId: `cart_${sp.ownerSlot ?? snap.activeSlot}`,
        shellKey: sp.shellKey,
        x: sp.x, y: sp.y, vx: sp.vx, vy: sp.vy,
        isUltimate: sp.isUltimate,
      });
      projectile.serverId = sp.id;
      projectile.x = sp.x;
      projectile.y = sp.y;
      projectile.vx = sp.vx;
      projectile.vy = sp.vy;
      projectile.ageFrames = sp.ageFrames ?? projectile.ageFrames;
      projectile.airTriggered = sp.airTriggered ?? projectile.airTriggered;
      return projectile;
    });

    engine.notifyHud();
  }
}
