import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';
import http from 'node:http';
import test from 'node:test';
import { jwtVerify, SignJWT } from 'jose';
import { createSocialAuth } from '../social-auth.mjs';

const issuerKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appleKey = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = { ...issuerKeys.publicKey.export({ format: 'jwk' }), kid: 'provider-key', alg: 'RS256', use: 'sig' };
const providers = {
  google: ['accounts.google.com', 'https://accounts.google.com', 'https://oauth2.googleapis.com/token'],
  apple: ['appleid.apple.com', 'https://appleid.apple.com', 'https://appleid.apple.com/auth/token'],
  kakao: ['kauth.kakao.com', null, 'https://kauth.kakao.com/oauth/token'],
  naver: ['nid.naver.com', null, 'https://nid.naver.com/oauth2.0/token'],
};

async function fixture(t, options = {}) {
  const recorded = [];
  let clock = Date.now();
  let active;
  const env = { BATTLE_AUTH_ORIGIN: 'https://game.example',
    BATTLE_GOOGLE_CLIENT_ID: 'google-game', BATTLE_GOOGLE_CLIENT_SECRET: 'google-server',
    BATTLE_NAVER_CLIENT_ID: 'naver-game', BATTLE_NAVER_CLIENT_SECRET: 'naver-server',
    BATTLE_KAKAO_CLIENT_ID: 'kakao-game', BATTLE_KAKAO_CLIENT_SECRET: 'kakao-server',
    BATTLE_APPLE_CLIENT_ID: 'apple-game', BATTLE_APPLE_TEAM_ID: 'team', BATTLE_APPLE_KEY_ID: 'game-key',
    BATTLE_APPLE_PRIVATE_KEY: appleKey.privateKey.export({ format: 'pem', type: 'pkcs8' }),
    ...options.env,
  };
  const fetchImpl = async (url, init) => {
    const path = String(url);
    if (path === 'https://www.googleapis.com/oauth2/v3/certs' || path === 'https://appleid.apple.com/auth/keys') {
      return Response.json({ keys: [jwk] });
    }
    if (path === 'https://kapi.kakao.com/v2/user/me' || path === 'https://openapi.naver.com/v1/nid/me') {
      assert.equal(init.headers.Authorization, 'Bearer provider-token');
      return Response.json(path.includes('kakao.com') ? { id: 123456789 } : { resultcode: '00', response: { id: 'stable-subject' } });
    }
    const { provider, destination } = active;
    const [, issuer, endpoint] = providers[provider];
    assert.equal(path, endpoint);
    assert.equal(init.method, 'POST');
    const form = new URLSearchParams(init.body);
    assert.equal(form.get('client_id'), provider + '-game');
    assert.equal(form.get('code'), 'test-authorization-code');
    assert.equal(form.get('redirect_uri'), destination.searchParams.get('redirect_uri'));
    if (provider === 'google' || provider === 'kakao') {
      assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'), destination.searchParams.get('code_challenge'));
      assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');
    }
    if (provider === 'apple') {
      const apple = await jwtVerify(form.get('client_secret'), appleKey.publicKey, { algorithms: ['ES256'], audience: issuer, issuer: 'team' });
      assert.equal(apple.payload.sub, 'apple-game');
      assert.equal(apple.protectedHeader.kid, 'game-key');
    } else assert.equal(form.get('client_secret'), provider + '-server');
    if (provider === 'naver') assert.equal(form.get('state'), destination.searchParams.get('state'));
    if (!issuer) return Response.json({ access_token: 'provider-token', token_type: 'Bearer' });
    const token = await new SignJWT({ nonce: destination.searchParams.get('nonce'), ...options.claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'provider-key' }).setSubject('stable-subject')
      .setIssuer(issuer).setAudience(options.audience || provider + '-game').setIssuedAt().setExpirationTime('5m').sign(issuerKeys.privateKey);
    return Response.json({ id_token: token });
  };
  const store = options.store || {
    authenticateAccount(token) { assert.equal(token, 'existing-account-token'); },
    loginWithSocialIdentity(identity) {
      recorded.push(identity);
      return { accountToken: 'new-account-token', account: { nickname: identity.nickname } };
    },
  };
  const handler = createSocialAuth({ store, env, fetchImpl, now: () => clock });
  const server = http.createServer(async (req, res) => {
    if (!(await handler(req, res))) res.writeHead(404).end();
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const query = async (route, body, extra = {}) => {
    const res = await fetch(base + '/api/battle/auth/' + route, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  async function open(provider, nickname = 'Seori') {
    const started = await query('start', { provider, nickname }, { Authorization: 'Bearer existing-account-token' });
    assert.equal(started.status, 200);
    const start = started.body;
    const entry = new URL(start.authorizeUrl);
    assert.equal(entry.origin, env.BATTLE_AUTH_ORIGIN);
    const response = await fetch(base + entry.pathname + entry.search, { redirect: 'manual' });
    assert.equal(response.status, 302);
    const cookie = response.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    if (provider === 'apple') assert.match(cookie, /SameSite=None/i);
    const destination = new URL(response.headers.get('location'));
    assert.equal(destination.hostname, providers[provider][0]);
    assert.equal(destination.searchParams.get('redirect_uri'), env.BATTLE_AUTH_ORIGIN + '/api/battle/auth/callback/' + provider);
    active = { provider, destination, cookie: cookie.split(';')[0], start };
    return active;
  }
  async function callback(params = { code: 'test-authorization-code' }, useCookie = true) {
    const { provider, destination, cookie } = active;
    const payload = new URLSearchParams({ state: destination.searchParams.get('state'), ...params });
    const endpoint = base + '/api/battle/auth/callback/' + provider;
    const headers = useCookie ? { Cookie: cookie } : {};
    return provider === 'apple'
      ? fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload })
      : fetch(endpoint + '?' + payload, { headers });
  }
  const claim = confirmationCode => query('claim', { claimToken: active.start.claimToken, confirmationCode });
  return { open, callback, claim, query, recorded, advance: ms => { clock += ms; } };
}

for (const provider of Object.keys(providers)) {
  test(provider + ' verifies the provider and requires the callback receipt before granting gameplay credentials', async t => {
    const app = await fixture(t);
    const flow = await app.open(provider);
    assert.deepEqual(await app.claim(), { status: 200, body: { pending: true } });
    const response = await app.callback();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const html = await response.text();
    assert.ok(html.includes(flow.start.flowId));
    assert.ok(!html.includes(flow.start.claimToken) && !html.includes('new-account-token'));
    const code = html.match(/<output[^>]*>(\d{6})<\/output>/)?.[1];
    assert.ok(code);
    assert.equal(app.recorded.length, 0);
    assert.equal((await app.claim()).body.confirmationRequired, true);
    const done = await app.claim(code);
    assert.equal(done.status, 200);
    assert.equal(done.body.accountToken, 'new-account-token');
    assert.deepEqual(app.recorded, [{ provider, subject: provider === 'kakao' ? '123456789' : 'stable-subject',
      nickname: 'Seori', accountToken: 'existing-account-token' }]);
    assert.equal((await app.claim(code)).status, 410);
  });
}

test('missing configuration omits a provider and returns a clear start status', async t => {
  const app = await fixture(t, { env: { BATTLE_AUTH_ORIGIN: 'http://public.example' } });
  assert.deepEqual((await app.query('providers')).body.providers, []);
  assert.equal((await app.query('start', { provider: 'google' })).status, 503);
});

test('callback requires its first-party browser cookie; provider cancellation closes the game handoff', async t => {
  const app = await fixture(t);
  await app.open('naver');
  assert.equal((await app.callback({}, false)).status, 410);
  assert.equal((await app.callback({ error: 'access_denied' })).status, 400);
  assert.equal((await app.claim()).body.error, 'AUTH_DENIED');
  assert.equal(app.recorded.length, 0);
});

test('expired flow cannot issue credentials and unsuccessful receipt entries are bounded', async t => {
  const app = await fixture(t);
  await app.open('kakao');
  const html = await (await app.callback()).text();
  const code = html.match(/<output[^>]*>(\d{6})<\/output>/)[1];
  const wrong = code === '000000' ? '000001' : '000000';
  for (let i = 0; i < 4; i++) assert.equal((await app.claim(wrong)).body.error, 'CONFIRMATION_CODE_INVALID');
  assert.equal((await app.claim(wrong)).status, 410);
  assert.equal((await app.claim(code)).status, 410);
  await app.open('google');
  app.advance(600001);
  assert.equal((await app.claim()).status, 410);
  assert.equal(app.recorded.length, 0);
});

test('unexpected ID token audience or nonce is reported as a failed verification', async t => {
  for (const mismatch of [{ audience: 'other-app' }, { claims: { nonce: 'different-session' } }]) {
    const app = await fixture(t, mismatch);
    await app.open('google');
    assert.equal((await app.callback()).status, 400);
    assert.equal((await app.claim()).body.error, 'AUTH_PROVIDER_FAILED');
    assert.equal(app.recorded.length, 0);
  }
});
