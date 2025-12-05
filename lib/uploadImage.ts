// lib/uploadImage.ts
export async function uploadImage({
  file,
  entityType,
  entityId,
  signal, // optional: for cancellation
}: {
  file: File;
  entityType: string;
  entityId: string;
  signal?: AbortSignal;
}) {
  // 👉 Frontend validation (user-friendly)
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (JPEG, PNG, etc.).');
  }
  if (file.size > 10 * 1024 * 1024) { // 10 MB limit
    throw new Error('File must be smaller than 10 MB.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('entityType', entityType);
  formData.append('entityId', entityId);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    signal, // allows cancellation
  });

  if (!res.ok) {
    // Try to get meaningful error
    let message = 'Upload failed.';
    try {
      const json = await res.json();
      message = json.message || message;
    } catch {}
    throw new Error(message);
  }

  return await res.json();
}