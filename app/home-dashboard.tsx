'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { browserClient } from './client'

type Event = { id: string; title: string; category: string; closes_at: string }
type Dashboard = { name: string; balance: number; pendingBets: number; openEvents: number; events: Event[] }
const categories: Record<string, string> = {
  meetings: 'Совещания', it: 'IT и техника', kitchen: 'Кухня и кофе', accounting: 'Бухгалтерия',
  sales: 'Продажи', logistics: 'Логистика', teams: 'Соревнования отделов', corporate: 'Корпоративные события',
  weather: 'Погода', special: 'Специальные события'
}

export function HomeDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [state, setState] = useState<'loading' | 'guest' | 'ready' | 'error'>('loading')
  useEffect(() => {
    let active = true
    const db = browserClient()
    async function load() {
      const { data: { session } } = await db.auth.getSession()
      if (!active) return
      if (!session) { setDashboard(null); setState('guest'); return }
      const [profile, wallet, bets, events] = await Promise.all([
        db.from('profiles').select('display_name').eq('id', session.user.id).single(),
        db.from('wallets').select('balance').eq('profile_id', session.user.id).single(),
        db.from('bets').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        db.from('events').select('id,title,category,closes_at', { count: 'exact' }).eq('status', 'open')
          .gt('closes_at', new Date().toISOString()).order('closes_at').limit(3)
      ])
      if (!active) return
      if (profile.error || wallet.error || bets.error || events.error) { setState('error'); return }
      setDashboard({ name: profile.data.display_name, balance: wallet.data.balance,
        pendingBets: bets.count ?? 0, openEvents: events.count ?? 0, events: events.data as Event[] })
      setState('ready')
    }
    void load()
    const { data } = db.auth.onAuthStateChange(() => { setTimeout(() => { if (active) void load() }, 0) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  if (state === 'loading') return <main className="home-page"><p role="status">Загружаем ваш обзор…</p></main>
  if (state === 'error') return <main className="home-page"><h1>Не удалось загрузить обзор</h1><p>Проверьте соединение и обновите страницу.</p><Link className="action-link" href="/login">Проверить вход</Link></main>
  if (state === 'guest') return <main className="home-page">
    <div className="home-hero"><p className="eyebrow">ФОНГРОБ · внутренняя офисная игра</p><h1>Офисные события, прогнозы и пари — в одном месте</h1>
      <p>Участвуйте добровольно, следите за результатами и получайте награды за виртуальные OfficeCoin.</p>
      <div className="home-actions"><Link className="action-link" href="/login">Войти в аккаунт</Link><Link className="action-link secondary" href="/line">Посмотреть события</Link></div></div>
    <section className="home-explain" aria-labelledby="how-title"><h2 id="how-title">С чего начать</h2><ol>
      <li><strong>Выберите событие.</strong> Срок и правила результата указаны в карточке.</li>
      <li><strong>Сделайте прогноз.</strong> Ставка списывается только в виртуальных OfficeCoin.</li>
      <li><strong>Следите за итогом.</strong> Результат появится в «Моих ставках».</li>
    </ol><p>Хотите просто договориться с коллегами? <Link href="/pari">Пари оформляются отдельно, без ставки OC.</Link></p></section>
  </main>
  const info = dashboard!
  return <main className="home-page">
    <div className="home-hero"><p className="eyebrow">Ваш обзор</p><h1>Здравствуйте, {info.name}</h1>
      <p>Выберите открытое событие или создайте пари с коллегами. Ваши результаты и награды всегда доступны в личном кабинете.</p>
      <div className="home-actions"><Link className="action-link" href="/line">Смотреть события</Link><Link className="action-link secondary" href="/pari/new">Создать пари</Link></div></div>
    <div className="home-metrics" aria-label="Краткая статистика">
      <Link href="/wallet"><span>Баланс</span><strong>{new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(info.balance)} OC</strong><small>Операции кошелька →</small></Link>
      <Link href="/line"><span>Открытые события</span><strong>{info.openEvents}</strong><small>Перейти к линии →</small></Link>
      <Link href="/bets"><span>Ожидают результата</span><strong>{info.pendingBets}</strong><small>Мои ставки →</small></Link>
    </div>
    <div className="home-sections">
      <section className="home-panel"><div className="home-section-head"><div><p className="eyebrow">Можно участвовать сейчас</p><h2>Ближайшие события</h2></div><Link href="/line">Все события →</Link></div>
        {info.events.length ? <ul className="home-events">{info.events.map(event => <li key={event.id}><Link href={`/line#event-${event.id}`}><strong>{event.title}</strong><span>{categories[event.category] || 'Событие'} · до {new Date(event.closes_at).toLocaleString('ru-RU', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}</span><b aria-hidden="true">→</b></Link></li>)}</ul>
          : <div className="home-empty"><p>Открытых событий пока нет.</p><Link href="/line#propose-event">Предложить событие →</Link></div>}
      </section>
      <section className="home-panel"><p className="eyebrow">Где продолжить</p><h2>Ваши разделы</h2><div className="home-shortcuts">
        <Link href="/bets"><strong>Мои ставки</strong><span>Прогнозы и результаты →</span></Link>
        <Link href="/pari"><strong>Пари</strong><span>Договорённости без OC →</span></Link>
        <Link href="/rating"><strong>Рейтинг</strong><span>Позиция в сезоне →</span></Link>
        <Link href="/shop"><strong>Магазин</strong><span>Награды за OC →</span></Link>
      </div></section>
    </div>
  </main>
}
