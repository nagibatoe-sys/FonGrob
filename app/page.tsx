import Link from "next/link"
import { SiteNav } from './site-nav'
export default function Home() {
  return <><SiteNav/><main>
    <header>ФОНГРОБ</header>
    <h1>Коэффициенты на рабочую реальность</h1>
    <p>Закрытая площадка офисных прогнозов. Участие добровольное. Все прогнозы оформляются в виртуальных OfficeCoin.</p>
    <nav><Link href="/line">Открыть линию</Link><Link href="/pari">Пари</Link><Link href="/login">Войти</Link></nav>
    <aside>Внутренние прогнозы для сотрудников · Правила события и источник результата указаны в линии</aside>
  </main></>
}
