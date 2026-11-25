// 볼탱이 대전 — /battle/ 정적 호스팅 + /api/battle/* 권위형 온라인 대전 HTTP 서버 (127.0.0.1:8791)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OnlineSimulation } from './server-sim.mjs';
import { BattlePersistentStore, StoreError } from './battle-store.mjs';
import { createSocialAuth } from './social-auth.mjs';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MIME_MAP = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.apk': 'application/vnd.android.package-archive',
};

const ALLOWED_HOSTS = new Set([
  '127.0.0.1',
  'localhost',
  '192.168.0.39',
  'boltangi.amazonlightsail.com',
  'dduemttk5ba8p.cloudfront.net',
  'ec2-43-203-70-197.ap-northeast-2.compute.amazonaws.com',
  '43.203.70.197.sslip.io',
  '43.203.70.197',
]);

function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function randomCode(len = 6) {
  return crypto.randomBytes(len).toString('hex').slice(0, len).toUpperCase();
}

export function startBattleServer(port = 8791, host = '127.0.0.1', options = {}) {
  const staticRoot = fs.realpathSync(path.resolve(options.staticRoot || ROOT_DIR));
  const store =
    options.store ||
    new BattlePersistentStore({
      dataDir: options.dataDir || path.join(ROOT_DIR, 'data'),
    });
  const handleSocialAuth = createSocialAuth({ ...options.socialAuth, store });
  const rooms = new Map();
  const challenges = new Map();
  const MAX_ROOMS = 24;
  const now = options.now || Date.now;
  const ROOM_IDLE_MS = options.roomIdleMs ?? 90_000;
  const FINISHED_TTL_MS = options.finishedRoomTtlMs ?? 120_000;
  const WAITING_MAX_MS = 10 * 60_000;
  const ACTIVE_MAX_MS = 30 * 60_000;
  const CHALLENGE_TTL_MS = 120_000;

  function finishRoomIfEnded(rm) {
    if (!rm.sim || rm.sim.phase !== 'GAME_OVER') return;
    if (rm.status !== 'FINISHED') {
      rm.status = 'FINISHED';
      rm.finishedAt = now();
      if (rm.tickTimer) clearInterval(rm.tickTimer);
      rm.tickTimer = null;
    }
    if (!rm.matchRewarded) {
      rm.matchRewarded = true;
      const snap = rm.sim.snapshot();
      const winnerSlot = snap.winnerSlot;
      rm.players.forEach((p, idx) => {
        if (!p || !p.accountToken || !p.accountId) return;
        const isWinner = winnerSlot === idx;
        try {
          store.applyReward({
            accountToken: p.accountToken,
            accountId: p.accountId,
            idempotencyKey: `match:${rm.id}:slot:${idx}`,
            deltaXp: isWinner ? 120 : 35,
            win: isWinner,
            matchCompleted: true,
          });
        } catch {
          // 중복 정산 또는 만료 토큰 무시
        }
      });
    }
  }

  function startRoomMatch(rm) {
    if (!rm || rm.status === 'ACTIVE') return;
    rm.status = 'ACTIVE';
    rm.sim = new OnlineSimulation({ mapPreset: rm.mapPreset, players: rm.players });
    rm.tickTimer = setInterval(() => {
      if (rm.sim) {
        rm.sim.tick();
        finishRoomIfEnded(rm);
      }
    }, 1000 / 60);
    rm.startedAt = now();
  }

  function cleanupExpiredRooms() {
    const current = now();
    for (const [cid, ch] of challenges) {
      const room = rooms.get(ch.roomId);
      if (!room || current - ch.createdAt >= CHALLENGE_TTL_MS) {
        if (room?.inviteStatus === 'PENDING') room.inviteStatus = 'EXPIRED';
        challenges.delete(cid);
      }
    }
    for (const [id, rm] of rooms.entries()) {
      if (rm.status === 'FINISHED') {
        if (current - rm.finishedAt >= FINISHED_TTL_MS) rooms.delete(id);
        continue;
      }
      const expired = [...rm.lastSeen.entries()]
        .filter(([, seen]) => current - seen >= ROOM_IDLE_MS)
        .map(([token]) => token);
      if (!rm.sim && (current - rm.createdAt >= WAITING_MAX_MS || expired.some((token) => rm.tokens.get(token) === 0))) {
        if (rm.tickTimer) clearInterval(rm.tickTimer);
        rooms.delete(id);
        continue;
      }
      if (!rm.sim) {
        // Remove inactive guests from a waiting room and reindex remaining slots.
        for (const token of expired) {
          const slot = rm.tokens.get(token);
          rm.tokens.delete(token); rm.sequences.delete(token); rm.lastSeen.delete(token);
          rm.players.splice(slot, 1);
          for (const [other, index] of rm.tokens) if (index > slot) rm.tokens.set(other, index - 1);
          rm.inviteConsumed = false;
        }
      } else if (rm.status === 'ACTIVE') {
        const timedOut = current - rm.startedAt >= ACTIVE_MAX_MS ? [...rm.tokens.keys()] : expired;
        const slots = timedOut.map((token) => rm.tokens.get(token)).filter((slot) => slot !== undefined);
        for (const token of timedOut) {
          rm.tokens.delete(token); rm.sequences.delete(token); rm.lastSeen.delete(token);
        }
        if (slots.length) rm.sim.forfeitSlots(slots);
        finishRoomIfEnded(rm);
      }
    }
  }

  const maintenanceTimer = setInterval(cleanupExpiredRooms, options.maintenanceIntervalMs ?? 1000);

  function resolveBearer(req) {
    const auth = req.headers.authorization || '';
    return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  }

  function socialAccount(token) {
    const account = store.authenticateAccount(token);
    if (!account.provider || !account.nickname || account.needsNickname) {
      throw new StoreError(403, 'SOCIAL_PROFILE_REQUIRED', '소셜 로그인 후 닉네임을 설정해 주세요.');
    }
    return account;
  }

  function publicChallenge(ch) {
    if (!ch) return null;
    const { id, roomId, inviteCode, from, status, createdAt } = ch;
    return { id, roomId, inviteCode, from, status, createdAt };
  }

  function isHostAllowed(req) {
    const rawHost = String(req.headers.host || '').split(':')[0].toLowerCase().trim();
    if (!rawHost) return true;
    const extra = process.env.BATTLE_ALLOWED_HOSTS
      ? new Set(process.env.BATTLE_ALLOWED_HOSTS.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean))
      : null;
    if (extra && extra.size > 0) return extra.has(rawHost);
    return /^[a-z0-9.-]+$/i.test(rawHost);
  }

  const STATIC_PREFIXES = ['styles/', 'src/', 'assets/', 'vendor/'];
  const STATIC_FILES = new Set(['index.html', 'privacy.html', 'boltaengi-battle.apk', 'favicon.ico']);

  const server = http.createServer(async (req, res) => {
    const sendJson = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(data));
    };

    try {
      if (!isHostAllowed(req)) {
        return sendJson(403, { error: 'INVALID_HOST' });
      }

      const urlObj = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
      const pathname = urlObj.pathname;
      if (pathname.startsWith('/api/battle/')) cleanupExpiredRooms();
      if (pathname.startsWith('/api/battle/auth/') && await handleSocialAuth(req, res, urlObj)) return;

      // 1) /battle -> /battle/ 리다이렉트 & 정적 파일 서빙
      if (pathname === '/battle') {
        res.writeHead(302, { Location: '/battle/' });
        return res.end();
      }

      if (req.method === 'GET' && (pathname === '/' || pathname.startsWith('/battle/') || STATIC_PREFIXES.some((p) => pathname.slice(1).startsWith(p)) || STATIC_FILES.has(pathname.slice(1)))) {
        let rel = pathname === '/' || pathname === '/battle/' ? 'index.html' : pathname.startsWith('/battle/') ? pathname.slice('/battle/'.length) : pathname.slice(1);
        rel = decodeURIComponent(rel).replace(/^\/+/, '');
        if (rel.includes('\0') || rel.split(/[\\/]+/).some((part) => part === '..' || part === '.')) {
          return sendJson(404, { error: 'NOT_FOUND' });
        }
        if (!STATIC_FILES.has(rel) && !STATIC_PREFIXES.some((p) => rel.startsWith(p))) {
          return sendJson(404, { error: 'NOT_FOUND' });
        }
        const resolved = path.resolve(staticRoot, rel);
        const relative = path.relative(staticRoot, resolved);
        if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative) ||
            !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
          return sendJson(404, { error: 'NOT_FOUND' });
        }
        // Do not serve a symlink/junction to private files, even when its
        // apparent URL is inside an allowed static directory.
        const realFile = fs.realpathSync(resolved);
        const normal = (p) => process.platform === 'win32' ? path.normalize(p).toLowerCase() : path.normalize(p);
        if (normal(realFile) !== normal(resolved)) return sendJson(404, { error: 'NOT_FOUND' });
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_MAP[ext] || 'application/octet-stream',
          'Cache-Control': ext === '.html' || ext === '.js' ? 'no-store' : 'public, max-age=60',
          'X-Content-Type-Options': 'nosniff',
        });
        return fs.createReadStream(resolved).pipe(res);
      }

      // 2) /api/battle/health
      if (req.method === 'GET' && pathname === '/api/battle/health') {
        const stats = store.getStats();
        return sendJson(200, {
          ok: true,
          service: 'boltaengi-battle',
          rooms: rooms.size,
          accounts: stats.accountCount,
          recoveredFromBackup: stats.recoveredFromBackup,
        });
      }

      // 2.2) 같은 네트워크 열린 대기방 목록 GET /api/battle/rooms/open
      if (req.method === 'GET' && pathname === '/api/battle/rooms/open') {
        cleanupExpiredRooms();
        const openRooms = [];
        for (const rm of rooms.values()) {
          if (
            rm.scope === 'all' && !rm.inviteConsumed &&
            (rm.status === 'WAITING_GUEST' || rm.status === 'WAITING_APPROVAL') &&
            rm.players.length < (rm.maxPlayers || 2)
          ) {
            openRooms.push({
              roomId: rm.id,
              inviteCode: rm.inviteCode,
              roomTitle: rm.roomTitle || `${rm.players[0]?.name || '호스트'}의 방`,
              hostName: rm.players[0]?.name || '호스트',
              scope: rm.scope || 'all',
              mapPreset: rm.mapPreset,
              playersCount: rm.players.length,
              maxPlayers: rm.maxPlayers || 2,
            });
          }
        }
        return sendJson(200, { rooms: openRooms });
      }

      // 2.5) 내 계정 조회 GET /api/battle/accounts/me (타 계정 격리)
      if (req.method === 'GET' && pathname === '/api/battle/accounts/me') {
        const accountToken = resolveBearer(req);
        const requestedId = urlObj.searchParams.get('accountId') || null;
        const account = store.authenticateAccount(accountToken, requestedId);
        return sendJson(200, { account });
      }

      if (req.method === 'DELETE' && pathname === '/api/battle/accounts/me') {
        const account = store.deleteAccount(resolveBearer(req));
        // Remove live state containing the account as well as its persisted record.
        const removedRoomIds = new Set();
        for (const [id, rm] of rooms) {
          if (rm.invitedAccountId === account.accountId || rm.players.some(p => p && p.accountId === account.accountId)) {
            if (rm.tickTimer) clearInterval(rm.tickTimer);
            rooms.delete(id);
            removedRoomIds.add(id);
          }
        }
        for (const [id, ch] of challenges) {
          if (ch.targetAccountId === account.accountId || ch.senderAccountId === account.accountId ||
              removedRoomIds.has(ch.roomId)) challenges.delete(id);
        }
        return sendJson(200, { deleted: true });
      }

      // 2.6) 실시간 점수 · 승률 · 계급 순위표 GET /api/battle/leaderboard
      if (req.method === 'GET' && pathname === '/api/battle/leaderboard') {
        const { leaderboard } = store.getLeaderboard({
          limit: 20,
          q: urlObj.searchParams.get('q'),
          exact: urlObj.searchParams.get('exact') === '1',
        });
        return sendJson(200, { leaderboard, rankedRewardsEnabled: true });
      }

      if (req.method === 'GET' && pathname === '/api/battle/challenges/pending') {
        const account = socialAccount(resolveBearer(req));
        const found = [...challenges.values()].find((ch) =>
          ch.targetAccountId === account.accountId && ch.status === 'PENDING'
        );
        return sendJson(200, { challenge: publicChallenge(found) });
      }

      // 3) 방 상태 조회 GET /api/battle/rooms/:roomId/state
      const stateMatch = pathname.match(/^\/api\/battle\/rooms\/([A-Za-z0-9_-]+)\/state$/);
      if (req.method === 'GET' && stateMatch) {
        cleanupExpiredRooms();
        const rm = rooms.get(stateMatch[1]);
        if (!rm) return sendJson(404, { error: 'ROOM_NOT_FOUND' });
        const token = resolveBearer(req);
        const slot = rm.tokens.get(token);
        if (slot === undefined) return sendJson(401, { error: 'UNAUTHORIZED' });
        if (rm.status !== 'FINISHED') rm.lastSeen.set(token, now());
        return sendJson(200, {
          roomId: rm.id,
          roomTitle: rm.roomTitle || `${rm.players[0]?.name || '호스트'}의 방`,
          scope: rm.scope,
          status: rm.status,
          slot,
          maxPlayers: rm.maxPlayers,
          rankedRewardsEnabled: true,
          inviteStatus: slot === 0 && rm.scope === 'invite' ? rm.inviteStatus : undefined,
          inviteCode: rm.inviteCode,
          approvalCode: slot === 0 && rm.status === 'WAITING_APPROVAL' ? rm.approvalCode : undefined,
          players: rm.players.map((p, idx) => ({ slot: idx, name: p.name, charKey: p.charKey })),
          snapshot: rm.sim ? rm.sim.snapshot() : null,
        });
      }

      if (req.method !== 'POST') {
        return sendJson(404, { error: 'NOT_FOUND' });
      }

      // JSON Body 파싱 (최대 4KB)
      let rawBody = '';
      for await (const chunk of req) {
        rawBody += chunk;
        if (Buffer.byteLength(rawBody) > 4096) return sendJson(413, { error: 'BODY_TOO_LARGE' });
      }
      const body = rawBody ? JSON.parse(rawBody) : {};
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return sendJson(400, { error: 'INVALID_JSON' });
      }

      // 3.5) 계정 등록/로그인 POST /api/battle/accounts
      if (pathname === '/api/battle/accounts/nickname') {
        const account = store.setNickname(resolveBearer(req), body.nickname);
        return sendJson(200, { account });
      }
      if (pathname === '/api/battle/accounts') {
        const result = store.registerOrLoginAccount({
          userId: body.userId,
          accountToken: resolveBearer(req),
        });
        return sendJson(result.created ? 201 : 200, result);
      }

      // 3.6) 멱등 전적/XP 보상 POST /api/battle/accounts/reward
      if (pathname === '/api/battle/accounts/reward') {
        return sendJson(403, { error: 'SERVER_MATCH_REWARDS_ONLY' });
      }

      // 3.7) 기존 localStorage 진행도 1회 멱등 이관 POST /api/battle/accounts/migrate-local
      if (pathname === '/api/battle/accounts/migrate-local') {
        return sendJson(403, { error: 'UNVERIFIED_LOCAL_PROGRESS_DISABLED' });
      }

      // 4) 방 생성 POST /api/battle/rooms
      if (pathname === '/api/battle/rooms' || pathname === '/api/battle/rooms/invite') {
        cleanupExpiredRooms();
        if (rooms.size >= MAX_ROOMS) return sendJson(429, { error: 'SERVER_FULL' });

        const roomId = `rm_${randomCode(6)}`;
        const inviteCode = randomCode(6);
        const hostToken = randomToken();
        const mapPreset = String(body.mapPreset || 'archipelago');
        const scope = pathname.endsWith('/invite') ? 'invite' : body.scope ?? 'all';
        if (scope !== 'all' && scope !== 'invite') {
          return sendJson(400, { error: 'UNSUPPORTED_ROOM_SCOPE' });
        }
        const hostAccountToken = resolveBearer(req) || body.accountToken;
        const hostAccount = socialAccount(hostAccountToken);
        const hostPlayer = {
          charKey: String(body.charKey || 'M01_MOCHI'),
          name: hostAccount.nickname,
          accountId: hostAccount.accountId,
          accountToken: hostAccountToken,
        };

        const maxPlayers = scope === 'all' && Number(body.maxPlayers) === 3 ? 3 : 2;
        const roomTitle = String(body.roomTitle || `${hostPlayer.name}의 방`).trim().slice(0, 28) || `${hostPlayer.name}의 방`;
        const rm = {
          id: roomId,
          inviteCode,
          roomTitle,
          inviteConsumed: false,
          maxPlayers,
          scope,
          approvalCode: randomCode(4),
          status: 'WAITING_GUEST',
          mapPreset,
          players: [hostPlayer],
          tokens: new Map([[hostToken, 0]]),
          sequences: new Map([[hostToken, 0]]),
          sim: null,
          tickTimer: null,
          createdAt: now(),
          lastSeen: new Map([[hostToken, now()]]),
        };
        rooms.set(roomId, rm);

        return sendJson(201, {
          roomId,
          inviteCode,
          memberToken: hostToken,
          scope,
          slot: 0,
          maxPlayers,
          status: rm.status,
        });
      }

      // 5) 방 참가 POST /api/battle/rooms/join
      if (pathname === '/api/battle/rooms/join') {
        cleanupExpiredRooms();
        const code = String(body.inviteCode || '').trim().toUpperCase();
        if (!code) return sendJson(400, { error: 'MISSING_INVITE_CODE' });

        let targetRoom = null;
        for (const rm of rooms.values()) {
          if (
            rm.inviteCode === code &&
            !rm.inviteConsumed &&
            (rm.status === 'WAITING_GUEST' || rm.status === 'WAITING_APPROVAL') &&
            rm.players.length < (rm.maxPlayers || 2)
          ) {
            targetRoom = rm;
            break;
          }
        }
        if (!targetRoom) return sendJson(404, { error: 'INVALID_OR_USED_INVITE' });

        const assignedSlot = targetRoom.players.length;
        const guestToken = randomToken();
        const guestAccountToken = resolveBearer(req) || body.accountToken;
        const guestAccount = socialAccount(guestAccountToken);
        if (targetRoom.scope !== 'all' && (targetRoom.scope !== 'invite' ||
            targetRoom.invitedAccountId !== guestAccount.accountId || targetRoom.inviteStatus !== 'ACCEPTED')) {
          return sendJson(403, { error: 'INVITE_REQUIRED' });
        }
        if (targetRoom.players.some(p => p.accountId === guestAccount.accountId)) {
          return sendJson(409, { error: 'ACCOUNT_ALREADY_IN_ROOM' });
        }
        targetRoom.tokens.set(guestToken, assignedSlot);
        targetRoom.sequences.set(guestToken, 0);
        targetRoom.lastSeen.set(guestToken, now());
        const newPlayer = {
          charKey: String(body.charKey || (assignedSlot === 1 ? 'M05_SODAPIN' : 'M02_PUDDING')),
          name: guestAccount.nickname,
          accountId: guestAccount.accountId,
          accountToken: guestAccountToken,
        };
        targetRoom.players.push(newPlayer);
        targetRoom.inviteConsumed = targetRoom.players.length >= (targetRoom.maxPlayers || 2);

        if (targetRoom.inviteConsumed && targetRoom.status !== 'ACTIVE') {
          startRoomMatch(targetRoom);
        }

        return sendJson(200, {
          roomId: targetRoom.id,
          memberToken: guestToken,
          scope: targetRoom.scope,
          slot: assignedSlot,
          maxPlayers: targetRoom.maxPlayers,
          status: targetRoom.status,
          snapshot: targetRoom.sim ? targetRoom.sim.snapshot() : null,
        });
      }

      // 6) 방 시작 승인 POST /api/battle/rooms/:roomId/approve
      const approveMatch = pathname.match(/^\/api\/battle\/rooms\/([A-Za-z0-9_-]+)\/approve$/);
      if (approveMatch) {
        const rm = rooms.get(approveMatch[1]);
        if (!rm) return sendJson(404, { error: 'ROOM_NOT_FOUND' });
        const token = resolveBearer(req);
        if (rm.tokens.get(token) !== 0) return sendJson(403, { error: 'HOST_ONLY' });
        if (rm.status !== 'WAITING_APPROVAL') return sendJson(409, { error: 'INVALID_ROOM_STATE' });

        startRoomMatch(rm);

        return sendJson(200, {
          roomId: rm.id,
          status: rm.status,
          snapshot: rm.sim.snapshot(),
        });
      }

      // 7) 게임 액션 POST /api/battle/rooms/:roomId/action
      const actionMatch = pathname.match(/^\/api\/battle\/rooms\/([A-Za-z0-9_-]+)\/action$/);
      if (actionMatch) {
        const rm = rooms.get(actionMatch[1]);
        if (!rm) return sendJson(404, { error: 'ROOM_NOT_FOUND' });
        const token = resolveBearer(req);
        const slot = rm.tokens.get(token);
        if (slot === undefined) return sendJson(401, { error: 'UNAUTHORIZED' });
        if (rm.status !== 'ACTIVE' || !rm.sim) return sendJson(409, { error: 'MATCH_NOT_ACTIVE' });

        const seq = Number(body.seq);
        const prevSeq = rm.sequences.get(token) || 0;
        if (!Number.isSafeInteger(seq) || seq <= prevSeq) {
          return sendJson(409, { error: 'STALE_OR_REPLAY_SEQUENCE' });
        }

        const result = rm.sim.act(slot, body);
        rm.sequences.set(token, seq);
        rm.lastSeen.set(token, now());
        return sendJson(200, { accepted: true, seq, ...result });
      }

      // Explicit leave is a forfeit in an active match and releases a waiting slot.
      const leaveMatch = pathname.match(/^\/api\/battle\/rooms\/([A-Za-z0-9_-]+)\/leave$/);
      if (leaveMatch) {
        const rm = rooms.get(leaveMatch[1]);
        if (!rm) return sendJson(404, { error: 'ROOM_NOT_FOUND' });
        const token = resolveBearer(req);
        const slot = rm.tokens.get(token);
        if (slot === undefined) return sendJson(401, { error: 'UNAUTHORIZED' });
        rm.tokens.delete(token); rm.sequences.delete(token); rm.lastSeen.delete(token);
        if (rm.status === 'ACTIVE') {
          rm.sim.forfeitSlots([slot]);
          finishRoomIfEnded(rm);
        } else if (!rm.sim && slot === 0) {
          rooms.delete(rm.id);
        } else if (!rm.sim) {
          rm.players.splice(slot, 1);
          for (const [other, index] of rm.tokens) if (index > slot) rm.tokens.set(other, index - 1);
          rm.inviteConsumed = false;
        }
        return sendJson(200, { left: true });
      }

      // 8) 대결 요청 보내기 POST /api/battle/challenges
      if (pathname === '/api/battle/challenges') {
        const account = socialAccount(resolveBearer(req));
        const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
        if (!body.targetNickname || !inviteCode) return sendJson(400, { error: 'MISSING_CHALLENGE_FIELDS' });
        const rm = rooms.get(body.roomId);
        if (!rm || rm.scope !== 'invite' || rm.status !== 'WAITING_GUEST' || rm.inviteCode !== inviteCode ||
            rm.players[0]?.accountId !== account.accountId) return sendJson(403, { error: 'FORBIDDEN_ROOM' });
        const target = store.findAccountByNickname(body.targetNickname);
        if (!target) return sendJson(404, { error: 'NICKNAME_NOT_FOUND' });
        if (target.accountId === account.accountId) return sendJson(400, { error: 'SELF_CHALLENGE' });
        if (challenges.size >= 500) return sendJson(429, { error: 'CHALLENGE_LIMIT' });
        if (rm.invitedAccountId) return sendJson(409, { error: 'INVITATION_ALREADY_SENT' });
        const cid = `chg_${randomCode(6)}`;
        const ch = {
          id: cid,
          targetAccountId: target.accountId,
          senderAccountId: account.accountId,
          inviteCode,
          roomId: rm.id,
          from: { nickname: account.nickname },
          status: 'PENDING',
          createdAt: now(),
        };
        rm.invitedAccountId = target.accountId;
        rm.inviteStatus = 'PENDING';
        challenges.set(cid, ch);
        return sendJson(201, { challenge: publicChallenge(ch) });
      }

      // 9) 대결 요청 응답 POST /api/battle/challenges/:id/respond
      const chgRespMatch = pathname.match(/^\/api\/battle\/challenges\/([A-Za-z0-9_-]+)\/respond$/);
      if (chgRespMatch) {
        const account = socialAccount(resolveBearer(req));
        const ch = challenges.get(chgRespMatch[1]);
        if (!ch) return sendJson(404, { error: 'CHALLENGE_NOT_FOUND' });
        if (ch.targetAccountId !== account.accountId) return sendJson(403, { error: 'FORBIDDEN_ACCOUNT' });
        if (ch.status !== 'PENDING') return sendJson(409, { error: 'CHALLENGE_ALREADY_RESPONDED' });
        if (typeof body.accept !== 'boolean') return sendJson(400, { error: 'INVALID_INVITE_RESPONSE' });
        ch.status = body.accept ? 'ACCEPTED' : 'DECLINED';
        rooms.get(ch.roomId).inviteStatus = ch.status;
        return sendJson(200, { challenge: publicChallenge(ch) });
      }

      return sendJson(404, { error: 'NOT_FOUND' });
    } catch (err) {
      if (err instanceof StoreError) {
        return sendJson(err.status, { error: err.code, message: err.message });
      }
      return sendJson(err instanceof SyntaxError ? 400 : 409, { error: err.message || 'BAD_REQUEST' });
    }
  });

  server.on('close', () => {
    clearInterval(maintenanceTimer);
    for (const rm of rooms.values()) {
      if (rm.tickTimer) clearInterval(rm.tickTimer);
    }
    rooms.clear();
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server));
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bindPort = Number(process.env.PORT || process.env.BATTLE_PORT || 8791);
  const bindHost = process.env.BATTLE_HOST || process.env.HOST || '0.0.0.0';
  const srv = await startBattleServer(bindPort, bindHost);
  console.log(`Boltaengi Battle Server listening at http://${bindHost}:${srv.address().port}/battle/`);
}
