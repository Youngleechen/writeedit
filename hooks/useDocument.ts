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
    // ⚠️ DEBUG MODE: SIMULATE CONTENT EVEN IF EMPTY
    // We'll use real values if available, otherwise fall back to test content.
    const hasRealInput = editor.inputText.trim().length > 0;
    const hasRealEdit = editor.editedText.trim().length > 0 && !editor.editedText.includes('Result will appear here');

    const originalText = hasRealInput
      ? editor.inputText.trim()
      : 'This is a simulated original text for testing.';

    const finalText = hasRealEdit
      ? editor.editedText.trim()
      : 'This is a simulated edited output. The AI integration appears to be not updating state correctly.';

    const name = hasRealInput
      ? editor.inputText.substring(0, 50).replace(/\s+/g, ' ').trim() + (editor.inputText.length > 50 ? '...' : '')
      : '🧪 Simulated Test Document';

    console.log('=== SIMULATED SAVE ATTEMPT ===');
    console.log('Using originalText:', originalText);
    console.log('Using finalText:', finalText);
    console.log('Real input?', hasRealInput);
    console.log('Real edit?', hasRealEdit);

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
          level: editor.editLevel || 'proofread',
          model: editor.selectedModel || 'x-ai/grok-4.1-fast:free',
          customInstruction: editor.customInstruction || '',
        }),
      });

      if (!res.ok) throw new Error('Failed to save document');
      const { id } = await res.json();

      editor.setDocumentId(id);
      await fetchDocuments();
      setError(null);
      console.log('✅ Simulated document saved successfully with ID:', id);
      alert('Document saved (simulated or real)! Check the list below.');
    } catch (err: any) {
      setError(err.message);
      console.error('Save failed:', err);
      alert('Save failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [editor, fetchDocuments]);

  const saveProgress = useCallback(async () => {
    if (!editor.documentId) {
      setError('No document loaded to update');
      return;
    }

    // Same simulation logic for progress
    const originalText = editor.inputText.trim() || 'Simulated original (progress save)';
    const finalText = editor.editedText.trim() || 'Simulated edited (progress save)';

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

  // Auto-save logic remains unchanged
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