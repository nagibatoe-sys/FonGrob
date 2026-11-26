'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { browserClient } from './client'

type Outcome = { id: string; label: string; odds: number }
type Event = { id: string; title: string; rules: string; category: string; status: string; closes_at: string; markets: { outcomes: Outcome[] }[] }
type Bet = { id: string; stake: number; odds: number; status: string }
const categories: Record<string, string> = {
  meetings: 'Совещания', it: 'IT и техника', kitchen: 'Кухня и кофе', accounting: 'Бухгалтерия',
  sales: 'Продажи', logistics: 'Логистика', teams: 'Соревнования отделов', corporate: 'Корпоративные события',
  weather: 'Погода', special: 'Специальные события'
}
export function Line() {
  const [events, setEvents] = useState<Event[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [admin, setAdmin] = useState(false)
  const [message, setMessage] = useState('Загрузка…')
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<{ event: string; outcome: Outcome; key: string }>()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  async function refresh() {
    const db = browserClient()
    const [line, tickets, roles] = await Promise.all([
      db.from('events').select('id,title,rules,category,status,closes_at,markets(outcomes(id,label,odds))').order('closes_at'),
      db.from('bets').select('id,stake,odds,status').order('created_at', { ascending: false }).limit(50),
      db.from('user_roles').select('role_code')
    ])
    if (line.error || tickets.error || roles.error) { setMessage('Войдите в аккаунт, чтобы открыть линию.'); return }
    setEvents(line.data as Event[])
    setBets(tickets.data)
    setAdmin(roles.data.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role.role_code)))
    setMessage('')
  }
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => void refresh(), 15000)
    return () => { clearTimeout(initial); clearInterval(timer) }
  }, [])
  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true)
    try {
      const { error } = await action()
      if (error) throw error
      await refresh()
      setMessage('Готово.')
    } catch (error) {
      setMessage(error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Не удалось выполнить действие. Проверьте данные.')
    } finally { setBusy(false) }
  }
  function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    void run(async () => {
      const result = await browserClient().rpc('propose_categorized_event', {
        title: data.get('title'), rules: data.get('rules'), category: data.get('category'), closes_at: new Date(String(data.get('date'))).toISOString()
      })
      if (!result.error) form.reset()
      return result
    })
  }
  function place(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selection) return
    const stake = Number(new FormData(event.currentTarget).get('stake'))
    void run(async () => {
      const result = await browserClient().rpc('place_bet', {
        request_id: selection.key, outcome_id: selection.outcome.id, stake
      })
      if (!result.error) setSelection(undefined)
      return result
    })
  }
  return <main className="line">
    <header><Link href="/">ФОНГРОБ</Link><nav><Link href="/pari">Пари</Link><Link href="/profile">Профиль</Link><Link href="/wallet">Кошелёк</Link><Link href="/login">Вход и выход</Link></nav></header>
    <h1>Офисная линия</h1><p>Прогнозы на рабочую реальность · Только виртуальные OfficeCoin</p>
    <p role="status">{message}</p>
    <div className="line-filters"><label>Поиск событий<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Название или условие" /></label>
      <label>Категория<select value={category} onChange={event => setCategory(event.target.value)}><option value="all">Все категории</option>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
    <div className="event-grid">{events.filter(event => (event.title + event.rules).toLowerCase().includes(search.toLowerCase()) && (category === 'all' || event.category === category)).map(event => <article key={event.id}>
      <small>{categories[event.category] || 'Событие'} · {event.status === 'proposed' ? 'На модерации' : event.status === 'open' ? 'Приём прогнозов' : event.status === 'void' ? 'Отменено' : 'Рассчитано'}</small>
      <h2>{event.title}</h2><p>{event.rules}</p><p>Закрытие {new Date(event.closes_at).toLocaleString('ru-RU')}</p>
      <div className="outcomes">{event.markets.flatMap(market => market.outcomes).map(outcome => <button disabled={busy || event.status !== 'open' || new Date(event.closes_at) <= new Date()} key={outcome.id} onClick={() => setSelection({ event: event.title, outcome, key: crypto.randomUUID() })}>{outcome.label} · {outcome.odds}</button>)}</div>
      {admin && event.status === 'proposed' && <button disabled={busy} onClick={() => void run(() => browserClient().rpc('publish_event', { event_id: event.id }))}>Опубликовать</button>}
      {admin && ['proposed','open'].includes(event.status) && <button disabled={busy} onClick={() => {
        const reason = window.prompt('Причина отмены (не менее 10 символов)')
        if (reason) void run(() => browserClient().rpc('cancel_event', { event_id: event.id, reason }))
      }}>Отменить событие</button>}
      {admin && event.status === 'open' && <details><summary>Подтвердить результат</summary>{event.markets.flatMap(market => market.outcomes).map(outcome => <button disabled={busy} key={outcome.id} onClick={() => {
        if (window.confirm('Рассчитать событие с результатом «' + outcome.label + '»?')) void run(() => browserClient().rpc('settle_event', { event_id: event.id, winning_outcome: outcome.id }))
      }}>Результат — {outcome.label}</button>)}</details>}
    </article>)}</div>
    {!events.length && <p>Событий пока нет. Предложите первое.</p>}
    {events.length > 0 && !events.some(event => (event.title + event.rules).toLowerCase().includes(search.toLowerCase()) && (category === 'all' || event.category === category)) && <p>По этому запросу событий нет.</p>}
    {selection && <section className="coupon"><h2>Купон</h2><p>{selection.event} · {selection.outcome.label} · {selection.outcome.odds}</p>
      <form onSubmit={place}><label>Ставка, OC<input name="stake" type="number" min="10" max="250" step=".01" defaultValue="10" required /></label>
        <button disabled={busy}>Подтвердить прогноз</button><button type="button" disabled={busy} onClick={() => setSelection(undefined)}>Убрать из купона</button></form></section>}
    <section><h2>Предложить событие</h2><p>Укажите проверяемое условие ответа «Да». Здоровье, зарплата, увольнение и личная жизнь исключены.</p>
      <form onSubmit={propose}><label>Название<input name="title" minLength={5} maxLength={160} required /></label>
        <label>Категория<select name="category" required>{Object.entries(categories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Условия результата<textarea name="rules" minLength={10} maxLength={2000} required /></label>
        <label>Приём прогнозов до<input name="date" type="datetime-local" required /></label><button disabled={busy}>Отправить на модерацию</button></form></section>
    <section><h2>Мои прогнозы</h2>{bets.length ? bets.map(bet => <p key={bet.id}>{bet.stake} OC × {bet.odds} · {({pending:'Ожидает результата',won:'Выигрыш',lost:'Проигрыш',void:'Возврат'})[bet.status as 'pending' | 'won' | 'lost' | 'void']}</p>) : <p>Прогнозов пока нет.</p>}</section>
  </main>
}
