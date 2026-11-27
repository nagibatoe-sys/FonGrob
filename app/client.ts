import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined
type DesktopBridge = { storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<boolean>; removeItem(key: string): Promise<boolean> } }
const temporary = new Map<string,string>()
export function browserClient() {
  const desktop = (window as Window & { fongrobDesktop?: DesktopBridge }).fongrobDesktop
  client ??= createClient(window.location.origin, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-preview', desktop ? {
    auth: { storage: {
      getItem: async key => (await desktop.storage.getItem(key)) ?? temporary.get(key) ?? null,
      setItem: async (key,value) => { temporary.set(key,value); await desktop.storage.setItem(key,value) },
      removeItem: async key => { temporary.delete(key); await desktop.storage.removeItem(key) }
    } }
  } : undefined)
  return client
}
