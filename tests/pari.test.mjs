import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('pari creation, private answers, deadline and unique participation', async () => {
  const db = new PGlite()
  const creator = '00000000-0000-0000-0000-000000000011'
  const member = '00000000-0000-0000-0000-000000000012'
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb, created_at timestamptz default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;`)
    const folder = new URL('../supabase/migrations/', import.meta.url)
    for (const file of (await readdir(folder)).sort()) await db.exec(await readFile(new URL(file,folder),'utf8'))
    await db.exec(`alter table auth.users disable trigger register_office_member;
      insert into auth.users(id,email) values('${creator}','creator@example.test'),('${member}','member@example.test');
      insert into public.profiles(id,display_name) values('${creator}','Автор'),('${member}','Участник');`)
    await db.query('select set_config($1,$2,false)', ['test.uid',creator])
    await db.exec('set role authenticated')
    const deadline = new Date(Date.now()+3600_000).toISOString()
    const created = await db.query(`select public.create_pari('multi','Куда поедем?','Выберите направление',null,$1,'UTC',true,'["Италия","Испания"]'::jsonb) id`,[deadline])
    const id = created.rows[0].id
    const first = (await db.query('select public.get_pari($1) data',[id])).rows[0].data
    assert.equal(first.options.length,2)
    assert.equal('answers' in first,false)
    await assert.rejects(db.query(`select public.create_pari('multi','Название','Условия',null,$1,'UTC',true,'["Да"," да "]'::jsonb)`,[deadline]),/повторяться/)
    await db.query('select set_config($1,$2,false)',['test.uid',member])
    await db.query('select public.submit_pari_answer($1,$2,null)',[id,first.options[0].id])
    await assert.rejects(db.query('select public.submit_pari_answer($1,$2,null)',[id,first.options[1].id]),{code:'23505'})
    const privateView = (await db.query('select public.get_pari($1) data',[id])).rows[0].data
    assert.equal('answers' in privateView,false)
    assert.equal(privateView.my_answer.option_id,first.options[0].id)
    await db.exec('reset role')
    await db.query("update public.pari set deadline_at=now()-interval '1 second' where id=$1",[id])
    await db.exec('set role authenticated')
    await assert.rejects(db.query('select public.submit_pari_answer($1,$2,null)',[id,first.options[0].id]),/завершён/)
    const publicView = (await db.query('select public.get_pari($1) data',[id])).rows[0].data
    assert.equal(publicView.status,'awaiting_result')
    assert.equal(publicView.answers.length,1)
    await assert.rejects(db.query('select public.finish_pari($1,$2,null)',[id,first.options[0].id]),{code:'42501'})
    await db.query('select set_config($1,$2,false)',['test.uid',creator])
    await db.query('select public.finish_pari($1,$2,null)',[id,first.options[0].id])
    assert.equal((await db.query('select public.get_pari($1) data',[id])).rows[0].data.status,'completed')
    const free = (await db.query(`select public.create_pari('free','Свободный прогноз','Напишите итог',null,$1,'Asia/Omsk',false,'[]'::jsonb) id`,[deadline])).rows[0].id
    await db.query('select set_config($1,$2,false)',['test.uid',member])
    await assert.rejects(db.query('select public.submit_pari_answer($1,null,$2)',[free,'   ']),/Введите ответ/)
    await db.query('select public.submit_pari_answer($1,null,$2)',[free,'  Прогноз  '])
    const visible = (await db.query('select public.get_pari($1) data',[free])).rows[0].data
    assert.equal(visible.answers[0].free_text,'Прогноз')
    await db.query('select set_config($1,$2,false)',['test.uid',creator])
    await assert.rejects(db.query(`select public.create_pari('binary','Да или нет','Проверяемый исход','2020-01-01',$1,'UTC',true,'[]'::jsonb)`,[deadline]),/Дедлайн позже даты события/)
  } finally { await db.close() }
})
