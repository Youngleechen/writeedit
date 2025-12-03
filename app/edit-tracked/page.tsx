// /app/edit-tracked/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useEditor } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';
import { TrackedChangesView } from '@/components/TrackedChangesView';

export default function EditTrackedPage() {
  const editor = useEditor();
  const docManager = useDocument();

  const {
    documents,
    isLoading: isDocLoading,
    error: docError,
    saveProgress: saveProgressToApi,
    deleteDocument,
  } = docManager;

  const {
    inputText,
    editedText,
    trackedHtml,
    viewMode,
    documentId,
    changeCount,
    setViewMode,
    setInputText,
    setDocumentId,
  } = editor;

  const [currentDoc, setCurrentDoc] = useState<SavedDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Load a document into editor
  const loadDocument = useCallback((doc: SavedDocument) => {
    editor.loadDocument(doc.id, {
      originalText: doc.original_text,
      editedText: doc.edited_text,
      level: doc.level,
      model: doc.model,
      customInstruction: doc.custom_instruction,
    });
    setCurrentDoc(doc);
    setDocumentId(doc.id);
    setViewMode('tracked');
    setUnsavedChanges(false);
  }, [editor, setDocumentId, setViewMode]);

  // Handle accept/reject by updating local state
  const handleAcceptChange = useCallback((group: any) => {
    // Since we don’t store diff HTML, we’ll mark as unsaved and rely on clean text
    setUnsavedChanges(true);
  }, []);

  const handleRejectChange = useCallback((group: any) => {
    setUnsavedChanges(true);
  }, []);

  // Save current state to Supabase
  const saveProgress = async () => {
    if (!documentId || !currentDoc) {
      setSaveError('No active document to save');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // Extract clean text from current state
      const cleanText = editedText; // In this architecture, editedText is always clean

      await saveProgressToApi(documentId, cleanText, inputText);
      setUnsavedChanges(false);
      alert('✅ Progress saved!');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Update unsaved state when text changes
  useEffect(() => {
    if (currentDoc) {
      const hasChanges = inputText !== currentDoc.original_text || editedText !== currentDoc.edited_text;
      setUnsavedChanges(hasChanges);
    }
  }, [inputText, editedText, currentDoc]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Edit Tracked</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Document List */}
        <div className="lg:col-span-1">
          <div className="bg-white p-4 rounded-lg border">
            <h2 className="font-semibold mb-3">Saved Documents</h2>
            {isDocLoading ? (
              <p>Loading...</p>
            ) : documents.length === 0 ? (
              <p className="text-gray-500 text-sm">No documents</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => loadDocument(doc)}
                    className={`p-2 rounded cursor-pointer text-sm ${
                      doc.id === documentId
                        ? 'bg-blue-100 border-l-2 border-l-blue-500'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium truncate">{doc.name}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {docError && <p className="text-red-600 text-sm mt-2">{docError}</p>}
          </div>
        </div>

        {/* Main: Tracked/Clean View */}
        <div className="lg:col-span-3">
          {currentDoc ? (
            <>
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{currentDoc.name}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={saveProgress}
                    disabled={!unsavedChanges || isSaving}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      unsavedChanges
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    💾 {isSaving ? 'Saving...' : 'Save Progress'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this document?')) {
                        deleteDocument(currentDoc.id);
                        setCurrentDoc(null);
                        editor.reset();
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              {/* View Toggle */}
              <div className="flex mb-4">
                <button
                  className={`px-3 py-1 text-sm rounded-l ${
                    viewMode === 'tracked'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => setViewMode('tracked')}
                >
                  Tracked Changes ({changeCount})
                </button>
                <button
                  className={`px-3 py-1 text-sm rounded-r ${
                    viewMode === 'clean'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => setViewMode('clean')}
                >
                  Clean Text
                </button>
              </div>

              {/* Content */}
              <div className="bg-white p-4 border rounded min-h-96">
                {viewMode === 'clean' ? (
                  <div className="whitespace-pre-wrap">{editedText || 'No content'}</div>
                ) : (
                  <TrackedChangesView
                    key={documentId}
                    originalText={inputText}
                    editedText={editedText}
                    onAcceptChange={handleAcceptChange}
                    onRejectChange={handleRejectChange}
                  />
                )}
              </div>

              {saveError && <p className="mt-2 text-red-600">{saveError}</p>}
            </>
          ) : (
            <div className="bg-white p-8 rounded border text-center text-gray-500">
              <p>Select a document from the sidebar to begin editing tracked changes.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}