'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';

type NodePosition = {
  node: Node;
  offset: number;
} | null;

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
    documentId,
    setViewMode,
    setInputText,
    setDocumentId,
  } = editor;

  const [currentDoc, setCurrentDoc] = useState<SavedDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const trackedRef = useRef<HTMLDivElement>(null);
  const cleanTextRef = useRef<string>(editedText);
  const isApplyingChangeRef = useRef(false);
  const cursorPositionRef = useRef<number | null>(null);
  const lastHtmlRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // === Escape HTML safely ===
  const escapeHtml = useCallback((text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }, []);

  // === Generate tracked HTML using diff (word-level) ===
  const generateDiffHtml = useCallback((original: string, edited: string): string => {
    if (typeof window === 'undefined') {
      return escapeHtml(edited);
    }

    const DiffLib = (window as any).Diff;
    if (!DiffLib) {
      return escapeHtml(edited);
    }

    try {
      const diffs = DiffLib.diffWordsWithSpace(original, edited);
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

  // === Extract clean text from tracked HTML ===
  const getCleanTextFromTracked = useCallback((): string => {
    if (!trackedRef.current) return '';
    
    const clone = trackedRef.current.cloneNode(true) as HTMLElement;
    
    // Remove UI elements
    clone.querySelectorAll('.change-action').forEach(el => el.remove());
    
    // Process change groups
    clone.querySelectorAll('.change-group').forEach(group => {
      const parent = group.parentNode;
      while (group.firstChild) {
        parent?.insertBefore(group.firstChild, group);
      }
      parent?.removeChild(group);
    });
    
    // Process inline changes
    clone.querySelectorAll('del').forEach(el => el.remove());
    clone.querySelectorAll('ins').forEach(ins => {
      const parent = ins.parentNode;
      while (ins.firstChild) {
        parent?.insertBefore(ins.firstChild, ins);
      }
      parent?.removeChild(ins);
    });
    
    return clone.textContent || '';
  }, []);

  // === Update clean text with cursor preservation ===
  const updateCleanText = useCallback((newText?: string) => {
    const text = newText || getCleanTextFromTracked();
    cleanTextRef.current = text;
    editor.setEditedText(text);
  }, [editor, getCleanTextFromTracked]);

  // === Debounced clean text update ===
  const debouncedUpdateCleanText = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      updateCleanText();
    }, 300);
  }, [updateCleanText]);

  // === Restore cursor position ===
  const restoreCursor = useCallback(() => {
    if (!trackedRef.current || cursorPositionRef.current === null) return;
    
    const range = document.createRange();
    const selection = window.getSelection();
    if (!selection) return;

    let charCount = 0;
    let node: Node | null = trackedRef.current.firstChild;
    
    const findNodeAndOffset = (targetCount: number): NodePosition => {
      while (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const textLength = node.textContent?.length || 0;
          if (charCount + textLength >= targetCount) {
            return {
              node: node,
              offset: targetCount - charCount
            };
          }
          charCount += textLength;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const childNodes = (node as Element).childNodes;
          for (let i = 0; i < childNodes.length; i++) {
            node = childNodes[i];
            const result = findNodeAndOffset(targetCount);
            if (result) return result;
          }
        }
        node = node.nextSibling;
      }
      return null;
    };

    const result = findNodeAndOffset(cursorPositionRef.current);
    if (result && result.node) {
      try {
        range.setStart(result.node, result.offset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (e) {
        console.warn('Failed to restore cursor position', e);
      }
    }
    
    cursorPositionRef.current = null;
  }, []);

  // === Apply accept or reject ===
  const applyChange = useCallback((group: HTMLElement, accept: boolean) => {
    if (isApplyingChangeRef.current) return;
    isApplyingChangeRef.current = true;

    // Save cursor position before DOM changes
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(trackedRef.current!);
      preSelectionRange.setEnd(range.endContainer, range.endOffset);
      cursorPositionRef.current = preSelectionRange.toString().length;
    }

    if (accept) {
      group.querySelectorAll('ins').forEach((ins) => {
        const parent = ins.parentNode!;
        while (ins.firstChild) parent.insertBefore(ins.firstChild, ins);
        parent.removeChild(ins);
      });
      group.querySelectorAll('del').forEach((del) => del.remove());
    } else {
      group.querySelectorAll('del').forEach((del) => {
        const parent = del.parentNode!;
        while (del.firstChild) parent.insertBefore(del.firstChild, del);
        parent.removeChild(del);
      });
      group.querySelectorAll('ins').forEach((ins) => ins.remove());
    }

    if (group.childNodes.length === 0) {
      group.remove();
    } else {
      while (group.firstChild) {
        group.parentNode!.insertBefore(group.firstChild, group);
      }
      group.remove();
    }

    // Update clean text immediately
    updateCleanText();
    setUnsavedChanges(true);
    lastHtmlRef.current = trackedRef.current?.innerHTML || '';

    // Reattach handlers and restore cursor
    setTimeout(() => {
      attachChangeHandlers();
      restoreCursor();
      isApplyingChangeRef.current = false;
    }, 0);
  }, [updateCleanText, restoreCursor]);

  // === Attach accept/reject handlers ===
  const attachChangeHandlers = useCallback(() => {
    if (!trackedRef.current) return;
    
    trackedRef.current.querySelectorAll('.change-action').forEach(el => el.remove());
    
    trackedRef.current.querySelectorAll('.change-group').forEach(group => {
      if (group.querySelector('.change-action')) return;
      
      const action = document.createElement('div');
      action.className = 'change-action';
      action.innerHTML = `
        <button class="accept-change" title="Accept">✅</button>
        <button class="reject-change" title="Reject">❌</button>
      `;
      group.appendChild(action);
      
      action.querySelector('.accept-change')?.addEventListener('click', (e) => {
        e.stopPropagation();
        applyChange(group as HTMLElement, true);
      });
      
      action.querySelector('.reject-change')?.addEventListener('click', (e) => {
        e.stopPropagation();
        applyChange(group as HTMLElement, false);
      });
    });
  }, [applyChange]);

  // === Handle manual edits in tracked view ===
  const handleTrackedInput = useCallback(() => {
    if (isApplyingChangeRef.current) return;
    
    setUnsavedChanges(true);
    lastHtmlRef.current = trackedRef.current?.innerHTML || '';
    
    // Debounced update to prevent performance issues
    debouncedUpdateCleanText();
  }, [debouncedUpdateCleanText]);

  // === Save cursor position before interaction ===
  const handleMouseDown = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(trackedRef.current!);
      preSelectionRange.setEnd(range.endContainer, range.endOffset);
      cursorPositionRef.current = preSelectionRange.toString().length;
    }
  }, []);

  // === Load document into editor and tracked view ===
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

      // Generate tracked HTML with fallback
      const html = doc.tracked_html ?? generateDiffHtml(doc.original_text, doc.edited_text);
      
      // Set content and initialize
      if (trackedRef.current) {
        trackedRef.current.innerHTML = html || '';
        lastHtmlRef.current = html || '';
        cleanTextRef.current = doc.edited_text;
        attachChangeHandlers();
      }
      
      setUnsavedChanges(false);
    },
    [editor, setDocumentId, setViewMode, generateDiffHtml, attachChangeHandlers]
  );

  // === Save to backend ===
  const saveProgress = async () => {
    if (!documentId || !currentDoc) {
      setSaveError('No active document to save');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const trackedHtmlContent = trackedRef.current?.innerHTML || null;
      lastHtmlRef.current = trackedHtmlContent || '';

      // ✅ Convert null → undefined to match API expectation
      await saveProgressToApi(
        documentId,
        cleanTextRef.current,
        inputText,
        trackedHtmlContent ?? undefined
      );

      setUnsavedChanges(false);
      alert('✅ Progress saved!');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // === Handle before unload ===
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges]);

  // === Load diff.js from CDN ===
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).Diff) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/diff@5.1.0/dist/diff.min.js';
      script.async = true;
      script.onload = () => {
        console.log('Diff library loaded');
      };
      document.head.appendChild(script);
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, []);

  // === Initial clean text sync ===
  useEffect(() => {
    cleanTextRef.current = editedText;
  }, [editedText]);

  // === Cleanup timeouts ===
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // === Render ===
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
          Tracked Changes Viewer
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
                  disabled={!unsavedChanges || isSaving}
                  className={`px-3 py-1.5 text-sm rounded ${
                    unsavedChanges
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  💾 {isSaving ? 'Saving...' : 'Save Progress'}
                </button>
              </div>
              <div
                id="tracked"
                ref={trackedRef}
                contentEditable={!isApplyingChangeRef.current}
                onInput={handleTrackedInput}
                onMouseDown={handleMouseDown}
                className="content-box p-3 bg-white border border-[#ddd] rounded whitespace-pre-wrap text-sm max-h-[40vh] overflow-y-auto focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                {cleanTextRef.current || 'No content'}
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

        #tracked:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
        }

        del {
          background-color: #ffe6e6;
          text-decoration: line-through;
          display: inline;
          padding: 0 1px;
          border-radius: 2px;
        }
        ins {
          background-color: #e6ffe6;
          text-decoration: none;
          display: inline;
          padding: 0 1px;
          border-radius: 2px;
        }

        .change-group {
          position: relative;
          display: inline;
          padding: 0 1px;
          border-radius: 2px;
        }

        .change-action {
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 2px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
          z-index: 100;
          display: flex;
          gap: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
        }

        .change-group:hover .change-action {
          opacity: 1;
          pointer-events: all;
        }

        .change-action button {
          padding: 2px 6px;
          font-size: 12px;
          border: 1px solid #ccc;
          border-radius: 3px;
          background: white;
          cursor: pointer;
          margin: 0;
        }
        .change-action button:hover {
          background: #f0f0f0;
        }
        .change-action button.accept-change {
          color: green;
          border-color: green;
        }
        .change-action button.reject-change {
          color: red;
          border-color: red;
        }

        .content-box {
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}