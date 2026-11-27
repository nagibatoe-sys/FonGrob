'use client'
import { ProfileSettings } from './profile/settings'
import { ProfileStats } from './profile/stats'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { browserClient } from './client'
import { SiteNav } from './site-nav'

type Entry = { id: string; amount: number; operation_key: string; created_at: string }
type Account = { departmentId: string | null; departments: { id: string; name: string }[]; name: string; balance: number; entries: Entry[]; isAdmin: boolean }

export function AccountView({ wallet = false }: { wallet?: boolean }) {
  const [uid, setUid] = useState<string | null>()
  const [result, setResult] = useState<{ uid: string; account?: Account }>()
  useEffect(() => {
    const { data } = browserClient().auth.onAuthStateChange((_, session) => setUid(session?.user.id ?? null))
    return () => data.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!uid) return
    let active = true
    const db = browserClient()
    async function load(id: string) {
      const [profile, funds, history, directory, roles] = await Promise.all([
        db.from('profiles').select('display_name,department_id').eq('id', id).single(),
        db.from('wallets').select('balance').eq('profile_id', id).single(),
        db.from('wallet_transactions').select('id,amount,operation_key,created_at').eq('profile_id', id)
          .order('created_at', { ascending: false }).order('id').limit(50),
        wallet ? { data: [], error: null } : db.from('departments').select('id,name').order('name'),
        db.from('user_roles').select('role_code').eq('profile_id', id)
      ])
      if (!active) return
      if (profile.error || funds.error || history.error || directory.error || roles.error) setResult({ uid: id })
      else setResult({ uid: id, account: { departmentId: profile.data.department_id, departments: directory.data, name: profile.data.display_name, balance: funds.data.balance, entries: history.data, isAdmin: roles.data.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role.role_code)) } })
    }
    void load(uid)
    return () => { active = false }
  }, [uid, wallet])
  const account = result?.uid === uid ? result?.account : undefined
  const format = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)
  return <><SiteNav/><main className="auth"><Link href="/">ФОНГРОБ</Link>
    <h1>{wallet ? 'Кошелёк' : 'Мой профиль'}</h1>
    {uid === null ? <Link href="/login">Войти в аккаунт</Link> : account ? <>
      <h2>{account.name}</h2><p>Баланс <strong>{format(account.balance)} OC</strong></p>
      {!wallet && uid && <ProfileSettings key={uid} uid={uid} name={account.name}
        departmentId={account.departmentId} departments={account.departments}
        onSaved={(name, departmentId) => setResult(current => current?.uid === uid && current.account
          ? { uid, account: { ...current.account, name, departmentId } } : current)} />}
      {!wallet && <ProfileStats/>}
      {wallet && <section><h2>Последние операции</h2>
        {account.entries.length ? <ul>{account.entries.map(entry => <li key={entry.id}>
          {entry.operation_key === 'opening' ? 'Стартовое начисление' : entry.operation_key}
          {' · '}{format(entry.amount)} OC · {new Date(entry.created_at).toLocaleDateString('ru-RU')}
        </li>)}</ul> : <p>Операций пока нет.</p>}
      </section>}
      <nav><Link href={wallet ? '/profile' : '/wallet'}>{wallet ? 'Мой профиль' : 'История кошелька'}</Link>{account.isAdmin && <><Link href="/admin/users">Пользователи</Link><Link href="/admin/live">Ставки и пари</Link><Link href="/admin/history">История</Link><Link href="/admin/manage">Управление</Link></>}<Link href="/login">Управление входом</Link></nav>
    </> : <p role="status">{uid && result?.uid === uid ? 'Не удалось загрузить данные. Обновите страницу.' : 'Загрузка…'}</p>}
  </main></>
}
