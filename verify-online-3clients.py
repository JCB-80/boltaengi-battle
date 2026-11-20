import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pages = []
    errs = [[], [], []]
    for i in range(3):
        ctx = b.new_context(viewport={"width": 844, "height": 390})
        pg = ctx.new_page()
        pg.on("pageerror", lambda e, idx=i: errs[idx].append(f"pageerror:{e}"))
        pg.on("console", lambda m, idx=i: errs[idx].append(f"console.{m.type}:{m.text}") if m.type == "error" else None)
        pg.goto("http://192.168.0.39:8791/battle/", wait_until="domcontentloaded")
        pg.wait_for_selector("#closeInterstitialBtn:not([disabled])", timeout=10000)
        pg.click("#closeInterstitialBtn")
        if pg.locator("#profileModal:not(.hidden)").count() > 0:
            pg.fill("#profUserId", f"p3_user_{i}")
            pg.fill("#profNickname", f"유저{i+1}")
            pg.fill("#profSchool", "테스트초")
            pg.fill("#profGradeNum", "3")
            pg.fill("#profClassNum", "1")
            pg.click("#profileModal button.primary-fire-btn")
            pg.wait_for_selector("#profileModal", state="hidden", timeout=5000)
        pages.append(pg)

    pages[0].click('button.social-tab[data-hub="friend"]')
    pages[0].select_option("#onlineMaxPlayers", "3")
    pages[0].click("#createOnlineRoomBtn")
    pages[0].wait_for_selector("#onlineRoomStatusBox:not(.hidden)", timeout=5000)
    import re
    p1_txt = pages[0].text_content("#onlineRoomStatusText")
    print("P1 status (1/3):", p1_txt)
    m_code = re.search(r"\[([A-Z0-9]+)\]", p1_txt)
    assert m_code, f"No invite code in {p1_txt}"
    code = m_code.group(1)

    # P2 joins -> must still wait in lobby (2/3)
    pages[1].wait_for_selector(f'#lanOpenRoomsList .lan-join-btn[data-code="{code}"]', timeout=8000)
    pages[1].click(f'#lanOpenRoomsList .lan-join-btn[data-code="{code}"]')
    time.sleep(0.8)
    p1_wait = pages[0].text_content("#onlineRoomStatusText")
    p2_wait = pages[1].text_content("#onlineRoomStatusText")
    p1_hidden = pages[0].locator("#gameScreen.hidden").count() == 1
    p2_hidden = pages[1].locator("#gameScreen.hidden").count() == 1
    print("WAIT_2_OF_3:", p1_wait, "|", p2_wait, "hidden=", p1_hidden, p2_hidden)
    assert p1_hidden and p2_hidden, "Game started before 3rd player joined!"

    # P3 joins -> all 3 enter gameScreen!
    pages[2].wait_for_selector(f'#lanOpenRoomsList .lan-join-btn[data-code="{code}"]', timeout=8000)
    pages[2].click(f'#lanOpenRoomsList .lan-join-btn[data-code="{code}"]')
    for idx, pg in enumerate(pages):
        pg.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)

    time.sleep(0.8)
    pages[0].screenshot(path="C:/Users/seo44/.gemini/antigravity/brain/cba4b5ba-ff40-427c-9cbc-10111c061e15/online_3p_grounded.png")

    active1 = [i for i, pg in enumerate(pages) if not pg.is_disabled("#fireActionBtn")]
    print("TURN 1 active slots:", active1)
    assert len(active1) == 1
    pages[active1[0]].click("#fireActionBtn")

    for pg in pages:
        pg.wait_for_function("() => Number(document.querySelector('#turnTimelineBadge')?.textContent?.match(/T(\\d+)/)?.[1] || 1) >= 2", timeout=20000)
    active2 = [i for i, pg in enumerate(pages) if not pg.is_disabled("#fireActionBtn")]
    print("TURN 2 active slots:", active2)
    assert len(active2) == 1 and active2[0] != active1[0]
    pages[active2[0]].click("#fireActionBtn")

    for pg in pages:
        pg.wait_for_function("() => Number(document.querySelector('#turnTimelineBadge')?.textContent?.match(/T(\\d+)/)?.[1] || 1) >= 3", timeout=20000)
    active3 = [i for i, pg in enumerate(pages) if not pg.is_disabled("#fireActionBtn")]
    print("TURN 3 active slots:", active3)
    assert len(active3) == 1 and active3[0] not in (active1[0], active2[0])
    print("ALL_3_TURNS_OK! Errors:", errs)
    b.close()
