import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BattlePersistentStore } from '../battle-store.mjs';
import { startBattleServer } from '../server.mjs';

function testDirectory(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'battle-nickname-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('nickname searches return global ranks and surface an exact match below the top 20', async (t) => {
  const store = new BattlePersistentStore({ dataDir: testDirectory(t) });
  for (let number = 1; number <= 22; number++) {
    const { accountToken } = store.loginWithSocialIdentity({
      provider: 'google', subject: String(number), nickname: `Straße-${String(number).padStart(2, '0')}`,
    });
    store.applyReward({ accountToken, idempotencyKey: `fixture-${number}`, win: true, deltaXp: number });
  }
  store.loginWithSocialIdentity({ provider: 'google', subject: 'last', nickname: 'Straße' });
  const server = await startBattleServer(0, '127.0.0.1', { store });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/api/battle/leaderboard`;
  async function lookup(q, exact = false) {
    const url = new URL(endpoint);
    if (q !== undefined) url.searchParams.set('q', q);
    if (exact) url.searchParams.set('exact', '1');
    const response = await fetch(url);
    assert.equal(response.status, 200);
    return (await response.json()).leaderboard;
  }
  const top = await lookup();
  assert.equal(top.length, 20);
  assert.equal(top[0].rank, 1);
  assert.equal(top.at(-1).rank, 20);
  assert.deepEqual(await lookup('   ', true), top);
  const partial = await lookup('ＳＳＥ-０１');
  assert.deepEqual(partial.map(row => [row.nickname, row.rank]), [['Straße-01', 22]]);
  const mixed = await lookup('STRASSE');
  assert.equal(mixed.length, 20);
  assert.deepEqual([mixed[0].nickname, mixed[0].rank], ['Straße', 23]);
  assert.deepEqual(mixed.slice(1), top.slice(0, 19));
  assert.deepEqual(await lookup('STRASSE', true), [mixed[0]]);
  assert.deepEqual(await lookup('unlisted'), []);
  assert.equal((await fetch(endpoint + '?q=' + 'z'.repeat(65))).status, 400);
});

test('provider profiles keep a unique normalized nickname over rename, restart, and deletion', (t) => {
  const dataDir = testDirectory(t);
  const store = new BattlePersistentStore({ dataDir });
  const player = store.loginWithSocialIdentity({ provider: 'google', subject: 'fixture-one', nickname: 'Ｓtraße' });
  assert.equal(player.account.nickname, 'Straße');
  assert.equal(store.findAccountByNickname('STRASSE').accountId, player.account.accountId);
  const other = store.loginWithSocialIdentity({ provider: 'kakao', subject: 'fixture-two' });
  assert.equal(other.account.needsNickname, true);
  assert.throws(() => store.setNickname(other.accountToken, 'StraSSe'), { code: 'NICKNAME_TAKEN' });
  assert.equal(store.setNickname(other.accountToken, '별토끼').needsNickname, false);
  store.setNickname(player.accountToken, '모찌웅');
  assert.equal(store.findAccountByNickname('strasse'), null);
  const reopened = new BattlePersistentStore({ dataDir });
  const same = reopened.loginWithSocialIdentity({ provider: 'google', subject: 'fixture-one' });
  assert.equal(same.account.accountId, player.account.accountId);
  assert.equal(same.account.nickname, '모찌웅');
  reopened.deleteAccount(same.accountToken);
  assert.equal(reopened.findAccountByNickname('모찌웅'), null);
  assert.equal(reopened.setNickname(other.accountToken, '모찌웅').nickname, '모찌웅');
});

test('an existing v2 account retains its identity and scores on social migration', (t) => {
  const dataDir = testDirectory(t);
  const file = path.join(dataDir, 'battle-store.json');
  const legacy = {
    accountId: 'fixture-legacy', userId: 'old-user', nickname: '원래볼탱이', schoolName: '이전학교', className: '이전반',
    accountToken: 'btl2_legacy_fixture', credentialVersion: 2, xp: 275, wins: 2, matches: 3, score: 210,
  };
  const snapshot = JSON.stringify({ schemaVersion: 1, accountsById: { [legacy.accountId]: legacy },
    userIdToAccountId: { [legacy.userId]: legacy.accountId },
    tokenToAccountId: { [legacy.accountToken]: legacy.accountId }, processedKeys: [] });
  fs.writeFileSync(file, snapshot);
  fs.writeFileSync(file + '.bak', snapshot);
  const store = new BattlePersistentStore({ dataDir });
  for (const name of [file, file + '.bak']) {
    const saved = JSON.parse(fs.readFileSync(name, 'utf8')).accountsById[legacy.accountId];
    assert.ok(!('schoolName' in saved) && !('className' in saved));
    assert.equal(saved.xp, legacy.xp);
  }
  assert.equal(store.getLeaderboard().length, 0);
  const migrated = store.loginWithSocialIdentity({ provider: 'apple', subject: 'fixture-migrate', accountToken: legacy.accountToken });
  assert.equal(migrated.account.accountId, legacy.accountId);
  assert.equal(migrated.account.nickname, legacy.nickname);
  assert.equal(migrated.account.xp, 275);
  assert.equal(migrated.account.needsNickname, false);
  const [leader] = store.getLeaderboard();
  assert.equal(leader.score, 210);
  assert.deepEqual([leader.wins, leader.matches, leader.winRate], [2, 3, 67]);
  assert.ok(!('userId' in leader) && !('accountId' in leader) && !('provider' in leader));
  assert.ok(!('schoolName' in leader) && !('className' in leader));
  assert.equal(store.findAccountByNickname(legacy.nickname).accountId, legacy.accountId);
});

test('ambiguous legacy nicknames require explicit selection and never combine different accounts', (t) => {
  const dataDir = testDirectory(t);
  const records = [
    { accountId: 'local1', userId: 'old1', nickname: 'Ｍochi', xp: 400, accountToken: 'btl2_test_one' },
    { accountId: 'local2', userId: 'old2', nickname: 'mochi', xp: 200, accountToken: 'btl2_test_two' },
  ].map((entry) => ({ ...entry, credentialVersion: 2, wins: 0, matches: 0, score: 0 }));
  fs.writeFileSync(path.join(dataDir, 'battle-store.json'), JSON.stringify({
    schemaVersion: 1, accountsById: Object.fromEntries(records.map(r => [r.accountId, r])),
    userIdToAccountId: Object.fromEntries(records.map(r => [r.userId, r.accountId])),
    tokenToAccountId: Object.fromEntries(records.map(r => [r.accountToken, r.accountId])), processedKeys: [],
  }));
  const store = new BattlePersistentStore({ dataDir });
  const first = store.loginWithSocialIdentity({ provider: 'naver', subject: 'first', accountToken: records[0].accountToken });
  assert.equal(first.account.needsNickname, true);
  assert.throws(() => store.setNickname(first.accountToken, 'MOCHI'), { code: 'NICKNAME_TAKEN' });
  store.setNickname(first.accountToken, '작은모찌');
  const second = store.loginWithSocialIdentity({ provider: 'naver', subject: 'second', accountToken: records[1].accountToken });
  assert.equal(second.account.nickname, 'mochi');
  assert.equal(second.account.xp, 200);
  assert.throws(() => store.loginWithSocialIdentity({ provider: 'naver', subject: 'first', accountToken: second.accountToken }), { code: 'ACCOUNT_LINK_CONFLICT' });
  assert.equal(store.authenticateAccount(first.accountToken).xp, 400);
});
