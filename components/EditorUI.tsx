// /components/EditorUI.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditLevel } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';
import { TrackedChangesView } from '@/components/TrackedChangesView';

const BASE_MODELS = [
  { id: 'x-ai/grok-4.1-fast:free', name: 'Grok 4.1 (Fast & Accurate)' },
  { id: 'anthropic/claude-3.5-sonnet:free', name: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-flash-1.5-8b:free', name: 'Gemini Flash 1.5' },
];

export function EditorUI() {
  const editor = useEditor();
  const docManager = useDocument();
  const trackedRef = useRef<HTMLDivElement>(null);

  const {
    documents,
    isLoading: isDocLoading,
    error: docError,
    saveDocument,
    saveProgress,
    deleteDocument,
    loadDocument,
  } = docManager;

  const {
    inputText,
    editedText,
    editLevel,
    customInstruction,
    selectedModel,
    isLoading,
    error,
    viewMode,
    isEditorialBoard,
    wordCount,
    documentId,
    setInputText,
    setEditLevel,
    setCustomInstruction,
    setSelectedModel,
    setIsEditorialBoard,
    setViewMode,
    applyEdit,
  } = editor;

  const [documentName, setDocumentName] = useState('');
  const [showDocuments, setShowDocuments] = useState(true);

  useEffect(() => {
    if (!documentName && inputText.trim()) {
      const name = inputText.substring(0, 50).replace(/\s+/g, ' ').trim() + (inputText.length > 50 ? '...' : '');
      setDocumentName(name);
    }
  }, [inputText, documentName]);

  const extractCleanTextFromTrackedDOM = useCallback((): string => {
    if (!trackedRef.current) return editedText;

    const clone = trackedRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.change-action').forEach(el => el.remove());
    clone.querySelectorAll('del').forEach(el => el.remove());
    clone.querySelectorAll('ins').forEach(el => {
      const text = document.createTextNode(el.textContent || '');
      el.replaceWith(text);
    });
    clone.querySelectorAll('.change-group').forEach(group => {
      while (group.firstChild) {
        group.parentNode?.insertBefore(group.firstChild, group);
      }
      group.remove();
    });

    return clone.textContent?.trim() || editedText;
  }, [editedText]);

  const handleCopy = async () => {
    const textToCopy = extractCleanTextFromTrackedDOM();
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      alert('✅ Copied!');
    } catch (err) {
      alert('Failed to copy.');
    }
  };

  const handleDownload = () => {
    const textToDownload = extractCleanTextFromTrackedDOM();
    if (!textToDownload.trim()) return;
    const blob = new Blob([textToDownload], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edited-document-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAcceptChange = useCallback(() => {}, []);
  const handleRejectChange = useCallback(() => {}, []);

  const handleSaveDocument = async () => {
    const original = inputText;
    const final = extractCleanTextFromTrackedDOM();
    if (!original.trim() || !final.trim()) {
      alert('No valid content to save. Please run “Edit” first.');
      return;
    }
    await saveDocument(final, original);
  };

  const handleSaveProgress = async () => {
    const original = inputText;
    const final = extractCleanTextFromTrackedDOM();
    if (!original.trim() || !final.trim()) {
      alert('No valid content to save.');
      return;
    }
    await saveProgress(final, original);
  };

  return (
    <div className="editor-ui max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold">Original Text</h2>
          <span className="text-sm text-gray-600">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your text here..."
          rows={8}
          className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm text-black" // Explicitly set text color to black
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium mb-2">Editing Level</h3>
          <div className="flex flex-wrap gap-2">
            {(['proofread', 'rewrite', 'formal', 'custom'] as EditLevel[]).map((level) => (
              <button
                key={level}
                className={`px-3 py-1 text-sm rounded-md ${
                  editLevel === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
                onClick={() => setEditLevel(level)}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
          {editLevel === 'custom' && (
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="Enter custom instruction..."
              className="w-full mt-2 p-2 border border-gray-300 rounded text-sm text-black" // Explicitly set text color to black
            />
          )}
        </div>

        <div>
          <h3 className="font-medium mb-2">Model & Options</h3>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm mb-2 text-black bg-white" // Explicitly set text color to black
            disabled={isLoading}
          >
            {BASE_MODELS.map((model) => (
              <option key={model.id} value={model.id} className="text-black"> // Explicitly set text color to black
                {model.name}
              </option>
            ))}
          </select>
          <label className="flex items-center text-sm text-black"> {/* Explicitly set text color to black */}
            <input
              type="checkbox"
              checked={isEditorialBoard}
              onChange={(e) => setIsEditorialBoard(e.target.checked)}
              className="mr-2"
              disabled={isLoading}
            />
            Use Editorial Board (3-round refinement)
          </label>
        </div>
      </div>

      <div className="border-t border-gray-300 pt-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Document Management</h2>
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            className="text-sm text-blue-600"
          >
            {showDocuments ? '↑ Hide' : '↓ Show'}
          </button>
        </div>

        {showDocuments && (
          <div id="documents-panel" className="mt-2 p-4 bg-gray-50 rounded border border-gray-200">
            <input
              id="document-name"
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Document name..."
              className="w-full p-2 border border-gray-300 rounded text-sm mb-2 text-black" // Explicitly set text color to black
            />
            <div className="flex gap-2">
              <button
                id="save-document-btn"
                onClick={handleSaveDocument}
                disabled={isLoading || isDocLoading}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                💾 Save Document
              </button>
              <button
                id="save-progress-btn"
                onClick={handleSaveProgress}
                disabled={!documentId || isLoading || isDocLoading}
                className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                🔄 Save Progress
              </button>
            </div>

            <div className="mt-4">
              <h3 className="font-medium mb-2">Saved Documents</h3>
              <div id="documents-list" className="space-y-2 max-h-60 overflow-y-auto">
                {documents.length === 0 ? (
                  <div className="text-gray-500 text-sm">No saved documents yet</div>
                ) : (
                  documents.map((doc) => {
                    const date = new Date(doc.created_at);
                    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={doc.id}
                        className={`p-2 border rounded cursor-pointer ${
                          doc.id === documentId
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-300 hover:bg-gray-100'
                        }`}
                        onClick={() => loadDocument(doc)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium text-sm text-black"> {/* Explicitly set text color to black */}
                            {doc.name}
                          </div>
                          <div className="text-xs text-gray-500">{formattedDate}</div>
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadDocument(doc);
                            }}
                            className="text-xs text-blue-600"
                          >
                            ↩️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('Delete this document?')) deleteDocument(doc.id);
                            }}
                            className="text-xs text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <button
          id="edit-btn"
          onClick={applyEdit}
          disabled={isLoading}
          className={`px-4 py-2 rounded-md font-medium ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isLoading ? '⏳ Processing...' : '✨ Edit'}
        </button>
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
        {docError && <p className="mt-2 text-red-600 text-sm">{docError}</p>}
      </div>

      {(editedText || isLoading) && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Edited Result</h2>
            <div className="flex gap-2">
              <button
                id="copy-btn"
                onClick={handleCopy}
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
              >
                📋 Copy
              </button>
              <button
                id="download-docx-btn"
                onClick={handleDownload}
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
              >
                💾 Download
              </button>
            </div>
          </div>

          <div className="flex mb-2">
            <button
              className={`px-3 py-1 text-sm ${
                viewMode === 'clean'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
              onClick={() => setViewMode('clean')}
            >
              Clean View
            </button>
            <button
              className={`px-3 py-1 text-sm ml-1 ${
                viewMode === 'tracked'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
              onClick={() => setViewMode('tracked')}
            >
              Tracked Changes ({editor.changeCount} change{editor.changeCount !== 1 ? 's' : ''})
            </button>
          </div>

          <div
            ref={trackedRef}
            className="min-h-[200px] p-3 border rounded-md bg-white font-mono text-sm"
            style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap', color: '#000' }} // Ensure text color is black
          >
            {viewMode === 'clean' ? (
              editedText || 'Result will appear here...'
            ) : (
              <TrackedChangesView
                originalText={inputText}
                editedText={editedText}
                onAcceptChange={handleAcceptChange}
                onRejectChange={handleRejectChange}
              />
            )}
          </div>
        </div>
      )}

      {!editedText && !isLoading && (
        <div className="p-3 bg-gray-50 border rounded text-gray-500 text-sm">
          Result will appear here...
        </div>
      )}
    </div>
  );
}