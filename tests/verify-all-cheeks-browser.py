"""Inspect all characters through the real game controls on an isolated local server."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import json, os, tempfile
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('BOLTAENGI_QA_SCREENSHOTS', Path(tempfile.gettempdir()) / 'boltaengi-cheek-audit'))
out.mkdir(parents=True, exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
port = server.server_address[1]
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}/'
def touch(cdp, kind, x=None, y=None):
    cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if x is None else [{'x': x, 'y': y}]})
try:
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 915, 'height': 412}, device_scale_factor=3, has_touch=True, is_mobile=True)
    context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.goto(base, wait_until='domcontentloaded')
    page.wait_for_selector('#charAvatarGrid [data-char-id]')
    characters=page.locator('#charAvatarGrid [data-char-id]').evaluate_all('(els) => els.map(e => e.dataset.charId)')
    assert len(characters)==20 and len(set(characters))==20, f'Expected 20 unique characters: {len(characters)}'
    page.select_option('#modeSelect','1v1_local')
    page.select_option('#mapSelect','bridge')
    cdp=context.new_cdp_session(page)
    for number,cid in enumerate(characters,1):
      page.locator(f'[data-char-id="{cid}"]').click()
      assert page.locator('#charSelect').input_value()==cid
      page.click('#startMatchBtn')
      page.wait_for_selector('#gameScreen:not(.hidden)')
      page.wait_for_timeout(350)
      page.evaluate('''() => {
        const indicator = document.querySelector('#floatingAirBtn');
        window.__qaFlightSeen = false;
        const observer = new MutationObserver(() => {
          if (!indicator.classList.contains('hidden')) window.__qaFlightSeen = true;
        });
        observer.observe(indicator, { attributes: true, attributeFilter: ['class'] });
      }''')
      box=page.locator('#gameCanvas').bounding_box()
      region={'x':box['x'] + box['width']*.16 - 45, 'y':box['y'] + box['height']*.42 - 55, 'width':140, 'height':120}
      page.screenshot(path=str(out / f'{cid}-idle.png'), clip=region)
      x=box['x']+box['width']*.50; y=box['y']+box['height']*.36
      touch(cdp,'touchStart',x,y); touch(cdp,'touchMove',x-36,y+30)
      page.wait_for_timeout(160)
      assert page.locator('#angleValueText').inner_text().strip()=='40°', f'{cid}: wrong aiming angle'
      page.screenshot(path=str(out / f'{cid}-drag.png'), clip=region)
      touch(cdp,'touchEnd')
      page.wait_for_timeout(80)
      page.screenshot(path=str(out / f'{cid}-release.png'), clip=region)
      assert page.evaluate('window.__qaFlightSeen'), f'{cid}: release did not enter flight'
      page.click('#backToLobbyBtn')
      page.wait_for_selector('#lobbyScreen:not(.hidden)')
      print(json.dumps({'character':cid,'status':'captured','count':number},ensure_ascii=True), flush=True)
    assert not errors, f'Browser errors: {errors}'
    context.close(); browser.close()
finally:
  server.shutdown(); server.server_close()
