'use client'
import Link from 'next/link'
import { browserClient } from './client'
import { useEffect, useState, type FormEvent } from 'react'

function createAuth() {
  return browserClient().auth
}

export function AuthForm({ register = false }: { register?: boolean }) {
  const [auth, setAuth] = useState<ReturnType<typeof createAuth>>()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const client = createAuth()
    const { data } = client.onAuthStateChange((_, session) => { setAuth(client); setEmail(session?.user.email || '') })
    return () => data.subscription.unsubscribe()
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!auth || busy) return
    const fields = new FormData(event.currentTarget)
    const value = (key: string) => String(fields.get(key) || '')
    const credentials = { email: value('email').trim(), password: value('password') }
    setBusy(true)
    setMessage('')
    try {
      if (email) {
        const { error } = await auth.signOut({ scope: 'local' })
        if (error) throw error
      } else if (register) {
        const { data, error } = await auth.signUp({ ...credentials, options: {
          emailRedirectTo: window.location.origin + '/login',
          data: { display_name: value('name').trim(), invitation: value('invite').trim() }
        } })
        if (error) throw error
        if (!data.session) setMessage('Проверьте почту и перейдите по ссылке подтверждения.')
      } else {
        const { error } = await auth.signInWithPassword(credentials)
        if (error) throw error
      }
    } catch {
      setMessage(email ? 'Не удалось выйти. Попробуйте ещё раз.' : register ? 'Не удалось зарегистрироваться. Проверьте адрес и приглашение.' : 'Не удалось войти. Проверьте почту и пароль.')
    } finally { setBusy(false) }
  }
  return <main className="auth"><Link href="/">ФОНГРОБ</Link>
    <h1>{email ? 'Вы вошли' : register ? 'Регистрация по приглашению' : 'Вход'}</h1>
    {email && <nav><Link href="/profile">Мой профиль</Link><Link href="/wallet">Кошелёк</Link></nav>}
    <form onSubmit={submit}>{email ? <p>{email}</p> : <>
      <label>Рабочая почта<input name="email" type="email" autoComplete="email" required /></label>
      {register && <label>Псевдоним<input name="name" maxLength={80} required /></label>}
      <label>Пароль<input type="password" name="password" minLength={register ? 8 : 1} autoComplete={register ? 'new-password' : 'current-password'} required /></label>
      {register && <label>Код приглашения<input name="invite" required /></label>}
    </>}
    <button disabled={busy || !auth}>{email ? 'Выйти' : register ? 'Создать аккаунт' : 'Войти'}</button></form>
    <p role="status">{message}</p>
    {!email && !register && <p><Link href="/forgot-password">Забыли пароль?</Link></p>}
    {!email && <Link href={register ? '/login' : '/register'}>{register ? 'Уже есть аккаунт? Войти' : 'У меня есть приглашение'}</Link>}
  </main>
}
