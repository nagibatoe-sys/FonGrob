'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { browserClient } from '../../client'

type User = { id: string; login: string; display_name: string; created_at: string; roles: string[] }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await browserClient().auth.getSession()
      const token = data.session?.access_token
      if (!token) { setError('Войдите в аккаунт администратора.'); return }
      const response = await fetch('/api/admin/users', { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setUsers(result)
      setAllowed(true)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить пользователей.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const { data: session } = await browserClient().auth.getSession()
      const token = session.session?.access_token
      if (!token) throw new Error('Войдите заново.')
      const response = await fetch('/api/admin/users', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ login: data.get('login'), name: data.get('name'), password: data.get('password') }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      form.reset()
      setMessage(`Пользователь ${result.login} создан. Передайте ему пароль через защищённый канал.`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать пользователя.') }
    finally { setBusy(false) }
  }
  const visible = users.filter(user => `${user.login} ${user.display_name}`.toLowerCase().includes(query.toLowerCase()))
  return <main className="admin-users">
    <header><Link href="/">ФОНГРОБ</Link><nav><Link href="/admin/live">Ставки и пари</Link><Link href="/admin/history">История</Link><Link href="/line">Линия</Link><Link href="/profile">Профиль</Link></nav></header>
    <h1>Пользователи</h1><p>Управление учётными записями сотрудников</p>
    {loading && <p role="status">Загрузка пользователей…</p>}
    {error && <p role="alert" className="admin-error">{error}</p>}
    {allowed && <div className="admin-layout">
      <section><div className="admin-section-head"><h2>Список пользователей <small>{users.length}</small></h2><button type="button" onClick={() => void load()}>Обновить</button></div>
        <label>Поиск по логину или имени<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Начните вводить…" /></label>
        {visible.length ? <div className="admin-table-wrap"><table><thead><tr><th>Логин</th><th>Имя</th><th>Роль</th><th>Создан</th></tr></thead><tbody>{visible.map(user => <tr key={user.id}><td><strong>{user.login}</strong></td><td>{user.display_name}</td><td>{user.roles.join(', ') || 'Сотрудник'}</td><td>{new Date(user.created_at).toLocaleDateString('ru-RU')}</td></tr>)}</tbody></table></div> : <p>Пользователи не найдены.</p>}
      </section>
      <section><h2>Новый пользователь</h2><p>Укажите данные для входа. Пароль не сохраняется в этой форме.</p>
        <form onSubmit={create}><label>Логин<input name="login" required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" autoComplete="off" /></label>
          <label>Отображаемое имя<input name="name" required maxLength={80} autoComplete="off" /></label>
          <label>Пароль<input name="password" type="password" required minLength={5} autoComplete="new-password" /></label>
          <button disabled={busy}>{busy ? 'Создание…' : 'Создать пользователя'}</button></form>
        {message && <p role="status">{message}</p>}
      </section>
    </div>}
  </main>
}
