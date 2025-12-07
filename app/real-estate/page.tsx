// app/test-image/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// We'll treat "Test Property Listing" as the real estate title
const LISTING_TITLE = 'Test Property Listing';

export default function TestImagePage() {
  const [imagePreviews, setImagePreviews] = useState<(string | null)[]>(Array(5).fill(null));
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user session and existing images on mount
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user.id;
      setUserId(uid || null);

      if (uid) {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('image_url')
          .eq('user_id', uid)
          .eq('title', LISTING_TITLE)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Failed to fetch listing:', error);
        } else if (data?.image_url) {
          try {
            const urls = JSON.parse(data.image_url);
            if (Array.isArray(urls)) {
              const filled = [...urls];
              while (filled.length < 5) filled.push(null);
              setImagePreviews(filled.slice(0, 5));
            }
          } catch (e) {
            // Fallback: treat as single image (legacy)
            setImagePreviews([data.image_url, ...Array(4).fill(null)]);
          }
        }
      }
    };

    init();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    setUploadingIndex(index);
    setStatus(null);

    try {
      const filePath = `blog/${userId}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from('blog-images')
        .upload(filePath, file, { upsert: false });

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('blog-images').getPublicUrl(filePath);
      const imageUrl = data.publicUrl;

      // Get current image list
      const current = [...imagePreviews];
      current[index] = imageUrl;

      // Save as JSON string in image_url field
      const imageJson = JSON.stringify(current);

      // Upsert: delete old + insert new (or just update if you prefer)
      await supabase
        .from('blog_posts')
        .delete()
        .eq('user_id', userId)
        .eq('title', LISTING_TITLE);

      const { error: insertErr } = await supabase
        .from('blog_posts')
        .insert({
          user_id: userId,
          title: LISTING_TITLE,
          content: 'Real estate property listing images.',
          image_url: imageJson,
          published: false,
        });

      if (insertErr) throw insertErr;

      setStatus(`✅ Image ${index + 1} uploaded!`);
      e.target.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10 space-y-6">
      <h1 className="text-2xl font-bold mb-4">PropertyParams: Property Image Upload (5 Images)</h1>

      {imagePreviews.map((preview, index) => (
        <div key={index} className="border rounded p-4">
          <h3 className="font-medium mb-2">Property Image {index + 1}</h3>
          {preview ? (
            <img
              src={preview}
              alt={`Property ${index + 1}`}
              className="w-full h-48 object-contain border mb-3"
            />
          ) : (
            <div className="w-full h-48 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 mb-3">
              No image
            </div>
          )}

          {userId ? (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleUpload(e, index)}
              disabled={uploadingIndex !== null}
              className="w-full"
            />
          ) : (
            <p className="text-red-600">You must be logged in to upload.</p>
          )}
        </div>
      ))}

      {uploadingIndex !== null && <p>Uploading image {uploadingIndex + 1}...</p>}
      {status && (
        <p className={status.startsWith('✅') ? 'text-green-600' : 'text-red-600'}>
          {status}
        </p>
      )}

      <p className="text-sm text-gray-500 mt-4">
        All 5 images are stored as a JSON array in the <code>image_url</code> field of a single{' '}
        <code>blog_posts</code> record titled &quot;{LISTING_TITLE}&quot;.
      </p>
    </div>
  );
}