"""Historical school-lobby device scenarios. Current HUD and online checks live in
tests/verify-hud-browser.py and tests/verify-online-match-browser.py.
"""
import time
from playwright.sync_api import sync_playwright

PHONE_PROFILES = [
    {"name": "Galaxy_S22_S25", "pw": 360, "ph": 780, "lw": 780, "lh": 360, "dpr": 3},
    {"name": "Galaxy_Z_Flip",  "pw": 360, "ph": 880, "lw": 880, "lh": 360, "dpr": 3},
    {"name": "iPhone_14_15",   "pw": 390, "ph": 844, "lw": 844, "lh": 390, "dpr": 3},
    {"name": "Large_Android",  "pw": 412, "ph": 915, "lw": 915, "lh": 412, "dpr": 2},
    {"name": "Compact_320px",  "pw": 320, "ph": 568, "lw": 568, "lh": 320, "dpr": 2},
]

def setup_profile(pg, uid, nick, school="염작초등학교", grade="3", cls="1"):
    pg.goto("http://192.168.0.39:8791/battle/", wait_until="domcontentloaded")
    pg.wait_for_selector("#closeInterstitialBtn:not([disabled])", timeout=10000)
    pg.click("#closeInterstitialBtn")
    if pg.locator("#profileModal:not(.hidden)").count() > 0:
        pg.fill("#profUserId", uid)
        pg.fill("#profNickname", nick)
        pg.fill("#profSchool", school)
        pg.fill("#profGradeNum", grade)
        pg.fill("#profClassNum", cls)
        pg.click("#profileModal button.primary-fire-btn")
        pg.wait_for_selector("#profileModal", state="hidden", timeout=5000)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)

    # 1) 5가지 폰 해상도별 로비 + 가로 인게임 + 터치 드래그 + 공중 낙하 + 결과 팝업 시뮬레이션
    for idx, prof in enumerate(PHONE_PROFILES):
        errs = []
        ctx = b.new_context(viewport={"width": prof["pw"], "height": prof["ph"]}, device_scale_factor=prof["dpr"], has_touch=True)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e, n=prof["name"]: errs.append(f"{n}:pageerror:{e}"))
        setup_profile(pg, f"sim_phone_{idx}", f"폰{idx+1}")
        pg.wait_for_selector("#schoolTopBanner", state="visible", timeout=5000)
        pg.click('.lb-scope-btn[data-lb-scope="school"]')
        pg.wait_for_timeout(250)
        pg.click('.lb-scope-btn[data-lb-scope="all"]')
        pg.wait_for_timeout(250)

        overflow_p = pg.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert not overflow_p, f"{prof['name']} portrait horizontal overflow!"

        # 가로 회전 시뮬레이션 후 인게임 진입
        pg.set_viewport_size({"width": prof["lw"], "height": prof["lh"]})
        pg.click("#startMatchBtn")
        pg.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)
        pg.wait_for_timeout(350)

        layout = pg.evaluate("""() => {
            const cf = document.querySelector('.canvas-frame').getBoundingClientRect();
            const cv = document.querySelector('#gameCanvas').getBoundingClientRect();
            const dk = document.querySelector('.slim-dock').getBoundingClientRect();
            const fire = document.querySelector('#fireActionBtn').getBoundingClientRect();
            const hud = document.querySelector('.floating-top-hud').getBoundingClientRect();
            const lob = document.querySelector('#backToLobbyBtn').getBoundingClientRect();
            return { vw: window.innerWidth, vh: window.innerHeight, cf, cv, dk, fire, hud, lob };
        }""")
        assert layout["cv"]["bottom"] <= layout["cf"]["bottom"] + 2, f"{prof['name']} canvas bottom clipped: {layout}"
        assert layout["dk"]["bottom"] <= layout["vh"] + 2, f"{prof['name']} dock bottom overflow: {layout}"
        assert layout["fire"]["right"] <= layout["vw"] + 2, f"{prof['name']} fire btn right overflow: {layout}"
        assert layout["hud"]["right"] <= layout["lob"]["left"] + 2, f"{prof['name']} HUD overlaps lobby btn: {layout}"

        # 터치 드래그 조준 발사 + 공중 터치 수직 낙하
        pg.mouse.move(prof["lw"] * 0.35, prof["lh"] * 0.45)
        pg.mouse.down()
        pg.mouse.move(prof["lw"] * 0.22, prof["lh"] * 0.62, steps=6)
        pg.mouse.up()
        pg.wait_for_timeout(200)
        pg.mouse.click(prof["lw"] * 0.5, prof["lh"] * 0.4)
        pg.wait_for_timeout(200)

        # 승리 팝업 가시성·넘침 검증
        pg.evaluate("""() => {
            document.querySelector('#winnerHeadline').textContent = '모찌웅 승리! · 3전 2승 (승률 67%)';
            document.querySelector('#gameOverModal').classList.remove('hidden');
        }""")
        pg.wait_for_timeout(150)
        mbox = pg.evaluate("""() => {
            const card = document.querySelector('#gameOverModal .modal-card').getBoundingClientRect();
            const btns = Array.from(document.querySelectorAll('#gameOverModal .modal-actions button')).map(b => b.getBoundingClientRect());
            return { vw: window.innerWidth, vh: window.innerHeight, card, btns };
        }""")
        assert mbox["card"]["bottom"] <= mbox["vh"] + 2, f"{prof['name']} modal card bottom overflow: {mbox}"
        for b_rect in mbox["btns"]:
            assert b_rect["left"] >= mbox["card"]["left"] - 2 and b_rect["right"] <= mbox["card"]["right"] + 2, f"{prof['name']} modal btn overflow: {mbox}"

        assert len(errs) == 0, f"{prof['name']} errors: {errs}"
        print(f"[OK] {prof['name']} ({prof['pw']}x{prof['ph']} / {prof['lw']}x{prof['lh']})")
        ctx.close()

    # 2) 서로 다른 2개 폰(Galaxy S22 vs Galaxy Z Flip) 간 랭킹표 '⚔️ 대결' 요청 -> 수락 -> 실시간 매치 진입
    c1 = b.new_context(viewport={"width": 360, "height": 780}, has_touch=True)
    c2 = b.new_context(viewport={"width": 360, "height": 880}, has_touch=True)
    p1 = c1.new_page()
    p2 = c2.new_page()
    setup_profile(p1, "sim_phone_0", "폰1")
    setup_profile(p2, "sim_phone_1", "폰2")

    p1.click('.lb-scope-btn[data-lb-scope="school"]')
    p1.wait_for_selector('.lb-challenge-btn[data-uid="sim_phone_1"]', state="attached", timeout=8000)
    p1.locator('.lb-challenge-btn[data-uid="sim_phone_1"]').scroll_into_view_if_needed()
    p1.click('.lb-challenge-btn[data-uid="sim_phone_1"]')
    p1.wait_for_selector("#onlineRoomStatusBox:not(.hidden)", timeout=5000)
    print("CHALLENGE_SENT:", p1.text_content("#onlineRoomStatusText"))

    p2.wait_for_selector("#challengeAlertModal:not(.hidden)", timeout=8000)
    print("CHALLENGE_RECEIVED:", p2.text_content("#challengeAlertText"))
    p2.click("#acceptChallengeBtn")

    p1.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)
    p2.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)
    print("CROSS_PHONE_CHALLENGE_MATCH_STARTED_OK!")
    b.close()
