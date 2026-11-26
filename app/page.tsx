import Link from "next/link"
export default function Home() {
  return <main>
    <header>ФОНГРОБ</header>
    <h1>Коэффициенты на рабочую реальность</h1>
    <p>Закрытая площадка офисных прогнозов. Участие добровольное. Все прогнозы оформляются в виртуальных OfficeCoin.</p>
    <nav><Link href="/line">Открыть линию</Link><Link href="/login">Войти</Link></nav>
    <aside>Платформа в разработке · Приём прогнозов ещё не открыт</aside>
  </main>
}
