"""Add optional, editable example events to a new VPS installation."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parent
examples = [
    ('meetings', 'Закончится ли пятничная планёрка до 12:00?', 'Результат подтверждает организатор по времени завершения в календаре команды.'),
    ('kitchen', 'Останется ли кофе на кухне к 15:00?', 'Ответ определяет дежурный по кухне после проверки запасов в 15:00.'),
    ('it', 'Будет ли принтер работать без перезагрузки всю неделю?', 'Поддержка подтверждает результат по журналу обращений за рабочую неделю.'),
    ('sales', 'Получит ли команда продаж пять новых заявок до пятницы?', 'Итог определяется по подтверждённому числу новых заявок в CRM.'),
    ('teams', 'Победит ли отдел разработки в викторине офиса?', 'Организатор публикует итоговый протокол добровольной викторины.'),
    ('corporate', 'Начнётся ли корпоративная игра вовремя?', 'Время старта подтверждает организатор по расписанию мероприятия.'),
    ('logistics', 'Приедет ли заказ канцелярии до обеда?', 'Ответ подтверждается отметкой о доставке до 12:00 по местному времени.'),
    ('special', 'Перенесут ли общее собрание на другой день?', 'Результат определяется по итоговому приглашению в офисном календаре.'),
]

def quote(value):
    return "'" + value.replace("'", "''") + "'"

rows = ',\n'.join('(' + ','.join(map(quote, row)) + ')' for row in examples)
query = f"""
with admin as (
 select profile_id from public.user_roles where role_code='SUPER_ADMIN' order by profile_id limit 1
), sample(category,title,rules) as (values {rows}),
created as (
 insert into public.events(category,title,rules,owner_id,closes_at,status)
 select s.category,s.title,s.rules,a.profile_id,now()+interval '14 days','open'
 from sample s cross join admin a
 where not exists(select 1 from public.events e where e.title=s.title)
 returning id
), markets as (
 insert into public.markets(event_id) select id from created returning id
)
insert into public.outcomes(market_id,label,odds)
select m.id,v.label,1.90 from markets m cross join (values ('Да'),('Нет')) v(label);
"""
if '--apply' not in sys.argv:
    raise SystemExit('Пробные события будут опубликованы и доступны сотрудникам. Запустите с --apply.')
command = ['docker','compose','--env-file',str(root/'.env'),'-f',str(root/'compose.yml'),
           'exec','-T','db','psql','-U','postgres','-v','ON_ERROR_STOP=1']
subprocess.run(command,input=query,text=True,check=True)
print('Пробные события добавлены. Повторный запуск не создаёт дубликаты.')
