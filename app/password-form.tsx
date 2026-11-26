'use client'
import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { browserClient } from './client'

export function PasswordForm({ reset = false }: { reset?: boolean }) {
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!reset) return
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) setReady(true)
      if (event === 'SIGNED_OUT') setReady(false)
    })
    return () => data.subscription.unsubscribe()
  }, [reset])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    setBusy(true)
    setMessage('')
    try {
      const auth = browserClient().auth
      if (reset) {
        const password = String(fields.get('password'))
        if (password !== fields.get('repeat')) {
          setMessage('Пароли должны совпадать.')
          return
        }
        const { error } = await auth.updateUser({ password })
        if (error) throw error
        setMessage('Пароль изменён.')
      } else {
        const { error } = await auth.resetPasswordForEmail(String(fields.get('email')).trim(), {
          redirectTo: window.location.origin + '/reset-password'
        })
        if (error) throw error
        setMessage('Если аккаунт существует, на почту придёт ссылка для восстановления.')
      }
      setDone(true)
    } catch {
      setMessage(reset ? 'Не удалось изменить пароль. Запросите новую ссылку или выберите другой пароль.' : 'Не удалось отправить запрос. Попробуйте позже.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="auth"><Link href="/">ФОНГРОБ</Link>
    <h1>{reset ? 'Новый пароль' : 'Восстановление пароля'}</h1>
    {reset && !ready && !done && <p>Откройте ссылку из письма. Если срок действия истёк, запросите новое письмо.</p>}
    {!done && (!reset || ready) && <form onSubmit={submit}>
      {reset ? <>
        <label>Новый пароль<input type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
        <label>Повторите пароль<input type="password" name="repeat" autoComplete="new-password" required /></label>
      </> : <label>Рабочая почта<input type="email" name="email" autoComplete="email" required /></label>}
      <button disabled={busy}>{reset ? 'Сохранить пароль' : 'Отправить ссылку'}</button>
    </form>}
    <p role="status">{message}</p>
    <nav><Link href="/login">Перейти ко входу</Link>{reset && !done && <Link href="/forgot-password">Запросить новую ссылку</Link>}</nav>
  </main>
}
