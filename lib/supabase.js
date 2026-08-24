import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // Shown in the browser console if the .env file is missing or misnamed.
  console.error(
    'Missing Supabase config. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
  )
}

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key')

export const isConfigured = Boolean(url && key)
