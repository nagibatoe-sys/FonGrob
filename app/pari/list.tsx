'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../client'
import { PariHeader } from './header'
type Item = { id:string; title:string; condition:string; type:string; deadline_at:string; timezone:string; status:string; creator_name:string; answer_count:number|null }
const label: Record<string,string> = {binary:'Да / Нет',multi:'Варианты ответа',free:'Свободный ответ'}
export function PariList({history=false}:{history?:boolean}) {
 const [items,setItems]=useState<Item[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const load=useCallback(async()=>{
  setLoading(true)
  const {data,error:failure}=await browserClient().rpc('list_pari')
  if(failure)setError('Войдите в аккаунт, чтобы увидеть пари.')
  else {setItems(data as Item[]);setError('')}
  setLoading(false)
 },[])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 const filtered=items.filter(item=>history?item.status==='completed':item.status!=='completed')
 return <><PariHeader current={history?'history':'pari'}/><main><small>Пари / {history?'История':'Открытые пари'}</small><div className="row" style={{justifyContent:'space-between',marginTop:10}}><div><h1>{history?'История пари':'Пари'}</h1><p className="muted">{history?'Завершённые пари и их результаты.':'Создавайте пари и отвечайте на прогнозы коллег.'}</p></div>{!history&&<Link href="/pari/new" className="btn primary">＋ Создать пари</Link>}</div>
  {loading&&<p role="status">Загрузка…</p>}{error&&<p role="alert" className="error">{error}</p>}
  {!loading&&!error&&(!filtered.length?<div className="panel"><p>{history?'Завершённых пари пока нет.':'Пари пока нет. Создайте первое.'}</p></div>:<div className="pari-list">{filtered.map(item=><Link href={`/pari/${item.id}`} key={item.id} className="card"><small>{label[item.type]} · {item.status==='open'?'Приём ответов':'Ожидание итога'}</small><h2>{item.title}</h2><p>{item.condition}</p><small>Автор: {item.creator_name} · До {new Date(item.deadline_at).toLocaleString('ru-RU',{timeZone:item.timezone})} ({item.timezone}){item.answer_count===null?' · Ответы скрыты':` · Ответов: ${item.answer_count}`}</small></Link>)}</div>)}
 </main></>
}
