// app/page.tsx
'use client';

import { useState } from 'react';
import { PageWithChrome } from '@/components/PageWithChrome'; // ✅ Import wrapper

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
    <PageWithChrome> {/* ✅ Wrap all your content */}
      <div style={{
        fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '2rem',
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        color: '#333',
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '600',
          marginBottom: '1rem',
          color: '#2c3e50',
        }}>
          🖼️ Vision Analysis with AI
        </h1>

        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="prompt" style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#2c3e50',
            }}>
              Prompt:
            </label>
            <input
              id="prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What's in this image? Describe the scene, objects, or people..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '1rem',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#0070f3'}
              onBlur={(e) => e.target.style.borderColor = '#ddd'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="image" style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: '500',
              marginBottom: '0.5rem',
              color: '#2c3e50',
            }}>
              Upload Image:
            </label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            />
          </div>

          {preview && (
            <div style={{
              marginTop: '1rem',
              textAlign: 'center',
            }}>
              <img
                src={preview}
                alt="Uploaded preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  border: '1px solid #eee',
                  objectFit: 'contain',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!image || !prompt.trim() || loading}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: !image || !prompt.trim() || loading ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '500',
              cursor: !image || !prompt.trim() || loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              if (!(image && prompt.trim() && !loading)) return;
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#005bb5';
            }}
            onMouseOut={(e) => {
              if (!(image && prompt.trim() && !loading)) return;
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0070f3';
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                </svg>
                Analyzing...
              </span>
            ) : (
              'Analyze Image'
            )}
          </button>
        </form>

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#ffebee',
            border: '1px solid #ef9a9a',
            borderRadius: '8px',
            marginBottom: '1rem',
            color: '#c62828',
          }}>
            ❌ {error}
          </div>
        )}

        {answer && (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            marginTop: '1rem',
            fontSize: '1rem',
            lineHeight: '1.6',
            color: '#333',
          }}>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: '600',
              marginBottom: '0.5rem',
              color: '#2c3e50',
            }}>
              🤖 AI Response
            </h2>
            <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {answer}
            </p>
          </div>
        )}

        {/* Spinner animation */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </PageWithChrome> {/* ✅ Close wrapper */}
  );
}