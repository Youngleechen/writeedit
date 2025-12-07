// app/test-image/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TestImagePage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user session and latest image on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        // Fetch the latest test image post for this user
        const { data, error } = await supabase
          .from('blog_posts')
          .select('image_url')
          .eq('user_id', uid)
          .eq('title', 'Test Image Upload')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Failed to fetch latest image:', error);
        } else if (data?.image_url) {
          setPreview(data.image_url);
        }
      }
    };

    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploading(true);
    setStatus(null);

    try {
      const filePath = `blog/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      // Insert or replace test post (only one needed for demo)
      const { error: upsertErr } = await supabase
        .from('blog_posts')
        .upsert(
          {
            user_id: userId,
            title: 'Test Image Upload',
            content: 'This is a test post for image upload.',
            image_url: imageUrl,
            published: false,
          },
          {
            onConflict: 'user_id,title', // assumes unique(user_id, title)
            ignoreDuplicates: false,
          }
        );

      if (upsertErr) throw upsertErr;

      setPreview(imageUrl);
      setStatus('✅ Uploaded and saved to blog_posts + blog-images!');

      // Optional: clear file input
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 mt-10">
      <h1 className="text-2xl font-bold mb-4">ImageContext Test</h1>

      {preview ? (
        <img
          src={preview}
          alt="Uploaded"
          className="w-full h-48 object-contain border mb-4"
        />
      ) : (
        <div className="w-full h-48 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 mb-4">
          No image uploaded
        </div>
      )}

      {userId ? (
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="w-full mb-2"
        />
      ) : (
        <p className="text-red-600">You must be logged in to upload.</p>
      )}

      {uploading && <p>Uploading...</p>}
      {status && (
        <p className={status.startsWith('✅') ? 'text-green-600' : 'text-red-600'}>
          {status}
        </p>
      )}

      <p className="text-sm text-gray-500 mt-4">
        This will create/update a test draft in your <code>blog_posts</code> table
        and upload to <code>blog-images</code>.
      </p>
    </div>
  );
}