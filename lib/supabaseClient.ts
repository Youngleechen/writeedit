// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';

// ✅ CLIENT-SIDE CLIENT (for use in 'use client' components)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ⚠️ SERVER-SIDE CLIENT (for API routes, Server Actions, etc.)
export const createSupabaseServerClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );