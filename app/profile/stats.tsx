'use client'
import { useCallback,useEffect,useState } from 'react'
import { browserClient } from '../client'
type Transaction={id:string;amount:number;operation:string;created_at:string}
type Bet={id:string;title:string;stake:number;odds:number;status:string;created_at:string}
type Purchase={id:string;name:string;price:number;status:string;created_at:string}
type Badge={title:string;icon:string;rarity:string;awarded_at:string}
type Stats={id:string;name:string;avatar_url:string|null;public_stats:boolean;balance:number;season_position:number|null;bets:number;wins:number;losses:number;accuracy:number;max_win:number;bet_history:Bet[];transactions:Transaction[];purchases:Purchase[];achievements:Badge[]}
export function ProfileStats({profileId}:{profileId?:string}){
 const [period,setPeriod]=useState('all')
 const [data,setData]=useState<Stats|null>(null)
 const [avatar,setAvatar]=useState('')
 const [publicStats,setPublicStats]=useState(false)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [selected,setSelected]=useState<number|null>(null)
 const [loading,setLoading]=useState(true)
 const load=useCallback(async()=>{
  const since=period==='all'?null:new Date(Date.now()-Number(period)*86400000).toISOString()
  const {data:result,error:failure}=await browserClient().rpc('user_statistics',{p_id:profileId||null,p_since:since,p_until:null})
  if(failure)setError(profileId?'Профиль закрыт или недоступен.':'Не удалось загрузить статистику.')
  else{const stats=result as Stats;setData(stats);setAvatar(stats.avatar_url||'');setPublicStats(stats.public_stats);setError('')}
  setLoading(false)
 },[period,profileId])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 async function save(){
  if(!data)return
  if(avatar&&!/^https:\/\/[^ ]+$/.test(avatar)){setError('Укажите HTTPS-адрес изображения.');return}
  const {error:failure}=await browserClient().from('profiles').update({avatar_url:avatar||null,public_stats:publicStats}).eq('id',data.id)
  if(failure)setError(failure.message);else{setMessage('Настройки профиля сохранены.');await load()}
 }
 const entries=data?.transactions||[]
 const start=(data?.balance||0)-entries.reduce((sum,item)=>sum+Number(item.amount),0)
 const values=[start,...entries.map((_,index)=>start+entries.slice(0,index+1).reduce((sum,item)=>sum+Number(item.amount),0))]
 const min=Math.min(...values,0),max=Math.max(...values,1)
 const points=values.map((value,index)=>`${20+index*560/Math.max(1,values.length-1)},${160-(value-min)*140/Math.max(1,max-min)}`).join(' ')
 return <section className="feature-page">{loading&&<p role="status">Загрузка статистики…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}{message&&<p role="status">{message}</p>}
 {data&&<><div className="feature-row">{data.avatar_url&&<img src={data.avatar_url} alt={`Аватар ${data.name}`} width={72} height={72} style={{borderRadius:'50%',objectFit:'cover'}}/>}<div><h2>{data.name}</h2><p>Баланс: <strong>{data.balance} OC</strong>{data.season_position?` · Место в сезоне: ${data.season_position}`:''}</p></div></div>
 <div className="feature-row" role="group" aria-label="Период статистики">{[['all','Всё время'],['30','30 дней'],['90','90 дней']].map(([value,label])=><button key={value} aria-pressed={period===value} onClick={()=>{setPeriod(value);setLoading(true)}}>{label}</button>)}</div>
 <div className="feature-grid profile-stat-grid">{[['Всего ставок',data.bets],['Победы',data.wins],['Проигрыши',data.losses],['Точность',`${data.accuracy}%`],['Максимальный выигрыш',`${data.max_win} OC`],['Изменение баланса',`${entries.reduce((sum,item)=>sum+Number(item.amount),0).toFixed(2)} OC`]].map(([label,value])=><div className="feature-card" key={label}><small>{label}</small><h2>{value}</h2></div>)}</div>
 <section className="feature-card"><h2>Баланс во времени</h2>{entries.length?<><svg viewBox="0 0 600 180" role="img" aria-label="График изменения баланса" style={{width:'100%',height:220}}><polyline fill="none" stroke="var(--accent)" strokeWidth="3" points={points}/>{values.map((value,index)=><circle key={index} cx={20+index*560/Math.max(1,values.length-1)} cy={160-(value-min)*140/Math.max(1,max-min)} r="5" fill="var(--accent)" tabIndex={0} onFocus={()=>setSelected(index)} onMouseEnter={()=>setSelected(index)}><title>{value.toFixed(2)} OC</title></circle>)}</svg><p role="status">{selected!==null?`${values[selected].toFixed(2)} OC`:'Наведите на точку графика или выберите её клавиатурой.'}</p></>:<p>Операций за этот период нет.</p>}</section>
 <div className="feature-grid"><section className="feature-card"><h2>История ставок</h2>{data.bet_history.length?data.bet_history.map(item=><p key={item.id}>{item.title} · {item.stake} OC × {item.odds} · {item.status}</p>):<p>Ставок нет.</p>}</section><section className="feature-card"><h2>Операции OC</h2>{entries.length?entries.map(item=><p key={item.id}>{new Date(item.created_at).toLocaleDateString('ru-RU')} · {item.operation} · {item.amount} OC</p>):<p>Операций нет.</p>}</section>
 <section className="feature-card"><h2>Достижения</h2>{data.achievements.length?data.achievements.map(item=><p key={item.title}>{item.icon} {item.title}</p>):<p>Пока нет достижений.</p>}</section><section className="feature-card"><h2>Покупки</h2>{data.purchases.length?data.purchases.map(item=><p key={item.id}>{item.name} · {item.price} OC · {item.status}</p>):<p>Покупок нет.</p>}</section></div>
 {!profileId&&<section className="feature-card"><h2>Публичный профиль</h2><label>HTTPS-адрес аватара<input value={avatar} onChange={event=>setAvatar(event.target.value)} placeholder="https://…"/></label><label className="feature-row"><input type="checkbox" checked={publicStats} onChange={event=>setPublicStats(event.target.checked)}/> Показывать мою статистику другим участникам</label><button onClick={()=>void save()}>Сохранить</button></section>}
 </>}</section>
}
