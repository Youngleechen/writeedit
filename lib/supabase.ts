import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'x-client-info': 'nextjs-web-app/1.0',
      },
    },
  }
);