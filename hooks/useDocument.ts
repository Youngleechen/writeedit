// /hooks/useDocument.ts
'use client';

import { useState, useCallback, useEffect } from 'react';

export interface SavedDocument {
  id: string;
  name: string;
  original_text: string;
  edited_text: string;
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
  const saveDocument = useCallback(async (
    finalText: string,
    originalText: string,
    name?: string
  ) => {
    if (!originalText.trim() || !finalText.trim()) {
      setError('Both original and edited text are required.');
      return null;
    }

    const docName = name?.trim() ||
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
          level: 'proofread', // or pass as param if needed
          model: 'x-ai/grok-4.1-fast:free',
          customInstruction: '',
        }),
      });

      if (!res.ok) throw new Error('Failed to save document');
      const { id } = await res.json();
      await fetchDocuments();
      return id; // ✅ Return ID so caller can set it
    } catch (err: any) {
      setError(err.message);
      console.error('Save failed:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [fetchDocuments]);

  // ✅ Save progress: updates existing doc
  const saveProgress = useCallback(async (id: string, finalText: string, originalText: string) => {
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
  }, [fetchDocuments]);

  const deleteDocument = useCallback(async (id: string) => {
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
  }, [fetchDocuments]);

  // ✅ loadDocument is just a passthrough — no editor coupling!
  // Caller (EditorUI) handles state update
  const loadDocument = useCallback((doc: SavedDocument) => {
    // This function now does nothing but can be used for consistency
    // Or remove it entirely and access doc directly in EditorUI
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