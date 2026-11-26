"""Локальная настройка первого администратора в Docker-стенде.
python scripts/bootstrap-admin.py employee@example.test
После регистрации с выданным кодом повторите команду для назначения роли.
"""
import sys
import secrets
import hashlib
import subprocess
import re

email = sys.argv[1].strip().lower()
if not re.fullmatch(r"[a-z0-9._+%-]+@[a-z0-9.-]+", email):
    raise SystemExit('Проверьте почту')
token = secrets.token_hex(32)
query = f"""
do $$
declare member uuid;
begin
 if exists(select 1 from public.user_roles where role_code='SUPER_ADMIN') then
  raise exception 'Первый администратор уже назначен';
 end if;
 select id into member from auth.users where email='{email}' and email_confirmed_at is not null;
 if member is not null then
  insert into public.user_roles values(member,'SUPER_ADMIN') on conflict do nothing;
 else
  insert into public.invitations(token_hash,email,expires_at)
  values(decode('{hashlib.sha256(token.encode()).hexdigest()}','hex'),'{email}',now()+interval '1 day');
 end if;
end $$;
"""
subprocess.run(['docker','exec','-i','fongrob-db','psql','-U','postgres','-v','ON_ERROR_STOP=1'],input=query.encode(),check=True)
print('Для регистрации используйте код ' + token + '. Если профиль уже подтверждён, роль назначена.')
