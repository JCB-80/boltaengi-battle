import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startBattleServer } from '../server.mjs';

test('static allowlist blocks encoded path traversal and symlink escape', async (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'boltaengi-static-test-'));
  const root = path.join(parent, 'public');
  const outside = path.join(parent, 'outside');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'));
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(root, 'src', 'public.js'), 'public marker');
  fs.writeFileSync(path.join(root, 'data', 'secret.json'), 'private marker');
  fs.writeFileSync(path.join(outside, 'external.js'), 'external marker');
  let hasLink = true;
  try { fs.symlinkSync(outside, path.join(root, 'src', 'escape'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch { hasLink = false; }
  const store = { getStats: () => ({ accountCount: 0 }) };
  const server = await startBattleServer(0, '127.0.0.1', { staticRoot: root, store });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(parent, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const publicRes = await fetch(`${base}/battle/src/public.js`);
  assert.equal(publicRes.status, 200);
  assert.equal(await publicRes.text(), 'public marker');
  const traversal = await fetch(`${base}/battle/src/%2e%2e%2fdata/secret.json`);
  assert.equal(traversal.status, 404);
  if (hasLink) {
    const link = await fetch(`${base}/battle/src/escape/external.js`);
    assert.equal(link.status, 404);
  } else {
    t.diagnostic('OS did not permit creating a symlink; symlink escape case not executed');
  }
});
