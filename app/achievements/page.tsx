'use client'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../client'
import { SiteNav } from '../site-nav'
type Achievement={id:string;code:string;title:string;description:string;rarity:string;icon:string;threshold:number;current_value:number;reward_oc:number;awarded_at:string|null}
type Notice={id:string;title:string;body:string;created_at:string;read_at:string|null}
const rarity:Record<string,string>={common:'Обычное',rare:'Редкое',epic:'Эпическое',legendary:'Легендарное'}
export default function AchievementsPage(){
 const [items,setItems]=useState<Achievement[]>([])
 const [notices,setNotices]=useState<Notice[]>([])
 const [error,setError]=useState('')
 const [noticeMessage,setNoticeMessage]=useState('')
 const [loading,setLoading]=useState(true)
 const load=useCallback(async()=>{
  const db=browserClient()
  const [a,n]=await Promise.all([db.rpc('achievement_progress'),db.rpc('my_notifications')])
  if(a.error||n.error)setError('Войдите в аккаунт, чтобы увидеть достижения.')
  else{setItems(a.data as Achievement[]);setNotices(n.data as Notice[]);setError('')}
  setLoading(false)
 },[])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 useEffect(()=>{if(typeof Notification==='undefined'||Notification.permission!=='granted')return;for(const item of notices.filter(item=>!item.read_at)){const key=`fongrob:notice:${item.id}`;if(!sessionStorage.getItem(key)){new Notification(item.title,{body:item.body});sessionStorage.setItem(key,'1')}}},[notices])
 async function read(id:string){await browserClient().rpc('mark_notification_read',{p_id:id});await load()}
 async function enableNotifications(){if(typeof Notification==='undefined'){setNoticeMessage('Системные уведомления недоступны.');return}const permission=await Notification.requestPermission();setNoticeMessage(permission==='granted'?'Уведомления включены.':'Уведомления не разрешены в системе или настройках приложения.')}
 return <><SiteNav/><main className="feature-page"><h1>Достижения</h1><p>Прогресс считается по вашим ставкам и завершённым сезонам.</p>
  {loading&&<p role="status">Загрузка…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}
  {!error&&<><div className="feature-grid">{items.map(item=><article className={`feature-card rarity-${item.rarity}`} key={item.id}><div style={{fontSize:'2.5rem'}} aria-hidden="true">{item.icon}</div><small>{rarity[item.rarity]}</small><h2>{item.title}</h2><p>{item.description}</p><progress max={item.threshold} value={Math.min(item.current_value,item.threshold)}/><p>{item.awarded_at?`Получено ${new Date(item.awarded_at).toLocaleDateString('ru-RU')}`:`${item.current_value} из ${item.threshold}`}{item.reward_oc>0?` · Награда ${item.reward_oc} OC`:''}</p></article>)}</div>
  {!loading&&!items.length&&<p>Достижения пока не настроены.</p>}
  <section className="feature-card"><h2>Уведомления</h2><button onClick={()=>void enableNotifications()}>Включить системные уведомления</button>{noticeMessage&&<p role="status">{noticeMessage}</p>}{notices.length?notices.map(item=><div key={item.id} className="feature-row"><p><strong>{item.title}</strong> · {item.body} · {new Date(item.created_at).toLocaleDateString('ru-RU')}</p>{!item.read_at&&<button onClick={()=>void read(item.id)}>Прочитано</button>}</div>):<p>Новых уведомлений нет.</p>}</section></>}
 </main></>
}
