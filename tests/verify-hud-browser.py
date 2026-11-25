"""Check small-screen battle HUD geometry and shell selection in an isolated browser."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import json, os, tempfile
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('BOLTAENGI_QA_SCREENSHOTS', Path(tempfile.gettempdir())/'boltaengi-hud-qa'))
out.mkdir(parents=True,exist_ok=True)
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(root)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_address[1]}/'
def overlaps(a,b):
    return a['x'] < b['x']+b['width'] and b['x'] < a['x']+a['width'] and a['y'] < b['y']+b['height'] and b['y'] < a['y']+a['height']
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True, executable_path=os.environ.get("BATTLE_CHROMIUM_PATH"))
  failures=[]
  for w,h in [(740,360),(915,360),(600,320),(360,740),(320,568)]:
   context=browser.new_context(viewport={'width':w,'height':h},has_touch=True,is_mobile=True)
   context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
   page=context.new_page(); errors=[]
   page.on('pageerror',lambda err: errors.append(str(err)))
   page.goto(base,wait_until='domcontentloaded')
   page.wait_for_selector('#startMatchBtn',state='visible')
   if (w,h)==(740,360):
    page.locator('[data-hub="friend"]').click()
    room_title=page.locator('#onlineRoomTitleInput')
    room_title.fill('AB')
    room_title.press('ArrowLeft')
    room_title.press('Space')
    assert room_title.input_value()=='A B', 'Battle shortcuts consumed lobby text editing keys'
    page.locator('[data-hub="classic"]').click()
   page.select_option('#modeSelect','1v1_local')
   page.select_option('#mapSelect','bridge')
   page.click('#startMatchBtn'); page.wait_for_selector('#gameScreen:not(.hidden)'); page.wait_for_timeout(250)
   hp=page.locator('#bottomHpHud').bounding_box()
   left=page.locator('.floating-corner-card.left').bounding_box()
   right=page.locator('.floating-corner-card.right').bounding_box()
   canvas=page.locator('#gameCanvas').bounding_box()
   if any(box is None for box in (hp,left,right,canvas)): failures.append(f'{w}x{h}: missing HUD elements')
   elif overlaps(hp,left) or overlaps(hp,right) or overlaps(left,right): failures.append(f'{w}x{h}: HUD panels overlap')
   weather=page.locator('#weatherToggleBtn')
   if overlaps(weather.bounding_box(), page.locator('.floating-top-actions').bounding_box()):
    failures.append(f'{w}x{h}: utilities cover weather')
   page.screenshot(path=str(out/f'{w}x{h}-hud.png'))
   page.locator('#shellCycleBtn').click()
   pop=page.locator('#shellPopover')
   if not pop.is_visible(): failures.append(f'{w}x{h}: shell popup did not open')
   else:
    pb=pop.bounding_box()
    if pb['x'] < 0 or pb['y'] < 0 or pb['x']+pb['width'] > w or pb['y']+pb['height'] > h:
     failures.append(f'{w}x{h}: shell popup extends outside viewport: {pb}')
    try:
     page.locator('[data-shell="AQUA_DRILL"]').click(timeout=3000)
     if not page.locator('#shellPopover').is_hidden(): failures.append(f'{w}x{h}: shell selection did not close popup')
    except Exception as exc: failures.append(f'{w}x{h}: shell selection failed: {type(exc).__name__}')
   if h > w:
    for selector in ['#topScorePill', '.floating-top-actions', '#bottomHpHud', '.floating-corner-card.left', '.floating-corner-card.right']:
     if overlaps(canvas, page.locator(selector).bounding_box()): failures.append(f'{w}x{h}: {selector} covers the arena')
   if (w,h)==(360,740):
    session=context.new_cdp_session(page)
    def finger(id,x,y):
     return {'id':id,'x':canvas['x']+canvas['width']*x,'y':canvas['y']+canvas['height']*y}
    def touch(kind,points):
     session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
    primary=finger(1,.51,.58); secondary=finger(2,.70,.60); second_end=finger(2,.80,.70)
    power=page.locator('#powerRange').input_value()
    touch('touchStart',[primary]); touch('touchStart',[primary,secondary])
    touch('touchMove',[primary,second_end]); touch('touchEnd',[second_end])
    assert page.locator('#powerRange').input_value()==power and page.locator('#fireActionBtn').is_enabled()
    touch('touchMove',[finger(1,.40,.68)])
    page.wait_for_function("initial => document.querySelector('#powerRange').value !== initial",arg=power)
    touch('touchEnd',[])
    page.wait_for_function("!document.querySelector('#fireActionBtn').textContent.includes('볼살 발사')")
   page.locator('#backToLobbyBtn').click()
   page.select_option('#modeSelect','2v2_team')
   page.locator('#startMatchBtn').click()
   cards=page.locator('#battleRoster .roster-card')
   cards.first.wait_for(state='visible')
   assert cards.count()==4 and [s.strip() for s in cards.locator('.roster-seat').all_text_contents()]==['A팀 1P','B팀 2P','A팀 3P','B팀 4P']
   assert cards.locator('progress').count()==4 and page.locator('#battleRoster [aria-current="true"]').count()==1
   page.screenshot(path=str(out/f'{w}x{h}-teams.png'))
   print(json.dumps({'viewport':[w,h],'hud':hp,'angle':left,'shell':right,'errors':errors},ensure_ascii=True),flush=True)
   failures.extend(errors); context.close()
  browser.close()
  if failures: raise AssertionError('; '.join(failures))
finally:
 server.shutdown(); server.server_close()
