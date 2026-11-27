'use client'
import Link from 'next/link'
import { useEffect,useState } from 'react'
import { browserClient } from '../client'
import { SiteNav } from '../site-nav'
type Entry={category:string;place:number;profile_id:string|null;display_name:string;score:number}
export default function HallPage(){
 const [entries,setEntries]=useState<Entry[]>([])
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 useEffect(()=>{void Promise.resolve().then(async()=>{const {data,error:failure}=await browserClient().rpc('hall_of_fame');if(failure)setError('Войдите в аккаунт, чтобы открыть Зал славы.');else setEntries(data as Entry[]);setLoading(false)})},[])
 const categories=[...new Set(entries.map(item=>item.category))]
 return <><SiteNav/><main className="feature-page"><h1>Зал славы</h1><p>Исторические результаты, победители сезонов и достижения участников.</p>
  {loading&&<p role="status">Загрузка…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}
  {!loading&&!error&&(categories.length?<div className="feature-grid">{categories.map(category=><section className="feature-card" key={category}><h2>{category}</h2>{entries.filter(item=>item.category===category).map(item=><p key={item.place}><strong className={`rank-${item.place}`}>#{item.place}</strong> {item.profile_id?<Link href={`/players/${item.profile_id}`}>{item.display_name}</Link>:item.display_name} · {item.score}</p>)}</section>)}</div>:<p>Рекорды появятся после рассчитанных ставок и завершённых сезонов.</p>)}
 </main></>
}
