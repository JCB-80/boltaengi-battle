import test from 'node:test';
import assert from 'node:assert/strict';
import { startBattleServer } from '../server.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BattlePersistentStore } from '../battle-store.mjs';

async function fixture(t) {
  let time = 1_000_000;
  const dataDir = await mkdtemp(path.join(tmpdir(), 'battle-network-test-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const store = new BattlePersistentStore({ dataDir });
  const accounts = {};
  for (const [alias, nickname] of [['a', 'Alice'], ['b', 'Bob'], ['c', 'Carol']]) {
    accounts[alias] = store.loginWithSocialIdentity({ provider: 'naver', subject: alias, nickname });
  }
  const server = await startBattleServer(0, '127.0.0.1', {
    store, now: () => time, roomIdleMs: 1_000, finishedRoomTtlMs: 1_000,
    maintenanceIntervalMs: 60_000,
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(path, { method = 'GET', token, body } = {}) {
    const bearer = accounts[token]?.accountToken || token;
    const response = await fetch(`${base}/api/battle${path}`, {
      method, headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  async function create(token = 'a', maxPlayers = 2, inviteOnly = false) {
    const r = await req(inviteOnly ? '/rooms/invite' : '/rooms', {
      method: 'POST', token, body: { accountToken: accounts[token].accountToken, maxPlayers },
    });
    assert.equal(r.status, 201);
    return r.data;
  }
  async function join(room, token = 'b') {
    const r = await req('/rooms/join', { method: 'POST', token, body: { inviteCode: room.inviteCode, accountToken: accounts[token].accountToken } });
    assert.equal(r.status, 200);
    return r.data;
  }
  return { req, create, join, stats: alias => store.authenticateAccount(accounts[alias].accountToken),
    advance: (ms) => { time += ms; } };
}

test('challenge endpoints require an authenticated sender and recipient', async (t) => {
  const f = await fixture(t);
  const room = await f.create('a', 2, true);
  const body = { roomId: room.roomId, inviteCode: room.inviteCode, targetNickname: 'Bob' };
  assert.equal((await f.req('/challenges', { method: 'POST', body })).status, 401);
  assert.equal((await f.req('/challenges', { method: 'POST', token: 'c', body })).status, 403);
  const sent = await f.req('/challenges', { method: 'POST', token: 'a', body });
  assert.equal(sent.status, 201);
  assert.deepEqual(sent.data.challenge.from, { nickname: 'Alice' });
  assert.equal((await f.req('/challenges/pending')).status, 401);
  assert.equal((await f.req('/challenges/pending', { token: 'c' })).data.challenge, null);
  assert.equal((await f.req(`/challenges/${sent.data.challenge.id}/respond`, { method: 'POST', token: 'c', body: { accept: true } })).status, 403);
  assert.equal((await f.req(`/challenges/${sent.data.challenge.id}/respond`, { method: 'POST', token: 'b', body: { accept: true } })).status, 200);
});

test('leaving an active two-player match ends it once and stale sessions cannot act', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const guest = await f.join(room);
  assert.equal((await f.req(`/rooms/${room.roomId}/leave`, { method: 'POST', token: guest.memberToken, body: {} })).status, 200);
  const state = await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  assert.equal(state.data.status, 'FINISHED');
  assert.equal(state.data.snapshot.phase, 'GAME_OVER');
  assert.equal(state.data.snapshot.winnerSlot, 0);
  assert.equal((await f.req(`/rooms/${room.roomId}/action`, { method: 'POST', token: guest.memberToken, body: { seq: 1, type: 'MOVE', dir: 1 } })).status, 401);
  assert.equal(state.data.rankedRewardsEnabled, true);
  await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  const hostStats = f.stats('a');
  const guestStats = f.stats('b');
  assert.deepEqual([hostStats.matches, hostStats.wins, hostStats.xp], [1, 1, 120]);
  assert.deepEqual([guestStats.matches, guestStats.wins, guestStats.xp], [1, 0, 35]);
});

test('three-player match continues after one player forfeits and ends after the second', async (t) => {
  const f = await fixture(t);
  const room = await f.create('a', 3);
  const guest = await f.join(room, 'b');
  const third = await f.join(room, 'c');
  assert.equal(third.slot, 2);
  assert.equal(third.status, 'ACTIVE');
  await f.req(`/rooms/${room.roomId}/leave`, { method: 'POST', token: guest.memberToken, body: {} });
  const remaining = await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  assert.equal(remaining.data.status, 'ACTIVE');
  assert.equal(remaining.data.snapshot.carts[1].alive, false);
  await f.req(`/rooms/${room.roomId}/leave`, { method: 'POST', token: third.memberToken, body: {} });
  const finished = await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  assert.equal(finished.data.status, 'FINISHED');
  assert.equal(finished.data.snapshot.winnerSlot, 0);
});

test('expired members forfeit, finished rooms expire even if polled', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const guest = await f.join(room);
  f.advance(700);
  assert.equal((await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken })).status, 200);
  f.advance(400);
  const result = await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  assert.equal(result.data.status, 'FINISHED');
  assert.equal(result.data.snapshot.winnerSlot, 0);
  assert.equal((await f.req(`/rooms/${room.roomId}/state`, { token: guest.memberToken })).status, 401);
  f.advance(1001);
  assert.equal((await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken })).status, 404);
});

test('all disconnected players time out together as a draw, not an arbitrary win', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  await f.join(room);
  f.advance(1001);
  const result = await f.req('/rooms/open');
  assert.equal(result.status, 200);
  assert.deepEqual([f.stats('a').wins, f.stats('b').wins], [0, 0]);
});

test('waiting rooms and challenges expire without background poll keeping them alive', async (t) => {
  const f = await fixture(t);
  const room = await f.create('a', 2, true);
  const sent = await f.req('/challenges', { method: 'POST', token: 'a', body: {
    roomId: room.roomId, inviteCode: room.inviteCode, targetNickname: 'Bob',
  } });
  assert.equal(sent.status, 201);
  f.advance(120_001);
  assert.equal((await f.req('/rooms/open')).data.rooms.length, 0);
  assert.equal((await f.req(`/challenges/${sent.data.challenge.id}/respond`, { method: 'POST', token: 'b', body: { accept: true } })).status, 404);
});

test('the leaderboard gives the winner and participant their scores using only public nicknames', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const guest = await f.join(room);
  await f.req(`/rooms/${room.roomId}/leave`, { method: 'POST', token: guest.memberToken, body: {} });
  await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  const board = await f.req('/leaderboard');
  assert.equal(board.status, 200);
  assert.equal(board.data.rankedRewardsEnabled, true);
  const rows = board.data.leaderboard;
  assert.deepEqual(rows.map(({ nickname, score, wins, matches }) => [nickname, score, wins, matches]),
    [['Alice', 100, 1, 1], ['Bob', 10, 0, 1], ['Carol', 0, 0, 0]]);
  for (const row of rows) {
    for (const field of ['accountId', 'userId', 'provider', 'providerSubject', 'schoolName', 'className']) {
      assert.equal(Object.hasOwn(row, field), false, field);
    }
  }
});
