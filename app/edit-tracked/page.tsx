'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';

// Web Worker for diff computation (prevents UI blocking)
const DIFF_WORKER_CODE = `
self.importScripts('https://unpkg.com/diff@5.1.0/dist/diff.min.js');

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

self.onmessage = function(e) {
  const { original, edited, requestId } = e.data;
  
  try {
    const diffs = Diff.diffWords(original, edited);
    let html = '';
    let groupContent = '';
    let inGroup = false;

    const flushGroup = (isChangeGroup) => {
      if (groupContent) {
        if (isChangeGroup) {
          html += \`<span class="change-group">\${groupContent}</span>\`;
        } else {
          html += groupContent;
        }
        groupContent = '';
      }
      inGroup = false;
    };

    for (let i = 0; i < diffs.length; i++) {
      const part = diffs[i];
      if (!part.added && !part.removed) {
        flushGroup(false);
        html += escapeHtml(part.value);
        continue;
      }

      if (!inGroup) {
        groupContent = '';
        inGroup = true;
      }

      if (part.removed) {
        groupContent += \`<del>\${escapeHtml(part.value)}</del>\`;
      } else if (part.added) {
        groupContent += \`<ins>\${escapeHtml(part.value)}</ins>\`;
      }

      const next = diffs[i + 1];
      if (!next || (!next.added && !next.removed)) {
        flushGroup(true);
      }
    }
    flushGroup(inGroup);
    
    self.postMessage({
      requestId,
      html: \`<div style="white-space:pre-wrap">\${html}</div>\`
    });
  } catch (err) {
    console.error('Diff generation failed:', err);
    self.postMessage({
      requestId,
      html: escapeHtml(edited)
    });
  }
};
`;

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
    editedText: externalEditedText,
    documentId,
    setViewMode,
    setInputText,
    setDocumentId,
    setEditedText,
  } = editor;

  // Performance-critical state
  const [currentDoc, setCurrentDoc] = useState<SavedDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [trackedHtmlState, setTrackedHtmlState] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const trackedRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const isApplyingChangeRef = useRef(false);
  const originalTrackedHtmlRef = useRef<string>('');
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  
  // Virtualization parameters
  const VIRTUALIZATION_THRESHOLD = 5000; // characters
  const CHUNK_SIZE = 2000; // characters per chunk
  const SCROLL_BUFFER = 600; // pixels

  // === Escape HTML safely ===
  const escapeHtml = useCallback((text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }, []);

  // === Initialize Web Worker ===
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const blob = new Blob([DIFF_WORKER_CODE], { type: 'application/javascript' });
      workerRef.current = new Worker(URL.createObjectURL(blob));
      
      workerRef.current.onmessage = (e) => {
        const { requestId, html } = e.data;
        if (requestId === requestIdRef.current) {
          setTrackedHtmlState(html);
          setIsLoadingContent(false);
        }
      };
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // === Generate tracked HTML using worker ===
  const generateTrackedHtml = useCallback(async (original: string, edited: string) => {
    if (original.length + edited.length > VIRTUALIZATION_THRESHOLD) {
      setIsLoadingContent(true);
      requestIdRef.current++;
      workerRef.current?.postMessage({ 
        original, 
        edited, 
        requestId: requestIdRef.current 
      });
    } else {
      // Small documents: compute directly
      setTrackedHtmlState(generateDiffHtmlDirect(original, edited));
    }
  }, []);

  // === Direct diff generation (small documents only) ===
  const generateDiffHtmlDirect = useCallback((original: string, edited: string): string => {
    try {
      const DiffLib = (window as any).Diff;
      if (!DiffLib) return escapeHtml(edited);

      const diffs = DiffLib.diffWords(original, edited);
      let html = '';
      let groupContent = '';
      let inGroup = false;

      const flushGroup = (isChangeGroup: boolean) => {
        if (groupContent) {
          if (isChangeGroup) {
            html += `<span class="change-group">${groupContent}</span>`;
          } else {
            html += groupContent;
          }
          groupContent = '';
        }
        inGroup = false;
      };

      for (let i = 0; i < diffs.length; i++) {
        const part = diffs[i];
        if (!part.added && !part.removed) {
          flushGroup(false);
          html += escapeHtml(part.value);
          continue;
        }

        if (!inGroup) {
          groupContent = '';
          inGroup = true;
        }

        if (part.removed) {
          groupContent += `<del>${escapeHtml(part.value)}</del>`;
        } else if (part.added) {
          groupContent += `<ins>${escapeHtml(part.value)}</ins>`;
        }

        const next = diffs[i + 1];
        if (!next || (!next.added && !next.removed)) {
          flushGroup(true);
        }
      }
      flushGroup(inGroup);
      return `<div style="white-space:pre-wrap">${html}</div>`;
    } catch (err) {
      console.error('Diff generation failed:', err);
      return escapeHtml(edited);
    }
  }, [escapeHtml]);

  // === Virtualized content rendering ===
  const renderVirtualizedContent = useCallback((html: string) => {
    if (!trackedRef.current) return;
    
    const contentDiv = trackedRef.current;
    contentDiv.innerHTML = '';
    
    const innerMatch = html.match(/<div[^>]*>([\s\S]*?)<\/div>/);
    const innerContent = innerMatch ? innerMatch[1] : html;
    const chunks = innerContent.split(/(?=<span class="change-group">|<del>|<ins>)/);
    const totalChunks = Math.ceil(chunks.length / CHUNK_SIZE);
    
    const container = document.createElement('div');
    container.className = 'virtualized-container';
    contentDiv.appendChild(container);
    
    const renderChunk = (index: number) => {
      const chunk = chunks.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE).join('');
      const chunkDiv = document.createElement('div');
      chunkDiv.className = `chunk-${index}`;
      chunkDiv.innerHTML = chunk;
      container.appendChild(chunkDiv);
    };
    
    // Initial render of visible chunks
    const visibleChunks = Math.ceil((window.innerHeight + SCROLL_BUFFER * 2) / 20);
    for (let i = 0; i < Math.min(totalChunks, visibleChunks); i++) {
      renderChunk(i);
    }
    
    // Scroll handler for dynamic loading
    const handleScroll = () => {
      const scrollTop = contentDiv.scrollTop;
      const visibleStart = Math.floor(scrollTop / 20 / CHUNK_SIZE);
      const visibleEnd = Math.ceil((scrollTop + window.innerHeight) / 20 / CHUNK_SIZE);
      
      // Clean up distant chunks
      Array.from(container.children).forEach(child => {
        const chunkIndex = parseInt((child as HTMLElement).className.split('-')[1], 10);
        if (chunkIndex < visibleStart - 1 || chunkIndex > visibleEnd + 1) {
          container.removeChild(child);
        }
      });
      
      // Render missing chunks
      for (let i = visibleStart; i <= visibleEnd; i++) {
        if (!container.querySelector(`.chunk-${i}`)) {
          renderChunk(i);
        }
      }
    };
    
    contentDiv.addEventListener('scroll', handleScroll);
    return () => contentDiv.removeEventListener('scroll', handleScroll);
  }, []);

  // === Extract clean text efficiently ===
  const updateCleanFromTracked = useCallback(() => {
    if (!trackedRef.current) return;
    
    const range = document.createRange();
    range.selectNodeContents(trackedRef.current);
    const fragments = range.cloneContents();
    
    // Process changes in batches
    const processBatch = (nodes: Node[], batchSize = 100) => {
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        batch.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.classList.contains('change-group') || el.tagName === 'DEL' || el.tagName === 'INS') {
              if (el.tagName === 'INS') {
                Array.from(el.childNodes).forEach(child => {
                  el.parentNode?.insertBefore(child, el);
                });
              }
              el.remove();
            }
          }
        });
      }
    };
    
    processBatch(Array.from(fragments.childNodes));
    const newText = fragments.textContent || '';
    setEditedText(newText);
    setUnsavedChanges(true);
  }, [setEditedText]);

  // === Attach accept/reject handlers (CORRECTED WITH useCallback) ===
  const attachAcceptRejectHandlers = useCallback(() => {
    if (!trackedRef.current) return;

    trackedRef.current.querySelectorAll('.change-action').forEach((el) => el.remove());
    trackedRef.current.querySelectorAll('.change-group').forEach((groupEl) => {
      if (groupEl.querySelector('.change-action')) return;
      const action = document.createElement('div');
      action.className = 'change-action';
      action.innerHTML = `
        <button class="accept-change" title="Accept">✅</button>
        <button class="reject-change" title="Reject">❌</button>
      `;
      groupEl.appendChild(action);
    });
  }, []);

  // === Apply accept or reject ===
  const applyChange = useCallback((group: HTMLElement, accept: boolean) => {
    if (isApplyingChangeRef.current) return;
    isApplyingChangeRef.current = true;

    const clone = group.cloneNode(true) as HTMLElement;

    if (accept) {
      clone.querySelectorAll('del').forEach((del) => del.remove());
      clone.querySelectorAll('ins').forEach((ins) => {
        while (ins.firstChild) {
          ins.parentNode?.insertBefore(ins.firstChild, ins);
        }
        ins.remove();
      });
    } else {
      clone.querySelectorAll('ins').forEach((ins) => ins.remove());
      clone.querySelectorAll('del').forEach((del) => {
        while (del.firstChild) {
          del.parentNode?.insertBefore(del.firstChild, del);
        }
        del.remove();
      });
    }

    requestAnimationFrame(() => {
      group.parentNode?.replaceChild(clone, group);
      updateCleanFromTracked();
      attachAcceptRejectHandlers();
      isApplyingChangeRef.current = false;
    });
  }, [updateCleanFromTracked, attachAcceptRejectHandlers]);

  // === Event delegation for change actions ===
  useEffect(() => {
    const handleActionClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('accept-change') || target.classList.contains('reject-change')) {
        e.stopPropagation();
        const group = target.closest('.change-group');
        if (group) {
          applyChange(group as HTMLElement, target.classList.contains('accept-change'));
        }
      }
    };

    document.addEventListener('click', handleActionClick);
    return () => document.removeEventListener('click', handleActionClick);
  }, [applyChange]);

  // === Handle deletion manually ===
  const handleDeletion = useCallback((isForward = false) => {
    if (isApplyingChangeRef.current || !trackedRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0).cloneRange();
    if (!range.toString().trim()) return;

    const group = document.createElement('span');
    group.className = 'change-group';
    const del = document.createElement('del');
    del.textContent = range.toString();
    group.appendChild(del);

    range.deleteContents();
    range.insertNode(group);

    const newRange = document.createRange();
    newRange.setStartAfter(group);
    newRange.setEndAfter(group);
    selection.removeAllRanges();
    selection.addRange(newRange);

    updateCleanFromTracked();
    attachAcceptRejectHandlers();
  }, [updateCleanFromTracked, attachAcceptRejectHandlers]);

  // === Insert tracked insertion ===
  const insertTrackedInsertion = useCallback((text: string) => {
    if (!text || isApplyingChangeRef.current || !trackedRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const ins = document.createElement('ins');
    ins.textContent = text;

    const group = document.createElement('span');
    group.className = 'change-group';
    group.appendChild(ins);

    range.deleteContents();
    range.insertNode(group);

    const newRange = document.createRange();
    newRange.setStartAfter(group);
    newRange.setEndAfter(group);
    selection.removeAllRanges();
    selection.addRange(newRange);

    updateCleanFromTracked();
    attachAcceptRejectHandlers();
  }, [updateCleanFromTracked, attachAcceptRejectHandlers]);

  // === Setup editing listeners ===
  useEffect(() => {
    const el = trackedRef.current;
    if (!el) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (isApplyingChangeRef.current) return;
      if (e.inputType === 'insertText' && e.data) {
        e.preventDefault();
        insertTrackedInsertion(e.data);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isApplyingChangeRef.current) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeletion(e.key === 'Delete');
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      insertTrackedInsertion(text);
    };

    el.addEventListener('beforeinput', handleBeforeInput);
    el.addEventListener('keydown', handleKeyDown);
    el.addEventListener('paste', handlePaste);

    return () => {
      el.removeEventListener('beforeinput', handleBeforeInput);
      el.removeEventListener('keydown', handleKeyDown);
      el.removeEventListener('paste', handlePaste);
    };
  }, [insertTrackedInsertion, handleDeletion]);

  // === Load document ===
  const loadDocument = useCallback(
    (doc: SavedDocument) => {
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
      setIsLoadingContent(true);

      if (doc.tracked_html) {
        setTrackedHtmlState(doc.tracked_html);
        setIsLoadingContent(false);
      } else {
        generateTrackedHtml(doc.original_text, doc.edited_text);
      }

      originalTrackedHtmlRef.current = doc.tracked_html || '';
      setUnsavedChanges(false);

      // Trigger DOM update and attach handlers
      setTimeout(() => {
        if (trackedRef.current) {
          trackedRef.current.innerHTML = doc.tracked_html || trackedHtmlState;
          attachAcceptRejectHandlers();
        }
      }, 0);
    },
    [editor, setDocumentId, setViewMode, generateTrackedHtml, attachAcceptRejectHandlers, trackedHtmlState]
  );

  // === Save to backend ===
  const saveProgress = useCallback(async () => {
    if (!documentId || !currentDoc || !trackedRef.current || !unsavedChanges) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const clean = externalEditedText;
      const trackedHtmlContent = trackedRef.current.innerHTML;

      // Small debounce
      await new Promise((resolve) => setTimeout(resolve, 100));

      await saveProgressToApi(documentId, clean, inputText, trackedHtmlContent);

      originalTrackedHtmlRef.current = trackedHtmlContent;
      setUnsavedChanges(false);
      alert('✅ Progress saved!');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  }, [documentId, currentDoc, externalEditedText, inputText, unsavedChanges, saveProgressToApi]);

  // === Detect unsaved changes ===
  useEffect(() => {
    if (!trackedRef.current || !currentDoc) return;

    if (mutationObserverRef.current) {
      mutationObserverRef.current.disconnect();
    }

    const observer = new MutationObserver(() => {
      if (trackedRef.current) {
        const isDirty = trackedRef.current.innerHTML !== originalTrackedHtmlRef.current;
        setUnsavedChanges(isDirty);
      }
    });

    observer.observe(trackedRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    mutationObserverRef.current = observer;
    return () => observer.disconnect();
  }, [currentDoc]);

  // === Render tracked content ===
  useEffect(() => {
    if (!trackedRef.current || !trackedHtmlState) return;

    if (isLoadingContent) {
      trackedRef.current.innerHTML = '<div class="loading-spinner">Loading document...</div>';
      return;
    }

    trackedRef.current.innerHTML = trackedHtmlState;

    if (trackedHtmlState.length > VIRTUALIZATION_THRESHOLD) {
      renderVirtualizedContent(trackedHtmlState);
    }

    attachAcceptRejectHandlers();
  }, [trackedHtmlState, isLoadingContent, renderVirtualizedContent, attachAcceptRejectHandlers]);

  return (
    <div className="flex h-screen bg-[#fafafa] text-[#333]">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-[#eee] p-4 overflow-y-auto">
        <h3 className="text-sm font-semibold mb-3">Saved Documents</h3>
        {isDocLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : documents.length === 0 ? (
          <p className="text-gray-500 text-sm" id="no-doc">
            No documents saved
          </p>
        ) : (
          <div id="doc-list" className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => loadDocument(doc)}
                className={`p-2.5 rounded cursor-pointer border border-[#eee] ${
                  doc.id === documentId
                    ? 'border-l-4 border-l-green-500 bg-[#f0f8f0]'
                    : 'hover:bg-[#f9f9f9]'
                }`}
              >
                <div className="font-bold text-sm truncate">{doc.name}</div>
                <div className="text-xs text-[#777] mt-1">
                  {new Date(doc.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
        {docError && <p className="text-red-600 text-xs mt-2">{docError}</p>}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-5 overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Tracked Changes Viewer (editor.js Compatible)
        </h2>

        {!currentDoc ? (
          <p id="placeholder" className="text-gray-500 italic">
            Select a document from the sidebar.
          </p>
        ) : (
          <div id="document-content">
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm text-[#555] font-medium">Tracked Changes</h3>
                <button
                  id="save-btn"
                  onClick={saveProgress}
                  disabled={!unsavedChanges || isSaving || isLoadingContent}
                  className={`px-3 py-1.5 text-sm rounded ${
                    unsavedChanges && !isLoadingContent
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  💾 {isLoadingContent ? 'Loading...' : isSaving ? 'Saving...' : 'Save Progress'}
                </button>
              </div>
              <div
                id="tracked"
                ref={trackedRef}
                contentEditable={!isApplyingChangeRef.current && !isLoadingContent}
                className={`content-box p-3 bg-white border border-[#ddd] rounded whitespace-pre-wrap text-sm max-h-[40vh] overflow-y-auto ${
                  isLoadingContent ? 'opacity-50 cursor-wait' : ''
                }`}
                style={{ whiteSpace: 'pre-wrap' }}
              />
              {saveError && <p className="text-red-600 text-sm mt-1">{saveError}</p>}
            </div>

            <div>
              <h3 className="text-sm text-[#555] font-medium mb-2">Clean Text</h3>
              <div
                id="clean"
                className="content-box p-3 bg-white border border-[#ddd] rounded whitespace-pre-wrap text-sm max-h-[40vh] overflow-y-auto"
              >
                {externalEditedText || 'No content'}
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100px;
          color: #666;
          font-style: italic;
        }

        .virtualized-container {
          position: relative;
          min-height: 100%;
        }

        del {
          background-color: #ffe6e6;
          text-decoration: line-through;
          margin: 0 2px;
          display: inline;
        }
        ins {
          background-color: #e6ffe6;
          text-decoration: none;
          margin: 0 2px;
          display: inline;
        }

        .change-group {
          position: relative;
          display: inline-block;
          white-space: nowrap;
        }

        .change-action {
          position: absolute;
          top: -22px;
          left: 0;
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 2px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          z-index: 100;
          gap: 4px;
          align-items: center;
          display: none;
          flex-direction: row;
        }

        .change-group:hover .change-action {
          display: flex !important;
        }

        .change-action button {
          padding: 2px 6px;
          font-size: 12px;
          border: 1px solid #ccc;
          border-radius: 3px;
          background: white;
          cursor: pointer;
        }
        .change-action button:hover {
          background: #f0f0f0;
        }
        .change-action button.accept-change {
          color: green;
        }
        .change-action button.reject-change {
          color: red;
        }

        .content-box {
          white-space: pre-wrap;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}