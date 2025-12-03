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

  const saveDocument = useCallback(async () => {
    const {
      inputText,
      editedText,
      editLevel,
      selectedModel,
      customInstruction,
    } = editor;

    const originalText = inputText.trim();
    const finalText = editedText.trim();

    // 🔍 DEBUG LOGS — TEMPORARY
    console.log('=== DEBUG: SaveDocument Attempt ===');
    console.log('inputText (raw):', JSON.stringify(inputText));
    console.log('editedText (raw):', JSON.stringify(editedText));
    console.log('originalText (trimmed):', JSON.stringify(originalText));
    console.log('finalText (trimmed):', JSON.stringify(finalText));
    console.log('finalText length:', finalText.length);
    console.log('finalText includes placeholder?', finalText.includes('Result will appear here'));
    console.log('Both non-empty?', !!originalText && !!finalText);
    console.log('=====================================');

    if (!originalText || !finalText || finalText.includes('Result will appear here')) {
      setError('No valid content to save');
      console.warn('❌ Save blocked: no valid content');
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
          originalText,
          editedText: finalText,
          level: editLevel,
          model: selectedModel,
          customInstruction,
        }),
      });

      if (!res.ok) throw new Error('Failed to save document');
      const { id } = await res.json();

      editor.setDocumentId(id);
      await fetchDocuments();
      setError(null);
      console.log('✅ Document saved successfully with ID:', id);
    } catch (err: any) {
      setError(err.message);
      console.error('Save failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [editor, fetchDocuments]);

  const saveProgress = useCallback(async () => {
    if (!editor.documentId) {
      setError('No document loaded to update');
      return;
    }

    const originalText = editor.inputText.trim();
    const finalText = editor.editedText.trim();

    if (!originalText || !finalText || finalText.includes('Result will appear here')) {
      setError('No valid content to save');
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
          originalText,
          editedText: finalText,
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

  useEffect(() => {
    if (
      !editor.documentId ||
      !editor.inputText.trim() ||
      !editor.editedText.trim() ||
      editor.editedText.includes('Result will appear here')
    ) {
      return;
    }

    const timer = setTimeout(() => {
      saveProgress();
    }, 2000);

    return () => clearTimeout(timer);
  }, [editor.documentId, editor.inputText, editor.editedText, saveProgress]);

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