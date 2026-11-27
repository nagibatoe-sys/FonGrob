import Link from 'next/link'
const items = [
  ['/', 'Главная'], ['/line', 'События'], ['/pari', 'Пари'], ['/bets', 'Мои ставки'], ['/rating', 'Рейтинг'],
  ['/seasons', 'Сезоны'], ['/achievements', 'Достижения'], ['/shop', 'Магазин'],
  ['/hall', 'Зал славы'], ['/profile', 'Личный кабинет']
]
export function SiteNav() {
  return <header className="site-header"><Link href="/" className="site-logo">ФОНГРОБ</Link><nav aria-label="Основная навигация">{items.map(([href,label])=><Link key={href} href={href}>{label}</Link>)}</nav></header>
}
