// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// This is ONLY for server-side use (API routes)
export const createSupabaseServerClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )