import Link from 'next/link'
export function PariHeader({ current = 'pari' }: { current?: 'pari' | 'history' }) {
  return <><header><Link href="/"><strong>♜ ПАРИ</strong></Link><span>ФОНГРОБ</span></header><nav aria-label="Навигация"><Link href="/">Главная</Link><Link href="/pari" aria-current={current === 'pari' ? 'page' : undefined}>Пари</Link><Link href="/profile">Профиль</Link><Link href="/pari/history" aria-current={current === 'history' ? 'page' : undefined}>История</Link></nav></>
}
