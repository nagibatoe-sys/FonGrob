'use client'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../client'
import { SiteNav } from '../site-nav'
type Category={code:string;name:string}
type Product={id:string;category_code:string;name:string;description:string;image_url:string|null;price:number;stock:number;active:boolean}
type Order={id:string;price:number;status:string;created_at:string;reward_products:{name:string}|null}
const status:Record<string,string>={ordered:'Оформлен',confirmed:'Подтверждён',issued:'Выдан',cancelled:'Отменён'}
export default function ShopPage(){
 const [products,setProducts]=useState<Product[]>([])
 const [categories,setCategories]=useState<Category[]>([])
 const [orders,setOrders]=useState<Order[]>([])
 const [balance,setBalance]=useState<number|null>(null)
 const [category,setCategory]=useState('all')
 const [pending,setPending]=useState<{id:string;productId:string}|null>(null)
 const [error,setError]=useState('')
 const [message,setMessage]=useState('')
 const [loading,setLoading]=useState(true)
 const load=useCallback(async()=>{
  const db=browserClient()
  const [c,p,o,w]=await Promise.all([
   db.from('reward_categories').select('code,name').order('name'),
   db.from('reward_products').select('id,category_code,name,description,image_url,price,stock,active').eq('active',true).order('created_at',{ascending:false}),
   db.from('reward_orders').select('id,price,status,created_at,reward_products(name)').order('created_at',{ascending:false}).limit(50),
   db.from('wallets').select('balance').single()
  ])
  if(c.error||p.error||o.error||w.error)setError('Войдите в аккаунт, чтобы открыть магазин.')
  else{setCategories(c.data);setProducts(p.data);setOrders(o.data as unknown as Order[]);setBalance(w.data.balance);setError('')}
  setLoading(false)
 },[])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 async function buy(product:Product){
  if(pending&&pending.productId!==product.id)return
  const request=pending?.productId===product.id?pending:{id:crypto.randomUUID(),productId:product.id}
  setPending(request);setError('');setMessage('')
  const {error:failure}=await browserClient().rpc('purchase_reward',{p_request_id:request.id,p_product_id:product.id})
  if(failure)setError(failure.message)
  else{setPending(null);setMessage(`Заказ «${product.name}» оформлен.`);await load()}
 }
 return <><SiteNav/><main className="feature-page"><h1>Магазин наград</h1><p>Награды за виртуальные OfficeCoin. Ваш баланс: <strong>{balance===null?'—':balance} OC</strong></p>
  <div className="feature-row"><label>Категория <select value={category} onChange={event=>setCategory(event.target.value)}><option value="all">Все категории</option>{categories.map(item=><option value={item.code} key={item.code}>{item.name}</option>)}</select></label></div>
  {loading&&<p role="status">Загрузка каталога…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {!loading&&!error&&<div className="feature-grid">{products.filter(product=>category==='all'||product.category_code===category).map(product=><article key={product.id} className="feature-card">
   {product.image_url&&<img src={product.image_url} alt={product.name}/>}<h2>{product.name}</h2><p>{product.description}</p><p><strong>{product.price} OC</strong> · Осталось: {product.stock}</p>
   <button disabled={product.stock<1||balance===null||balance<product.price||pending!==null} onClick={()=>void buy(product)}>{product.stock<1?'Нет в наличии':pending?.productId===product.id?'Оформление…':'Получить награду'}</button>
  </article>)}</div>}
  {!loading&&!error&&!products.some(product=>category==='all'||product.category_code===category)&&<p>В этой категории пока нет наград.</p>}
  <section className="feature-card"><h2>История покупок</h2>{orders.length?<div className="feature-table-wrap"><table><thead><tr><th>Награда</th><th>Стоимость</th><th>Дата</th><th>Статус</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td>{order.reward_products?.name||'Награда'}</td><td>{order.price} OC</td><td>{new Date(order.created_at).toLocaleDateString('ru-RU')}</td><td>{status[order.status]||order.status}</td></tr>)}</tbody></table></div>:<p>Покупок пока нет.</p>}</section>
 </main></>
}
