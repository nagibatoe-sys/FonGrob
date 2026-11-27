'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../client'
import { SiteNav } from '../site-nav'
type Season={id:string;starts_at:string;ends_at:string;status:string;winner_rule:string;winner_name:string|null;seconds_left:number}
type Row={profile_id:string;display_name:string;bets:number;wins:number;profit:number;accuracy:number|null;rank:number}
const rules:Record<string,string>={profit:'Прибыль OC',wins:'Победы',accuracy:'Точность'}
const remaining=(end:string,now:number)=>{const seconds=Math.max(0,Math.floor((new Date(end).getTime()-now)/1000));return `${Math.floor(seconds/86400)} дн. ${Math.floor(seconds%86400/3600)} ч. ${Math.floor(seconds%3600/60)} мин.`}
export function SeasonBoard({rating=false}:{rating?:boolean}){
 const [seasons,setSeasons]=useState<Season[]>([])
 const [selected,setSelected]=useState('')
 const [rows,setRows]=useState<Row[]>([])
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 const [now,setNow]=useState(0)
 const load=useCallback(async()=>{
  const db=browserClient()
  const {data,error:failure}=await db.rpc('season_directory')
  if(failure){setError('Войдите в аккаунт, чтобы открыть сезоны.');setLoading(false);return}
  const list=data as Season[];setSeasons(list)
  const id=selected||list.find(item=>item.status==='active')?.id||list[0]?.id||''
  setSelected(id)
  if(id){const result=await db.rpc('season_leaderboard',{p_season_id:id});if(result.error)setError(result.error.message);else{setRows(result.data as Row[]);setError('')}}
  setLoading(false)
 },[selected])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 useEffect(()=>{const initial=setTimeout(()=>setNow(Date.now()),0);const timer=setInterval(()=>setNow(Date.now()),60000);return()=>{clearTimeout(initial);clearInterval(timer)}},[])
 const active=seasons.find(item=>item.status==='active')
 const current=seasons.find(item=>item.id===selected)
 return <><SiteNav/><main className="feature-page"><h1>{rating?'Рейтинг':'Сезоны'}</h1><p>Сезонные показатели считаются по рассчитанным ставкам. Баланс и история сохраняются при смене сезона.</p>
  {active&&<section className="feature-card"><h2>Текущий сезон</h2><p>{new Date(active.starts_at).toLocaleDateString('ru-RU')} — {new Date(active.ends_at).toLocaleDateString('ru-RU')}</p><p>До окончания: <strong>{now?remaining(active.ends_at,now):'…'}</strong></p><small>Победитель определяется по показателю: {rules[active.winner_rule]}.</small></section>}
  <label>Выберите сезон<select value={selected} onChange={event=>{setSelected(event.target.value);setLoading(true)}}>{seasons.map(item=><option key={item.id} value={item.id}>{new Date(item.starts_at).toLocaleDateString('ru-RU')} — {new Date(item.ends_at).toLocaleDateString('ru-RU')} · {item.status==='active'?'Текущий':'Завершён'}</option>)}</select></label>
  {loading&&<p role="status">Загрузка рейтинга…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}
  {!loading&&!error&&<section className="feature-card"><h2>Таблица лидеров · {current?rules[current.winner_rule]:''}</h2>{rows.length?<div className="feature-table-wrap"><table><thead><tr><th>Место</th><th>Участник</th><th>Ставки</th><th>Победы</th><th>Точность</th><th>Прибыль</th></tr></thead><tbody>{rows.map(row=><tr key={row.profile_id}><td className={`rank-${row.rank}`}>{row.rank}</td><td>{row.display_name==='Участник'?row.display_name:<Link href={`/players/${row.profile_id}`}>{row.display_name}</Link>}</td><td>{row.bets}</td><td>{row.wins}</td><td>{row.accuracy??0}%</td><td>{row.profit} OC</td></tr>)}</tbody></table></div>:<p>Рассчитанных ставок в этом сезоне пока нет.</p>}</section>}
  {!rating&&<section className="feature-card"><h2>Архив победителей</h2>{seasons.filter(item=>item.status==='completed').length?seasons.filter(item=>item.status==='completed').map(item=><p key={item.id}>{new Date(item.starts_at).toLocaleDateString('ru-RU')} — {new Date(item.ends_at).toLocaleDateString('ru-RU')}: <strong>{item.winner_name||'Победитель не определён'}</strong></p>):<p>Завершённых сезонов пока нет.</p>}</section>}
 </main></>
}
