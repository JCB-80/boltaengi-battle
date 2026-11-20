// 볼탱이 대전 — /battle/ 정적 호스팅 + /api/battle/* 권위형 온라인 대전 HTTP 서버 (127.0.0.1:8791)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OnlineSimulation } from './server-sim.mjs';
import { BattlePersistentStore, StoreError } from './battle-store.mjs';

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
  const store =
    options.store ||
    new BattlePersistentStore({
      dataDir: options.dataDir || path.join(ROOT_DIR, 'data'),
    });
  const rooms = new Map();
  const challenges = new Map();
  const MAX_ROOMS = 24;
  const ROOM_TTL_MS = 15 * 60 * 1000;

  function settleRoomRewardsIfEnded(rm) {
    if (!rm || !rm.sim || rm.matchRewarded) return;
    const snap = rm.sim.snapshot();
    if (snap.phase !== 'GAME_OVER') return;
    rm.matchRewarded = true;
    const winnerSlot = snap.winnerSlot;
    rm.players.forEach((p, idx) => {
      if (!p || !p.accountToken) return;
      const isWinner = winnerSlot === idx;
      try {
        store.applyReward({
          accountToken: p.accountToken,
          accountId: p.accountId,
          idempotencyKey: `match:${rm.id}:slot:${idx}`,
          deltaXp: isWinner ? 120 : 40,
          win: isWinner,
          matchCompleted: true,
        });
      } catch {
        // 보상 중복 또는 토큰 만료 시 무시
      }
    });
  }

  function startRoomMatch(rm) {
    if (!rm || rm.status === 'ACTIVE') return;
    rm.status = 'ACTIVE';
    rm.sim = new OnlineSimulation({ mapPreset: rm.mapPreset, players: rm.players });
    rm.tickTimer = setInterval(() => {
      if (rm.sim) {
        rm.sim.tick();
        settleRoomRewardsIfEnded(rm);
      }
    }, 1000 / 60);
    rm.lastActivity = Date.now();
  }

  function cleanupExpiredRooms() {
    const now = Date.now();
    for (const [id, rm] of rooms.entries()) {
      if (now - rm.createdAt > ROOM_TTL_MS && now - rm.lastActivity > 5 * 60 * 1000) {
        if (rm.tickTimer) clearInterval(rm.tickTimer);
        rooms.delete(id);
      }
    }
  }

  function resolveBearer(req) {
    const auth = req.headers.authorization || '';
    return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
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

      // 1) /battle -> /battle/ 리다이렉트 & 정적 파일 서빙
      if (pathname === '/battle') {
        res.writeHead(302, { Location: '/battle/' });
        return res.end();
      }

      if (req.method === 'GET' && (pathname === '/' || pathname.startsWith('/battle/') || STATIC_PREFIXES.some((p) => pathname.slice(1).startsWith(p)) || STATIC_FILES.has(pathname.slice(1)))) {
        let rel = pathname === '/' || pathname === '/battle/' ? 'index.html' : pathname.startsWith('/battle/') ? pathname.slice('/battle/'.length) : pathname.slice(1);
        rel = decodeURIComponent(rel).replace(/^\/+/, '');
        if (!STATIC_FILES.has(rel) && !STATIC_PREFIXES.some((p) => rel.startsWith(p))) {
          return sendJson(404, { error: 'NOT_FOUND' });
        }
        const resolved = path.resolve(ROOT_DIR, rel);
        if (!resolved.startsWith(ROOT_DIR) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
          return sendJson(404, { error: 'NOT_FOUND' });
        }
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
            !rm.inviteConsumed &&
            (rm.status === 'WAITING_GUEST' || rm.status === 'WAITING_APPROVAL' || rm.status === 'ACTIVE') &&
            rm.players.length < (rm.maxPlayers || 2)
          ) {
            openRooms.push({
              roomId: rm.id,
              inviteCode: rm.inviteCode,
              roomTitle: rm.roomTitle || `${rm.players[0]?.name || '호스트'}의 방`,
              hostName: rm.players[0]?.name || '호스트',
              schoolName: rm.schoolName || '',
              className: rm.className || '',
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

      // 2.6) 실시간 승률 순위표 GET /api/battle/leaderboard
      if (req.method === 'GET' && pathname === '/api/battle/leaderboard') {
        const scope = urlObj.searchParams.get('scope') || 'all';
        const schoolName = urlObj.searchParams.get('schoolName') || '';
        const className = urlObj.searchParams.get('className') || '';
        const result = store.getLeaderboard({ scope, schoolName, className, limit: 20 });
        return sendJson(200, result);
      }

      // 2.7) 대기 중인 대결 요청 조회 GET /api/battle/challenges/pending?userId=...
      if (req.method === 'GET' && pathname === '/api/battle/challenges/pending') {
        const uid = String(urlObj.searchParams.get('userId') || '').trim().toLowerCase();
        if (!uid) return sendJson(200, { challenge: null });
        const now = Date.now();
        let found = null;
        for (const [cid, ch] of challenges.entries()) {
          if (now - ch.createdAt > 120000) {
            challenges.delete(cid);
            continue;
          }
          if (ch.targetUserId === uid && ch.status === 'PENDING') {
            found = ch;
            break;
          }
        }
        return sendJson(200, { challenge: found });
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
        rm.lastActivity = Date.now();
        return sendJson(200, {
          roomId: rm.id,
          status: rm.status,
          slot,
          maxPlayers: rm.maxPlayers,
          inviteCode: slot === 0 ? rm.inviteCode : undefined,
          approvalCode: slot === 0 && rm.status === 'WAITING_APPROVAL' ? rm.approvalCode : undefined,
          players: rm.players.map((p) => ({ name: p.name, charKey: p.charKey })),
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
      if (pathname === '/api/battle/accounts') {
        const result = store.registerOrLoginAccount({
          userId: body.userId,
          nickname: body.nickname,
          schoolName: body.schoolName,
          className: body.className,
        });
        return sendJson(result.created ? 201 : 200, result);
      }

      // 3.6) 멱등 전적/XP 보상 POST /api/battle/accounts/reward
      if (pathname === '/api/battle/accounts/reward') {
        const accountToken = resolveBearer(req);
        const result = store.applyReward({
          accountToken,
          accountId: body.accountId || null,
          idempotencyKey: body.idempotencyKey,
          deltaXp: body.deltaXp,
          win: Boolean(body.win),
          matchCompleted: body.matchCompleted !== false,
          expectedVersion: body.expectedVersion,
        });
        return sendJson(200, result);
      }

      // 3.7) 기존 localStorage 진행도 1회 멱등 이관 POST /api/battle/accounts/migrate-local
      if (pathname === '/api/battle/accounts/migrate-local') {
        const accountToken = resolveBearer(req);
        const result = store.migrateLocalProgress({
          accountToken,
          idempotencyKey: body.idempotencyKey,
          localXp: body.localXp,
          localWins: body.localWins,
          localMatches: body.localMatches,
          expectedVersion: body.expectedVersion,
        });
        return sendJson(200, result);
      }

      // 4) 방 생성 POST /api/battle/rooms
      if (pathname === '/api/battle/rooms') {
        cleanupExpiredRooms();
        if (rooms.size >= MAX_ROOMS) return sendJson(429, { error: 'SERVER_FULL' });

        const roomId = `rm_${randomCode(6)}`;
        const inviteCode = randomCode(6);
        const hostToken = randomToken();
        const mapPreset = String(body.mapPreset || 'archipelago');
        let hostAccount = null;
        const hostAccountToken = body.accountToken ? String(body.accountToken) : '';
        if (hostAccountToken) {
          hostAccount = store.authenticateAccount(hostAccountToken);
        }
        const hostPlayer = {
          charKey: String(body.charKey || 'M01_MOCHI'),
          name: String(body.name || (hostAccount && hostAccount.nickname) || '호스트').slice(0, 18),
          accountId: hostAccount ? hostAccount.accountId : null,
          accountToken: hostAccount ? hostAccountToken : null,
        };

        const maxPlayers = Number(body.maxPlayers) === 3 ? 3 : 2;
        const roomTitle = String(body.roomTitle || `${hostPlayer.name}의 방`).trim().slice(0, 28) || `${hostPlayer.name}의 방`;
        const schoolName = String(body.schoolName || (hostAccount && hostAccount.schoolName) || '').slice(0, 32);
        const className = String(body.className || (hostAccount && hostAccount.className) || '').slice(0, 24);
        const scope = body.scope === 'class' || body.scope === 'school' ? body.scope : 'all';
        const rm = {
          id: roomId,
          inviteCode,
          roomTitle,
          inviteConsumed: false,
          maxPlayers,
          schoolName,
          className,
          scope,
          approvalCode: randomCode(4),
          status: 'WAITING_GUEST',
          mapPreset,
          players: [hostPlayer],
          tokens: new Map([[hostToken, 0]]),
          sequences: new Map([[hostToken, 0]]),
          sim: null,
          tickTimer: null,
          createdAt: Date.now(),
          lastActivity: Date.now(),
        };
        rooms.set(roomId, rm);

        return sendJson(201, {
          roomId,
          inviteCode,
          memberToken: hostToken,
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
            (rm.status === 'WAITING_GUEST' || rm.status === 'WAITING_APPROVAL' || rm.status === 'ACTIVE') &&
            rm.players.length < (rm.maxPlayers || 2)
          ) {
            targetRoom = rm;
            break;
          }
        }
        if (!targetRoom) return sendJson(404, { error: 'INVALID_OR_USED_INVITE' });

        const assignedSlot = targetRoom.players.length;
        const guestToken = randomToken();
        targetRoom.tokens.set(guestToken, assignedSlot);
        let guestAccount = null;
        const guestAccountToken = body.accountToken ? String(body.accountToken) : '';
        if (guestAccountToken) {
          guestAccount = store.authenticateAccount(guestAccountToken);
        }
        targetRoom.sequences.set(guestToken, 0);
        const newPlayer = {
          charKey: String(body.charKey || (assignedSlot === 1 ? 'M05_SODAPIN' : 'M02_PUDDING')),
          name: String(body.name || (guestAccount && guestAccount.nickname) || `플레이어${assignedSlot + 1}`).slice(0, 18),
          accountId: guestAccount ? guestAccount.accountId : null,
          accountToken: guestAccount ? guestAccountToken : null,
        };
        targetRoom.players.push(newPlayer);
        targetRoom.inviteConsumed = targetRoom.players.length >= (targetRoom.maxPlayers || 2);

        if (targetRoom.inviteConsumed && targetRoom.status !== 'ACTIVE') {
          startRoomMatch(targetRoom);
        } else {
          targetRoom.lastActivity = Date.now();
        }

        return sendJson(200, {
          roomId: targetRoom.id,
          memberToken: guestToken,
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
        rm.lastActivity = Date.now();
        return sendJson(200, { accepted: true, seq, ...result });
      }

      // 8) 대결 요청 보내기 POST /api/battle/challenges
      if (pathname === '/api/battle/challenges') {
        const targetUserId = String(body.targetUserId || '').trim().toLowerCase();
        const inviteCode = String(body.inviteCode || '').trim().toUpperCase();
        if (!targetUserId || !inviteCode) return sendJson(400, { error: 'MISSING_CHALLENGE_FIELDS' });
        const cid = `chg_${randomCode(6)}`;
        const ch = {
          id: cid,
          targetUserId,
          inviteCode,
          roomId: String(body.roomId || ''),
          from: {
            userId: String(body.fromUserId || ''),
            nickname: String(body.fromNickname || '도전자').slice(0, 18),
            schoolName: String(body.fromSchool || '').slice(0, 32),
            className: String(body.fromClass || '').slice(0, 24),
          },
          status: 'PENDING',
          createdAt: Date.now(),
        };
        challenges.set(cid, ch);
        return sendJson(201, { challenge: ch });
      }

      // 9) 대결 요청 응답 POST /api/battle/challenges/:id/respond
      const chgRespMatch = pathname.match(/^\/api\/battle\/challenges\/([A-Za-z0-9_-]+)\/respond$/);
      if (chgRespMatch) {
        const ch = challenges.get(chgRespMatch[1]);
        if (!ch) return sendJson(404, { error: 'CHALLENGE_NOT_FOUND' });
        ch.status = body.accept ? 'ACCEPTED' : 'DECLINED';
        return sendJson(200, { challenge: ch });
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
