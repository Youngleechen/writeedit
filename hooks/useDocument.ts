// /hooks/useDocument.ts
'use client';

import { useState, useCallback, useEffect } from 'react';

export interface SavedDocument {
  id: string;
  name: string;
  original_text: string;
  edited_text: string;
  tracked_html?: string | null; // ✅ Added for tracked changes persistence
  level: string;
  model: string;
  custom_instruction: string;
  created_at: string;
  updated_at?: string;
}

export function useDocument() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to load documents');
      const { documents: docs } = await res.json();
      setDocuments(docs || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ✅ Save: returns the new document ID
  const saveDocument = useCallback(
    async (finalText: string, originalText: string, name?: string) => {
      if (!originalText.trim() || !finalText.trim()) {
        setError('Both original and edited text are required.');
        return null;
      }

      const docName =
        name?.trim() ||
        originalText.substring(0, 50).replace(/\s+/g, ' ').trim() +
          (originalText.length > 50 ? '...' : '');

      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: docName,
            originalText: originalText.trim(),
            editedText: finalText.trim(),
            trackedHtml: null, // will be populated on first save or update
            level: 'proofread',
            model: 'x-ai/grok-4.1-fast:free',
            customInstruction: '',
          }),
        });

        if (!res.ok) throw new Error('Failed to save document');
        const { id } = await res.json();
        await fetchDocuments();
        return id;
      } catch (err: any) {
        setError(err.message);
        console.error('Save failed:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDocuments]
  );

  // ✅ Save progress: updates existing doc (including tracked_html!)
  const saveProgress = useCallback(
    async (id: string, finalText: string, originalText: string, trackedHtml?: string) => {
      if (!originalText.trim() || !finalText.trim()) {
        setError('Both original and edited text are required.');
        return false;
      }

      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/documents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            originalText: originalText.trim(),
            editedText: finalText.trim(),
            trackedHtml: trackedHtml || null,
          }),
        });

        if (!res.ok) throw new Error('Failed to update document');
        await fetchDocuments();
        return true;
      } catch (err: any) {
        setError(err.message);
        console.error('Update failed:', err);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDocuments]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error('Failed to delete document');
        await fetchDocuments();
      } catch (err: any) {
        setError(err.message);
        console.error('Delete failed:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchDocuments]
  );

  // Optional: passthrough for consistency (not strictly needed)
  const loadDocument = useCallback((doc: SavedDocument) => {
    return doc;
  }, []);

  return {
    documents,
    isLoading,
    error,
    saveDocument,
    saveProgress,
    deleteDocument,
    loadDocument,
    fetchDocuments,
  };
}