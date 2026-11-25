import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOpenRooms, renderRankings } from '../src/lobbyLists.js';

function element(tagName) {
  return {
    tagName,
    children: [],
    classList: { toggle() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren() { this.children = []; },
    addEventListener(event, handler) { this[event] = handler; },
    setAttribute(name, value) { this[name] = value; },
    set innerHTML(_) { throw new Error('Use text nodes for player-controlled labels'); },
  };
}

test('room and ranking labels render as text and buttons use the room code or nickname', (t) => {
  globalThis.document = { createElement: element };
  t.after(() => { delete globalThis.document; });
  const rooms = element('div');
  const ranking = element('div');
  const nickname = '별콩';
  const roomTitle = '둘이서 <별 & 달>';
  const joins = [], invites = [];
  renderOpenRooms(rooms, [{ roomTitle, hostName: nickname, inviteCode: '01A2BC', playersCount: 1, maxPlayers: 2 }], code => joins.push(code));
  renderRankings(ranking, [{ nickname, userId: 'private-account', rank: 2, matches: 3, wins: 2, score: 210, winRate: 67 }], '달콩', nick => invites.push(nick));

  const [roomBody, join] = rooms.children[0].children;
  assert.equal(roomBody.children[0].textContent, roomTitle);
  assert.equal(roomBody.children[1].textContent, '별콩 · 1/2명');
  const [rankBody, invite] = ranking.children[0].children;
  assert.equal(rankBody.children[0].textContent, '2위 · 별콩');
  assert.match(rankBody.children[1].textContent, /210점 · 3전 2승/);
  assert.equal(invite['aria-label'], '별콩님 초대');
  join.click();
  invite.click();
  assert.deepEqual(joins, ['01A2BC']);
  assert.deepEqual(invites, [nickname]);
});
