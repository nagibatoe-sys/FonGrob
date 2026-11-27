#!/bin/sh
set -eu
while :; do
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h db -U postgres -v ON_ERROR_STOP=1 -Atc \
    'select public.rollover_seasons(); select public.refresh_all_achievements();' || true
  sleep 3600
done
