// app/test/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Check if user is authenticated
  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUploading(true);

    // Re-check auth on submit
    const isAuthenticated = await checkAuth();
    if (!isAuthenticated) {
      setIsUploading(false);
      return;
    }

    if (!file) {
      setError('Please select an image');
      setIsUploading(false);
      return;
    }

    if (!text.trim()) {
      setError('Please enter some text');
      setIsUploading(false);
      return;
    }

    // File size limit: 50MB (Supabase free tier)
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Max 50MB.');
      setIsUploading(false);
      return;
    }

    try {
      // Get user ID for path isolation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Generate unique file path
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      
      // Upload image to Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('user-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new Error(uploadError.message || 'Image upload failed');
      }

      // Save text + image path to database
      const { error: dbError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: text,
          image_path: fileName, // e.g., "user-id/1234567890-image.jpg"
        });

      if (dbError) {
        console.error('Database insert error:', dbError);
        throw new Error('Failed to save post');
      }

      // Success
      alert('Upload successful!');
      setFile(null);
      setText('');
    } catch (err: any) {
      const message = err.message || 'Upload failed. Please try again.';
      setError(message);
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Upload Image + Text</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="text" className="block mb-2 font-medium">
            Text Content
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            rows={4}
            placeholder="Enter your text here..."
            required
          />
        </div>

        <div>
          <label htmlFor="image" className="block mb-2 font-medium">
            Image Upload (max 50MB)
          </label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 border border-gray-300 rounded-md"
            required
          />
          {file && <p className="mt-1 text-sm text-gray-600">{file.name}</p>}
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  );
}