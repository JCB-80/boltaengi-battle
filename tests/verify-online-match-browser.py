"""Exercise a two-player room, active and finished reloads, and a real online rematch."""
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
START_SERVER = """
import { startBattleServer } from './server.mjs';
const server = await startBattleServer(0, '127.0.0.1', { dataDir: process.argv[1] });
console.log(server.address().port);
"""


def register(page, url, name):
    page.goto(url)
    if not page.locator('#profileModal').is_visible():
        page.locator('#openProfileBtn').click()
    page.locator('#profUserId').fill(name)
    page.locator('#profNickname').fill(name)
    page.locator('#profSchool').fill('테스트학교')
    page.locator('#profGradeNum').fill('3')
    page.locator('#profClassNum').fill('1')
    with page.expect_response(lambda res: res.url.endswith('/accounts') and res.request.method == 'POST') as response:
        page.locator('#profileForm button[type=submit]').click()
    assert response.value.ok
    page.locator('[data-hub=friend]').click()


def join(page, code):
    page.locator('#onlineInviteInput').fill(code)
    page.locator('#joinOnlineRoomBtn').click()
    expect(page.locator('#gameScreen')).to_be_visible()


def check_match(browser, url):
    errors = []
    contexts = [browser.new_context(viewport={'width': 844, 'height': 390}) for _ in range(2)]
    host, guest = [context.new_page() for context in contexts]
    for page, name in [(host, 'roomhost'), (guest, 'roomguest')]:
        page.on('pageerror', lambda error: errors.append(str(error)))
        register(page, url, name)
    host.locator('#createOnlineRoomBtn').click()
    expect(host.locator('#partyRoomModal')).to_be_visible()
    first_code = host.locator('#partyRoomCode').inner_text()
    join(guest, first_code)
    expect(host.locator('#gameScreen')).to_be_visible()
    actor = host if host.locator('#fireActionBtn').is_enabled() else guest
    actor.locator('#fireActionBtn').click()
    actor.locator('#fireActionBtn.air-mode').click()
    for page in (host, guest):
        expect(page.locator('#turnTimelineBadge')).to_contain_text('T2')

    guest.reload()
    expect(guest.locator('#gameScreen')).to_be_visible()
    expect(guest.locator('#turnTimelineBadge')).to_contain_text('T2')
    guest.locator('#backToLobbyBtn').click()
    expect(host.locator('#gameOverModal')).to_be_visible()
    xp = host.evaluate("Number(localStorage.getItem('puffpuff_xp'))")
    assert xp > 0
    for _ in range(2):
        host.reload()
        expect(host.locator('#gameOverModal')).to_be_visible()
        assert host.evaluate("Number(localStorage.getItem('puffpuff_xp'))") == xp

    host.locator('#modalRestartBtn').click()
    expect(host.locator('#partyRoomModal')).to_be_visible()
    new_code = host.locator('#partyRoomCode').inner_text()
    assert new_code != first_code
    guest.locator('[data-hub=friend]').click()
    join(guest, new_code)
    for page in (host, guest):
        expect(page.locator('#gameScreen')).to_be_visible()
        expect(page.locator('#turnTimelineBadge')).to_contain_text('T1')
        expect(page.locator('#gameOverModal')).to_be_hidden()
    assert not errors, errors
    for context in contexts:
        context.close()


def check_legacy_rematch(browser, url):
    host = browser.new_page()
    guest = browser.new_page()
    register(host, url, 'legacyhost')
    register(guest, url, 'legacyguest')
    scopes = []

    def record_creation(request):
        if request.method == 'POST' and request.url.endswith('/api/battle/rooms'):
            scopes.append(request.post_data_json['scope'])

    def omit_room_scope(route):
        response = route.fetch()
        state = response.json()
        state.pop('scope', None)
        route.fulfill(response=response, json=state)

    host.on('request', record_creation)
    host.route('**/api/battle/rooms/*/state', omit_room_scope)
    host.locator('[data-hub=school]').click()
    host.locator('#createClassOnlineRoomBtn').click()
    for has_saved_scope in (True, False):
        expect(host.locator('#partyRoomModal')).to_be_visible()
        guest.locator('[data-hub=friend]').click()
        join(guest, host.locator('#partyRoomCode').inner_text())
        expect(host.locator('#gameScreen')).to_be_visible()
        guest.locator('#backToLobbyBtn').click()
        expect(host.locator('#gameOverModal')).to_be_visible()
        if not has_saved_scope:
            # Session saved by a released client, before the scope was stored.
            host.evaluate("""() => {
                const key = 'boltaengi_online_session_v1';
                const session = JSON.parse(sessionStorage.getItem(key));
                delete session.scope;
                sessionStorage.setItem(key, JSON.stringify(session));
            }""")
        host.reload()
        expect(host.locator('#gameOverModal')).to_be_visible()
        action = host.locator('#modalRestartBtn')
        if not has_saved_scope:
            expect(action).to_have_text('로비에서 방 범위 선택')
        action.click()
        if has_saved_scope:
            expect(host.locator('#partyRoomModal')).to_be_visible()
            assert scopes == ['class', 'class'], scopes
    expect(host.locator('#createClassOnlineRoomBtn')).to_be_visible()
    expect(host.locator('#partyRoomModal')).to_be_hidden()
    assert scopes == ['class', 'class'], scopes
    host.locator('[data-hub=friend]').click()
    host.locator('#createOnlineRoomBtn').click()
    expect(host.locator('#partyRoomModal')).to_be_visible()
    assert scopes == ['class', 'class', 'all'], scopes
    host.close()
    guest.close()


if __name__ == '__main__':
    with TemporaryDirectory() as data_dir, subprocess.Popen(
        ['node', '--input-type=module', '-e', START_SERVER, data_dir],
        cwd=ROOT, stdout=subprocess.PIPE, text=True,
    ) as server:
        try:
            port = int(server.stdout.readline())
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=os.environ.get('BATTLE_CHROMIUM_PATH'))
                try:
                    url = f'http://127.0.0.1:{port}/battle/'
                    check_match(browser, url)
                    check_legacy_rematch(browser, url)
                finally:
                    browser.close()
        finally:
            server.terminate()
    print('Passed 2P fire, air trigger, refresh, single XP award and online rematch with current and legacy scope data.')
