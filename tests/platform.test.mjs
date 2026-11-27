import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile,readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('shop is atomic and idempotent; achievements and seasons use server data', async()=>{
 const db=new PGlite()
 const admin='00000000-0000-0000-0000-000000000021'
 const member='00000000-0000-0000-0000-000000000022'
 try{
  await db.exec(`create role authenticated; create role anon; create schema auth;
   create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,created_at timestamptz default now());
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;`)
  const folder=new URL('../supabase/migrations/',import.meta.url)
  for(const file of (await readdir(folder)).sort())await db.exec(await readFile(new URL(file,folder),'utf8'))
  await db.exec(`alter table auth.users disable trigger register_office_member;
   insert into auth.users(id,email) values('${admin}','admin@example.test'),('${member}','member@example.test');
   insert into profiles(id,display_name) values('${admin}','Админ'),('${member}','Игрок');
   insert into wallets(profile_id,balance) values('${admin}',1000),('${member}',1000);
   insert into user_roles(profile_id,role_code) values('${admin}','ADMIN');`)
  await db.query('select set_config($1,$2,false)',['test.uid',member])
  await db.exec('set role authenticated')
  await assert.rejects(db.query("select upsert_reward_category('test','Проверка')"),{code:'42501'})
  await db.query('select set_config($1,$2,false)',['test.uid',admin])
  const product=(await db.query("select upsert_reward_product(null,'office','Кофе','Чашка кофе',null,100,1,true) id")).rows[0].id
  assert.equal((await db.query('select count(*) total from admin_actions')).rows[0].total,1)
  await db.query('select set_config($1,$2,false)',['test.uid',member])
  const request='00000000-0000-0000-0000-000000000023'
  await db.query('select purchase_reward($1,$2)',[request,product])
  await db.query('select purchase_reward($1,$2)',[request,product])
  assert.equal((await db.query('select balance from wallets where profile_id=$1',[member])).rows[0].balance,'900.00')
  assert.equal((await db.query('select stock from reward_products where id=$1',[product])).rows[0].stock,0)
  await assert.rejects(db.query('select purchase_reward(gen_random_uuid(),$1)',[product]),/недоступен/)
  await db.query('select set_config($1,$2,false)',['test.uid',admin])
  await db.query("select set_reward_order_status($1,'cancelled')",[request])
  await db.query("select set_reward_order_status($1,'cancelled')",[request])
  await db.exec('reset role')
  assert.equal((await db.query('select balance from wallets where profile_id=$1',[member])).rows[0].balance,'1000.00')
  assert.equal((await db.query('select count(*) total from wallet_transactions where operation_key=$1',['shop_refund:'+request])).rows[0].total,1)
  assert.equal((await db.query('select stock from reward_products where id=$1',[product])).rows[0].stock,1)
  await db.exec('set role authenticated')
  await db.query('select set_config($1,$2,false)',['test.uid',member])
  const cosmetic='a10c0000-0000-4000-8000-000000000001'
  const styleRequest='00000000-0000-0000-0000-000000000024'
  await db.query('select purchase_reward($1,$2)',[styleRequest,cosmetic])
  await db.query('select purchase_reward($1,$2)',[styleRequest,cosmetic])
  assert.equal((await db.query('select balance from wallets where profile_id=$1',[member])).rows[0].balance,'760.00')
  assert.equal((await db.query('select status from reward_orders where id=$1',[styleRequest])).rows[0].status,'issued')
  assert.equal((await db.query('select accent_code from profiles where id=$1',[member])).rows[0].accent_code,'gold')
  await assert.rejects(db.query('select purchase_reward(gen_random_uuid(),$1)',[cosmetic]),/уже приобретено/)
  await db.query("select equip_cosmetic('standard')")
  await assert.rejects(db.query("select equip_cosmetic('ice')"),/не приобретено/)
  await db.query("select equip_cosmetic('gold')")
  await assert.rejects(db.query("update profiles set accent_code='ice' where id=$1",[member]),{code:'42501'})
  await db.query('select set_config($1,$2,false)',['test.uid',admin])
  const season=(await db.query('select count(*) total from season_directory()')).rows[0].total
  assert.equal(season,1)
  const event=(await db.query("select propose_event('Демо событие','Проверяемое условие',now()+interval '1 day') id")).rows[0].id
  await db.query('select publish_event($1)',[event])
  const outcome=(await db.query('select o.id from outcomes o join markets m on m.id=o.market_id where m.event_id=$1 limit 1',[event])).rows[0].id
  await db.query('select set_config($1,$2,false)',['test.uid',member])
  await db.query('select place_bet(gen_random_uuid(),$1,10)',[outcome])
  const badges=(await db.query('select title from achievement_progress()')).rows.map(row=>row.title)
  assert.ok(badges.includes('Первый шаг'))
  assert.equal((await db.query("select count(*) total from user_achievements ua join achievements a on a.id=ua.achievement_id where ua.profile_id=$1 and a.code='first_step'",[member])).rows[0].total,1)
 }finally{await db.close()}
})
