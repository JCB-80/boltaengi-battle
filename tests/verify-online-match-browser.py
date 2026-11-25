"""Exercise social signup, public rankings, nickname invitations and two- or three-player combat."""
import argparse
import os
from html import escape
from pathlib import Path
import socket
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import parse_qs, urlencode, urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ACCOUNT_XP = """() => {
    const profile = JSON.parse(localStorage.getItem('puffpuff_user_profile_v1'));
    const saved = localStorage.getItem('puffpuff_xp_progress_v2:' + encodeURIComponent(profile.userId));
    return JSON.parse(saved || '{}').xp || 0;
}"""
UPSTREAM_AUTHORIZE = 'https://nid.naver.com/oauth2.0/authorize'
START_SERVER = """
import { startBattleServer } from './server.mjs';
const [dataDir, rawPort] = process.argv.slice(1);
const port = Number(rawPort);
const origin = 'http://127.0.0.1:' + port;
const subjects = new Set(['guest-one', 'guest-two', 'guest-three']);
const socialAuth = {
  env: { BATTLE_AUTH_ORIGIN: origin, BATTLE_NAVER_CLIENT_ID: 'fixture', BATTLE_NAVER_CLIENT_SECRET: 'fixture' },
  fetchImpl: async (url, options) => {
    if (String(url) === 'https://nid.naver.com/oauth2.0/token') {
      const subject = options.body.get('code');
      if (subjects.has(subject)) return Response.json({ access_token: subject, token_type: 'Bearer' });
    }
    if (String(url) === 'https://openapi.naver.com/v1/nid/me') {
      const subject = new Headers(options.headers).get('authorization')?.replace(/^Bearer /, '');
      if (subjects.has(subject)) return Response.json({ resultcode: '00', response: { id: subject } });
    }
    throw new Error('Unexpected request to upstream provider fixture');
  },
};
const server = await startBattleServer(port, '127.0.0.1', { dataDir, socialAuth });
console.log(origin);
"""


def connect_browser(browser, origin, subject, manual=False):
    context = browser.new_context(viewport={'width': 390, 'height': 844}, locale='ko')
    if manual:
        # Android's external browser cannot broadcast to the game's WebView.
        context.add_init_script("Object.defineProperty(window, 'BroadcastChannel', {value: undefined})")

    def route_request(route):
        url = route.request.url
        if urlparse(url).path == '/api/battle/auth/authorize/naver' and url.startswith(origin + '/'):
            # Playwright cannot intercept the second hop of an HTTP redirect. Use the
            # real server's binding cookie and destination, then start a fresh navigation.
            reply = route.fetch(max_redirects=0)
            destination = reply.headers['location']
            assert reply.status == 302 and destination.startswith(UPSTREAM_AUTHORIZE + '?')
            return route.fulfill(status=200, headers={'Content-Type': 'text/html',
                'Set-Cookie': reply.headers['set-cookie']},
                body='<meta http-equiv="refresh" content="0; url=' + escape(destination) + '">')
        if url.startswith(origin + '/'):
            return route.continue_()
        if url.startswith(UPSTREAM_AUTHORIZE + '?'):
            options = parse_qs(urlparse(url).query)
            assert options['client_id'] == ['fixture']
            destination = options['redirect_uri'][0]
            assert destination == origin + '/api/battle/auth/callback/naver'
            state = options['state'][0]
            approve = destination + '?' + urlencode({'state': state, 'code': subject})
            decline = destination + '?' + urlencode({'state': state, 'error': 'access_denied'})
            # The test provider's consent screen navigates back to the game's actual callback.
            body = ('<!doctype html><meta charset="utf-8">' +
                    f'<a id="consent" href="{escape(approve)}">동의</a>' +
                    f'<a id="decline" href="{escape(decline)}">취소</a>')
            return route.fulfill(status=200, content_type='text/html', body=body)
        return route.abort()

    context.route('**/*', route_request)
    return context


def screenshot(page, name, directory_var='BATTLE_QA_SCREENSHOTS'):
    output = os.environ.get(directory_var)
    if output:
        directory = Path(output)
        directory.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(directory / name))


def register(page, origin, nickname, manual=False, check_cancel=False):
    page.goto(origin + '/battle/')
    page.locator('#openProfileBtn').click()
    sign_in = page.locator('[data-social-provider=naver]')
    expect(sign_in).to_be_enabled()
    if check_cancel:
        screenshot(page, 'boltaengi-social-login.png')
        with page.context.expect_page() as cancel_window:
            sign_in.click()
        cancelled = cancel_window.value
        cancelled.locator('#decline').click()
        expect(page.locator('#accountStatusText')).to_contain_text('취소', timeout=10000)
        expect(sign_in).to_be_enabled()
        cancelled.close()
    page.locator('#profNickname').fill(nickname)
    with page.context.expect_page() as new_window:
        sign_in.click()
    external = new_window.value
    external.locator('#consent').click()
    if manual:
        code = external.locator('#confirmation-code').inner_text()
        page.locator('#loginConfirmationCode').fill(code.strip())
        page.locator('#confirmLoginCodeBtn').click()
    expect(page.locator('#profileModal')).to_be_hidden(timeout=15000)
    if not external.is_closed():
        external.close()
    expect(page.locator('#profileSummaryText')).to_contain_text(nickname)
    page.locator('[data-hub=friend]').click()


def check_invitation(host, guest, host_name, guest_name, decline=False):
    if decline:
        host.locator('#inviteNickname').fill(guest_name)
        host.locator('#sendNicknameInviteBtn').click()
    else:
        host.locator('[data-hub=ranking]').click()
        host.locator('#rankingQuery').fill(guest_name[:2])
        results = host.locator('#leaderboardList .lobby-list-row')
        expect(results).to_have_count(1)
        expect(results).to_contain_text(guest_name)
        results.get_by_role('button').click()
    expect(host.locator('#partyRoomModal')).to_be_visible()
    expect(guest.locator('#challengeAlertText')).to_contain_text(host_name, timeout=10000)
    if decline:
        guest.locator('#declineChallengeBtn').click()
        expect(host.locator('#onlineRoomStatusText')).to_contain_text('거절', timeout=10000)
        expect(host.locator('#partyRoomModal')).to_be_hidden()
        return
    guest.locator('#acceptChallengeBtn').click()
    for page in (host, guest):
        expect(page.locator('#gameScreen')).to_be_visible()
        expect(page.locator('#gameOverModal')).to_be_hidden()


def play_turn(host, guest):
    actor = host if host.locator('#fireActionBtn').is_enabled() else guest
    actor.locator('#fireActionBtn').click()
    expect(actor.locator('#fireActionBtn.air-mode')).to_be_enabled()
    with actor.expect_response(lambda r: r.url.endswith('/action') and r.request.post_data_json['type'] == 'AIR_TRIGGER') as air:
        actor.keyboard.press('Space')
    assert air.value.ok
    for page in (host, guest):
        expect(page.locator('#turnTimelineBadge')).to_contain_text('T2')


def browse_as_guest(browser, origin, host_name, guest_name):
    context = connect_browser(browser, origin, 'guest-three')
    try:
        spectator = context.new_page()
        spectator.goto(origin + '/battle/')
        spectator.locator('[data-hub=ranking]').click()
        ranks = spectator.locator('#leaderboardList .lobby-list-row')
        expect(ranks).to_have_count(2)
        expect(ranks.first).to_contain_text(host_name)
        field = spectator.locator('#rankingQuery')
        field.fill('결과없음')
        expect(spectator.locator('#rankingStatus')).to_contain_text('일치하는 닉네임이 없어요')
        expect(ranks).to_have_count(0)
        field.fill(guest_name[:2])
        expect(ranks).to_have_count(1)
        expect(ranks).to_contain_text(guest_name)
        expect(spectator.locator('#profileModal')).to_be_hidden()
        expect(spectator.locator('#showMyRank')).to_be_hidden()
        spectator.locator('#clearRankingQuery').click()
        expect(ranks).to_have_count(2)
    finally:
        context.close()


def check_match(browser, origin):
    errors = []
    contexts = [connect_browser(browser, origin, 'guest-one'), connect_browser(browser, origin, 'guest-two', manual=True)]
    try:
        host, guest = [context.new_page() for context in contexts]
        host_name, guest_name = '모찌구름', '단풍별'
        for page, nickname, manual in [(host, host_name, False), (guest, guest_name, True)]:
            page.on('pageerror', lambda error: errors.append(str(error)))
            register(page, origin, nickname, manual, check_cancel=not manual)

        guest.reload()
        expect(guest.locator('#profileSummaryText')).to_contain_text(guest_name)
        check_invitation(host, guest, host_name, guest_name, decline=True)
        check_invitation(host, guest, host_name, guest_name)
        play_turn(host, guest)
        screenshot(host, 'online_2clients_host_turn2.png', 'BATTLE_QA_MATCH_SCREENSHOTS')
        screenshot(guest, 'online_2clients_guest_turn2.png', 'BATTLE_QA_MATCH_SCREENSHOTS')
        guest.reload()
        expect(guest.locator('#gameScreen')).to_be_visible()
        expect(guest.locator('#turnTimelineBadge')).to_contain_text('T2')
        screenshot(guest, 'online_2clients_guest_reloaded.png', 'BATTLE_QA_MATCH_SCREENSHOTS')
        guest.locator('#backToLobbyBtn').click()
        expect(host.locator('#gameOverModal')).to_be_visible()
        host.wait_for_function(ACCOUNT_XP)
        xp = host.evaluate(ACCOUNT_XP)
        for _ in range(2):
            host.reload()
            expect(host.locator('#gameOverModal')).to_be_visible()
            assert host.evaluate(ACCOUNT_XP) == xp
        host.locator('#modalRestartBtn').click()
        expect(guest.locator('#challengeAlertText')).to_contain_text(host_name, timeout=10000)
        guest.locator('#acceptChallengeBtn').click()
        for page in (host, guest):
            expect(page.locator('#gameScreen')).to_be_visible()
            expect(page.locator('#turnTimelineBadge')).to_contain_text('T1')
        guest.locator('#backToLobbyBtn').click()
        expect(host.locator('#gameOverModal')).to_be_visible()
        host.locator('#modalLobbyBtn').click()

        host.locator('[data-hub=ranking]').click()
        ranking = host.locator('#leaderboardList')
        expect(ranking).to_contain_text(host_name)
        expect(ranking).to_contain_text(guest_name)
        with host.expect_response(lambda r: urlparse(r.url).path.endswith('/leaderboard') and
                                  parse_qs(urlparse(r.url).query).get('q') == [guest_name[:2]] and r.ok) as response:
            host.locator('#rankingQuery').fill(guest_name[:2])
        rows = response.value.json()['leaderboard']
        expect(ranking.locator('.lobby-list-row')).to_have_count(1)
        expect(ranking).to_contain_text(guest_name)
        for row in rows:
            assert not {'userId', 'accountId', 'provider', 'providerSubject', 'schoolName', 'className'}.intersection(row)
        screenshot(host, 'boltaengi-nickname-search.png')
        host.locator('#showMyRank').click()
        expect(host.locator('#rankingStatus')).to_have_text('내 전체 순위')
        expect(ranking.locator('.lobby-list-row')).to_have_count(1)
        expect(ranking.locator('.lobby-list-row').first).to_contain_text(host_name)
        expect(ranking.locator('.lobby-list-row').first).to_contain_text('2전 2승')

        browse_as_guest(browser, origin, host_name, guest_name)
        host.locator('[data-hub=friend]').click()
        host.locator('#inviteNickname').fill(guest_name)
        host.locator('#nicknameInviteForm').evaluate("el => el.scrollIntoView({block: 'center'})")
        screenshot(host, 'boltaengi-nickname-lobby.png')
        assert not errors, errors
    finally:
        for context in contexts:
            context.close()


def check_three_players(browser, origin):
    contexts = [connect_browser(browser, origin, subject, manual=True)
                for subject in ('guest-one', 'guest-two', 'guest-three')]
    errors = []
    try:
        pages = [context.new_page() for context in contexts]
        host, guest, survivor = pages
        for page, nickname in zip(pages, ['모찌구름', '단풍별', '민트콩']):
            page.on('pageerror', lambda error: errors.append(str(error)))
            register(page, origin, nickname, manual=True)
        host.locator('#onlineRoomTitleInput').fill('세 친구 대전')
        host.locator('#onlineMaxPlayers').select_option('3')
        host.locator('#createOnlineRoomBtn').click()
        expect(host.locator('#partyRoomModal')).to_be_visible()
        code = host.locator('#partyRoomCode').inner_text()
        guest.locator('#onlineInviteInput').fill(code)
        guest.locator('#joinOnlineRoomBtn').click()
        for page in (host, guest):
            expect(page.locator('#partySlotsGrid .party-slot-card.joined')).to_have_count(2)
            expect(page.locator('#gameScreen')).to_be_hidden()
        screenshot(host, 'party_room_3d_ui.png', 'BATTLE_QA_MATCH_SCREENSHOTS')
        survivor.locator('#lanOpenRoomsList').get_by_role('button', name='입장').click()
        for page in pages:
            expect(page.locator('#gameScreen')).to_be_visible()
            expect(page.locator('#partyRoomModal')).to_be_hidden()
        screenshot(host, 'commercial_3d_char_fx.png', 'BATTLE_QA_MATCH_SCREENSHOTS')
        visited = set()
        for turn in range(1, 4):
            active = [i for i, p in enumerate(pages) if p.locator('#fireActionBtn').is_enabled()]
            assert len(active) == 1 and active[0] not in visited, (turn, active, visited)
            visited.update(active)
            pages[active[0]].locator('#fireActionBtn').click()
            for page in pages:
                expect(page.locator('#turnTimelineBadge')).to_contain_text('T' + str(turn + 1), timeout=10000)
        host.locator('#backToLobbyBtn').click()
        expect(survivor.locator('#gameOverModal')).to_be_hidden()
        guest.locator('#backToLobbyBtn').click()
        expect(survivor.locator('#winnerHeadline')).to_contain_text('민트콩')
        expect(survivor.locator('#gameOverModal')).to_be_visible()
        assert not errors, errors
    finally:
        for context in contexts:
            context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--players', type=int, choices=(2, 3), help='run one room size')
    players = parser.parse_args().players
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    with TemporaryDirectory() as data_dir, subprocess.Popen(
        ['node', '--input-type=module', '-e', START_SERVER, data_dir, str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, text=True,
    ) as server:
        try:
            origin = server.stdout.readline().strip()
            assert origin == f'http://127.0.0.1:{port}'
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    executable_path=os.environ.get('BATTLE_CHROMIUM_PATH'),
                    args=['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'],
                )
                try:
                    if players in (None, 2):
                        check_match(browser, origin)
                        print('Passed 2P social signup, callback, invitation, combat, reload, XP, ranking and rematch.')
                    if players in (None, 3):
                        check_three_players(browser, origin)
                        print('Passed 3P public listing, code entry, wait for 3, turn rotation and forfeits.')
                finally:
                    browser.close()
        finally:
            server.terminate()
