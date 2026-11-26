import type { ReactNode } from 'react'
import './style.css'

export const metadata = { title: 'ФОНГРОБ · Офисные прогнозы' }
export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="ru"><body>{children}</body></html>
}
