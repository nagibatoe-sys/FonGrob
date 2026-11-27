'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { browserClient } from '../client'

type Order = { reward_products: { cosmetic_code: string | null } | null }
const choices = [
  { code: 'standard', name: 'Лайм', description: 'Базовый стиль · бесплатно' },
  { code: 'gold', name: 'Золото', description: 'Доступно после покупки' },
  { code: 'ice', name: 'Лёд', description: 'Доступно после покупки' }
]

export function AppearanceSettings({ uid }: { uid: string }) {
  const [current, setCurrent] = useState('standard')
  const [owned, setOwned] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    const db = browserClient()
    void Promise.all([
      db.from('profiles').select('accent_code').eq('id', uid).single(),
      db.from('reward_orders').select('reward_products(cosmetic_code)').eq('status', 'issued')
    ]).then(([profile, orders]) => {
      if (!active) return
      if (!profile.error) setCurrent(profile.data.accent_code)
      if (!orders.error) setOwned((orders.data as unknown as Order[]).map(order => order.reward_products?.cosmetic_code).filter((code): code is string => Boolean(code)))
      setLoading(false)
    })
    return () => { active = false }
  }, [uid])
  async function equip(code: string) {
    setBusy(true); setMessage('')
    const { error } = await browserClient().rpc('equip_cosmetic', { p_code: code })
    if (error) setMessage('Не удалось применить оформление. Попробуйте ещё раз.')
    else {
      setCurrent(code)
      window.dispatchEvent(new CustomEvent('fongrob-accent-changed', { detail: code }))
      setMessage('Оформление применено.')
    }
    setBusy(false)
  }
  return <section className="appearance-settings" aria-labelledby="appearance-title">
    <div className="appearance-heading"><div><span className="section-kicker">ПЕРСОНАЛИЗАЦИЯ</span><h2 id="appearance-title">Оформление интерфейса</h2><p>Акцент меняет цвет кнопок и навигации. Все функции доступны с базовым оформлением.</p></div><Link href="/shop">В магазин →</Link></div>
    {loading ? <p role="status">Загрузка оформления…</p> : <div className="appearance-options">{choices.map(choice => {
      const available = choice.code === 'standard' || owned.includes(choice.code)
      return <div className={`appearance-option appearance-${choice.code}`} key={choice.code}>
        <div className="appearance-preview" aria-hidden="true"><span>Ф</span><i/></div>
        <strong>{choice.name}</strong><small>{choice.code === current ? 'Используется' : available ? 'Приобретено' : choice.description}</small>
        {available ? <button type="button" disabled={busy || choice.code === current} onClick={() => void equip(choice.code)}>{choice.code === current ? 'Выбрано' : 'Применить'}</button> : <Link href="/shop?category=appearance">Открыть в магазине</Link>}
      </div>
    })}</div>}
    <p role="status">{message}</p>
  </section>
}
