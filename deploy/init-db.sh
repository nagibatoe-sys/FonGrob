#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 -U postgres --set=rest_password="$REST_PASSWORD" <<'SQL'
create schema auth;
create role authenticated nologin;
create role anon nologin;
select format('create role fongrob_reader login noinherit password %L', :'rest_password') \gexec
grant authenticated, anon to fongrob_reader;
grant usage on schema auth to authenticated;
alter role postgres set search_path = auth,public;
SQL
