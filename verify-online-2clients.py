import os
import re
import subprocess
import sys
import time
import urllib.request
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\seo44\.gemini\antigravity\brain\cba4b5ba-ff40-427c-9cbc-10111c061e15"
SERVER_DIR = r"I:\Projects\PuffPuffSiege-Online"
BASE_URL = "http://127.0.0.1:8791/battle/"

def wait_for_server(url, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Battle server did not start in time")

def main():
    proc = subprocess.Popen(
        ["node", "server.mjs"],
        cwd=SERVER_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        wait_for_server("http://127.0.0.1:8791/api/battle/health")

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            host_ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            guest_ctx = browser.new_context(viewport={"width": 1280, "height": 800})

            host_page = host_ctx.new_page()
            guest_page = guest_ctx.new_page()

            host_errors = []
            guest_errors = []
            host_page.on("pageerror", lambda err: host_errors.append(f"pageerror: {err}"))
            host_page.on("console", lambda msg: host_errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)
            guest_page.on("pageerror", lambda err: guest_errors.append(f"pageerror: {err}"))
            guest_page.on("console", lambda msg: guest_errors.append(f"console.{msg.type}: {msg.text}") if msg.type == "error" else None)

            host_page.goto(BASE_URL, wait_until="networkidle")
            guest_page.goto(BASE_URL, wait_until="networkidle")

            # Dismiss initial 3s Google interstitial gate & register synthetic profile on both browsers
            for idx, page in enumerate((host_page, guest_page)):
                page.wait_for_selector("#closeInterstitialBtn:not([disabled])", timeout=8000)
                page.click("#closeInterstitialBtn")
                if page.locator("#profileModal:not(.hidden)").count() > 0:
                    page.fill("#profUserId", f"test_user_{idx + 1}")
                    page.fill("#profNickname", "가상호스트" if idx == 0 else "가상게스트")
                    page.fill("#profSchool", "가상초등학교")
                    page.fill("#profGradeNum", "3")
                    page.fill("#profClassNum", str(idx + 1))
                    page.click('#profileForm button[type="submit"]')
                    page.wait_for_selector("#profileModal", state="hidden", timeout=5000)

            # Open 친구 초대 tab where 온라인 방 만들기 / 입장 UI lives
            host_page.click('button.social-tab[data-hub="friend"]')
            guest_page.click('button.social-tab[data-hub="friend"]')

            # 1) Host creates room
            host_page.click("#createOnlineRoomBtn")
            host_page.wait_for_function(
                "() => /([A-Z0-9]{6})/.test(document.querySelector('#onlineRoomStatusText')?.textContent || '')",
                timeout=8000,
            )
            status_text = host_page.text_content("#onlineRoomStatusText") or ""
            m = re.search(r"([A-Z0-9]{6})", status_text)
            assert m, f"Invite code not found in: {status_text}"
            invite_code = m.group(1)

            # 2) Guest joins with invite code
            guest_page.fill("#onlineInviteInput", invite_code)
            guest_page.click("#joinOnlineRoomBtn")

            # 3) Host approves
            host_page.wait_for_selector("#approveOnlineRoomBtn:not(.hidden)", timeout=8000)
            host_page.click("#approveOnlineRoomBtn")

            # 4) Both enter #gameScreen
            host_page.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)
            guest_page.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)
            time.sleep(0.8)

            # 5) Host aims slightly and fires shot (Space hold 450ms)
            host_page.keyboard.down("Space")
            time.sleep(0.45)
            host_page.keyboard.up("Space")

            # Wait for projectile flight & Turn 2 transition on both clients
            host_page.wait_for_function(
                "() => Number(document.querySelector('#turnTimelineBadge')?.textContent?.match(/\\d+/)?.[0] || 1) >= 2",
                timeout=15000,
            )
            guest_page.wait_for_function(
                "() => Number(document.querySelector('#turnTimelineBadge')?.textContent?.match(/\\d+/)?.[0] || 1) >= 2",
                timeout=15000,
            )
            time.sleep(0.5)

            host_shot_path = os.path.join(ARTIFACT_DIR, "online_2clients_host_turn2.png")
            guest_shot_path = os.path.join(ARTIFACT_DIR, "online_2clients_guest_turn2.png")
            host_page.screenshot(path=host_shot_path)
            guest_page.screenshot(path=guest_shot_path)

            # 6) Guest reloads browser and automatically reconnects into Turn 2
            guest_page.reload(wait_until="domcontentloaded")
            guest_page.wait_for_selector("#gameScreen:not(.hidden)", timeout=8000)
            guest_page.wait_for_function(
                "() => Number(document.querySelector('#turnTimelineBadge')?.textContent?.match(/\\d+/)?.[0] || 1) >= 2",
                timeout=8000,
            )
            time.sleep(0.5)

            guest_reloaded_path = os.path.join(ARTIFACT_DIR, "online_2clients_guest_reloaded.png")
            guest_page.screenshot(path=guest_reloaded_path)

            assert len(host_errors) == 0, f"Host console errors: {host_errors}"
            assert len(guest_errors) == 0, f"Guest console errors: {guest_errors}"

            print("PLAYWRIGHT_2CLIENTS_PASSED:", {
                "invite_code": invite_code,
                "host_turn": host_page.text_content("#turnTimelineBadge"),
                "guest_turn_after_reload": guest_page.text_content("#turnTimelineBadge"),
                "host_errors": len(host_errors),
                "guest_errors": len(guest_errors),
            })
            browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()
