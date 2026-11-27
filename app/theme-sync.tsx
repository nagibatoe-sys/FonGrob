'use client'
import { useEffect } from 'react'
import { browserClient } from './client'

const valid = new Set(['standard', 'gold', 'ice'])

export function ThemeSync() {
  useEffect(() => {
    const db = browserClient()
    let active = true
    async function sync(uid?: string) {
      if (!active) return
      if (!uid) { document.documentElement.dataset.accent = 'standard'; return }
      const { data } = await db.from('profiles').select('accent_code').eq('id', uid).single()
      const code = data?.accent_code ?? 'standard'
      if (active) document.documentElement.dataset.accent = valid.has(code) ? code : 'standard'
    }
    const changed = (event: Event) => {
      const code = (event as CustomEvent<string>).detail
      if (valid.has(code)) document.documentElement.dataset.accent = code
    }
    window.addEventListener('fongrob-accent-changed', changed)
    void db.auth.getSession().then(({ data }) => sync(data.session?.user.id))
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (active) void sync(session?.user.id) }, 0)
    })
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener('fongrob-accent-changed', changed) }
  }, [])
  return null
}
