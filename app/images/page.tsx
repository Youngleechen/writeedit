// app/page.tsx
'use client';

import { useState } from 'react';

export default function VisionPage() {
  const [image, setImage] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !prompt.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);

    // Convert image to base64 (without data URL prefix)
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = (reader.result as string).split(',')[1];
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(image);
    });

    try {
      const res = await fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      setAnswer(data.answer);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem' }}>
      <h1>Vision Analysis with AI</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="prompt">Prompt:</label>
          <input
            id="prompt"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., What is shown in this image?"
            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
          />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="image">Upload Image:</label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: 'block', marginTop: '0.5rem' }}
          />
        </div>

        {preview && (
          <div style={{ marginTop: '1rem' }}>
            <img
              src={preview}
              alt="Preview"
              style={{ maxWidth: '100%', maxHeight: '300px' }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!image || !prompt.trim() || loading}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Analyzing...' : 'Analyze Image'}
        </button>
      </form>

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      {answer && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#f9f9f9',
            borderRadius: '4px',
          }}
        >
          <h2>AI Response:</h2>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}