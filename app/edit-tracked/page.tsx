'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Diff from 'diff';
import { useEditor } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';

// Types
type ChangeGroup = HTMLElement;

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
    inputText: editorInputText,
    editedText: editorEditedText,
    documentId: editorDocId,
    setDocumentId,
    reset: resetEditor,
  } = editor;

  // Local state for UI
  const [currentDoc, setCurrentDoc] = useState<SavedDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [viewMode, setViewMode] = useState<'tracked' | 'clean'>('tracked');

  // Refs for DOM
  const trackedRef = useRef<HTMLDivElement>(null);
  const cleanRef = useRef<HTMLDivElement>(null);
  const isApplyingChangeRef = useRef(false);
  const originalTrackedHtmlRef = useRef('');

  // ------------------ UTILITIES ------------------

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const generateDiffHtml = (original: string, edited: string): string => {
    const diffs = Diff.diffWords(original, edited);
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

    const areWordsSimilar = (word1: string, word2: string) => {
      if (!word1 || !word2) return false;
      const lenDiff = Math.abs(word1.length - word2.length);
      if (lenDiff > Math.max(word1.length, word2.length) * 0.4) return false;
      let common = 0, i = 0, j = 0;
      while (i < word1.length && j < word2.length) {
        if (word1[i] === word2[j]) {
          common++; i++; j++;
        } else {
          if (i < word1.length - 1 && word1[i + 1] === word2[j]) i++;
          else if (j < word2.length - 1 && word1[i] === word2[j + 1]) j++;
          else { i++; j++; }
        }
      }
      return common / Math.max(word1.length, word2.length) >= 0.6;
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
      } else if (inGroup && part.added && next.removed) {
        flushGroup(true);
      } else if (inGroup && part.removed && next.added) {
        if (!areWordsSimilar(part.value.trim(), next.value.trim())) {
          flushGroup(true);
        }
      }
    }
    flushGroup(inGroup);
    return `<div style="white-space:pre-wrap">${html}</div>`;
  };

  const updateCleanFromTracked = useCallback(() => {
    if (!trackedRef.current) return '';
    const clone = trackedRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.change-action, .change-group').forEach(el => el.remove());
    clone.querySelectorAll('del').forEach(el => el.remove());
    clone.querySelectorAll('ins').forEach(ins => {
      const parent = ins.parentNode!;
      while (ins.firstChild) parent.insertBefore(ins.firstChild, ins);
      parent.removeChild(ins);
    });
    return clone.textContent || '';
  }, []);

  const attachAcceptRejectHandlers = useCallback(() => {
    if (!trackedRef.current) return;
    trackedRef.current.querySelectorAll('.change-action').forEach(el => el.remove());
    trackedRef.current.querySelectorAll<HTMLElement>('.change-group').forEach(group => {
      if (group.querySelector('.change-action')) return;
      const action = document.createElement('div');
      action.className = 'change-action';
      action.innerHTML = `
        <button class="accept-change" title="Accept">✅</button>
        <button class="reject-change" title="Reject">❌</button>
      `;
      group.appendChild(action);

      action.querySelector('.accept-change')!.addEventListener('click', (e) => {
        e.stopPropagation();
        applyChange(group, true);
      });
      action.querySelector('.reject-change')!.addEventListener('click', (e) => {
        e.stopPropagation();
        applyChange(group, false);
      });
    });
  }, []);

  const applyChange = useCallback((group: ChangeGroup, accept: boolean) => {
    isApplyingChangeRef.current = true;

    if (accept) {
      group.querySelectorAll('ins').forEach(ins => {
        const parent = ins.parentNode!;
        while (ins.firstChild) parent.insertBefore(ins.firstChild, ins);
        parent.removeChild(ins);
      });
      group.querySelectorAll('del').forEach(del => del.remove());
    } else {
      group.querySelectorAll('del').forEach(del => {
        const parent = del.parentNode!;
        while (del.firstChild) parent.insertBefore(del.firstChild, del);
        parent.removeChild(del);
      });
      group.querySelectorAll('ins').forEach(ins => ins.remove());
    }

    if (group.childNodes.length === 0) {
      group.remove();
    } else {
      while (group.firstChild) {
        group.parentNode!.insertBefore(group.firstChild, group);
      }
      group.remove();
    }

    // Update clean view
    const cleanText = updateCleanFromTracked();
    if (cleanRef.current) cleanRef.current.textContent = cleanText;

    // Mark as unsaved
    setUnsavedChanges(trackedRef.current?.innerHTML !== originalTrackedHtmlRef.current);

    // Reattach handlers
    attachAcceptRejectHandlers();
    isApplyingChangeRef.current = false;
  }, [updateCleanFromTracked, attachAcceptRejectHandlers]);

  const performDeletion = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const fragment = range.cloneContents();
    if (!fragment.textContent?.trim()) return;

    const tempDiv = document.createElement('div');
    tempDiv.appendChild(fragment);
    const safeText = tempDiv.textContent;

    const del = document.createElement('del');
    del.textContent = safeText;

    const group = document.createElement('span');
    group.className = 'change-group';
    group.appendChild(del);

    range.deleteContents();
    range.insertNode(group);

    const cleanText = updateCleanFromTracked();
    if (cleanRef.current) cleanRef.current.textContent = cleanText;
    setUnsavedChanges(trackedRef.current?.innerHTML !== originalTrackedHtmlRef.current);
  }, [updateCleanFromTracked]);

  const handleDeletion = useCallback((isForward = false) => {
    if (isApplyingChangeRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    trackedRef.current?.querySelectorAll('.change-action').forEach(el => el.remove());

    let range;
    if (selection.isCollapsed) {
      range = selection.getRangeAt(0).cloneRange();
      if (isForward) {
        const maxOffset = range.endContainer.textContent?.length || 0;
        range.setEnd(range.endContainer, Math.min(range.endOffset + 1, maxOffset));
      } else {
        if (range.startOffset === 0) return;
        range.setStart(range.startContainer, range.startOffset - 1);
      }
      if (range.toString().trim() === '') return;
    } else {
      range = selection.getRangeAt(0);
      if (!range.toString().trim()) return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
    performDeletion();

    const afterRange = document.createRange();
    afterRange.setStart(range.startContainer, range.startOffset);
    afterRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(afterRange);

    attachAcceptRejectHandlers();
  }, [performDeletion, attachAcceptRejectHandlers]);

  const insertTrackedInsertion = useCallback((text: string) => {
    if (!text || isApplyingChangeRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const ins = document.createElement('ins');
    ins.textContent = text;

    const group = document.createElement('span');
    group.className = 'change-group';
    group.appendChild(ins);

    range.insertNode(group);

    const newRange = document.createRange();
    newRange.setStartAfter(group);
    newRange.setEndAfter(group);
    selection.removeAllRanges();
    selection.addRange(newRange);

    const cleanText = updateCleanFromTracked();
    if (cleanRef.current) cleanRef.current.textContent = cleanText;
    setUnsavedChanges(trackedRef.current?.innerHTML !== originalTrackedHtmlRef.current);
    attachAcceptRejectHandlers();
  }, [updateCleanFromTracked, attachAcceptRejectHandlers]);

  // ------------------ EVENT HANDLERS ------------------

  useEffect(() => {
    if (!trackedRef.current) return;
    const div = trackedRef.current;
    div.contentEditable = 'true';

    const beforeinputHandler = (e: InputEvent) => {
      if (isApplyingChangeRef.current) return;
      if (e.inputType === 'insertText' && e.data) {
        e.preventDefault();
        insertTrackedInsertion(e.data);
      }
      // Note: 'insertFromPaste' is handled by paste event — skip here
    };

    const pasteHandler = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      insertTrackedInsertion(text);
    };

    const keydownHandler = (e: KeyboardEvent) => {
      if (isApplyingChangeRef.current) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleDeletion(e.key === 'Delete');
      }
    };

    div.addEventListener('beforeinput', beforeinputHandler);
    div.addEventListener('paste', pasteHandler);
    div.addEventListener('keydown', keydownHandler);

    return () => {
      div.removeEventListener('beforeinput', beforeinputHandler);
      div.removeEventListener('paste', pasteHandler);
      div.removeEventListener('keydown', keydownHandler);
    };
  }, [insertTrackedInsertion, handleDeletion]);

  // ------------------ DOCUMENT LOADING ------------------

  const loadDocument = useCallback((doc: SavedDocument) => {
    const trackedHtml = generateDiffHtml(doc.original_text, doc.edited_text);
    if (trackedRef.current) {
      trackedRef.current.innerHTML = trackedHtml;
      originalTrackedHtmlRef.current = trackedHtml;
      setTimeout(() => {
        attachAcceptRejectHandlers();
        const cleanText = updateCleanFromTracked();
        if (cleanRef.current) cleanRef.current.textContent = cleanText;
      }, 0);
    }
    setCurrentDoc(doc);
    setDocumentId(doc.id);
    setViewMode('tracked');
    setUnsavedChanges(false);
  }, [setDocumentId, attachAcceptRejectHandlers, updateCleanFromTracked]);

  // When a new doc is selected externally (e.g., via URL), load it
  useEffect(() => {
    if (editorDocId && documents.length > 0) {
      const doc = documents.find(d => d.id === editorDocId);
      if (doc && (!currentDoc || currentDoc.id !== doc.id)) {
        loadDocument(doc);
      }
    }
  }, [editorDocId, documents, currentDoc, loadDocument]);

  // ------------------ SAVING ------------------

  const saveProgress = async () => {
    if (!currentDoc || !trackedRef.current) {
      setSaveError('No active document');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const cleanText = updateCleanFromTracked();
      // Save clean text as edited_text, original_text stays the same
      await saveProgressToApi(currentDoc.id, cleanText, currentDoc.original_text);
      // After save, update original tracked HTML to current state
      originalTrackedHtmlRef.current = trackedRef.current.innerHTML;
      setUnsavedChanges(false);
      alert('✅ Progress saved!');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Detect unsaved changes via MutationObserver
  useEffect(() => {
    if (!trackedRef.current) return;
    const observer = new MutationObserver(() => {
      setUnsavedChanges(trackedRef.current!.innerHTML !== originalTrackedHtmlRef.current);
    });
    observer.observe(trackedRef.current, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  // ------------------ RENDER ------------------

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 font-sans">
      <style jsx global>{`
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
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          z-index: 100;
          gap: 4px;
          align-items: center;
          display: none;
          flex-direction: row;
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
        .change-action button.accept-change { color: green; }
        .change-action button.reject-change { color: red; }

        .change-group:hover .change-action {
          display: flex !important;
        }
      `}</style>

      <h1 className="text-2xl font-bold">Edit Tracked Changes</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
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
                      doc.id === currentDoc?.id
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

        {/* Main Content */}
        <div className="lg:col-span-3">
          {currentDoc ? (
            <>
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
                        resetEditor();
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>

              <div className="flex mb-4">
                <button
                  className={`px-3 py-1 text-sm rounded-l ${
                    viewMode === 'tracked'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                  onClick={() => setViewMode('tracked')}
                >
                  Tracked Changes
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

              <div className="bg-white p-4 border rounded min-h-96">
                {viewMode === 'clean' ? (
                  <div
                    ref={cleanRef}
                    className="whitespace-pre-wrap"
                    contentEditable={false}
                  />
                ) : (
                  <div
                    ref={trackedRef}
                    className="whitespace-pre-wrap min-h-32 outline-none"
                    style={{
                      padding: '12px',
                      backgroundColor: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      maxHeight: '40vh',
                      overflowY: 'auto',
                    }}
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