// app/toaster/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

export default function ToasterTestPage() {
  const [status, setStatus] = useState<string>('Initializing Supabase...');

  useEffect(() => {
    const testSupabase = async () => {
      try {
        const { count, error } = await supabase
          .from('test')
          .select('id', { count: 'exact', head: true });

        if (error && error.code === '42P01') {
          setStatus('✅ Supabase client works! (No "test" table found — that’s OK)');
        } else if (error) {
          setStatus(`⚠️ Supabase error: ${error.message}`);
        } else {
          setStatus(`✅ Connected! Table has ${count} records.`);
        }
      } catch (err: any) {
        setStatus(`❌ Unexpected error: ${err.message}`);
      }
    };

    testSupabase();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '600px' }}>
      <h1>✨ Toaster Test Page</h1>
      <p><strong>Supabase Status:</strong> {status}</p>
      <p>
        If you see a ✅, your local setup matches Vercel.  
        Commit and push to deploy the same working version!
      </p>
      <hr style={{ margin: '1.5rem 0' }} />
      <p><em>Note: No table? Create one in your Supabase dashboard → Table Editor.</em></p>
    </div>
  );
}