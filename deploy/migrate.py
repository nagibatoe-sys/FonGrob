"""Apply checked migrations to this Compose stack with a shared database lock."""
from pathlib import Path
import subprocess
import hashlib
import time

root = Path(__file__).resolve().parent
command = ['docker', 'compose', '--env-file', str(root / '.env'), '-f', str(root / 'compose.yml')]
psql = command + ['exec', '-T', 'db', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1']
for attempt in range(60):
    ready = subprocess.run(psql + ['-Atc', "select to_regclass('auth.users') is not null"],
                           capture_output=True, text=True)
    if ready.returncode == 0 and ready.stdout.strip() == 't':
        break
    time.sleep(1)
else:
    raise SystemExit('Supabase Auth schema did not become ready')
parts = [
    "select pg_advisory_lock(7419023);",
    "create table if not exists public.schema_migrations(name text primary key, checksum text not null);"
]
for file in sorted((root.parent / 'supabase/migrations').glob('*.sql')):
    name = file.name
    checksum = hashlib.sha256(file.read_bytes()).hexdigest()
    parts.append(fr"""select exists(select 1 from public.schema_migrations where name='{name}' and checksum<>'{checksum}') as changed \gset
\if :changed
\echo Migration checksum mismatch
\quit 1
\endif
select exists(select 1 from public.schema_migrations where name='{name}') as applied \gset
\if :applied
\else
begin;""")
    lines = file.read_text().splitlines()
    parts.extend(line for line in lines if line.strip().lower() not in ('begin;', 'commit;'))
    parts.append(f"insert into public.schema_migrations values('{name}','{checksum}');\ncommit;\n\\endif")
parts.append("select pg_advisory_unlock(7419023);")
subprocess.run(psql, input='\n'.join(parts), text=True, check=True)
