import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = { Matter: {} };
const { OnlineBattleClient } = await import('../src/onlineAdapter.js');

const memoryStorage = () => {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
};

test('leaving clears local state and sends the room credential to the leave endpoint', async (t) => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => { calls.push(args); return { ok: true, json: async () => ({ left: true }) }; };
  t.after(() => { globalThis.fetch = oldFetch; delete globalThis.localStorage; delete globalThis.sessionStorage; });
  const client = new OnlineBattleClient();
  client.roomId = 'rm_test'; client.token = 'room_secret'; client.slot = 0;
  client.saveSession();
  client.clearSession();
  assert.equal(client.roomId, null);
  assert.equal(sessionStorage.getItem('boltaengi_online_session_v1'), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/api/battle/rooms/rm_test/leave');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer room_secret');
});

test('polling reports an interrupted connection and resumes after a transient failure', async (t) => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return { ok: true, json: async () => ({ status: 'ACTIVE', roomId: 'rm_test' }) };
  };
  const client = new OnlineBattleClient();
  client.roomId = 'rm_test'; client.token = 'room_secret';
  t.after(() => { client.stopPolling(); globalThis.fetch = oldFetch; delete globalThis.localStorage; delete globalThis.sessionStorage; });
  const states = [];
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('reconnection did not complete')), 2000);
    client.startPolling((state) => {
      states.push(state);
      if (state.status === 'ACTIVE') { clearTimeout(timeout); resolve(); }
    }, 10);
  });
  assert.equal(states[0].connectionError, 'RECONNECTING');
  assert.equal(states.at(-1).status, 'ACTIVE');
  assert.ok(calls >= 2);
});

test('a delayed account response cannot replace the most recently selected identity', async (t) => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  const oldFetch = globalThis.fetch;
  for (const id of ['alice', 'bob']) {
    const auth = { userId: id, accountId: id[0], accountToken: 'token_' + id[0] };
    localStorage.setItem('boltaengi_account_auth_v2:' + id, JSON.stringify(auth));
  }
  const pending = new Map();
  globalThis.fetch = async (_url, options) => new Promise((resolve) => pending.set(options.headers.Authorization, resolve));
  t.after(() => { globalThis.fetch = oldFetch; delete globalThis.localStorage; delete globalThis.sessionStorage; });
  const client = new OnlineBattleClient();
  const first = client.syncAccount({ userId: 'alice' });
  const second = client.syncAccount({ userId: 'bob' });
  pending.get('Bearer token_b')({ ok: true, json: async () => ({ account: { userId: 'bob', accountId: 'b' }, accountToken: 'token_b' }) });
  assert.equal((await second).userId, 'bob');
  pending.get('Bearer token_a')({ ok: true, json: async () => ({ account: { userId: 'alice', accountId: 'a' }, accountToken: 'token_a' }) });
  assert.equal(await first, null);
  assert.equal(client.accountAuth.userId, 'bob');
  assert.equal(client.accountAuth.accountToken, 'token_b');
  assert.equal(JSON.parse(localStorage.getItem('boltaengi_account_auth_v1')).userId, 'bob');
  assert.equal(JSON.parse(localStorage.getItem('boltaengi_account_auth_v2:alice')).accountToken, 'token_a');
  let authorization;
  globalThis.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    return { ok: true, json: async () => ({ account: { userId: 'alice', accountId: 'a' }, accountToken: 'token_a' }) };
  };
  assert.equal((await client.syncAccount({ userId: 'alice' })).userId, 'alice');
  assert.equal(authorization, 'Bearer token_a');
  assert.equal(JSON.parse(localStorage.getItem('boltaengi_account_auth_v2:bob')).accountToken, 'token_b');
});

test('deleting the active account preserves the other account credentials', async (t) => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  const alice = { userId: 'alice', accountId: 'a', accountToken: 'token_a' };
  const bob = { userId: 'bob', accountId: 'b', accountToken: 'token_b' };
  localStorage.setItem('boltaengi_account_auth_v1', JSON.stringify(alice));
  localStorage.setItem('boltaengi_account_auth_v2:bob', JSON.stringify(bob));
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'DELETE') return { ok: true, json: async () => ({ deleted: true }) };
    return { ok: true, json: async () => ({ account: alice, accountToken: alice.accountToken }) };
  };
  t.after(() => { globalThis.fetch = oldFetch; delete globalThis.localStorage; delete globalThis.sessionStorage; });
  const client = new OnlineBattleClient();
  await client.syncAccount({ userId: 'alice' });
  await client.deleteAccount();
  assert.equal(localStorage.getItem('boltaengi_account_auth_v1'), null);
  assert.equal(localStorage.getItem('boltaengi_account_auth_v2:alice'), null);
  assert.equal(JSON.parse(localStorage.getItem('boltaengi_account_auth_v2:bob')).accountToken, 'token_b');
});

test('a failed switch to another profile does not attach the previous account to a room', async (t) => {
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
  localStorage.setItem('boltaengi_account_auth_v1', JSON.stringify({ userId: 'alice', accountId: 'a', accountToken: 'token_a' }));
  const oldFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ roomId: 'rm_test', memberToken: 'room_token', slot: 0 }) };
  };
  t.after(() => { globalThis.fetch = oldFetch; delete globalThis.localStorage; delete globalThis.sessionStorage; });
  const client = new OnlineBattleClient();
  assert.equal(await client.syncAccount({ userId: 'bob' }), null);
  assert.equal(calls.length, 0);
  assert.equal(client.getActiveAccountAuth(), null);
  await client.createRoom({ name: 'Bob' });
  assert.equal(JSON.parse(calls.at(-1).options.body).accountToken, undefined);
  assert.equal(JSON.parse(localStorage.getItem('boltaengi_account_auth_v1')).userId, 'alice');
});
