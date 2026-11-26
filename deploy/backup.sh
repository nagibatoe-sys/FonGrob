#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
mkdir -p backups
backup="backups/fongrob-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose --env-file .env -f compose.yml exec -T db pg_dump -U postgres -Fc > "$backup.tmp"
mv "$backup.tmp" "$backup"
printf '%s\n' "$backup"
