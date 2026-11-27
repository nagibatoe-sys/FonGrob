'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { browserClient } from '../client'

type Event = { id: string; title: string; closes_at: string; status: string; bets_count: number; total_stake: number }
type Bet = { id: string; login: string; event_title: string; outcome: string; stake: number; odds: number; created_at: string }
type Game = Event & { outcome: string | null; cancellation_reason: string | null }
type Log = { id: string; login: string; operation_key: string; amount: number; created_at: string; event_title: string | null }
type View = 'live' | 'history'
const date = (value: string) => new Date(value).toLocaleString('ru-RU')
const money = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value) + ' OC'
const operation = (value: string) => value.startsWith('bet:') ? 'Ставка' : value.startsWith('payout:') ? 'Выигрыш' : value.startsWith('refund:') ? 'Возврат' : value === 'opening' ? 'Стартовое начисление' : value

export function AdminDashboard({ view }: { view: View }) {
  const [events, setEvents] = useState<Event[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [tab, setTab] = useState<'games' | 'logs'>('games')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    const db = browserClient()
    const results = view === 'live'
      ? await Promise.all([db.rpc('admin_active_events'), db.rpc('admin_pending_bets')])
      : await Promise.all([db.rpc('admin_finished_games'), db.rpc('admin_operation_logs')])
    if (results.some(result => result.error)) setError('Не удалось загрузить данные. Войдите как администратор и повторите попытку.')
    else {
      setError('')
      if (view === 'live') { setEvents(results[0].data as Event[]); setBets(results[1].data as Bet[]) }
      else { setGames(results[0].data as Game[]); setLogs(results[1].data as Log[]) }
    }
    setLoading(false)
  }, [view])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  return <main className="admin-users">
    <header><Link href="/">ФОНГРОБ</Link><nav><Link href="/admin/users">Пользователи</Link><Link href="/admin/live">Ставки и пари</Link><Link href="/admin/history">История</Link><Link href="/admin/manage">Управление</Link><Link href="/profile">Профиль</Link></nav></header>
    <div className="admin-section-head"><div><h1>{view === 'live' ? 'Актуальные ставки и пари' : 'История игр и операций'}</h1><p>{view === 'live' ? 'Открытые события и все ставки, ожидающие расчёта.' : 'Завершённые события и журнал движения OfficeCoin.'}</p></div><button type="button" onClick={() => void load()}>Обновить</button></div>
    {loading && <p role="status">Загрузка…</p>}{error && <p role="alert" className="admin-error">{error}</p>}
    {!loading && !error && view === 'live' && <div className="admin-stack">
      <section><h2>Открытые пари <small>{events.length}</small></h2>{events.length ? <div className="admin-table-wrap"><table><thead><tr><th>Событие</th><th>Приём до</th><th>Ставок</th><th>Общая сумма</th></tr></thead><tbody>{events.map(item => <tr key={item.id}><td>{item.title}</td><td>{date(item.closes_at)}</td><td>{item.bets_count}</td><td>{money(item.total_stake)}</td></tr>)}</tbody></table></div> : <p>Открытых пари нет.</p>}</section>
      <section><h2>Ставки без результата <small>{bets.length}</small></h2>{bets.length ? <div className="admin-table-wrap"><table><thead><tr><th>Участник</th><th>Событие</th><th>Исход</th><th>Ставка</th><th>Коэффициент</th><th>Дата</th></tr></thead><tbody>{bets.map(item => <tr key={item.id}><td>{item.login}</td><td>{item.event_title}</td><td>{item.outcome}</td><td>{money(item.stake)}</td><td>{item.odds}</td><td>{date(item.created_at)}</td></tr>)}</tbody></table></div> : <p>Ожидающих ставок нет.</p>}</section>
    </div>}
    {!loading && !error && view === 'history' && <section className="admin-history">
      <div className="admin-tabs" role="tablist" aria-label="История"><button role="tab" aria-selected={tab === 'games'} onClick={() => setTab('games')}>Прошедшие игры ({games.length})</button><button role="tab" aria-selected={tab === 'logs'} onClick={() => setTab('logs')}>Логи ({logs.length})</button></div>
      {tab === 'games' ? <div role="tabpanel">{games.length ? <div className="admin-table-wrap"><table><thead><tr><th>Событие</th><th>Результат</th><th>Приём до</th><th>Ставок</th><th>Общая сумма</th></tr></thead><tbody>{games.map(item => <tr key={item.id}><td>{item.title}</td><td>{item.status === 'void' ? `Отменено: ${item.cancellation_reason || 'причина не указана'}` : item.outcome || 'Результат не указан'}</td><td>{date(item.closes_at)}</td><td>{item.bets_count}</td><td>{money(item.total_stake)}</td></tr>)}</tbody></table></div> : <p>Завершённых игр пока нет.</p>}</div>
        : <div role="tabpanel">{logs.length ? <div className="admin-table-wrap"><table><thead><tr><th>Дата</th><th>Участник</th><th>Операция</th><th>Событие</th><th>Изменение</th></tr></thead><tbody>{logs.map(item => <tr key={item.id}><td>{date(item.created_at)}</td><td>{item.login}</td><td>{operation(item.operation_key)}</td><td>{item.event_title || '—'}</td><td>{money(item.amount)}</td></tr>)}</tbody></table></div> : <p>Записей пока нет.</p>}</div>}
      <p className="admin-note">Показаны последние 200 записей в каждой вкладке.</p>
    </section>}
  </main>
}
