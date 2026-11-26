'use client'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../../client'
import { PariHeader } from '../header'
type Option={id:string;label:string}
type Answer={option_id:string|null;free_text:string|null;name:string;created_at:string}
type Pari={id:string;type:'binary'|'multi'|'free';title:string;condition:string;event_date:string|null;deadline_at:string;timezone:string;hidden_answers:boolean;status:string;creator_id:string;result_option_id:string|null;result_text:string|null;options:Option[];my_answer:{option_id:string|null;free_text:string|null}|null;answers?:Answer[]}
export default function PariPage(){
 const {id}=useParams<{id:string}>()
 const [pari,setPari]=useState<Pari|null>(null)
 const [uid,setUid]=useState<string|null>(null)
 const [choice,setChoice]=useState('')
 const [text,setText]=useState('')
 const [result,setResult]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const load=useCallback(async()=>{
  const db=browserClient()
  const [session,response]=await Promise.all([db.auth.getUser(),db.rpc('get_pari',{p_id:id})])
  setUid(session.data.user?.id||null)
  if(response.error)setError('Не удалось загрузить пари. Войдите в аккаунт и проверьте ссылку.')
  else {setPari(response.data as Pari);setError('')}
 },[id])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 async function submit(){
  if(!pari||busy)return
  setBusy(true);setError('')
  const {error:failure}=await browserClient().rpc('submit_pari_answer',{p_id:id,p_option_id:pari.type==='free'?null:choice||null,p_free_text:pari.type==='free'?text.trim():null})
  if(failure)setError(failure.message)
  else await load()
  setBusy(false)
 }
 async function finish(){
  if(!pari||busy)return
  setBusy(true);setError('')
  const {error:failure}=await browserClient().rpc('finish_pari',{p_id:id,p_option_id:pari.type==='free'?null:result||null,p_result_text:pari.type==='free'?result.trim():null})
  if(failure)setError(failure.message)
  else await load()
  setBusy(false)
 }
 const label=(optionId:string|null)=>pari?.options.find(item=>item.id===optionId)?.label||'—'
 const closed=pari?.status!=='open'
 return <><PariHeader/><main><small>Пари / Просмотр</small>{!pari?<p role="status">{error||'Загрузка…'}</p>:<div className="pari-detail panel"><small>{pari.type==='binary'?'ДА / НЕТ':pari.type==='multi'?'ВАРИАНТЫ ОТВЕТА':'СВОБОДНЫЙ ОТВЕТ'} · {pari.status==='completed'?'Завершено':closed?'Ожидание итога':'Приём ответов'}</small><h1>{pari.title}</h1><p>{pari.condition}</p>{pari.event_date&&<p>Дата события: {pari.event_date.split('-').reverse().join('.')}</p>}<p>Приём ответов до: {new Date(pari.deadline_at).toLocaleString('ru-RU',{timeZone:pari.timezone})} ({pari.timezone})</p><hr/>
  {pari.status==='completed'&&<p className="success">Результат: {pari.type==='free'?pari.result_text:label(pari.result_option_id)}</p>}
  <h2>Ваш ответ</h2>{pari.my_answer?<p className="success">{pari.type==='free'?pari.my_answer.free_text:label(pari.my_answer.option_id)} · Ответ отправлен</p>:closed?<p>Приём ответов завершён.</p>:<><div className="pari-answer">{pari.type==='free'?<><label htmlFor="answer-text">Ваш прогноз</label><textarea id="answer-text" maxLength={1000} value={text} onChange={event=>setText(event.target.value)}/></>:pari.options.map(option=><button key={option.id} className={`btn choice ${choice===option.id?'selected':''}`} aria-pressed={choice===option.id} onClick={()=>setChoice(option.id)}>{option.label}</button>)}</div><button className="btn primary" disabled={busy||!(pari.type==='free'?text.trim():choice)} onClick={()=>void submit()}>{busy?'Отправка…':'Отправить ответ'}</button></>}
  <hr/><h2>Ответы участников</h2>{pari.answers?<>{pari.answers.length?pari.answers.map((answer,index)=><p key={index}>{answer.name}: {pari.type==='free'?answer.free_text:label(answer.option_id)}</p>):<p>Ответов пока нет.</p>}</>:<p>Ответы скрыты до окончания приёма прогнозов.</p>}
  {closed&&pari.status!=='completed'&&uid===pari.creator_id&&<><hr/><h2>Завершить пари</h2>{pari.type==='free'?<><label htmlFor="result-text">Итоговый результат</label><textarea id="result-text" value={result} maxLength={1000} onChange={event=>setResult(event.target.value)}/></>:pari.options.map(option=><button key={option.id} className={`btn choice ${result===option.id?'selected':''}`} aria-pressed={result===option.id} onClick={()=>setResult(option.id)}>{option.label}</button>)}<button className="btn primary" disabled={busy||!result.trim()} onClick={()=>void finish()}>Зафиксировать результат</button></>}
  {error&&<p className="error" role="alert">{error}</p>}
 </div>}</main></>
}
