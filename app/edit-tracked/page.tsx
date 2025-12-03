'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor } from '@/hooks/useEditor';
import { useDocument, SavedDocument } from '@/hooks/useDocument';

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
  const [trackedHtmlState, setTrackedHtmlState] = useState<string>('');
  const trackedRef = useRef<HTMLDivElement>(null);
  const isApplyingChangeRef = useRef(false);

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

  // === Extract clean text from tracked HTML ===
  const updateCleanFromTracked = useCallback(() => {
    if (!trackedRef.current) return;
    const clone = trackedRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.change-action, .change-group').forEach((el) => el.remove());
    clone.querySelectorAll('del').forEach((el) => el.remove());
    clone.querySelectorAll('ins').forEach((el) => {
      const parent = el.parentNode!;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    const newText = clone.textContent || '';
    editor.setEditedText(newText);
  }, [editor]);

  // === Apply accept or reject ===
  const applyChange = useCallback((group: HTMLElement, accept: boolean) => {
    if (isApplyingChangeRef.current) return;
    isApplyingChangeRef.current = true;

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

    updateCleanFromTracked();
    setUnsavedChanges(true);

    // Reattach handlers after DOM change
    setTimeout(() => {
      if (trackedRef.current) {
        trackedRef.current.querySelectorAll('.change-action').forEach((el) => el.remove());
        trackedRef.current.querySelectorAll('.change-group').forEach((grp) => {
          if (!grp.querySelector('.change-action')) {
            const action = document.createElement('div');
            action.className = 'change-action';
            action.innerHTML = `
              <button class="accept-change" title="Accept">✅</button>
              <button class="reject-change" title="Reject">❌</button>
            `;
            grp.appendChild(action);
            action.querySelector('.accept-change')?.addEventListener('click', (e) => {
              e.stopPropagation();
              applyChange(grp as HTMLElement, true);
            });
            action.querySelector('.reject-change')?.addEventListener('click', (e) => {
              e.stopPropagation();
              applyChange(grp as HTMLElement, false);
            });
          }
        });
      }
    }, 0);

    isApplyingChangeRef.current = false;
  }, [updateCleanFromTracked]);

  // === Handle manual edits in tracked view ===
  const handleTrackedInput = useCallback(() => {
    if (isApplyingChangeRef.current) return;
    setUnsavedChanges(true);
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

      const html = doc.tracked_html || generateDiffHtml(doc.original_text, doc.edited_text);
      setTrackedHtmlState(html);
      setUnsavedChanges(false);
    },
    [editor, setDocumentId, setViewMode, generateDiffHtml]
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
      const clean = editedText;
      const trackedHtmlContent = trackedRef.current?.innerHTML || null;

      // ✅ Convert null → undefined to match API expectation
      await saveProgressToApi(
        documentId,
        clean,
        inputText,
        trackedHtmlContent ?? undefined // or: trackedHtmlContent || undefined
      );

      setUnsavedChanges(false);
      alert('✅ Progress saved!');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // === Detect unsaved changes ===
  useEffect(() => {
    if (currentDoc) {
      const hasChanges = trackedHtmlState !== (currentDoc.tracked_html || '');
      setUnsavedChanges(hasChanges);
    }
  }, [trackedHtmlState, currentDoc]);

  // === Attach accept/reject handlers on initial render & after load ===
  useEffect(() => {
    if (trackedRef.current) {
      trackedRef.current.querySelectorAll('.change-action').forEach((el) => el.remove());
      trackedRef.current.querySelectorAll('.change-group').forEach((group) => {
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
    }
  }, [trackedHtmlState, applyChange]);

  // === Load diff.js from CDN ===
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).Diff) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/diff@5.1.0/dist/diff.min.js';
      script.async = true;
      document.head.appendChild(script);
      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
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
                dangerouslySetInnerHTML={{ __html: trackedHtmlState }}
                className="content-box p-3 bg-white border border-[#ddd] rounded whitespace-pre-wrap text-sm max-h-[40vh] overflow-y-auto"
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
                {editedText || 'No content'}
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

        .change-group:hover .change-action {
          display: flex !important;
        }

        .content-box {
          white-space: pre-wrap;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}