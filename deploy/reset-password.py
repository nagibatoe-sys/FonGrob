"""Set a new password for an existing user without email delivery."""
import argparse
import base64
import getpass
import hashlib
import hmac
import json
from pathlib import Path
import re
import subprocess
import time
import urllib.error
import urllib.request

root = Path(__file__).resolve().parent
config = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines()
              if '=' in line and not line.startswith('#'))
parser = argparse.ArgumentParser(description='Сменить пароль пользователя ФОНГРОБ')
parser.add_argument('login')
args = parser.parse_args()
login = args.login.strip().lower()
if not re.fullmatch(r'[a-z0-9][a-z0-9._-]{2,31}', login):
    parser.error('Неверный формат логина')
email = f'{login}@accounts.fongrob.invalid'
query = "select id from auth.users where email='" + email + "';"
result = subprocess.run(['docker', 'compose', '--env-file', str(root / '.env'), '-f', str(root / 'compose.yml'),
                         'exec', '-T', 'db', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', query],
                        text=True, capture_output=True, check=True, stdin=subprocess.DEVNULL)
user_id = result.stdout.strip()
if not user_id:
    raise SystemExit('Пользователь не найден')
password = getpass.getpass('Новый пароль (не менее 12 символов): ')
if len(password) < 12:
    parser.error('Пароль слишком короткий')
def enc(data):
    return base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode()).rstrip(b'=').decode()
now = int(time.time())
message = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({'role': 'service_role', 'iss': 'fongrob-admin', 'aud': 'authenticated', 'iat': now, 'exp': now + 300})
token = message + '.' + base64.urlsafe_b64encode(hmac.new(config['JWT_SECRET'].encode(), message.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
request = urllib.request.Request('http://127.0.0.1:9999/admin/users/' + user_id,
    data=json.dumps({'password': password}).encode(),
    headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'apikey': token}, method='PUT')
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        print('Пароль изменён для:', login, 'HTTP', response.status)
except urllib.error.HTTPError as error:
    raise SystemExit('Сервис входа отклонил изменение: ' + error.read().decode()[:500])
