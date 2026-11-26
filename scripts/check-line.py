import secrets,subprocess,hashlib
from playwright.sync_api import sync_playwright,expect
t=secrets.token_hex(18); email=t[:12]+'@example.test'; pwd=secrets.token_hex(12)
q=f"insert into public.invitations(token_hash,email,expires_at) values(decode('{hashlib.sha256(t.encode()).hexdigest()}','hex'),'{email}',now()+interval '1 hour')"
subprocess.run(['docker','exec','-i','fongrob-db','psql','-U','postgres','-v','ON_ERROR_STOP=1'],input=q.encode(),check=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--no-proxy-server'])
 page=b.new_page(); page.goto('http://127.0.0.1:3000/register')
 for name,val in [('email',email),('name','Тестовый сотрудник'),('password',pwd),('invite',t)]: page.locator(f'input[name="{name}"]').fill(val)
 page.get_by_role('button',name='Создать аккаунт').click()
 import urllib.request,json,html,re,time
 def link(kind):
  base='http://127.0.0.1:35434/api/v1/'
  for _ in range(20):
   for item in json.load(urllib.request.urlopen(base+'messages'))['messages']:
    if email not in [x['Address'] for x in item['To']]: continue
    body=json.load(urllib.request.urlopen(base+'message/'+item['ID']))['HTML']
    for href in re.findall(r'href="([^"]+)"',html.unescape(body)):
     if 'type='+kind in href: return href
   time.sleep(.25)
  raise ValueError(kind)
 expect(page.get_by_role('status')).to_contain_text('Проверьте почту')
 page.goto(link('signup'))
 expect(page.get_by_role('heading',name='Вы вошли')).to_be_visible()
 sql=lambda q:subprocess.check_output(['docker','exec','-i','fongrob-db','psql','-U','postgres','-v','ON_ERROR_STOP=1','-At'],input=q.encode()).decode().strip()
 sql(f"insert into public.user_roles select id,'ADMIN' from auth.users where email='{email}' on conflict do nothing")
 page.goto('http://127.0.0.1:3000/line')
 page.get_by_label('Название',exact=True).fill('Закончится ли кофе до 15:00?')
 page.get_by_label('Условия результата').fill('Да, если контейнер кофе пуст до 15:00 по часам офиса.')
 page.get_by_label('Приём прогнозов до').fill('2026-12-25T12:00')
 page.get_by_role('button',name='Отправить на модерацию').click()
 expect(page.get_by_role('heading',name='Закончится ли кофе до 15:00?').last).to_be_visible()
 page.get_by_role('button',name='Опубликовать').last.click()
 expect(page.get_by_text('Готово.',exact=True)).to_be_visible()
 page.screenshot(path='/workspace/fongrob-line.png',full_page=True)
 print('Proposal and publication verified in browser')
 adminpage=page
 player=b.new_page()
 t=secrets.token_hex(18);email=t[:12]+'@example.test';pwd=secrets.token_hex(12)
 sql(f"insert into public.invitations(token_hash,email,expires_at) values(decode('{hashlib.sha256(t.encode()).hexdigest()}','hex'),'{email}',now()+interval '1 hour')")
 player.goto('http://127.0.0.1:3000/register')
 for name,val in [('email',email),('name','Игрок юзабилити'),('password',pwd),('invite',t)]: player.locator(f'input[name="{name}"]').fill(val)
 player.get_by_role('button',name='Создать аккаунт').click()
 expect(player.get_by_role('status')).to_contain_text('Проверьте почту')
 player.goto(link('signup'))
 expect(player.get_by_role('heading',name='Вы вошли')).to_be_visible()
 player.goto('http://127.0.0.1:3000/line')
 card=player.get_by_role('article').filter(has=player.get_by_role('heading',name='Закончится ли кофе до 15:00?')).last
 card.get_by_role('button',name='Да · 1.9',exact=True).click()
 player.get_by_label('Ставка, OC').fill('25')
 player.get_by_role('button',name='Подтвердить прогноз').click()
 expect(player.get_by_text('25 OC × 1.9',exact=False)).to_be_visible()
 adminpage.reload()
 acard=adminpage.get_by_role('article').filter(has=adminpage.get_by_role('heading',name='Закончится ли кофе до 15:00?')).last
 acard.get_by_text('Подтвердить результат',exact=True).click()
 adminpage.on('dialog',lambda dialog:dialog.accept())
 acard.get_by_role('button',name='Результат — Да',exact=True).click()
 expect(adminpage.get_by_text('Готово.',exact=True)).to_be_visible()
 player.goto('http://127.0.0.1:3000/wallet')
 expect(player.get_by_text('1 022,5 OC',exact=True)).to_be_visible()
 print('Browser bet and settlement verified')
