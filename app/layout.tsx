import type { ReactNode } from 'react'
import './style.css'
import './bookmaker.css'
import { ThemeSync } from './theme-sync'

export const metadata = { title: 'ФОНГРОБ · Офисные прогнозы' }
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body><ThemeSync/>{children}</body></html>
}
