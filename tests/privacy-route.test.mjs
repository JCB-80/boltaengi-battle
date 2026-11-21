import test from 'node:test';
import assert from 'node:assert/strict';
import { startBattleServer } from '../server.mjs';

test('the lobby and external privacy page expose the account-deletion instructions', async (t) => {
  const store = { getStats: () => ({ accountCount: 0 }) };
  const server = await startBattleServer(0, '127.0.0.1', { store });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const lobby = await fetch(`${base}/battle/`);
  assert.equal(lobby.status, 200);
  assert.match(await lobby.text(), /href="\.\/privacy\.html#account-deletion"/);
  const privacy = await fetch(`${base}/battle/privacy.html`);
  assert.equal(privacy.status, 200);
  const html = await privacy.text();
  assert.match(html, /id="account-deletion"/);
  assert.match(html, /mailto:seo4401@gmail\.com/);
  assert.match(html, /계정 및 서버 전적 삭제/);
});
