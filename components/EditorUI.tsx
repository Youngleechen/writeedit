// /components/EditorUI.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditLevel } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';
import { TrackedChangesView } from '@/components/TrackedChangesView';

export function EditorUI() {
  const editor = useEditor();
  const docManager = useDocument();
  const trackedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ✅ Destructure hooks ONCE — no duplicates
  const {
    documents,
    isLoading: isDocLoading,
    error: docError,
    saveDocument,
    saveProgress,
    deleteDocument,
  } = docManager;

  const {
    inputText,
    editedText,
    editLevel,
    customInstruction,
    isLoading: isEditorLoading,
    error: editorError,
    viewMode,
    wordCount,
    documentId,
    changeCount,
    setInputText,
    setEditLevel,
    setCustomInstruction,
    setViewMode,
    setEditedText,
    setDocumentId,
  } = editor;

  // ✅ Local state for async job flow
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const [documentName, setDocumentName] = useState('');
  const [showDocuments, setShowDocuments] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Auto-show document panel after first edit
  useEffect(() => {
    if (editedText && !isEditorLoading && !isProcessing) {
      setShowDocuments(true);
    }
  }, [editedText, isEditorLoading, isProcessing]);

  // Auto-generate document name
  useEffect(() => {
    if (!documentName.trim() && inputText.trim()) {
      const name = inputText.substring(0, 50).replace(/\s+/g, ' ').trim() + (inputText.length > 50 ? '...' : '');
      setDocumentName(name);
    }
  }, [inputText, documentName]);

  const extractCleanTextFromTrackedDOM = useCallback((): string => {
    if (!trackedRef.current) return editedText || '';

    const clone = trackedRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.change-action, del').forEach(el => el.remove());
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

    return clone.textContent?.trim() || editedText || '';
  }, [editedText]);

  const handleCopy = async () => {
    const textToCopy = extractCleanTextFromTrackedDOM();
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      alert('✅ Copied!');
    } catch {
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
    a.download = `edited-document-${new Date().toISOString().slice(0, 10)}.txt`;
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
    const id = await saveDocument(final, original, documentName);
    if (id) {
      setDocumentId(id);
      setDocumentName('');
    }
  };

  const handleSaveProgress = async () => {
    const original = inputText;
    const final = extractCleanTextFromTrackedDOM();
    if (!original.trim() || !final.trim() || !documentId) {
      alert('No valid content or active document to update.');
      return;
    }
    await saveProgress(documentId, final, original);
  };

  const handleDocumentClick = (doc: SavedDocument) => {
    editor.loadDocument?.(doc.id, {
      originalText: doc.original_text,
      editedText: doc.edited_text,
      level: doc.level,
      model: doc.model,
      customInstruction: doc.custom_instruction,
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (fileInputRef.current) fileInputRef.current.value = '';
    setSelectedFile(file);

    try {
      let text = '';
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (fileName.endsWith('.doc')) {
        alert('⚠️ Legacy .doc files have limited support. For best results, convert to .docx.');
        const reader = new FileReader();
        reader.readAsText(file);
        await new Promise((resolve) => {
          reader.onload = resolve;
          reader.onerror = resolve;
        });
        text = reader.result as string;
      } else {
        alert('Unsupported content type. Please upload .docx or .doc files only.');
        setSelectedFile(null);
        return;
      }

      if (text.trim()) {
        setInputText(text);
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^\w\s-]/g, '')
          .trim()
          .substring(0, 40) || 'New Document';
        setDocumentName(cleanName);
      } else {
        alert('Could not extract readable text from the document.');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Failed to read document. Please ensure it’s a valid Microsoft Word file.');
    } finally {
      setSelectedFile(null);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // ✅ Async Edit with Job Polling
  const applyEditAsync = useCallback(async () => {
    if (!inputText.trim()) {
      setProcessingError('Input required');
      return;
    }

    setIsProcessing(true);
    setProcessingError(null);
    setJobId(null);

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputText,
          instruction: editLevel === 'custom' ? customInstruction : '',
          model: 'x-ai/grok-4.1-fast:free',
          editLevel,
          useEditorialBoard: false,
          numVariations: 1,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Unknown error');
      }

      const { jobId: newJobId } = await response.json();
      setJobId(newJobId);

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/edit/status?jobId=${newJobId}`);
          if (!statusRes.ok) {
            throw new Error('Failed to fetch job status');
          }
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            clearInterval(interval);
            setPollInterval(null);
            setIsProcessing(false);
            setEditedText(statusData.result.editedText);
            setViewMode('tracked');
          } else if (statusData.status === 'failed') {
            clearInterval(interval);
            setPollInterval(null);
            setIsProcessing(false);
            setProcessingError(statusData.error || 'Processing failed');
          }
        } catch (err) {
          clearInterval(interval);
          setPollInterval(null);
          setIsProcessing(false);
          setProcessingError('Error checking processing status');
        }
      }, 2000);

      setPollInterval(interval);
    } catch (err: unknown) {
      setIsProcessing(false);
      setProcessingError(err instanceof Error ? err.message : 'An error occurred');
    }
  }, [inputText, editLevel, customInstruction, setEditedText, setViewMode]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  // Combine loading and error states
  const isLoading = isEditorLoading || isProcessing || isDocLoading;
  const combinedError = processingError || editorError || docError;

  return (
    <div className="editor-ui max-w-4xl mx-auto p-4 space-y-6 bg-white text-black min-h-screen">
      
      {/* === 1. Original Text === */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-black">Original Text</h2>
          <span className="text-sm text-gray-600">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        </div>

        <div className="mb-4 p-4 border-2 border-dashed rounded-xl border-blue-200 bg-blue-50/40 hover:border-blue-300 transition-colors">
          <div className="flex flex-col items-center justify-center py-5 px-4 text-center">
            <div className="mb-3 p-3 bg-blue-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Upload a Microsoft Word document</p>
            <p className="text-xs text-gray-500 mb-3">.docx or .doc • Max 10MB</p>
            <button
              type="button"
              onClick={triggerFileUpload}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Browse Word Files
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".docx,.doc"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className="hidden"
            />
          </div>

          {selectedFile && (
            <div className="mt-3 flex items-center justify-center text-sm text-blue-600">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing {selectedFile.name}...
            </div>
          )}
        </div>

        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your text here or upload a Word document above..."
          rows={8}
          className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        />
      </div>

      {/* === 2. Editing Level === */}
      <div>
        <h3 className="font-medium mb-2 text-black">Editing Level</h3>
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
            className="w-full mt-2 p-2 border border-gray-300 rounded text-sm text-black bg-white"
          />
        )}
      </div>

      {/* === 3. Edit Button === */}
      <div>
        <button
          id="edit-btn"
          onClick={applyEditAsync}
          disabled={isLoading || !inputText.trim()}
          className={`px-4 py-2 rounded-md font-medium ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : inputText.trim()
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? '⏳ Processing...' : '✨ Edit'}
        </button>
        {combinedError && (
          <p className="mt-2 text-red-600 text-sm">{combinedError}</p>
        )}
      </div>

      {/* === 4. Edited Result === */}
      {(editedText || isLoading || jobId) && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-black">Edited Result</h2>
            <div className="flex gap-2">
              <button
                id="copy-btn"
                onClick={handleCopy}
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                disabled={!editedText}
              >
                📋 Copy
              </button>
              <button
                id="download-btn"
                onClick={handleDownload}
                className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                disabled={!editedText}
              >
                💾 Download
              </button>
            </div>
          </div>

          {isProcessing && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 mb-4">
              <p>🚀 Your document is being processed. This may take a few moments.</p>
              <p className="text-sm mt-1">You can close this tab and come back later.</p>
            </div>
          )}

          {editedText && (
            <>
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
                  Tracked Changes ({changeCount} change{changeCount !== 1 ? 's' : ''})
                </button>
              </div>

              <div
                ref={trackedRef}
                className="min-h-[200px] p-3 border rounded-md bg-white font-mono text-sm text-black"
                style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap' }}
              >
                {viewMode === 'clean' ? (
                  editedText
                ) : (
                  <TrackedChangesView
                    key={documentId || 'new'}
                    originalText={inputText}
                    editedText={editedText}
                    onAcceptChange={handleAcceptChange}
                    onRejectChange={handleRejectChange}
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}

      {!editedText && !isLoading && !jobId && (
        <div className="p-3 bg-gray-50 border rounded text-gray-500 text-sm">
          Result will appear here after you click “Edit”.
        </div>
      )}

      {/* === 5. Document Management === */}
      <div className="border-t border-gray-300 pt-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-black">Document Management</h2>
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
              className="w-full p-2 border border-gray-300 rounded text-sm mb-2 text-black bg-white"
            />
            <div className="flex gap-2">
              <button
                id="save-document-btn"
                onClick={handleSaveDocument}
                disabled={isLoading || !editedText}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                💾 Save Document
              </button>
              <button
                id="save-progress-btn"
                onClick={handleSaveProgress}
                disabled={!documentId || isLoading || !editedText}
                className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                🔄 Save Progress
              </button>
            </div>

            <div className="mt-4">
              <h3 className="font-medium mb-2 text-black">Saved Documents</h3>
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
                        onClick={() => handleDocumentClick(doc)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium text-sm text-black">{doc.name}</div>
                          <div className="text-xs text-gray-500">{formattedDate}</div>
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDocumentClick(doc);
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
    </div>
  );
}