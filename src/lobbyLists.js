function lobbyListRow() {
  const row = document.createElement('div');
  row.className = 'lobby-list-row';
  const body = document.createElement('div');
  const name = document.createElement('strong');
  name.className = 'lobby-list-name';
  const stats = document.createElement('span');
  stats.className = 'lobby-list-stats';
  body.append(name, stats);
  row.append(body);
  return { row, name, stats };
}

function lobbyButton(label, click) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'social-mini-btn';
  button.textContent = label;
  button.addEventListener('click', click);
  return button;
}

export function renderOpenRooms(container, list, onJoin) {
  container.replaceChildren();
  if (!list.length) container.textContent = '아직 열린 공개 방이 없어요.';
  for (const room of list) {
    const { row, name, stats } = lobbyListRow();
    name.textContent = room.roomTitle || `${room.hostName}의 방`;
    stats.textContent = `${room.hostName} · ${room.playersCount}/${room.maxPlayers}명`;
    row.append(lobbyButton('입장', () => onJoin(room.inviteCode)));
    container.append(row);
  }
}

export function renderRankings(container, list, myNickname, onInvite) {
  container.replaceChildren();
  for (const item of list) {
    const { row, name, stats } = lobbyListRow();
    const myRow = item.nickname === myNickname;
    row.classList.toggle('is-me', myRow);
    name.textContent = `${item.rank}위 · ${item.nickname}${myRow ? ' (나)' : ''}`;
    stats.textContent = `${item.rankBadge || '🌱'} Lv.${item.rankLevel || 1} · ${item.score}점 · ${item.matches}전 ${item.wins}승 (${item.winRate}%)`;
    if (!myRow) {
      const invite = lobbyButton('초대', () => onInvite(item.nickname));
      invite.setAttribute('aria-label', `${item.nickname}님 초대`);
      row.append(invite);
    }
    container.append(row);
  }
}
