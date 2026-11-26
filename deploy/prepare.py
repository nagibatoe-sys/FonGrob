"""Create untracked configuration once, with distinct generated secrets."""
from pathlib import Path
import secrets
import os

root = Path(__file__).resolve().parent
target = root / '.env'
text = (root / '.env.example').read_text()
for name in ('POSTGRES_PASSWORD', 'REST_PASSWORD', 'JWT_SECRET'):
    text = text.replace(name + '=\n', name + '=' + secrets.token_hex(32) + '\n')
with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
    file.write(text)
print('Created deploy/.env. Set domain, public URL and SMTP before starting.')
