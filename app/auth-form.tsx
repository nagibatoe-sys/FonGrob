'use client'
import Link from 'next/link'
import { browserClient } from './client'
import { useEffect, useState, type FormEvent } from 'react'

function createAuth() {
  return browserClient().auth
}

export function AuthForm() {
  const [auth, setAuth] = useState<ReturnType<typeof createAuth>>()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const client = createAuth()
    const ready = setTimeout(() => setAuth(client), 0)
    void client.getSession().then(({ data }) => { setEmail(data.session?.user.email || '') })
    const { data } = client.onAuthStateChange((_, session) => { setEmail(session?.user.email || '') })
    return () => { clearTimeout(ready); data.subscription.unsubscribe() }
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth || busy) return
    const fields = new FormData(event.currentTarget)
    const value = (key: string) => String(fields.get(key) || '')
    const username = value('login').trim().toLowerCase()
    const credentials = { email: `${username}@accounts.fongrob.invalid`, password: value('password') }
    setBusy(true)
    setMessage('')
    try {
      if (email) {
        const { error } = await auth.signOut({ scope: 'local' })
        if (error) throw error
      } else {
        if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) throw Error('invalid login')
        const { error } = await auth.signInWithPassword(credentials)
        if (error) throw error
      }
    } catch {
      setMessage(email ? 'Не удалось выйти. Попробуйте ещё раз.' : 'Не удалось войти. Проверьте логин и пароль.')
    } finally { setBusy(false) }
  }
  return <main className="auth"><Link href="/">ФОНГРОБ</Link>
    <h1>{email ? 'Вы вошли' : 'Вход'}</h1>
    {email && <nav><Link href="/profile">Мой профиль</Link><Link href="/wallet">Кошелёк</Link></nav>}
    <form onSubmit={submit}>{email ? <p>Логин: {email.split('@')[0]}</p> : <>
      <label>Логин<input name="login" autoComplete="username" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}" required /></label>
      <label>Пароль<input type="password" name="password" autoComplete="current-password" required /></label>
    </>}
    <button disabled={busy || !auth}>{email ? 'Выйти' : 'Войти'}</button></form>
    <p role="status">{message}</p>
    {!email && <p>Учётную запись и пароль выдаёт администратор.</p>}
  </main>
}
