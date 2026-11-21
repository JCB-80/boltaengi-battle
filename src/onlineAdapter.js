// 볼탱이 대전 — /api/battle/* 온라인 대전 클라이언트 스냅샷 어댑터 (재접속 · 크레이터 동기화 · 턴 교대)
import { CHARACTERS, SHELLS } from './config.js';
import { CoasterCart, CapsuleProjectile } from './entities.js';

const SESSION_KEY = 'boltaengi_online_session_v1';
const ACCOUNT_KEY = 'boltaengi_account_auth_v1';

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
  }

  _loadAccountAuth() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveAccountAuth(auth) {
    this.accountAuth = auth;
    try {
      if (auth) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(auth));
    } catch {
      // ignore storage errors
    }
  }

  async syncAccount(profile) {
    if (!profile?.userId) return null;
    const res = await this._post('/api/battle/accounts', {
      userId: profile.userId,
      nickname: profile.nickname,
      schoolName: profile.schoolName,
      className: profile.className,
    }, false);
    if (res?.account && res?.accountToken) {
      this._saveAccountAuth({
        userId: res.account.userId,
        accountId: res.account.accountId,
        accountToken: res.accountToken,
      });
    }
    return res?.account || null;
  }

  async fetchMyAccount() {
    if (!this.accountAuth?.accountToken) return null;
    const res = await fetch('/api/battle/accounts/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accountAuth.accountToken}` },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.account || null;
  }

  async recordLocalMatchReward({ win = false, deltaXp = 40, matchId = '' } = {}) {
    if (!this.accountAuth?.accountToken) return null;
    const res = await fetch('/api/battle/accounts/reward', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accountAuth.accountToken}`,
      },
      body: JSON.stringify({
        accountId: this.accountAuth.accountId,
        idempotencyKey: matchId || `local:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        deltaXp,
        win: Boolean(win),
        matchCompleted: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.account || null;
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

  clearSession() {
    this.stopPolling();
    this.roomId = null;
    this.token = null;
    this.slot = null;
    this.seq = 0;
    this.appliedCraterIds.clear();
    this.initializedMapKey = null;
    sessionStorage.removeItem(SESSION_KEY);
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
    const res = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
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
      accountToken: this.accountAuth?.accountToken || undefined,
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
      accountToken: this.accountAuth?.accountToken || undefined,
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
    const tick = async () => {
      if (this._fetching) return;
      const reqRoomId = this.roomId;
      if (!reqRoomId || !this.token) return;
      this._fetching = true;
      try {
        const state = await this.fetchState();
        if (state && this.roomId === reqRoomId && this.token) onState(state);
      } catch (err) {
        if (err?.message === 'ROOM_NOT_FOUND' || err?.message === 'UNAUTHORIZED') {
          this.clearSession();
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

    if (this.initializedMapKey !== snap.mapKey) {
      this.initializedMapKey = snap.mapKey;
      this.appliedCraterIds.clear();
      engine.mapPreset = snap.mapKey;
      engine.terrain.generate(snap.mapKey);
      engine.structures.blocks = [];
      engine.particles = [];
      engine.shockwaves = [];
      engine.floatingTexts = [];
    }

    // 1) 서버 크레이터를 로컬 빵 지형에 동기화 적용
    if (Array.isArray(snap.craters)) {
      for (const cr of snap.craters) {
        if (this.appliedCraterIds.has(cr.id)) continue;
        this.appliedCraterIds.add(cr.id);
        const carved = engine.terrain.carveCrater(cr.cx, cr.cy, cr.r);
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
      if (engine.carts.length !== snap.carts.length) {
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
        const isMyAim = idx === this.slot && snap.phase === 'AIM' && snap.activeSlot === this.slot;
        if (!isMyAim) {
          local._targetX = sc.x;
          local._targetY = sc.y;
          local.facing = sc.facing;
          local.aimElevation = sc.aimElevation;
          local.aimPower = sc.aimPower;
          local.selectedShell = sc.selectedShell;
        } else {
          local._targetX = sc.x;
          local._targetY = sc.y;
        }
        local.hp = sc.hp;
        local.maxHp = sc.maxHp;
        local.fuel = sc.fuel;
        local.ultGauge = sc.ultGauge;
        local.useUltimate = sc.useUltimate;
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

    engine.projectiles = (snap.projectiles || []).map((sp) => {
      const p = new CapsuleProjectile({
        ownerId: `slot_${snap.activeSlot}`,
        shellKey: sp.shellKey,
        x: sp.x,
        y: sp.y,
        vx: sp.vx,
        vy: sp.vy,
        isUltimate: sp.isUltimate,
      });
      p.active = true;
      return p;
    });

    engine.notifyHud();
  }
}
