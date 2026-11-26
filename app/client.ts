import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined
export function browserClient() {
  client ??= createClient(window.location.origin, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-preview')
  return client
}
