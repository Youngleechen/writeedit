// /components/EditorUI.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditLevel } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';
import { TrackedChangesView } from '@/components/TrackedChangesView';
import { CheckCircleIcon, ExclamationCircleIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

// Toast component for notifications
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center p-3 rounded-lg shadow-lg animate-fade-in-out ${
      type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {type === 'success' ? (
        <CheckCircleIcon className="h-5 w-5 mr-2 text-green-500" />
      ) : (
        <ExclamationCircleIcon className="h-5 w-5 mr-2 text-red-500" />
      )}
      <span className="mr-2">{message}</span>
      <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
        ✕
      </button>
    </div>
  );
};

export function EditorUI() {
  const editor = useEditor();
  const docManager = useDocument();
  const trackedRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

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
    isLoading,
    error,
    viewMode,
    wordCount,
    documentId,
    changeCount,
    setInputText,
    setEditLevel,
    setCustomInstruction,
    setViewMode,
    applyEdit,
  } = editor;

  const [documentName, setDocumentName] = useState('');
  const [showDocuments, setShowDocuments] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' }>>([]);
  const [acceptedFiles] = useState(['.txt', '.docx', '.pdf']);

  // Add toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  // Remove toast
  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    if (!documentName.trim() && inputText.trim()) {
      const name = inputText.substring(0, 50).replace(/\s+/g, ' ').trim() + (inputText.length > 50 ? '...' : '');
      setDocumentName(name);
    }
  }, [inputText]);

  const extractCleanTextFromTrackedDOM = useCallback((): string => {
    if (!trackedRef.current) return editedText;

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

    return clone.textContent?.trim() || editedText;
  }, [editedText]);

  const handleCopy = async () => {
    const textToCopy = extractCleanTextFromTrackedDOM();
    if (!textToCopy.trim()) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      showToast('Copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy text', 'error');
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
    showToast('Document downloaded!', 'success');
  };

  const handleAcceptChange = useCallback(() => {}, []);
  const handleRejectChange = useCallback(() => {}, []);

  const handleSaveDocument = async () => {
    const original = inputText;
    const final = extractCleanTextFromTrackedDOM();
    if (!original.trim() || !final.trim()) {
      showToast('No valid content to save. Please run "Edit" first.', 'error');
      return;
    }
    const id = await saveDocument(final, original, documentName);
    if (id) {
      editor.setDocumentId(id);
      setDocumentName('');
      showToast('Document saved successfully!', 'success');
    }
  };

  const handleSaveProgress = async () => {
    const original = inputText;
    const final = extractCleanTextFromTrackedDOM();
    if (!original.trim() || !final.trim() || !documentId) {
      showToast('No valid content or active document to update.', 'error');
      return;
    }
    await saveProgress(documentId, final, original);
    showToast('Progress saved successfully!', 'success');
  };

  const handleDocumentClick = (doc: SavedDocument) => {
    editor.loadDocument(doc.id, {
      originalText: doc.original_text,
      editedText: doc.edited_text,
      level: doc.level,
      model: doc.model,
      customInstruction: doc.custom_instruction,
    });
    showToast(`Loaded document: ${doc.name}`, 'success');
  };

  // PDF parsing function
  const parsePDF = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const pdfjs = await import('pdfjs-dist');
      const workerSrc = `//cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let extractedText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        extractedText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      
      return extractedText;
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw new Error('Failed to parse PDF content');
    }
  };

  // File processing logic
  const processFile = async (file: File) => {
    if (!acceptedFiles.includes(file.name.slice(file.name.lastIndexOf('.')).toLowerCase())) {
      showToast(`Unsupported file type. Please upload ${acceptedFiles.join(', ')}.`, 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      showToast('File size exceeds 10MB limit', 'error');
      return;
    }

    setIsParsingFile(true);
    let text = '';

    try {
      if (file.name.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        text = await parsePDF(arrayBuffer);
      } else if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else {
        text = await file.text();
      }

      if (text.trim()) {
        setInputText(text);
        setDocumentName(file.name.replace(/\.[^/.]+$/, ''));
        showToast(`${file.name} uploaded successfully!`, 'success');
      } else {
        showToast('Could not extract readable text from the file.', 'error');
      }
    } catch (err) {
      console.error('File processing error:', err);
      showToast('Failed to process file. Ensure it\'s a valid document.', 'error');
    } finally {
      setIsParsingFile(false);
    }
  };

  // Handle file input change
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    e.target.value = '';
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) await processFile(file);
  };

  return (
    <div className="editor-ui max-w-4xl mx-auto p-4 space-y-6 bg-white text-gray-800 min-h-screen relative">
      {/* Toast notifications */}
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          message={toast.message} 
          type={toast.type} 
          onClose={() => removeToast(toast.id)} 
        />
      ))}

      <div 
        ref={dropZoneRef}
        className={`relative transition-all duration-200 ${
          dragOver ? 'border-2 border-blue-500 border-dashed bg-blue-50 rounded-xl' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-50 bg-opacity-80 flex flex-col items-center justify-center rounded-xl z-10">
            <ArrowDownTrayIcon className="h-12 w-12 text-blue-600 mb-2" />
            <p className="text-lg font-medium text-blue-800">Drop your file here</p>
            <p className="text-sm text-blue-600 mt-1">Supports .txt, .docx, and .pdf files (max 10MB)</p>
          </div>
        )}

        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Original Text</h2>
            <span className="text-sm text-gray-500">{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
          </div>

          {/* File upload section */}
          <div className="mb-4 p-4 border-2 border-dashed rounded-lg border-gray-300 hover:border-gray-400 transition-colors cursor-pointer bg-gray-50">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <DocumentTextIcon className="h-8 w-8 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-700 mb-1">Drag & drop your document here</span>
              <span className="text-xs text-gray-500 mb-2">or</span>
              <span className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors">
                Browse files
              </span>
              <input
                type="file"
                accept={acceptedFiles.join(',')}
                onChange={handleFileUpload}
                className="hidden"
                disabled={isParsingFile}
              />
            </label>
            
            {isParsingFile && (
              <div className="mt-2 flex items-center justify-center text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Processing file...
              </div>
            )}
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste your text here or drag & drop a document above..."
            rows={8}
            className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-wait"
            disabled={isLoading || isParsingFile}
          />
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-2">Editing Level</h3>
        <div className="flex flex-wrap gap-2">
          {(['proofread', 'rewrite', 'formal', 'custom'] as EditLevel[]).map((level) => (
            <button
              key={level}
              aria-pressed={editLevel === level}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-all ${
                editLevel === level
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            className="w-full mt-2 p-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}
      </div>

      <div className="border-t border-gray-200 pt-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Document Management</h2>
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            aria-expanded={showDocuments}
            className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center"
          >
            {showDocuments ? (
              <>
                <span>Hide documents</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                <span>Show documents</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        </div>

        {showDocuments && (
          <div id="documents-panel" className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="mb-3">
              <label htmlFor="document-name" className="block text-sm font-medium text-gray-700 mb-1">
                Document name
              </label>
              <input
                id="document-name"
                type="text"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder="Document name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                id="save-document-btn"
                onClick={handleSaveDocument}
                disabled={isLoading || isDocLoading || isParsingFile}
                className="px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <span>💾 Save Document</span>
                {isDocLoading && <span className="ml-2 animate-pulse">...</span>}
              </button>
              <button
                id="save-progress-btn"
                onClick={handleSaveProgress}
                disabled={!documentId || isLoading || isDocLoading || isParsingFile}
                className="px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <span>🔄 Save Progress</span>
                {isDocLoading && <span className="ml-2 animate-pulse">...</span>}
              </button>
            </div>

            <div>
              <h3 className="font-medium mb-2 text-gray-800">Saved Documents</h3>
              <div id="documents-list" className="max-h-64 overflow-y-auto pr-2 space-y-2">
                {documents.length === 0 ? (
                  <div className="text-gray-500 text-sm py-3 text-center">
                    No saved documents yet
                  </div>
                ) : (
                  documents.map((doc) => {
                    const date = new Date(doc.created_at);
                    const formattedDate = date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    
                    return (
                      <div
                        key={doc.id}
                        role="button"
                        aria-label={`Document: ${doc.name}`}
                        className={`p-3 border rounded-xl cursor-pointer transition-all ${
                          doc.id === documentId
                            ? 'border-green-500 bg-green-50 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-100 hover:shadow'
                        }`}
                        onClick={() => handleDocumentClick(doc)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium text-sm text-gray-900 truncate max-w-[70%]">
                            {doc.name || 'Untitled Document'}
                          </div>
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            {formattedDate}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            doc.level === 'proofread' ? 'bg-blue-100 text-blue-800' :
                            doc.level === 'rewrite' ? 'bg-purple-100 text-purple-800' :
                            doc.level === 'formal' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {doc.level.charAt(0).toUpperCase() + doc.level.slice(1)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDocumentClick(doc);
                              }}
                              aria-label="Reload document"
                              className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                              title="Reload document"
                            >
                              ↩️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
                                  deleteDocument(doc.id);
                                  showToast('Document deleted', 'success');
                                }
                              }}
                              aria-label="Delete document"
                              className="text-xs text-red-600 hover:text-red-800 transition-colors"
                              title="Delete document"
                            >
                              ×
                            </button>
                          </div>
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

      <div className="pt-2">
        <button
          id="edit-btn"
          onClick={applyEdit}
          disabled={isLoading || isParsingFile}
          className={`w-full px-6 py-3 text-lg font-medium rounded-xl transition-all ${
            isLoading || isParsingFile
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
              Processing...
            </span>
          ) : '✨ Edit Document'}
        </button>
        
        {(error || docError) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error || docError}</span>
          </div>
        )}
      </div>

      {(editedText || isLoading) && (
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
            <h2 className="text-lg font-semibold">Edited Result</h2>
            <div className="flex flex-wrap gap-2">
              <button
                id="copy-btn"
                onClick={handleCopy}
                disabled={isLoading || isParsingFile}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center"
              >
                <span>📋 Copy</span>
                {isLoading && <span className="ml-1 animate-pulse">...</span>}
              </button>
              <button
                id="download-docx-btn"
                onClick={handleDownload}
                disabled={isLoading || isParsingFile}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 flex items-center"
              >
                <span>💾 Download</span>
                {isLoading && <span className="ml-1 animate-pulse">...</span>}
              </button>
            </div>
          </div>

          <div className="flex mb-3 border border-gray-200 rounded-lg overflow-hidden">
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'clean'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setViewMode('clean')}
              aria-pressed={viewMode === 'clean'}
            >
              Clean View
            </button>
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                viewMode === 'tracked'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setViewMode('tracked')}
              aria-pressed={viewMode === 'tracked'}
            >
              Tracked Changes {changeCount > 0 && `(${changeCount})`}
            </button>
          </div>

          <div
            ref={trackedRef}
            className="min-h-[250px] p-4 border rounded-xl bg-gray-50 font-mono text-sm"
            style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}
            aria-live="polite"
          >
            {viewMode === 'clean' ? (
              isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p>Enhancing your document...</p>
                </div>
              ) : editedText || 'Result will appear here...'
            ) : (
              isLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  <p>Analyzing changes...</p>
                </div>
              ) : (
                <TrackedChangesView
                  key={documentId || 'new'}
                  originalText={inputText}
                  editedText={editedText}
                  onAcceptChange={handleAcceptChange}
                  onRejectChange={handleRejectChange}
                />
              )
            )}
          </div>
        </div>
      )}

      {!editedText && !isLoading && (
        <div className="p-4 bg-gray-50 border-2 border-dashed rounded-xl text-gray-500 text-sm text-center">
          <p className="mb-2">Your edited document will appear here after clicking "Edit Document"</p>
          <p className="text-xs text-gray-400">AI-powered editing with tracked changes</p>
        </div>
      )}
    </div>
  );
}