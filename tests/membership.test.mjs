import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('invite-only registration and opening credit are atomic', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select current_setting('test.uid',true)::uuid $$;`)
    const folder = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(folder)).sort()) {
      await db.exec(await readFile(new URL(file, folder), 'utf8'))
    }
    await db.exec(`insert into invitations(token_hash,email,expires_at)
      values(sha256(convert_to('bootstrap','UTF8')),'admin@example.test', now()+interval '1 hour')`)
    const signup = (email, invitation, display_name) => db.query(
      'insert into auth.users(email,raw_user_meta_data) values($1,$2) returning id',
      [email, JSON.stringify({invitation, display_name})])
    await assert.rejects(signup('someone@example.test','bootstrap','A'), /недействительно/)
    await assert.rejects(signup('admin@example.test','bootstrap',''), {code:'23514'})
    const [{id}] = (await signup('admin@example.test','bootstrap','Админ')).rows
    await assert.rejects(signup('admin@example.test','bootstrap','A'), /недействительно/)
    await db.query("select set_config('test.uid',$1,false)", [id])
    await db.exec('set role authenticated')
    await assert.rejects(db.query("select issue_invitation('b@example.test')"), {code:'42501'})
    await db.exec('reset role')
    await db.query("insert into user_roles values($1,'ADMIN')",[id])
    await db.exec('set role authenticated')
    const [{token}] = (await db.query("select issue_invitation('b@example.test') as token")).rows
    await db.exec('reset role')
    const [other] = (await signup('b@example.test',token,'Борис')).rows
    await db.exec('set role authenticated')
    assert.equal((await db.query("update profiles set display_name='Новое имя' where id=$1 returning id", [id])).rows.length, 1)
    assert.equal((await db.query("update profiles set display_name='Чужой' where id=$1 returning id", [other.id])).rows.length, 0)
    await assert.rejects(db.query("update profiles set department_id=gen_random_uuid()"), {code:'23503'})
    await assert.rejects(db.query("update profiles set id=gen_random_uuid()"), {code:'42501'})
    const [{eid}] = (await db.query("select propose_event('Тестовое событие','Проверяемый результат', now()+interval '1 day') eid")).rows
    await db.query('select publish_event($1)',[eid])
    const [{oid}] = (await db.query('select o.id oid from outcomes o join markets m on m.id=o.market_id where m.event_id=$1 limit 1',[eid])).rows
    await assert.rejects(db.query('select place_bet(gen_random_uuid(),$1,10)',[oid]), /управляете/)
    await db.query("select set_config('test.uid',$1,false)", [other.id])
    const [{bid}] = (await db.query('select place_bet(gen_random_uuid(),$1,10) bid',[oid])).rows
    await db.query('select place_bet($1,$2,10)',[bid,oid])
    assert.equal((await db.query('select balance from wallets')).rows[0].balance,'990.00')
    await db.query("select set_config('test.uid',$1,false)", [id])
    await db.query('select settle_event($1,$2)',[eid,oid])
    await db.query('select settle_event($1,$2)',[eid,oid])
    await db.query("select set_config('test.uid',$1,false)", [other.id])
    assert.equal((await db.query('select balance from wallets')).rows[0].balance,'1009.00')
    await db.query("select set_config('test.uid',$1,false)", [id])
    const [{cancelled}] = (await db.query("select propose_event('Отменяемое событие','Проверяемое правило',now()+interval '1 day') cancelled")).rows
    await db.query('select publish_event($1)',[cancelled])
    const [{choice}] = (await db.query('select o.id choice from outcomes o join markets m on m.id=o.market_id where m.event_id=$1 limit 1',[cancelled])).rows
    await db.query("select set_config('test.uid',$1,false)", [other.id])
    await db.query('select place_bet(gen_random_uuid(),$1,50)',[choice])
    await assert.rejects(db.query("select cancel_event($1,'Причина отмены события')",[cancelled]),{code:'42501'})
    await db.query("select set_config('test.uid',$1,false)", [id])
    await db.query("select cancel_event($1,'Причина отмены события')",[cancelled])
    await db.query("select cancel_event($1,'Причина отмены события')",[cancelled])
    await db.query("select set_config('test.uid',$1,false)", [other.id])
    assert.equal((await db.query('select balance from wallets')).rows[0].balance,'1009.00')
    await db.query("select set_config('test.uid',$1,false)", [id])
    assert.deepEqual((await db.query('select operation_key,amount from wallet_transactions')).rows,
      [{operation_key:'opening',amount:'1000.00'}])
    assert.deepEqual((await db.query('select balance from wallets')).rows,[{balance:'1000.00'}])
  } finally {
    await db.close()
  }
})
