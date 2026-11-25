import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { OnlineSimulation } from '../server-sim.mjs';

globalThis.window = { Matter };
const { OnlineBattleClient } = await import('../src/onlineAdapter.js');

function fixture() {
  const client = new OnlineBattleClient();
  const sim = new OnlineSimulation({
    mapPreset: 'bridge',
    players: [{ charKey: 'M04_BAMTOL', name: '단지' }, { charKey: 'M05_SODAPIN', name: '소다' }],
  });
  client.slot = sim.activeSlot;
  const engine = {
    carts: [{ displayName: '이전 1P' }, { displayName: '이전 2P' }],
    terrain: { generate() {}, carveCrater() { return 1; } },
    structures: {}, notifyHud() {},
  };
  return { client, engine, sim };
}

test('joining a new room and restoring mid-turn replaces a same-size roster and restores aim', () => {
  const { client, engine, sim } = fixture();
  const snap = sim.snapshot();
  snap.carts[snap.activeSlot].aimPower = 71;
  client.applySnapshotToEngine(engine, snap);
  assert.deepEqual(engine.carts.map(c => [c.displayName, c.spec.id]), [['단지', 'M04_BAMTOL'], ['소다', 'M05_SODAPIN']]);
  assert.equal(engine.activeActor.aimPower, 71);
  engine.activeActor.aimPower = 58;
  engine.activeActor.useUltimate = true;
  client.applySnapshotToEngine(engine, snap);
  assert.equal(engine.activeActor.aimPower, 58);
  assert.equal(engine.activeActor.useUltimate, true);
});

test('online projectile trail and air-trigger availability follow the same server projectile', () => {
  const { client, engine, sim } = fixture();
  sim.act(sim.activeSlot, { type: 'FIRE' });
  const shot = sim.projectiles[0];
  shot.ageFrames = 3;
  client.applySnapshotToEngine(engine, sim.snapshot());
  const drawn = engine.projectiles[0];
  assert.ok(drawn.canAirTrigger());
  drawn.trail.push({ x: drawn.x, y: drawn.y });
  client.applySnapshotToEngine(engine, sim.snapshot());
  assert.equal(engine.projectiles[0], drawn);
  assert.equal(drawn.trail.length, 1);
  sim.act(sim.activeSlot, { type: 'AIR_TRIGGER' });
  client.applySnapshotToEngine(engine, sim.snapshot());
  assert.ok(engine.projectiles.length > 0 && engine.projectiles.every(p => !p.canAirTrigger()));
});

test('online ultimate selection is applied at launch only with a full meter', () => {
  for (const gauge of [35, 100]) {
    const { sim } = fixture();
    const actor = sim.carts[sim.activeSlot];
    actor.ultGauge = gauge;
    sim.act(sim.activeSlot, { type: 'FIRE', useUltimate: true });
    assert.equal(sim.projectiles[0].isUltimate, gauge === 100);
    assert.equal(actor.ultGauge, gauge === 100 ? 0 : gauge);
  }
});

test('rejoining reconstructs craters silently even if the final map image loads late', () => {
  const { client, engine, sim } = fixture();
  const cuts = [];
  engine.terrain.pendingImageApply = true;
  engine.terrain.carveCrater = (...cut) => { cuts.push(cut); return 1; };
  const state = { ...sim.snapshot(), craters: [{ id: 1, cx: 160, cy: 200, r: 60 }] };
  client.applySnapshotToEngine(engine, state);
  client.applySnapshotToEngine(engine, state);
  assert.equal(cuts.length, 1);
  engine.terrain.pendingImageApply = false;
  client.applySnapshotToEngine(engine, state);
  client.applySnapshotToEngine(engine, state);
  assert.deepEqual(cuts, [[160, 200, 60], [160, 200, 60]]);
});
