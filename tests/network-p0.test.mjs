import test from 'node:test';
import assert from 'node:assert/strict';
import { startBattleServer } from '../server.mjs';
import { StoreError } from '../battle-store.mjs';

const users = {
  a: { accountId: 'acct_a', userId: 'alice', nickname: 'Alice', schoolName: '', className: '' },
  b: { accountId: 'acct_b', userId: 'bob', nickname: 'Bob', schoolName: '', className: '' },
  c: { accountId: 'acct_c', userId: 'carol', nickname: 'Carol', schoolName: '', className: '' },
};

async function fixture(t, { applyReward } = {}) {
  let time = 1_000_000;
  const rewards = [];
  const store = {
    getStats: () => ({ accountCount: 3, recoveredFromBackup: false }),
    authenticateAccount(token) {
      const user = users[token];
      if (!user) throw new StoreError(401, 'UNAUTHORIZED', 'unauthorized');
      return user;
    },
    applyReward(data) {
      rewards.push(data);
      return applyReward?.(data);
    },
  };
  const server = await startBattleServer(0, '127.0.0.1', {
    store, now: () => time, roomIdleMs: 1_000, finishedRoomTtlMs: 1_000,
    maintenanceIntervalMs: 60_000,
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(path, { method = 'GET', token, body } = {}) {
    const response = await fetch(`${base}/api/battle${path}`, {
      method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  }
  async function create(token = 'a', maxPlayers = 2) {
    const r = await req('/rooms', { method: 'POST', body: { accountToken: token, maxPlayers } });
    assert.equal(r.status, 201);
    return r.data;
  }
  async function join(room, token = 'b') {
    const r = await req('/rooms/join', { method: 'POST', body: { inviteCode: room.inviteCode, accountToken: token } });
    assert.equal(r.status, 200);
    return r.data;
  }
  return { req, create, join, rewards, advance: (ms) => { time += ms; } };
}

test('challenge endpoints require an authenticated sender and recipient', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const body = { roomId: room.roomId, inviteCode: room.inviteCode, targetUserId: 'bob', fromUserId: 'alice' };
  assert.equal((await f.req('/challenges', { method: 'POST', body })).status, 401);
  assert.equal((await f.req('/challenges', { method: 'POST', token: 'c', body })).status, 403);
  const sent = await f.req('/challenges', { method: 'POST', token: 'a', body });
  assert.equal(sent.status, 201);
  assert.equal(sent.data.challenge.from.userId, 'alice');
  assert.equal((await f.req('/challenges/pending?userId=bob')).status, 401);
  assert.equal((await f.req('/challenges/pending?userId=bob', { token: 'c' })).status, 403);
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
  assert.equal(f.rewards.length, 0);
  assert.equal(state.data.rankedRewardsEnabled, false);
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
  assert.equal(f.rewards.filter((reward) => reward.win).length, 0);
});

test('waiting rooms and challenges expire without background poll keeping them alive', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const sent = await f.req('/challenges', { method: 'POST', token: 'a', body: {
    roomId: room.roomId, inviteCode: room.inviteCode, targetUserId: 'bob',
  } });
  assert.equal(sent.status, 201);
  f.advance(120_001);
  assert.equal((await f.req('/rooms/open')).data.rooms.length, 0);
  assert.equal((await f.req(`/challenges/${sent.data.challenge.id}/respond`, { method: 'POST', token: 'b', body: { accept: true } })).status, 404);
});

test('ranked rewards and untrusted historical leaderboard are disabled', async (t) => {
  const f = await fixture(t);
  const room = await f.create();
  const guest = await f.join(room);
  await f.req(`/rooms/${room.roomId}/leave`, { method: 'POST', token: guest.memberToken, body: {} });
  await f.req(`/rooms/${room.roomId}/state`, { token: room.memberToken });
  const board = await f.req('/leaderboard');
  assert.equal(board.data.rankedRewardsEnabled, false);
  assert.deepEqual(board.data.leaderboard, []);
  assert.equal(f.rewards.length, 0);
});
