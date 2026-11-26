"""Create an administrator-issued login; run on the VPS after migrations."""
import argparse
import base64
import getpass
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parent
config = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines()
              if '=' in line and not line.startswith('#'))
parser = argparse.ArgumentParser(description='Создать учётную запись ФОНГРОБ')
parser.add_argument('login', help='3–32 латинских символа, цифры, точка, дефис или подчёркивание')
parser.add_argument('--name', required=True, help='Имя, отображаемое в приложении')
parser.add_argument('--super-admin', action='store_true', help='Назначить первого SUPER_ADMIN')
args = parser.parse_args()
login = args.login.strip().lower()
if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,31}', login):
    parser.error('Неверный формат логина')
name = args.name.strip()
if not 1 <= len(name) <= 80:
    parser.error('Имя должно содержать 1–80 символов')
password = getpass.getpass('Пароль нового пользователя (не менее 5 символов): ')
if len(password) < 5:
    parser.error('Пароль слишком короткий')
email = f'{login}@accounts.fongrob.invalid'
secret = config['JWT_SECRET'].encode()
def enc(data):
    return base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode()).rstrip(b'=').decode()
now = int(time.time())
body = enc({'role': 'service_role', 'iss': 'fongrob-admin', 'aud': 'authenticated', 'iat': now, 'exp': now + 300})
header = enc({'alg': 'HS256', 'typ': 'JWT'})
message = f'{header}.{body}'
token = message + '.' + base64.urlsafe_b64encode(hmac.new(secret, message.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
invite = secrets.token_hex(32)
def literal(value):
    return "'" + value.replace("'", "''") + "'"
def sql(query):
    result = subprocess.run(['docker', 'compose', '--env-file', str(root / '.env'), '-f', str(root / 'compose.yml'),
                             'exec', '-T', 'db', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'],
                            input=query, text=True, capture_output=True)
    if result.returncode:
        raise SystemExit(result.stderr.strip())
    return result.stdout.strip()
if args.super_admin and sql("select count(*) from public.user_roles where role_code='SUPER_ADMIN';") != '0':
    raise SystemExit('SUPER_ADMIN уже существует')
if sql(f'select count(*) from auth.users where email={literal(email)};') != '0':
    raise SystemExit('Логин уже занят')
sql(f"insert into public.invitations(token_hash,email,expires_at) values "
    f"(decode('{hashlib.sha256(invite.encode()).hexdigest()}','hex'),{literal(email)},now()+interval '5 minutes');")
request = urllib.request.Request('http://127.0.0.1:9999/admin/users',
    data=json.dumps({'email': email, 'password': password, 'email_confirm': True,
                     'user_metadata': {'display_name': name, 'invitation': invite}}).encode(),
    headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'apikey': token}, method='POST')
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        user = json.load(response)
except urllib.error.HTTPError as error:
    print('Сервис входа отклонил создание пользователя:', error.read().decode()[:500], file=sys.stderr)
    raise SystemExit(1)
except urllib.error.URLError as error:
    raise SystemExit(f'Сервис входа недоступен: {error}')
if args.super_admin:
    sql(f"insert into public.user_roles(profile_id,role_code) values ({literal(user['id'])},'SUPER_ADMIN');")
print(f'Создан пользователь: {login}' + (' (SUPER_ADMIN)' if args.super_admin else ''))
print('Передайте ему логин и пароль через защищённый канал. Пароль в журнал не записывался.')
