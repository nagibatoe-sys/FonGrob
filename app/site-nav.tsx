'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { browserClient } from './client'

const primary = [
  { href: '/', label: 'Обзор' },
  { href: '/line', label: 'События' },
  { href: '/pari', label: 'Пари' },
  { href: '/bets', label: 'Мои ставки' }
]
const competition = [
  { href: '/rating', label: 'Рейтинг' },
  { href: '/seasons', label: 'Сезоны' },
  { href: '/hall', label: 'Зал славы' }
]
const rewards = [
  { href: '/achievements', label: 'Достижения' },
  { href: '/shop', label: 'Магазин' }
]

export function SiteNav() {
  const pathname = usePathname()
  const [signedIn, setSignedIn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    const db = browserClient()
    let active = true
    async function update(userId?: string) {
      if (!active) return
      setSignedIn(Boolean(userId))
      if (!userId) { setIsAdmin(false); return }
      const { data } = await db.from('user_roles').select('role_code').eq('profile_id', userId)
      if (active) setIsAdmin(Boolean(data?.some(row => ['ADMIN', 'SUPER_ADMIN'].includes(row.role_code))))
    }
    void db.auth.getSession().then(({ data }) => update(data.session?.user.id))
    const { data } = db.auth.onAuthStateChange((_event, session) => { setTimeout(() => { if (active) void update(session?.user.id) }, 0) })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])
  const link = ({ href, label }: { href: string; label: string }) => {
    const current = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
    return <Link key={href} href={href} aria-current={current ? 'page' : undefined}>{label}</Link>
  }
  return <header className="site-header">
    <div className="site-mainbar">
      <Link href="/" className="site-logo">ФОНГРОБ<span> / офисная игра</span></Link>
      <nav className="site-primary" aria-label="Основные действия">{primary.map(link)}</nav>
      <Link className="site-account" href={signedIn ? '/profile' : '/login'}>{signedIn ? 'Личный кабинет' : 'Войти'}</Link>
    </div>
    <div className="site-subbar">
      <nav aria-label="Рейтинг и сезоны"><span>Соревнование</span>{competition.map(link)}</nav>
      <nav aria-label="Достижения и награды"><span>Награды</span>{rewards.map(link)}</nav>
      {isAdmin && <Link className="site-admin" href="/admin/users">Администрирование</Link>}
    </div>
  </header>
}
