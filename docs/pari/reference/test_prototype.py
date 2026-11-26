from playwright.sync_api import sync_playwright
from pathlib import Path
p=Path(__file__).resolve().parent
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 for t in ['binary','multi','free','visible']:
  page=b.new_page(viewport={"width":1440,"height":1050});page.on("pageerror",lambda e:errors.append(str(e)))
  page.set_content((p/'prototype.html').read_text());page.locator('[data-type='+('binary' if t=='visible' else t)+']').click();
  if t=='visible': page.locator('#hidden').click()
  page.screenshot(path=str(p/'screenshots'/f'{t}.png'),full_page=True)
 page=b.new_page(viewport={"width":1440,"height":1050});page.on("pageerror",lambda e:errors.append(str(e)));page.set_content((p/'prototype.html').read_text());page.locator('[data-answer="Да"]').click();page.locator('#send').click();assert 'Прогноз принят' in page.locator('#card').inner_text();page.locator('#retry').click();page.locator('#hidden').click();assert 'Ответы скрыты' not in page.locator('#card').inner_text();page.locator('[data-type=multi]').click();page.locator('#add').click();assert page.locator('#create').is_disabled();page.locator('[data-opt="3"]').fill('Греция');assert page.locator('#create').is_enabled();page.locator('[data-del="3"]').click();page.locator('[data-type=free]').click();page.locator('#answer').fill('2:1');page.locator('#send').click();assert 'Прогноз принят' in page.locator('#card').inner_text();page.locator('#create').click();assert 'создано' in page.locator('#notice').inner_text();page.locator('#reset').click();assert page.locator('#name').input_value()=='Первый снег';page.locator('#deadline').fill('2026-12-16');assert page.locator('#create').is_disabled();assert not errors,errors
 page.set_viewport_size({'width':390,'height':844});page.locator('#reset').click();page.screenshot(path=str(p/'screenshots/mobile.png'),full_page=True);assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');b.close();print('PASS')
