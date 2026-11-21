import assert from 'node:assert/strict';

// The renderer's terrain dependency expects Matter on window; this test exercises
// canvas commands only and does not start a browser or touch the user's data.
globalThis.window = { Matter: {} };
globalThis.Image = class {
  constructor() { this.width = 512; this.height = 512; }
  set src(value) { this.onload?.(); }
};
const { GameRenderer } = await import('../src/renderer.js');

function recordingContext() {
  const commands = [];
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'commands') return commands;
      if (key in target) return target[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'measureText') return () => ({ width: 30 });
      if (key === 'ellipse') return (...args) => {
        assert.ok(args[2] >= 0 && args[3] >= 0, 'ellipse radii must not become negative during recoil');
        commands.push({ op: key, args });
      };
      return (...args) => commands.push({ op: key, args });
    },
  });
  return ctx;
}

function drawAim(facing, elevation) {
  const renderer = Object.create(GameRenderer.prototype);
  const ctx = recordingContext();
  const cart = {
    x: 500, y: 400, facing, aimElevation: elevation, lastElevation: null,
    selectedShell: 'ACORN_SPLIT',
    getMuzzlePosition: () => ({ baseX: 500 + facing * 8, baseY: 376, x: 500, y: 360 }),
    getLaunchVelocity: () => ({ vx: facing * 10, vy: -10 }),
  };
  renderer.drawFloatingAimHUD(ctx, cart, 0, 'CLEAR', null);
  const marker = ctx.commands.find(({ op, args }) => op === 'arc' && args[2] === 4);
  const label = ctx.commands.find(({ op }) => op === 'fillText');
  assert.ok(marker, 'current angle marker must be drawn');
  assert.equal(label.args[0], `${elevation}°`);
  return marker.args;
}

for (const degrees of [5, 45, 85]) {
  const right = drawAim(1, degrees);
  const left = drawAim(-1, degrees);
  const radians = degrees * Math.PI / 180;
  assert.ok(Math.abs(right[0] - (500 + Math.cos(radians) * 67)) < 1e-8);
  assert.ok(Math.abs(left[0] - (500 - Math.cos(radians) * 67)) < 1e-8);
  assert.ok(Math.abs(right[1] - (354 - Math.sin(radians) * 67)) < 1e-8);
  assert.equal(left[1], right[1]);
}
console.log('PASS: aim gauge follows the character and mirrors 5°, 45°, 85°');

// Exercise the real sprite/cheek path at light and strong draw and through an
// ultimate's recoil (> 1). The projectile's position follows the drawn cheek.
const renderer = Object.create(GameRenderer.prototype);
renderer.recoilProgress = new WeakMap();
renderer.aimCheekAnchors = new Map();
const cart = {
  id: 'cart_0', x: 500, y: 400, facing: 1, recoil: 0, tiltAngle: 0, wheelSpin: 0,
  slotIndex: 0, aimElevation: 45, aimPower: 20, useUltimate: false,
  powerUpTurns: 0, skillMode: 'NORMAL', selectedShell: 'ACORN_SPLIT',
  hp: 120, maxHp: 120, mood: 'idle', spec: { id: 'M01_MOCHI', name: '모찌' },
  getMuzzlePosition: () => ({ baseX: 0, baseY: 0 }),
};
function orbAt(power) {
  cart.aimPower = power;
  const ctx = recordingContext();
  renderer.drawCoasterCart(ctx, cart, true, 'AIM', 0, { active: true, currentX: -power, currentY: 0 });
  const radius = 4.5 + Math.max(0, Math.min(1, (power - 4) / 103));
  const orb = ctx.commands.find(({ op, args }) => op === 'arc' && Math.abs(args[2] - radius) < 1e-8);
  assert.ok(orb, 'loaded marble must be drawn');
  return orb.args;
}
const light = orbAt(20);
const strong = orbAt(80);
assert.ok(strong[0] < light[0], 'stronger pull moves the marble back');
assert.ok(strong[1] > light[1], 'marble tracks the drawn cheek opposite to the aim');
const idleContext = recordingContext();
renderer.drawCoasterCart(idleContext, cart, true, 'AIM', 0, { active: false });
assert.equal(idleContext.commands.filter(({ op }) => op === 'drawImage').length, 1,
  'the cheek is not warped before the player begins dragging');
const heldContext = recordingContext();
renderer.drawCoasterCart(heldContext, cart, true, 'AIM', 0, { active: true, currentX: -80, currentY: 0 });
assert.ok(heldContext.commands.filter(({ op }) => op === 'drawImage').length > 1,
  'a real pull deforms the cheek mesh');
const anchor = renderer.aimCheekAnchors.get(cart.id);
assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y), 'world-space cheek anchor is available for the launch transition');
const projectileCtx = recordingContext();
renderer.drawProjectile(projectileCtx, {
  x: 550, y: 340, vx: 10, vy: -10, trail: [], shellKey: 'ACORN_SPLIT',
  canAirTrigger: () => false,
}, 0, anchor);
assert.deepEqual(projectileCtx.commands.find(({ op }) => op === 'translate').args, [anchor.x, anchor.y]);
cart.useUltimate = true;
const recoilMotion = [];
for (const recoil of [1.35, 1.1, 0.8, 0.4, 0]) {
  cart.recoil = recoil;
  const context = recordingContext();
  renderer.drawCoasterCart(context, cart, true, 'FLIGHT', 0);
  recoilMotion.push(context.commands.filter(({ op }) => op === 'translate')[1].args[0]);
}
assert.ok(recoilMotion[0] < 0 && recoilMotion[1] > 0,
  'button/AI firing animates a brief pull followed by a forward snap');
console.log('PASS: marble follows cheek pull; ultimate recoil renders through recovery');
