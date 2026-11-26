import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('authenticated user sees only their wallet and cannot change balances', async () => {
  const db = new PGlite()
  const owner = '00000000-0000-0000-0000-000000000001'
  try {
    await db.exec(`create schema auth; create role authenticated; create role anon;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select '${owner}'::uuid $$;`)
    await db.exec(await readFile(new URL('../supabase/migrations/202611250001_core.sql', import.meta.url), 'utf8'))
    await db.exec(`insert into auth.users values ('${owner}'),(gen_random_uuid());
      insert into profiles select id, 'Сотрудник', null from auth.users;
      insert into wallets select id, 10 from profiles;
      set role authenticated;`)
    assert.deepEqual((await db.query('select profile_id from wallets')).rows, [{profile_id: owner}])
    await assert.rejects(db.query('update wallets set balance = 20'), {code:'42501'})
  } finally {
    await db.close()
  }
})
