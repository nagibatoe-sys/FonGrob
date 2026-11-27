'use client'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../client'
import { SiteNav } from '../site-nav'
import Link from 'next/link'
type Category={code:string;name:string}
type Product={id:string;category_code:string;name:string;description:string;image_url:string|null;price:number;stock:number;active:boolean;cosmetic_code:string|null}
type Order={id:string;product_id:string;price:number;status:string;created_at:string;reward_products:{name:string}|null}
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
   db.from('reward_products').select('id,category_code,name,description,image_url,price,stock,active,cosmetic_code').eq('active',true).order('created_at',{ascending:false}),
   db.from('reward_orders').select('id,product_id,price,status,created_at,reward_products(name)').order('created_at',{ascending:false}).limit(200),
   db.from('wallets').select('balance').single()
  ])
  if(c.error||p.error||o.error||w.error)setError('Войдите в аккаунт, чтобы открыть магазин.')
  else{setCategories(c.data);setProducts(p.data);setOrders(o.data as unknown as Order[]);setBalance(w.data.balance);setError('')}
  setLoading(false)
 },[])
 useEffect(()=>{void Promise.resolve().then(()=>{const requested=new URLSearchParams(window.location.search).get('category');if(requested)setCategory(requested);return load()})},[load])
 async function buy(product:Product){
  if(pending&&pending.productId!==product.id)return
  const request=pending?.productId===product.id?pending:{id:crypto.randomUUID(),productId:product.id}
  setPending(request);setError('');setMessage('')
  const {error:failure}=await browserClient().rpc('purchase_reward',{p_request_id:request.id,p_product_id:product.id})
  if(failure)setError(failure.message)
  else{setPending(null);setMessage(product.cosmetic_code?`Оформление «${product.name}» применено. Его можно менять в профиле.`:`Заказ «${product.name}» оформлен.`);if(product.cosmetic_code)window.dispatchEvent(new CustomEvent('fongrob-accent-changed',{detail:product.cosmetic_code}));await load()}
 }
 const owned=new Set(orders.filter(order=>order.status==='issued').map(order=>order.product_id))
 return <><SiteNav/><main className="feature-page"><h1>Магазин наград</h1><p>Награды за виртуальные OfficeCoin. Ваш баланс: <strong>{balance===null?'—':balance} OC</strong></p>
  <section className="shop-intro"><span className="section-kicker">ПЕРСОНАЛИЗАЦИЯ</span><div><h2>Ваш стиль — ваш выбор</h2><p>Базовое оформление доступно всем. Дополнительные цветовые акценты можно приобрести один раз и переключать в <Link href="/profile">профиле</Link>.</p></div><div className="shop-intro-art" aria-hidden="true"><span>OC</span></div></section>
  <div className="feature-row"><label>Категория <select value={category} onChange={event=>setCategory(event.target.value)}><option value="all">Все категории</option>{categories.map(item=><option value={item.code} key={item.code}>{item.name}</option>)}</select></label></div>
  {loading&&<p role="status">Загрузка каталога…</p>}{error&&<p role="alert" className="feature-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {!loading&&!error&&<div className="feature-grid">{products.filter(product=>category==='all'||product.category_code===category).map(product=><article key={product.id} className={`feature-card shop-product ${product.cosmetic_code?'cosmetic-product':''}`}>
   {product.image_url?<img src={product.image_url} alt={product.name}/>:product.cosmetic_code?<div className={`cosmetic-swatch cosmetic-${product.cosmetic_code}`} aria-hidden="true"><span>Ф</span><i>ФОНГРОБ / ВАШ СТИЛЬ</i></div>:null}<small>{categories.find(item=>item.code===product.category_code)?.name||'Награда'}</small><h2>{product.name}</h2><p>{product.description}</p><p><strong>{product.price} OC</strong>{!product.cosmetic_code&&` · Осталось: ${product.stock}`}</p>
   <button disabled={owned.has(product.id)||product.stock<1||balance===null||balance<product.price||pending!==null} onClick={()=>void buy(product)}>{owned.has(product.id)?'Уже ваше':product.stock<1?'Нет в наличии':pending?.productId===product.id?'Оформление…':product.cosmetic_code?'Открыть оформление':'Получить награду'}</button>
  </article>)}</div>}
  {!loading&&!error&&!products.some(product=>category==='all'||product.category_code===category)&&<p>В этой категории пока нет наград.</p>}
  <section className="feature-card"><h2>История покупок</h2>{orders.length?<div className="feature-table-wrap"><table><thead><tr><th>Награда</th><th>Стоимость</th><th>Дата</th><th>Статус</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td>{order.reward_products?.name||'Награда'}</td><td>{order.price} OC</td><td>{new Date(order.created_at).toLocaleDateString('ru-RU')}</td><td>{status[order.status]||order.status}</td></tr>)}</tbody></table></div>:<p>Покупок пока нет.</p>}</section>
 </main></>
}
