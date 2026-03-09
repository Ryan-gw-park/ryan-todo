import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('sb_url')
const key = import.meta.env.VITE_SUPABASE_KEY || localStorage.getItem('sb_key')

let _db = (url && key) ? createClient(url, key) : null

export function getDb() { return _db }

export function initSupabase(u, k) {
  _db = createClient(u, k)
}

export function getCreds() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('sb_url') || '',
    key: import.meta.env.VITE_SUPABASE_KEY || localStorage.getItem('sb_key') || '',
  }
}

export function hasCreds() {
  const c = getCreds()
  return !!(c.url && c.key)
}
