// /hooks/useDocument.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useEditor } from './useEditor';

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
  const editor = useEditor();

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

  // ✅ ACCEPT finalText as input — don't assume editedText is valid
  const saveDocument = useCallback(async (finalText: string, originalText: string) => {
    if (!originalText.trim() || !finalText.trim()) {
      setError('Both original and edited text are required.');
      return;
    }

    let name = originalText.substring(0, 50).replace(/\s+/g, ' ').trim();
    if (originalText.length > 50) name += '...';

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          originalText: originalText.trim(),
          editedText: finalText.trim(),
          level: editor.editLevel,
          model: editor.selectedModel,
          customInstruction: editor.customInstruction,
        }),
      });

      if (!res.ok) throw new Error('Failed to save document');
      const { id } = await res.json();

      editor.setDocumentId(id);
      await fetchDocuments();
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Save failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [editor, fetchDocuments]);

  const saveProgress = useCallback(async (finalText: string, originalText: string) => {
    if (!editor.documentId) {
      setError('No document loaded to update');
      return;
    }
    if (!originalText.trim() || !finalText.trim()) {
      setError('Both original and edited text are required.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editor.documentId,
          originalText: originalText.trim(),
          editedText: finalText.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to update document');
      await fetchDocuments();
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('Update failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [editor, fetchDocuments]);

  const deleteDocument = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete document');
      await fetchDocuments();
      if (editor.documentId === id) {
        editor.reset();
        editor.setDocumentId(null);
      }
    } catch (err: any) {
      setError(err.message);
      console.error('Delete failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [editor, fetchDocuments]);

  const loadDocument = useCallback((doc: SavedDocument) => {
    editor.loadDocument(doc.id, {
      originalText: doc.original_text,
      editedText: doc.edited_text,
      level: doc.level,
      model: doc.model,
      customInstruction: doc.custom_instruction,
    });
  }, [editor]);

  // Auto-save: now also uses DOM-derived text (handled in EditorUI)

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