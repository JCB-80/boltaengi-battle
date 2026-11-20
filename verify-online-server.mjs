import assert from 'node:assert/strict';
import { startBattleServer } from './server.mjs';

const srv = await startBattleServer(0, '127.0.0.1');
const base = `http://127.0.0.1:${srv.address().port}`;

try {
  // 1) Health & no-store check
  const hRes = await fetch(`${base}/api/battle/health`);
  assert.equal(hRes.status, 200);
  assert.equal(hRes.headers.get('cache-control'), 'no-store');
  const hData = await hRes.json();
  assert.equal(hData.ok, true);

  // 2) Create -> Join -> Approve
  const cRes = await fetch(`${base}/api/battle/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapPreset: 'archipelago', charKey: 'M01_MOCHI', name: '호스트모찌' }),
  });
  assert.equal(cRes.status, 201);
  const created = await cRes.json();
  assert.ok(created.roomId && created.inviteCode && created.memberToken);

  const jRes = await fetch(`${base}/api/battle/rooms/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: created.inviteCode, charKey: 'M05_SODAPIN', name: '게스트아라핀' }),
  });
  assert.equal(jRes.status, 200);
  const joined = await jRes.json();
  assert.equal(joined.roomId, created.roomId);

  // Guest cannot approve
  const badApprove = await fetch(`${base}/api/battle/rooms/${created.roomId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${joined.memberToken}` },
    body: '{}',
  });
  assert.equal(badApprove.status, 403);

  // Host approves
  const aRes = await fetch(`${base}/api/battle/rooms/${created.roomId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${created.memberToken}` },
    body: '{}',
  });
  assert.equal(aRes.status, 200);

  // 3) Unauthorized / Wrong turn / Invalid angle / Replay rejection
  const unauth = await fetch(`${base}/api/battle/rooms/${created.roomId}/state`);
  assert.equal(unauth.status, 401);

  const wrongTurn = await fetch(`${base}/api/battle/rooms/${created.roomId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${joined.memberToken}` },
    body: JSON.stringify({ seq: 1, type: 'FIRE', elevation: 45, power: 50 }),
  });
  assert.equal(wrongTurn.status, 409);

  const badAngle = await fetch(`${base}/api/battle/rooms/${created.roomId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${created.memberToken}` },
    body: JSON.stringify({ seq: 1, type: 'FIRE', elevation: 999, power: 50 }),
  });
  assert.equal(badAngle.status, 409);

  // 4) Valid Host FIRE -> crater carved -> Turn 2 switch
  const fireRes = await fetch(`${base}/api/battle/rooms/${created.roomId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${created.memberToken}` },
    body: JSON.stringify({ seq: 1, type: 'FIRE', elevation: 45, power: 36 }),
  });
  assert.equal(fireRes.status, 200);

  // Replay seq=1 rejected
  const replayRes = await fetch(`${base}/api/battle/rooms/${created.roomId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${created.memberToken}` },
    body: JSON.stringify({ seq: 1, type: 'MOVE', dir: 1 }),
  });
  assert.equal(replayRes.status, 409);

  // Wait up to 3.5s for server simulation to finish flight & settle to Turn 2
  let finalSnap = null;
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const stRes = await fetch(`${base}/api/battle/rooms/${created.roomId}/state`, {
      headers: { Authorization: `Bearer ${created.memberToken}` },
    });
    const st = await stRes.json();
    if (st.snapshot?.turnNumber >= 2 && st.snapshot?.phase === 'AIM') {
      finalSnap = st.snapshot;
      break;
    }
  }
  assert.ok(finalSnap, 'Turn 2 AIM not reached');
  assert.equal(finalSnap.activeSlot, 1);
  assert.ok(finalSnap.craters.length >= 1, 'Expected at least 1 crater carved');

  console.log('SERVER_AUTHORITY_CHECKS_PASSED:', {
    turnNumber: finalSnap.turnNumber,
    activeSlot: finalSnap.activeSlot,
    craters: finalSnap.craters.length,
  });
} finally {
  srv.close();
}
