'use client'
import { useEffect,useState } from 'react'
import { browserClient } from '../client'
import { SiteNav } from '../site-nav'
type Bet={id:string;stake:number;odds:number;status:string;created_at:string;outcomes:{label:string;markets:{events:{title:string}|null}|null}|null}
const labels:Record<string,string>={pending:'Ожидает результата',won:'Выигрыш',lost:'Проигрыш',void:'Возврат'}
export default function BetsPage(){
 const [items,setItems]=useState<Bet[]>([])
 const [filter,setFilter]=useState('all')
 const [error,setError]=useState('')
 const [loading,setLoading]=useState(true)
 useEffect(()=>{void Promise.resolve().then(async()=>{const {data,error:failure}=await browserClient().from('bets').select('id,stake,odds,status,created_at,outcomes(label,markets(events(title)))').order('created_at',{ascending:false}).limit(200);if(failure)setError('Войдите в аккаунт, чтобы увидеть ставки.');else setItems(data as unknown as Bet[]);setLoading(false)})},[])
 const visible=items.filter(item=>filter==='all'||item.status===filter)
 return <><SiteNav/><main className="feature-page"><h1>Мои ставки</h1><p>Личная история прогнозов на события.</p><label>Статус<select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">Все</option>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
 {loading&&<p role="status">Загрузка…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}
 {!loading&&!error&&(visible.length?<div className="feature-table-wrap"><table><thead><tr><th>Событие</th><th>Исход</th><th>Ставка</th><th>Коэффициент</th><th>Статус</th><th>Дата</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td>{item.outcomes?.markets?.events?.title||'Событие'}</td><td>{item.outcomes?.label||'—'}</td><td>{item.stake} OC</td><td>{item.odds}</td><td>{labels[item.status]||item.status}</td><td>{new Date(item.created_at).toLocaleDateString('ru-RU')}</td></tr>)}</tbody></table></div>:<p>Ставок с выбранным статусом пока нет.</p>)}
 </main></>
}
