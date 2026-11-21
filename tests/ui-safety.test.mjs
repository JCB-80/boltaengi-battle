import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(process.env.BATTLE_UI_SOURCE || new URL('../src/main.js', import.meta.url), 'utf8');
const between = (start, end) => {
  const i = source.indexOf(start), j = source.indexOf(end, i);
  assert.ok(i >= 0 && j > i, `missing source section: ${start}`);
  return source.slice(i, j);
};
const escapeFunction = between('function escapePartyHtml(str) {', '\nfunction renderPartyRoomModal');
const roomFunction = between('let lastLanRoomsJson =', '\nrefreshLanOpenRooms();');
const rankingFunction = between('let lastLeaderboardJson =', '\nrefreshLeaderboard(true);');
const attack = '\"><img src=x onerror=alert(1)>&\'';
function box() { return { innerHTML: '', textContent: '', classList: { contains: () => false }, querySelectorAll: () => [] }; }
function harness(data) {
  const ui = { lanOpenRoomsList: box(), schoolOpenRoomsList: box(), leaderboardList: box(), schoolTopBanner: box(), lobbyScreen: box() };
  const context = { ui, onlineClient: {}, fetch: async () => ({ ok: true, json: async () => data }), loadUserProfile: () => null, shortSchoolLabel: x => x, URLSearchParams, currentLbScope: 'all', console };
  vm.createContext(context);
  vm.runInContext(escapeFunction + '\n' + roomFunction + '\n' + rankingFunction, context);
  return context;
}
function assertEscaped(html) {
  assert.ok(!html.includes(attack));
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;&amp;&#39;/);
}

test('room and leaderboard content and attributes escape attacker-controlled text', async () => {
  const ctx = harness({ rooms: [{ roomId:'r', roomTitle: attack, hostName: attack, inviteCode: attack, schoolName: attack, className: attack, scope:'class', playersCount: 1, maxPlayers:2 }], leaderboard: [{ rank: 4, userId: attack, nickname: attack, score: attack, matches:1, wins:1, winRate:100 }] });
  await vm.runInContext('refreshLanOpenRooms()', ctx);
  await vm.runInContext('refreshLeaderboard(true)', ctx);
  assertEscaped(ctx.ui.lanOpenRoomsList.innerHTML);
  assertEscaped(ctx.ui.schoolOpenRoomsList.innerHTML);
  assertEscaped(ctx.ui.leaderboardList.innerHTML);
});
