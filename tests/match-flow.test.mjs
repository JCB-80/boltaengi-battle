import assert from 'node:assert/strict';
import test from 'node:test';
import Matter from 'matter-js';
import { OnlineSimulation } from '../server-sim.mjs';
import { WORLD } from '../src/config.js';

// Exercise the game loop without a GPU. Only browser storage, image loading,
// and the map surface are replaced; entities and turn resolution are real.
globalThis.window = { Matter };
globalThis.Image = class {};
globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { GameEngine } = await import('../src/gameEngine.js');

function engineForTest() {
  const renderer = { render() {}, addShake() {} };
  const engine = new GameEngine({ renderer });
  Object.assign(engine.terrain, {
    generate: () => [],
    findSafeSpawnX: x => x,
    findTopSurface: () => 500,
    findSurfaceNear: () => 500,
    isSolid: () => false,
    getSlopeAngle: () => 0,
  });
  engine.structures.populateForPreset = () => {};
  return engine;
}

test('opening the lobby and returning from a match do not run match physics', () => {
  const engine = engineForTest();
  assert.equal(engine.phase, 'IDLE');
  engine.tick(new Set());
  assert.equal(engine.matterEngine.timing.timestamp, 0);
  engine.startMatch({ gameMode: '1v1_local' });
  engine.phase = 'IDLE';
  const x = engine.skyBox.x;
  engine.tick(new Set());
  assert.equal(engine.skyBox.x, x);
});

test('a knocked-out profile wins with its teammate, gets its base XP once, and can rematch', () => {
  const engine = engineForTest();
  engine.startMatch({ gameMode: '2v2_team' });
  for (const index of [0, 1, 3]) engine.carts[index].takeDamage(999);
  assert.equal(engine.checkVictory(), true);
  assert.equal(engine.winnerText, 'A팀 승리!');
  assert.equal(engine.didLocalPlayerWin(), true);
  assert.equal(engine.playerXp, 50);
  assert.equal(engine.checkVictory(), true);
  assert.equal(engine.playerXp, 50);
  const physicsTime = engine.matterEngine.timing.timestamp;
  engine.tick(new Set());
  assert.equal(engine.matterEngine.timing.timestamp, physicsTime);
  engine.lastTornadoTurn = 30;
  engine.tornado.alertFrames = 80;
  engine.pityCutin.active = true;
  engine.startMatch({ gameMode: '1v1_local' });
  assert.equal(engine.phase, 'AIM');
  assert.equal(engine.lastTornadoTurn, 0);
  assert.equal(engine.tornado.alertFrames, 0);
  assert.equal(engine.pityCutin.active, false);
});

test('a hotseat win by the second player counts as a loss for the first profile', () => {
  const engine = engineForTest();
  engine.startMatch({ gameMode: '1v1_local' });
  engine.carts[0].takeDamage(999);
  assert.equal(engine.checkVictory(), true);
  assert.equal(engine.didLocalPlayerWin(), false);
  assert.equal(engine.playerXp, 15);
  engine.isRemoteMatch = true;
  engine.carts[0].controller = 'remote';
  assert.equal(engine.didLocalPlayerWin(), true);
  engine.carts[1].takeDamage(999);
  assert.equal(engine.didLocalPlayerWin(), false);
});

test('a last opponent KO during local aiming ends the match without another shot', () => {
  const engine = engineForTest();
  engine.startMatch({ gameMode: '1v1_local' });
  engine.carts[1].takeDamage(999);
  for (let i = 0; i < 30; i++) engine.tick(new Set());
  assert.equal(engine.phase, 'GAME_OVER');
  assert.equal(engine.turnNumber, 1);
});

test('online falls during aiming resolve promptly and skip eliminated turns', () => {
  for (const count of [2, 3]) {
    const sim = new OnlineSimulation({ players: Array.from({ length: count }, (_, i) => ({ name: 'P' + i })) });
    const fallen = sim.carts[sim.activeSlot];
    sim.terrain.findSurfaceNear = (x, y) => x === fallen.x ? null : y;
    fallen.y = WORLD.SEA_LEVEL;
    for (let i = 0; i < 30; i++) sim.tick();
    assert.equal(fallen.alive, false);
    if (count === 2) {
      assert.equal(sim.phase, 'GAME_OVER');
      assert.equal(sim.winnerSlot, sim.carts.find(c => c.alive).slot);
    } else {
      assert.equal(sim.phase, 'AIM');
      assert.equal(sim.turnNumber, 2);
      assert.notEqual(sim.activeSlot, fallen.slot);
    }
  }
});

test('online settlement waits for a second falling survivor before assigning a winner', () => {
  const sim = new OnlineSimulation();
  sim.terrain.findSurfaceNear = () => null;
  sim.carts[0].y = WORLD.SEA_LEVEL;
  sim.carts[1].y = WORLD.SEA_LEVEL - 400;
  for (let i = 0; i < 85; i++) sim.tick();
  assert.equal(sim.phase, 'GAME_OVER');
  assert.equal(sim.winnerSlot, null);
  assert.equal(sim.winnerText, '무승부!');
});

test('online reward receipt and XP survive refresh, including interruption of the legacy mirror', t => {
  const storage = new Map([['puffpuff_xp', '45']]);
  t.mock.method(localStorage, 'getItem', key => storage.get(key) ?? null);
  t.mock.method(localStorage, 'setItem', (key, value) => {
    if (key === 'puffpuff_xp') throw new Error('storage interrupted after authoritative save');
    storage.set(key, value);
  });

  const first = engineForTest();
  assert.equal(first.playerXp, 45);
  first.grantXp(120, '승리', 'room-a:1');
  assert.equal(first.playerXp, 165);
  for (let refresh = 0; refresh < 2; refresh++) {
    const restored = engineForTest();
    restored.grantXp(120, '승리', 'room-a:1');
    assert.equal(restored.playerXp, 165);
  }
  const nextRoom = engineForTest();
  nextRoom.grantXp(35, '참가', 'room-b:0');
  assert.equal(nextRoom.playerXp, 200);
  first.grantXp(120, '승리', 'room-a:1');
  assert.equal(first.playerXp, 200);
  first.grantXp(15, '명중');
  assert.equal(engineForTest().playerXp, 215);
});
