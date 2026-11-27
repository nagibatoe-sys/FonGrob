'use client'
import Link from 'next/link'
import { useCallback,useEffect,useState,type FormEvent } from 'react'
import { browserClient } from '../../client'
type Category={code:string;name:string}
type Product={id:string;category_code:string;name:string;description:string;image_url:string|null;price:number;stock:number;active:boolean}
type Order={id:string;login:string;product_name:string;price:number;status:string;created_at:string}
type Achievement={id:string;code:string;title:string;description:string;rarity:string;icon:string;rule_code:string;threshold:number;reward_oc:number;enabled:boolean}
type Settings={duration_months:number;winner_rule:string;winner_reward:number}
type UserStat={id:string;login:string;display_name:string;balance:number;bets:number;wins:number;accuracy:number;orders:number}
type Audit={id:string;actor_id:string;entity:string;entity_id:string;action:string;created_at:string}
const statuses:Record<string,string>={ordered:'Оформлен',confirmed:'Подтверждён',issued:'Выдан',cancelled:'Отменён'}
export default function ManagePage(){
 const [tab,setTab]=useState('products')
 const [categories,setCategories]=useState<Category[]>([])
 const [products,setProducts]=useState<Product[]>([])
 const [orders,setOrders]=useState<Order[]>([])
 const [achievements,setAchievements]=useState<Achievement[]>([])
 const [settings,setSettings]=useState<Settings|null>(null)
 const [stats,setStats]=useState<UserStat[]>([])
 const [audit,setAudit]=useState<Audit[]>([])
 const [editingProduct,setEditingProduct]=useState<Product|null>(null)
 const [editingAchievement,setEditingAchievement]=useState<Achievement|null>(null)
 const [message,setMessage]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const load=useCallback(async()=>{
  const db=browserClient()
  const [c,p,o,a,s,u,l]=await Promise.all([
   db.from('reward_categories').select('code,name').order('name'),
   db.from('reward_products').select('id,category_code,name,description,image_url,price,stock,active').order('created_at',{ascending:false}),
   db.rpc('admin_reward_orders'),
   db.from('achievements').select('id,code,title,description,rarity,icon,rule_code,threshold,reward_oc,enabled').order('title'),
   db.from('season_settings').select('duration_months,winner_rule,winner_reward').single(),
   db.rpc('admin_user_stats'),
   db.from('admin_actions').select('id,actor_id,entity,entity_id,action,created_at').order('created_at',{ascending:false}).limit(100)
  ])
  if(c.error||p.error||o.error||a.error||s.error||u.error||l.error)setError('Войдите как администратор, чтобы открыть управление.')
  else{setCategories(c.data);setProducts(p.data);setOrders(o.data as Order[]);setAchievements(a.data);setSettings(s.data);setStats(u.data as UserStat[]);setAudit(l.data);setError('')}
  setLoading(false)
 },[])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 async function run(action:()=>PromiseLike<{error:{message:string}|null}>,success:string){setBusy(true);setError('');setMessage('');try{const result=await action();if(result.error)throw result.error;setMessage(success);await load()}catch(cause){setError(cause instanceof Error?cause.message:'Операция не выполнена.')}finally{setBusy(false)}}
 function categorySubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);void run(()=>browserClient().rpc('upsert_reward_category',{p_code:String(data.get('code')).trim(),p_name:String(data.get('name')).trim()}),'Категория сохранена.');form.reset()}
 function productSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);void run(()=>browserClient().rpc('upsert_reward_product',{p_id:editingProduct?.id||null,p_category:data.get('category'),p_name:data.get('name'),p_description:data.get('description'),p_image_url:String(data.get('image')||'').trim()||null,p_price:Number(data.get('price')),p_stock:Number(data.get('stock')),p_active:data.get('active')==='on'}),'Товар сохранён.');setEditingProduct(null);form.reset()}
 function achievementSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);void run(()=>browserClient().rpc('upsert_achievement',{p_id:editingAchievement?.id||null,p_code:data.get('code'),p_title:data.get('title'),p_description:data.get('description'),p_rarity:data.get('rarity'),p_icon:data.get('icon'),p_rule_code:data.get('rule'),p_threshold:Number(data.get('threshold')),p_reward_oc:Number(data.get('reward')),p_enabled:data.get('enabled')==='on'}),'Достижение сохранено.');setEditingAchievement(null);form.reset()}
 function settingsSubmit(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);void run(()=>browserClient().rpc('set_season_settings',{p_duration_months:Number(data.get('months')),p_winner_rule:data.get('rule'),p_winner_reward:Number(data.get('reward'))}),'Настройки следующего сезона сохранены.')}
 return <main className="feature-page"><header className="feature-row"><Link href="/">ФОНГРОБ</Link><Link href="/admin/users">Пользователи</Link><Link href="/admin/live">Ставки и пари</Link><Link href="/profile">Профиль</Link></header><h1>Управление платформой</h1>
  <div className="feature-row" role="tablist" aria-label="Разделы управления">{[['products','Товары'],['orders','Заказы'],['achievements','Достижения'],['seasons','Сезоны'],['stats','Статистика'],['audit','Журнал']].map(([value,label])=><button role="tab" aria-selected={tab===value} key={value} onClick={()=>setTab(value)}>{label}</button>)}</div>
  {loading&&<p role="status">Загрузка…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {!loading&&!error&&<section className="feature-card" role="tabpanel">
   {tab==='products'&&<><h2>Категории и товары</h2><form onSubmit={categorySubmit} className="feature-row"><label>Код категории<input name="code" pattern="[a-z][a-z0-9_-]{1,31}" required/></label><label>Название<input name="name" required minLength={2}/></label><button disabled={busy}>Сохранить категорию</button></form><p>Категории: {categories.map(item=>item.name).join(', ')||'нет'}</p>
    <form key={editingProduct?.id||'new'} onSubmit={productSubmit}><h2>{editingProduct?'Изменить товар':'Новый товар'}</h2><div className="feature-grid"><label>Категория<select name="category" defaultValue={editingProduct?.category_code} required>{categories.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>Название<input name="name" defaultValue={editingProduct?.name} required minLength={2}/></label><label>Цена, OC<input name="price" type="number" min="0.01" step="0.01" defaultValue={editingProduct?.price} required/></label><label>Остаток<input name="stock" type="number" min="0" defaultValue={editingProduct?.stock??0} required/></label><label>HTTPS-адрес изображения<input name="image" type="url" defaultValue={editingProduct?.image_url||''}/></label><label>Описание<textarea name="description" defaultValue={editingProduct?.description} required minLength={2}/></label></div><label className="feature-row"><input name="active" type="checkbox" defaultChecked={editingProduct?.active??true}/> Доступен в магазине</label><button disabled={busy}>Сохранить товар</button>{editingProduct&&<button type="button" onClick={()=>setEditingProduct(null)}>Отмена</button>}</form>
    <h2>Каталог</h2>{products.length?products.map(item=><p key={item.id}>{item.name} · {item.price} OC · остаток {item.stock} · {item.active?'активен':'скрыт'} <button onClick={()=>setEditingProduct(item)}>Изменить</button></p>):<p>Товаров пока нет.</p>}</>}
   {tab==='orders'&&<><h2>Заказы</h2>{orders.length?orders.map(item=><div className="feature-row" key={item.id}><p>{item.login} · {item.product_name} · {item.price} OC · {statuses[item.status]} · {new Date(item.created_at).toLocaleDateString('ru-RU')}</p>{item.status==='ordered'&&<button disabled={busy} onClick={()=>void run(()=>browserClient().rpc('set_reward_order_status',{p_order_id:item.id,p_status:'confirmed'}),'Заказ подтверждён.')}>Подтвердить</button>}{item.status==='confirmed'&&<button disabled={busy} onClick={()=>void run(()=>browserClient().rpc('set_reward_order_status',{p_order_id:item.id,p_status:'issued'}),'Награда выдана.')}>Выдать</button>}{['ordered','confirmed'].includes(item.status)&&<button disabled={busy} onClick={()=>void run(()=>browserClient().rpc('set_reward_order_status',{p_order_id:item.id,p_status:'cancelled'}),'Заказ отменён, OC возвращены.')}>Отменить</button>}</div>):<p>Заказов нет.</p>}</>}
   {tab==='achievements'&&<><h2>Достижения</h2><form key={editingAchievement?.id||'new'} onSubmit={achievementSubmit}><div className="feature-grid"><label>Код<input name="code" defaultValue={editingAchievement?.code} required pattern="[a-z][a-z0-9_]{2,39}"/></label><label>Название<input name="title" defaultValue={editingAchievement?.title} required/></label><label>Описание<input name="description" defaultValue={editingAchievement?.description} required/></label><label>Значок<input name="icon" defaultValue={editingAchievement?.icon||'★'} required maxLength={8}/></label><label>Редкость<select name="rarity" defaultValue={editingAchievement?.rarity||'common'}>{[['common','Обычное'],['rare','Редкое'],['epic','Эпическое'],['legendary','Легендарное']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Условие<select name="rule" defaultValue={editingAchievement?.rule_code||'first_bet'}>{[['first_bet','Число ставок'],['wins','Победы'],['accuracy','Точность при 10 ставках'],['veteran_days','Дней в системе'],['season_champion','Победы в сезоне'],['collector','Полученные достижения'],['hall_of_fame','Зал славы']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>Порог<input name="threshold" type="number" min="1" max="10000" defaultValue={editingAchievement?.threshold||1} required/></label><label>Награда, OC<input name="reward" type="number" min="0" max="10000" step="0.01" defaultValue={editingAchievement?.reward_oc||0} required/></label></div><label className="feature-row"><input name="enabled" type="checkbox" defaultChecked={editingAchievement?.enabled??true}/> Включено</label><button disabled={busy}>Сохранить достижение</button>{editingAchievement&&<button type="button" onClick={()=>setEditingAchievement(null)}>Отмена</button>}</form>{achievements.map(item=><p key={item.id}>{item.icon} {item.title} · {item.rule_code}: {item.threshold} · {item.enabled?'активно':'выключено'} <button onClick={()=>setEditingAchievement(item)}>Изменить</button></p>)}</>}
   {tab==='seasons'&&<><h2>Настройки новых сезонов</h2>{settings&&<form key={JSON.stringify(settings)} onSubmit={settingsSubmit}><label>Продолжительность, месяцев<input name="months" type="number" min="1" max="12" defaultValue={settings.duration_months} required/></label><label>Правило победителя<select name="rule" defaultValue={settings.winner_rule}><option value="profit">Прибыль OC</option><option value="wins">Победы</option><option value="accuracy">Точность</option></select></label><label>Награда победителю, OC<input name="reward" type="number" min="0" max="99999" step="0.01" defaultValue={settings.winner_reward} required/></label><button disabled={busy}>Сохранить</button><p>Настройки применяются к следующим сезонам; текущий сезон сохраняет свои даты и правило.</p></form>}</>}
   {tab==='stats'&&<><h2>Статистика пользователей</h2>{stats.length?<div className="feature-table-wrap"><table><thead><tr><th>Логин</th><th>Имя</th><th>Баланс</th><th>Ставки</th><th>Победы</th><th>Точность</th><th>Заказы</th></tr></thead><tbody>{stats.map(item=><tr key={item.id}><td>{item.login}</td><td>{item.display_name}</td><td>{item.balance} OC</td><td>{item.bets}</td><td>{item.wins}</td><td>{item.accuracy}%</td><td>{item.orders}</td></tr>)}</tbody></table></div>:<p>Пользователей пока нет.</p>}</>}
   {tab==='audit'&&<><h2>Журнал действий администратора</h2>{audit.length?audit.map(item=><p key={item.id}>{new Date(item.created_at).toLocaleString('ru-RU')} · {item.entity} · {item.action} · {item.entity_id}</p>):<p>Действий пока нет.</p>}</>}
  </section>}
 </main>
}
