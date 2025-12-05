// app/estate/page.tsx
'use client';

import { useState, useRef } from 'react';

export default function EstateUploadPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      setUploadUrl(null); // reset previous result
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadUrl(data.url);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Upload failed. Check console.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🏡 Real Estate Upload Test</h1>
      <p>Upload a property image to test Supabase Storage.</p>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ marginTop: '1rem' }}
      />

      {preview && (
        <div style={{ marginTop: '1rem' }}>
          <h3>Preview:</h3>
          <img
            src={preview}
            alt="Preview"
            style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }}
          />
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!preview || isUploading}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: !preview || isUploading ? 'not-allowed' : 'pointer',
        }}
      >
        {isUploading ? 'Uploading...' : 'Upload to Supabase'}
      </button>

      {uploadUrl && (
        <div style={{ marginTop: '1rem' }}>
          <h3>✅ Upload Success!</h3>
          <p>
            <a href={uploadUrl} target="_blank" rel="noopener noreferrer">
              View uploaded image
            </a>
          </p>
          <input
            type="text"
            value={uploadUrl}
            readOnly
            onClick={(e) => (e.target as HTMLInputElement).select()}
            style={{ width: '100%', padding: '0.3rem', marginTop: '0.5rem' }}
          />
        </div>
      )}
    </div>
  );
}