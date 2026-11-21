import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startBattleServer } from './server.mjs';
import { BattlePersistentStore } from './battle-store.mjs';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'battle-persist-'));
const storeFile = path.join(tempDir, 'battle-store.json');

async function api(baseUrl, pathname, { method = 'GET', token = null, body = null } = {}) {
  const headers = { Host: '127.0.0.1' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== null) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  return { status: res.status, json };
}

try {
  // 1) 서버 1차 기동 & 가상 테스트 계정 2개 생성
  const store = new BattlePersistentStore({ dataDir: tempDir });
  let srv = await startBattleServer(0, '127.0.0.1', { store });
  let baseUrl = `http://127.0.0.1:${srv.address().port}`;

  const regA = await api(baseUrl, '/api/battle/accounts', {
    method: 'POST',
    body: { userId: 'test_student_01', nickname: '가상유저A', schoolName: '가상초', className: '1반' },
  });
  assert.equal(regA.status, 201);
  assert.equal(regA.json.account.xp, 0);

  const regB = await api(baseUrl, '/api/battle/accounts', {
    method: 'POST',
    body: { userId: 'test_student_02', nickname: '가상유저B', schoolName: '가상초', className: '2반' },
  });
  assert.equal(regB.status, 201);

  const tokenA = regA.json.accountToken;
  const tokenB = regB.json.accountToken;
  const idA = regA.json.account.accountId;
  const idB = regB.json.account.accountId;

  // 2) 계정 간 격리 검증 (A 토큰으로 B 조회 시도 -> 403)
  const crossRead = await api(baseUrl, `/api/battle/accounts/me?accountId=${idB}`, { token: tokenA });
  assert.equal(crossRead.status, 403);
  assert.equal(crossRead.json.error, 'FORBIDDEN_ACCOUNT');

  const noAuth = await api(baseUrl, '/api/battle/accounts/me');
  assert.equal(noAuth.status, 401);

  // 3) 멱등성 보상 + 중복 지급 방지 + 낙관적 버전 충돌 검증
  // Reward processing is now server-only; exercise the real store seam directly.
  const reward1 = store.applyReward({ accountToken: tokenA, idempotencyKey: 'match-001', deltaXp: 120, win: true, expectedVersion: 1 });
  assert.equal(reward1.deduplicated, false);
  assert.equal(reward1.account.xp, 120);
  assert.equal(reward1.account.wins, 1);
  assert.equal(reward1.account.version, 2);

  // 같은 idempotencyKey 재요청 -> 중복 지급 없이 deduplicated: true
  const rewardDup = store.applyReward({ accountToken: tokenA, idempotencyKey: 'match-001', deltaXp: 120, win: true, expectedVersion: 1 });
  assert.equal(rewardDup.deduplicated, true);
  assert.equal(rewardDup.account.xp, 120);

  // 오래된 expectedVersion으로 다른 키 전송 -> 409 SAVE_CONFLICT
  assert.throws(() => store.applyReward({ accountToken: tokenA, idempotencyKey: 'match-002', deltaXp: 50, win: false, expectedVersion: 1 }), { code: 'SAVE_CONFLICT' });

  // Seed B via the server-side settlement seam; local migration is disabled.
  const rewardB = store.applyReward({ accountToken: tokenB, idempotencyKey: 'match-b', deltaXp: 350, win: true, expectedVersion: 1 });
  assert.equal(rewardB.account.xp, 350);
  assert.equal(rewardB.account.wins, 1);

  // 비영속 임시 방 생성 (재시작 시 만료 확인용)
  const roomRes = await api(baseUrl, '/api/battle/rooms', {
    method: 'POST',
    token: tokenA,
    body: { charKey: 'M01_MOCHI', name: '가상유저A', accountToken: tokenA },
  });
  assert.equal(roomRes.status, 201);
  const ephemeralRoomId = roomRes.json.roomId;
  const ephemeralMemberToken = roomRes.json.memberToken;

  // 4) 서버 재시작 후 영속 데이터 복구 & 임시 방 만료 확인
  await new Promise((r) => srv.close(r));

  srv = await startBattleServer(0, '127.0.0.1', { dataDir: tempDir });
  baseUrl = `http://127.0.0.1:${srv.address().port}`;

  const meAfterRestart = await api(baseUrl, '/api/battle/accounts/me', { token: tokenA });
  assert.equal(meAfterRestart.status, 200);
  assert.equal(meAfterRestart.json.account.accountId, idA);
  assert.equal(meAfterRestart.json.account.xp, 120);
  assert.equal(meAfterRestart.json.account.wins, 1);

  const expiredRoom = await api(baseUrl, `/api/battle/rooms/${ephemeralRoomId}/state`, {
    token: ephemeralMemberToken,
  });
  assert.equal(expiredRoom.status, 404);
  assert.equal(expiredRoom.json.error, 'ROOM_NOT_FOUND');

  // 5) 주 저장 파일 손상 시 .bak 백업 자동 복구 검증
  await new Promise((r) => srv.close(r));
  assert.equal(fs.existsSync(`${storeFile}.bak`), true);
  fs.writeFileSync(storeFile, '{ CORRUPTED_JSON_TRUNCATED', 'utf8');

  srv = await startBattleServer(0, '127.0.0.1', { dataDir: tempDir });
  baseUrl = `http://127.0.0.1:${srv.address().port}`;

  const health = await api(baseUrl, '/api/battle/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.recoveredFromBackup, true);
  assert.equal(health.json.accounts, 2);

  const meB = await api(baseUrl, '/api/battle/accounts/me', { token: tokenB });
  assert.equal(meB.status, 200);
  assert.equal(meB.json.account.xp, 350);

  const memMb = Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10;
  console.log('PERSISTENCE_CHECKS_PASSED:', {
    accounts: health.json.accounts,
    recoveredFromBackup: health.json.recoveredFromBackup,
    rssMemoryMb: memMb,
  });
  await new Promise((r) => srv.close(r));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
