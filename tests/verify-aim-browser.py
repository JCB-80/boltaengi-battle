"""Isolated, headless visual/input smoke test; no production server or user profile."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import json
import math
import os
import tempfile
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
out = Path(os.environ.get('BOLTAENGI_QA_SCREENSHOTS', Path(tempfile.gettempdir()) / 'boltaengi-visual-qa'))
out.mkdir(parents=True, exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(root)))
port = server.server_address[1]
Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{port}/'

def touch(cdp, kind, x=None, y=None):
    points=[] if x is None else [{'x': x, 'y': y}]
    cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': points})

try:
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    failures=[]
    for width,height,character,direction in [(915,412,'M01_MOCHI',1),(740,360,'M10_GAMJA',-1)]:
      context=browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1, has_touch=True, is_mobile=True)
      context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
      page=context.new_page()
      errors=[]
      page.on('pageerror', lambda err: errors.append(str(err)))
      page.goto(base, wait_until='domcontentloaded')
      page.wait_for_selector('#startMatchBtn', state='visible')
      page.select_option('#modeSelect','1v1_local')
      page.select_option('#mapSelect','bridge')
      if character != 'M01_MOCHI': page.locator(f'[data-char-id="{character}"]').click()
      page.click('#startMatchBtn')
      page.wait_for_selector('#gameScreen:not(.hidden)')
      page.wait_for_timeout(350)
      tag=f'{width}-{character}'
      page.screenshot(path=str(out / f'{tag}-idle.png'))
      box=page.locator('#gameCanvas').bounding_box()
      ratio=box['width']/box['height']
      x=box['x']+box['width']*.50
      y=box['y']+box['height']*.36
      cdp=context.new_cdp_session(page)
      # Below the 12 CSS-pixel firing threshold, the gesture must not fire.
      touch(cdp,'touchStart',x,y); touch(cdp,'touchMove',x-5,y+3); touch(cdp,'touchEnd')
      page.wait_for_timeout(100)
      if page.locator('#floatingAirBtn').is_visible(): failures.append(f'{tag}: tiny drag fired')
      # An interrupted touch must cancel even when the pull was long enough to fire.
      touch(cdp,'touchStart',x,y); touch(cdp,'touchMove',x-36,y+30); touch(cdp,'touchCancel')
      page.wait_for_timeout(100)
      if page.locator('#floatingAirBtn').is_visible(): failures.append(f'{tag}: touch cancel fired')
      # Drag backwards and down; both directions should display the visual angle.
      touch(cdp,'touchStart',x,y); touch(cdp,'touchMove',x-36*direction,y+30)
      page.wait_for_timeout(150)
      angle=page.locator('#angleValueText').inner_text()
      page.screenshot(path=str(out / f'{tag}-drag.png'))
      touch(cdp,'touchEnd')
      page.wait_for_timeout(100)
      flight=page.locator('#floatingAirBtn').is_visible()
      page.screenshot(path=str(out / f'{tag}-release.png'))
      try: angle_value=int(angle.rstrip('°'))
      except ValueError: angle_value=-1
      expected=round(math.degrees(math.atan2(30,36)))
      print(json.dumps({'viewport':[width,height], 'character':character, 'facing':'right' if direction>0 else 'left', 'canvas_ratio':round(ratio,3),'angle':angle_value,'expected_angle':expected,'fired':flight,'errors':errors},ensure_ascii=True))
      if abs(ratio-16/9)>0.04: failures.append(f'{tag}: canvas aspect ratio is {ratio:.3f}')
      if abs(angle_value-expected)>2: failures.append(f'{tag}: drag shows {angle_value}, expected approximately {expected}')
      if not flight: failures.append(f'{tag}: releasing a full drag did not enter flight')
      failures.extend(errors)
      context.close()
    browser.close()
    if failures: raise AssertionError('; '.join(failures))
finally:
  server.shutdown()
  server.server_close()
