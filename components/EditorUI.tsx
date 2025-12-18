'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditLevel } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';
import { TrackedChangesView } from '@/components/TrackedChangesView';

// Chunking helper (matches backend limits)
const MAX_CHUNK_WORDS = 800;
const MAX_SINGLE_REQUEST_WORDS = 2000;

function splitIntoChunks(text: string, maxWords = MAX_CHUNK_WORDS): string[] {
  const words = text.trim().split(/\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentCount = 0;

  for (const word of words) {
    currentChunk.push(word);
    currentCount++;
    
    if (currentCount >= maxWords) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
      currentCount = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

export function EditorUI() {
  const editor = useEditor();
  const docManager = useDocument();
  const trackedRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chunkProcessingRef = useRef(false); // Prevent duplicate processing

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
    applyEdit: originalApplyEdit,
  } = editor;

  const [documentName, setDocumentName] = useState('');
  const [showDocuments, setShowDocuments] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingChunks, setProcessingChunks] = useState(false);
  const [chunkProgress, setChunkProgress] = useState({ current: 0, total: 0 });
  const [largeDocumentMode, setLargeDocumentMode] = useState(false);
  const [chunkedResults, setChunkedResults] = useState<string[]>([]);

  // Auto-show document panel after first edit
  useEffect(() => {
    if (editedText && !isLoading && !largeDocumentMode) {
      setShowDocuments(true);
    }
  }, [editedText, isLoading, largeDocumentMode]);

  useEffect(() => {
    if (!documentName.trim() && inputText.trim()) {
      const name = inputText.substring(0, 50).replace(/\s+/g, ' ').trim() + (inputText.length > 50 ? '...' : '');
      setDocumentName(name);
    }
  }, [inputText]);

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
      alert('No valid content to save. Please run "Edit" first.');
      return;
    }
    const id = await saveDocument(final, original, documentName);
    if (id) {
      editor.setDocumentId(id);
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
    editor.loadDocument(doc.id, {
      originalText: doc.original_text,
      editedText: doc.edited_text,
      level: doc.level,
      model: doc.model,
      customInstruction: doc.custom_instruction,
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File too large. Maximum size is 10MB.');
      return;
    }

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
        alert('SupportedContent type. Please upload .docx or .doc files only.');
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
        
        // Auto-detect large document mode
        const words = text.trim().split(/\s+/).length;
        setLargeDocumentMode(words > MAX_SINGLE_REQUEST_WORDS);
      } else {
        alert('Could not extract readable text from the document.');
      }
    } catch (err) {
      console.error('File parsing error:', err);
      alert('Failed to read document. Please ensure it\'s a valid Microsoft Word file.');
    } finally {
      setSelectedFile(null);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // NEW: Chunked processing function
  const processLargeDocument = async () => {
    if (chunkProcessingRef.current) return;
    chunkProcessingRef.current = true;
    
    setProcessingChunks(true);
    setChunkedResults([]);
    setChunkProgress({ current: 0, total: 0 });
    
    try {
      const chunks = splitIntoChunks(inputText);
      setChunkProgress({ current: 0, total: chunks.length });
      
      const results: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        setChunkProgress(prev => ({ ...prev, current: i + 1 }));
        
       const response = await fetch('/api/edit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: chunks[i],
    instruction: editLevel === 'custom' ? customInstruction : editLevel,
    // ❗ You must define/track selected model elsewhere
    // For now, omit or use a default
    model: 'mistralai/devstral-2512:free', // or get from a state like `selectedModel`
    editLevel,
    useEditorialBoard: editor.isEditorialBoard, // ✅ corrected name
    numVariations: 1,
    chunkIndex: i,
    totalChunks: chunks.length
  })
});

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Chunk ${i+1} failed`);
        }

        const data = await response.json();
        results.push(data.editedText);
      }
      
      // Combine results
      const fullResult = results.join('\n\n');
      setChunkedResults(results);
      
      // Only set final result after all chunks processed
      editor.setEditedText(fullResult);
    
      // Show success message
      alert(`✅ Successfully processed ${chunks.length} chunks!`);
      
    } catch (err) {
      console.error('Chunk processing error:', err);
      alert(`❌ Processing failed: ${(err as Error).message}`);
    } finally {
      setProcessingChunks(false);
      chunkProcessingRef.current = false;
    }
  };

  // Enhanced edit handler with chunking support
  const applyEdit = async () => {
    if (chunkProcessingRef.current) return;
    
    const words = inputText.trim().split(/\s+/).length;
    
    // Handle large documents
    if (words > MAX_SINGLE_REQUEST_WORDS) {
      if (confirm(`Your document has ${words} words. Processing will happen in ${Math.ceil(words / MAX_CHUNK_WORDS)} chunks. This may take several minutes. Continue?`)) {
        await processLargeDocument();
      }
      return;
    }
    
    // Handle normal documents
    try {
      await originalApplyEdit();
      
      // Auto-show documents panel after successful edit
      if (!showDocuments) setShowDocuments(true);
      
    } catch (err) {
      if (err instanceof Error && err.message.includes('413')) {
        // Backend requested chunking
        setLargeDocumentMode(true);
        alert('Document too large for single request. Switching to chunked processing mode.');
      } else {
        console.error('Edit failed:', err);
        alert(`Edit failed: ${(err as Error).message}`);
      }
    }
  };

  // Disable tracked changes for large documents
  const showTrackedChanges = !largeDocumentMode && viewMode === 'tracked';

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
          
          {/* Chunk processing status */}
          {processingChunks && (
            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              Processing chunk {chunkProgress.current} of {chunkProgress.total}...
              <div className="mt-1 h-2 bg-yellow-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-300" 
                  style={{ width: `${(chunkProgress.current / chunkProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <textarea
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setLargeDocumentMode(e.target.value.trim().split(/\s+/).length > MAX_SINGLE_REQUEST_WORDS);
          }}
          placeholder="Paste your text here or upload a Word document above..."
          rows={8}
          className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading || processingChunks}
        />
        
        {largeDocumentMode && (
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
            📌 Large document detected ({wordCount} words). Will be processed in chunks of {MAX_CHUNK_WORDS} words each. Tracked changes won't be available.
          </div>
        )}
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
              disabled={processingChunks}
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
            disabled={processingChunks}
          />
        )}
      </div>

      {/* === 3. ✨ Edit Button === */}
      <div>
        <button
          id="edit-btn"
          onClick={applyEdit}
          disabled={isLoading || processingChunks || !inputText.trim()}
          className={`px-4 py-2 rounded-md font-medium ${
            isLoading || processingChunks
              ? 'bg-gray-400 cursor-not-allowed'
              : inputText.trim()
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {processingChunks ? '🔄 Processing Chunks...' : isLoading ? '⏳ Processing...' : '✨ Edit'}
        </button>
        {(error || docError) && (
          <p className="mt-2 text-red-600 text-sm">{error || docError}</p>
        )}
      </div>

      {/* === 4. Edited Result === */}
      {(editedText || isLoading || processingChunks) && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold text-black">Edited Result</h2>
            <div className="flex gap-2">
              <button
                id="copy-btn"
                onClick={handleCopy}
                disabled={processingChunks}
                className={`px-3 py-1 text-sm rounded ${
                  processingChunks
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                📋 Copy
              </button>
              <button
                id="download-btn"
                onClick={handleDownload}
                disabled={processingChunks}
                className={`px-3 py-1 text-sm rounded ${
                  processingChunks
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
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
              disabled={largeDocumentMode} // Disable toggle for large docs
            >
              Clean View
            </button>
            <button
              className={`px-3 py-1 text-sm ml-1 ${
                showTrackedChanges
                  ? 'bg-blue-600 text-white'
                  : largeDocumentMode
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
              onClick={() => !largeDocumentMode && setViewMode('tracked')}
              title={largeDocumentMode ? "Tracked changes disabled for large documents" : ""}
            >
              Tracked Changes {largeDocumentMode ? '(disabled)' : `(${changeCount} change${changeCount !== 1 ? 's' : ''})`}
            </button>
          </div>

          <div
            ref={trackedRef}
            className="min-h-[200px] p-3 border rounded-md bg-white font-mono text-sm text-black"
            style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap' }}
          >
            {processingChunks ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <svg className="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p>Processing document in chunks...</p>
                <p className="text-sm mt-1">Chunk {chunkProgress.current} of {chunkProgress.total}</p>
              </div>
            ) : viewMode === 'clean' ? (
              editedText || 'Result will appear here...'
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
        </div>
      )}

      {!editedText && !isLoading && !processingChunks && (
        <div className="p-3 bg-gray-50 border rounded text-gray-500 text-sm">
          Result will appear here after you click "Edit".
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
              disabled={processingChunks}
            />
            <div className="flex gap-2">
              <button
                id="save-document-btn"
                onClick={handleSaveDocument}
                disabled={isLoading || isDocLoading || processingChunks || !editedText}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                💾 Save Document
              </button>
              <button
                id="save-progress-btn"
                onClick={handleSaveProgress}
                disabled={!documentId || isLoading || isDocLoading || processingChunks || !editedText}
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
                        onClick={() => !processingChunks && handleDocumentClick(doc)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium text-sm text-black">{doc.name}</div>
                          <div className="text-xs text-gray-500">{formattedDate}</div>
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              !processingChunks && handleDocumentClick(doc);
                            }}
                            className={`text-xs ${processingChunks ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600'}`}
                            disabled={processingChunks}
                          >
                            ↩️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              !processingChunks && confirm('Delete this document?') && deleteDocument(doc.id);
                            }}
                            className={`text-xs ${processingChunks ? 'text-gray-400 cursor-not-allowed' : 'text-red-600'}`}
                            disabled={processingChunks}
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