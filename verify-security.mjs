import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startBattleServer } from './server.mjs';
import { BattlePersistentStore } from './battle-store.mjs';

async function withServer(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltaengi-security-'));
  const server = await startBattleServer(0, '127.0.0.1', { dataDir: dir });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(route, { method = 'POST', token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json() };
  }
  try { await run(api, dir); } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const register = api => api('/api/battle/accounts', { body: { userId: 'student01', nickname: 'Player' } });

test('public ID cannot retrieve or modify a registered account', async () => withServer(async api => {
  const created = await register(api);
  assert.equal(created.status, 201);
  const attack = await api('/api/battle/accounts', { body: { userId: 'student01', nickname: 'attacker' } });
  assert.notEqual(attack.status, 200);
  assert.equal(attack.json.accountToken, undefined);
  const other = await api('/api/battle/accounts', { body: { userId: 'otheruser', nickname: 'Other' } });
  const crossLogin = await api('/api/battle/accounts', { token: other.json.accountToken, body: { userId: 'student01', nickname: 'attacker' } });
  assert.equal(crossLogin.status, 403);
  assert.equal(crossLogin.json.accountToken, undefined);
  const own = await api('/api/battle/accounts/me', { method: 'GET', token: created.json.accountToken });
  assert.equal(own.json.account.nickname, 'Player');
  const login = await api('/api/battle/accounts', { token: created.json.accountToken, body: { userId: 'student01', nickname: 'Player2' } });
  assert.equal(login.status, 200);
  assert.equal(login.json.account.nickname, 'Player2');
}));

test('client cannot forge match rewards or migrate unverified leaderboard stats', async () => withServer(async api => {
  const created = await register(api);
  const token = created.json.accountToken;
  const reward = await api('/api/battle/accounts/reward', { token, body: { idempotencyKey: 'fake', deltaXp: 2000, win: true } });
  assert.ok(reward.status >= 400);
  const migrate = await api('/api/battle/accounts/migrate-local', { token, body: { idempotencyKey: 'fake2', localWins: 99, localXp: 9999, localMatches: 99 } });
  assert.ok(migrate.status >= 400);
  const own = await api('/api/battle/accounts/me', { method: 'GET', token });
  assert.equal(own.json.account.wins, 0);
  assert.equal(own.json.account.xp, 0);
}));

test('account deletion requires owner credential and deletes stored record including backup', async () => withServer(async (api, dir) => {
  const created = await register(api);
  const token = created.json.accountToken;
  const denied = await api('/api/battle/accounts/me', { method: 'DELETE' });
  assert.equal(denied.status, 401);
  const deleted = await api('/api/battle/accounts/me', { method: 'DELETE', token });
  assert.equal(deleted.status, 200);
  const after = await api('/api/battle/accounts/me', { method: 'GET', token });
  assert.equal(after.status, 401);
  const staleSync = await api('/api/battle/accounts', { token, body: { userId: 'student01', nickname: 'Player' } });
  assert.equal(staleSync.status, 401);
  for (const file of ['battle-store.json', 'battle-store.json.bak']) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    assert.equal(data.userIdToAccountId.student01, undefined);
    assert.equal(data.tokenToAccountId[token], undefined);
    assert.equal(data.accountsById[created.json.account.accountId], undefined);
  }
}));

test('a single account cannot occupy both sides of one room', async () => withServer(async api => {
  const created = await register(api);
  const token = created.json.accountToken;
  const room = await api('/api/battle/rooms', { body: { accountToken: token } });
  assert.equal(room.status, 201);
  const join = await api('/api/battle/rooms/join', { body: { inviteCode: room.json.inviteCode, accountToken: token } });
  assert.equal(join.status, 409);
  assert.equal(join.json.error, 'ACCOUNT_ALREADY_IN_ROOM');
}));

test('compromisable legacy token is rejected while legacy data remains intact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltaengi-legacy-'));
  const storePath = path.join(dir, 'battle-store.json');
  const token = 'btl_old_compromised';
  const legacy = {
    schemaVersion: 1,
    accountsById: { acct_old: { accountId: 'acct_old', userId: 'olduser', nickname: 'Old', schoolName: '', className: '', xp: 50, wins: 2, matches: 3, version: 1, accountToken: token } },
    tokenToAccountId: { [token]: 'acct_old' }, userIdToAccountId: { olduser: 'acct_old' }, processedKeys: [],
  };
  fs.writeFileSync(storePath, JSON.stringify(legacy));
  fs.writeFileSync(`${storePath}.bak`, JSON.stringify(legacy));
  const server = await startBattleServer(0, '127.0.0.1', { dataDir: dir });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const me = await fetch(`${base}/api/battle/accounts/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(me.status, 401);
    const reclaim = await fetch(`${base}/api/battle/accounts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId: 'olduser', nickname: 'Attacker' }),
    });
    assert.equal(reclaim.status, 403);
    assert.equal((await reclaim.json()).error, 'ACCOUNT_RECOVERY_REQUIRED');
    const leaderboard = await fetch(`${base}/api/battle/leaderboard`);
    assert.equal(JSON.stringify(await leaderboard.json()).includes('olduser'), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(storePath, 'utf8')), legacy);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('reward retry persists exactly once after primary or backup write failure', () => {
  for (const failureTarget of ['battle-store.json', 'battle-store.json.bak']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltaengi-retry-'));
    try {
      const store = new BattlePersistentStore({ dataDir: dir });
      const created = store.registerOrLoginAccount({ userId: 'retry', nickname: 'Retry' });
      const reward = { accountToken: created.accountToken, idempotencyKey: 'match:retry:0', deltaXp: 120, win: true };
      const originalRename = fs.renameSync;
      fs.renameSync = function(from, to) {
        if (path.basename(String(to)) === failureTarget) throw new Error('injected-write-failure');
        return originalRename.apply(this, arguments);
      };
      try { assert.throws(() => store.applyReward(reward), /injected-write-failure/); }
      finally { fs.renameSync = originalRename; }
      assert.equal(store.applyReward(reward).deduplicated, true);
      const reopened = new BattlePersistentStore({ dataDir: dir });
      const result = reopened.authenticateAccount(created.accountToken);
      assert.equal(result.xp, 120);
      assert.equal(result.wins, 1);
      assert.equal(result.matches, 1);
      for (const name of ['battle-store.json', 'battle-store.json.bak']) {
        const copy = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        assert.equal(copy.accountsById[created.account.accountId].wins, 1);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

test('failed account deletion retains authentication and can be retried', () => {
  for (const failureTarget of ['battle-store.json', 'battle-store.json.bak']) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltaengi-delete-retry-'));
    try {
      const store = new BattlePersistentStore({ dataDir: dir });
      const created = store.registerOrLoginAccount({ userId: 'deleteuser', nickname: 'Delete User' });
      store.applyReward({ accountToken: created.accountToken, idempotencyKey: 'match:delete:0', deltaXp: 5 });
      const originalRename = fs.renameSync;
      fs.renameSync = function(from, to) {
        if (path.basename(String(to)) === failureTarget) throw new Error('injected-delete-failure');
        return originalRename.apply(this, arguments);
      };
      try { assert.throws(() => store.deleteAccount(created.accountToken), /injected-delete-failure/); }
      finally { fs.renameSync = originalRename; }
      assert.equal(store.authenticateAccount(created.accountToken).userId, 'deleteuser');
      store.deleteAccount(created.accountToken);
      assert.throws(() => store.authenticateAccount(created.accountToken), { code: 'INVALID_TOKEN' });
      for (const name of ['battle-store.json', 'battle-store.json.bak']) {
        const copy = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        assert.equal(copy.accountsById[created.account.accountId], undefined);
        assert.equal(copy.processedKeys.some(k => k.accountId === created.account.accountId), false);
      }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});
