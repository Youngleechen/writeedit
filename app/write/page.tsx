// app/write/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { PageWithChrome } from '@/components/PageWithChrome';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id || null;
}

// --- Types ---
interface DraftListItem {
  id: string;
  title: string;
  updated_at?: string;
  lastEdited?: string;
}

interface FullDraft {
  id: string;
  title: string;
  content: string;
  updated_at?: string;
}

interface HistoryState {
  content: string;
  title: string;
  selection: SelectionState | null;
  timestamp: number;
}

interface SelectionState {
  startOffset: number;
  endOffset: number;
  startContainerPath: ElementPathStep[];
  endContainerPath: ElementPathStep[];
}

interface ElementPathStep {
  nodeType: number;
  nodeName: string;
  index: number;
}

const HISTORY_OPTIONS = {
  MAX_STATES: 100,
  THROTTLE_DELAY: 300,
};

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  return date.toLocaleDateString();
};

const generateId = (): string => 'local_' + Math.random().toString(36).substring(2, 11);

// --- Main Component ---
export default function WritePage() {
  // --- Refs ---
  const canvasRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingHistoryCaptureRef = useRef<NodeJS.Timeout | null>(null);
  const currentSelectionRangeRef = useRef<Range | null>(null);
  const variationPickerRef = useRef<HTMLDivElement | null>(null);

  // 🔥 NEW: Use a ref to store the last valid selection text (survives blur/click)
  const lastValidSelectionTextRef = useRef<string | null>(null);

  // --- State (keep for UI only, not logic) ---
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isAiOperation, setIsAiOperation] = useState(false);
  const [isApplyingHistory, setIsApplyingHistory] = useState(false);
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  const [lastHistoryTimestamp, setLastHistoryTimestamp] = useState(0);
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState('Start writing to create a draft');
  const [autosaveStatusType, setAutosaveStatusType] = useState<'saved' | 'saving' | 'error' | 'unsaved' | 'info'>('info');
  const [wordCount, setWordCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // (Optional) Keep this if you want to show selection UI (e.g., highlight buttons)
  const [hasActiveSelection, setHasActiveSelection] = useState(false);

  // --- Toast ---
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const updateAutosaveStatus = (text: string, type: typeof autosaveStatusType) => {
    setAutosaveStatus(text);
    setAutosaveStatusType(type);
  };

  // --- Selection utils (for history) ---
  const getElementPath = (element: Node, root: Node): ElementPathStep[] => {
    if (element === root) return [];
    const path: ElementPathStep[] = [];
    let current: Node | null = element;
    while (current && current !== root) {
      if (current.parentNode) {
        let index = 0;
        let sibling = current.previousSibling;
        while (sibling) {
          if (sibling.nodeType === current.nodeType && sibling.nodeName === current.nodeName) index++;
          sibling = sibling.previousSibling;
        }
        path.unshift({
          nodeType: current.nodeType,
          nodeName: current.nodeName,
          index,
        });
        current = current.parentNode;
      } else break;
    }
    return path;
  };

  const resolveElementPath = (path: ElementPathStep[], root: Node): Node | null => {
    if (path.length === 0) return root;
    let current: Node = root;
    for (const step of path) {
      if (current.nodeType !== 1) return null;
      let found: Node | null = null;
      let count = 0;
      for (let i = 0; i < current.childNodes.length; i++) {
        const child = current.childNodes[i];
        if (child.nodeType === step.nodeType && child.nodeName === step.nodeName) {
          if (count === step.index) {
            found = child;
            break;
          }
          count++;
        }
      }
      if (!found) return null;
      current = found;
    }
    return current;
  };

  const saveSelectionState = (): SelectionState | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!canvas.contains(range.startContainer)) return null;
    return {
      startOffset: range.startOffset,
      endOffset: range.endOffset,
      startContainerPath: getElementPath(range.startContainer, canvas),
      endContainerPath: getElementPath(range.endContainer, canvas),
    };
  };

  const restoreSelectionState = (state: SelectionState | null) => {
    if (!state || !canvasRef.current) return;
    const startContainer = resolveElementPath(state.startContainerPath, canvasRef.current);
    const endContainer =
      state.startContainerPath === state.endContainerPath
        ? startContainer
        : resolveElementPath(state.endContainerPath, canvasRef.current);
    if (!startContainer || !endContainer) return;
    try {
      const range = document.createRange();
      range.setStart(startContainer, state.startOffset);
      range.setEnd(endContainer, state.endOffset);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      currentSelectionRangeRef.current = range.cloneRange();
    } catch (e) {
      console.warn('Selection restore failed', e);
    }
  };

  // --- History ---
  const resetHistory = () => {
    setHistoryStack([]);
    setCurrentHistoryIndex(-1);
    setLastHistoryTimestamp(0);
    if (pendingHistoryCaptureRef.current) {
      clearTimeout(pendingHistoryCaptureRef.current);
      pendingHistoryCaptureRef.current = null;
    }
    currentSelectionRangeRef.current = null;
    // Clear selection ref when starting fresh
    lastValidSelectionTextRef.current = null;
  };

  const shouldCaptureHistory = () => !isApplyingHistory && !isAiOperation;

  const captureHistoryState = () => {
    if (!shouldCaptureHistory()) return;
    const now = Date.now();
    if (now - lastHistoryTimestamp < HISTORY_OPTIONS.THROTTLE_DELAY) {
      if (pendingHistoryCaptureRef.current) clearTimeout(pendingHistoryCaptureRef.current);
      pendingHistoryCaptureRef.current = setTimeout(captureHistoryState, HISTORY_OPTIONS.THROTTLE_DELAY);
      return;
    }

    const canvas = canvasRef.current;
    const titleEl = titleRef.current;
    if (!canvas || !titleEl) return;

    const content = canvas.textContent || '';
    const title = titleEl.value || 'Untitled Draft';
    const selection = saveSelectionState();

    const lastState = historyStack[currentHistoryIndex];
    if (lastState && lastState.content === content && lastState.title === title) return;

    let newStack = historyStack.slice(0, currentHistoryIndex + 1);
    const newState: HistoryState = { content, title, selection, timestamp: now };
    newStack.push(newState);
    if (newStack.length > HISTORY_OPTIONS.MAX_STATES) {
      newStack = newStack.slice(1);
      setCurrentHistoryIndex(prev => prev - 1);
    }

    setHistoryStack(newStack);
    setCurrentHistoryIndex(newStack.length - 1);
    setLastHistoryTimestamp(now);
    if (pendingHistoryCaptureRef.current) {
      clearTimeout(pendingHistoryCaptureRef.current);
      pendingHistoryCaptureRef.current = null;
    }
  };

  const applyHistoryState = (state: HistoryState) => {
    if (!canvasRef.current || !titleRef.current) return;
    canvasRef.current.textContent = state.content;
    titleRef.current.value = state.title;
    restoreSelectionState(state.selection);
    updateWordCount();
    updateAutosaveStatus('History restored', 'info');
  };

  const undo = () => {
    if (currentHistoryIndex <= 0 || historyStack.length === 0) {
      showToast('No more undo history', 'info');
      return;
    }
    setIsApplyingHistory(true);
    setCurrentHistoryIndex(prev => prev - 1);
    applyHistoryState(historyStack[currentHistoryIndex - 1]);
    setIsApplyingHistory(false);
    showToast('Changes undone', 'success');
  };

  const redo = () => {
    if (currentHistoryIndex >= historyStack.length - 1) {
      showToast('No more redo history', 'info');
      return;
    }
    setIsApplyingHistory(true);
    setCurrentHistoryIndex(prev => prev + 1);
    applyHistoryState(historyStack[currentHistoryIndex + 1]);
    setIsApplyingHistory(false);
    showToast('Changes redone', 'success');
  };

  // --- Word count ---
  const updateWordCount = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const text = canvas.textContent || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
  };

  // --- Local storage & Supabase (unchanged) ---
  const getLocalDrafts = (): FullDraft[] => {
    const stored = localStorage.getItem('localDrafts');
    return stored ? JSON.parse(stored) : [];
  };

  const saveToLocalDrafts = (draft: FullDraft) => {
    const drafts = getLocalDrafts();
    const index = drafts.findIndex((d) => d.id === draft.id);
    if (index > -1) drafts[index] = draft;
    else drafts.push(draft);
    localStorage.setItem('localDrafts', JSON.stringify(drafts));
  };

  const saveDraftToSupabase = async (content: string, title: string): Promise<string> => {
    const userId = await getCurrentUserId();
    if (!userId) {
      const id = currentDraftId || generateId();
      saveToLocalDrafts({ id, title, content, updated_at: new Date().toISOString() });
      showToast('Saved locally. Log in to sync.', 'info');
      return id;
    }

    const now = new Date().toISOString();
    const trimmedContent = content.trim();
    if (currentDraftId) {
      const { error } = await supabase
        .from('drafts')
        .update({ title, content: trimmedContent, updated_at: now })
        .eq('id', currentDraftId)
        .eq('user_id', userId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('drafts')
        .insert([{ user_id: userId, title, content: trimmedContent }])
        .select('id')
        .single();
      if (error) throw error;
      if (!data) throw new Error('Failed to create draft');
      setCurrentDraftId(data.id);
      return data.id;
    }
    setIsDirty(false);
    return currentDraftId!;
  };

  const loadDraft = async (id: string) => {
    resetHistory();
    setIsApplyingHistory(true);
    setCurrentDraftId(id);
    currentSelectionRangeRef.current = null;

    const userId = await getCurrentUserId();
    let data: FullDraft | undefined = undefined;

    if (userId) {
      const { data: dbData, error } = await supabase
        .from('drafts')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !dbData) {
        showToast('Failed to load draft', 'error');
        setIsApplyingHistory(false);
        return;
      }
      data = {
        id: dbData.id,
        title: dbData.title,
        content: dbData.content,
        updated_at: dbData.updated_at,
      };
    } else {
      const drafts = getLocalDrafts();
      data = drafts.find((d) => d.id === id);
      if (!data) {
        showToast('Draft not found locally', 'error');
        setIsApplyingHistory(false);
        return;
      }
    }

    if (canvasRef.current) canvasRef.current.textContent = data.content || '';
    if (titleRef.current) titleRef.current.value = data.title;
    setIsDirty(false);
    updateWordCount();
    updateAutosaveStatus('Draft loaded', 'saved');
    captureHistoryState();
    setIsApplyingHistory(false);
  };

  const loadAllDrafts = async () => {
    const userId = await getCurrentUserId();
    let drafts: DraftListItem[] = [];
    if (userId) {
      const { data } = await supabase
        .from('drafts')
        .select('id, title, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      drafts = (data || []).map(d => ({
        id: d.id,
        title: d.title,
        updated_at: d.updated_at,
      }));
    } else {
      drafts = getLocalDrafts().map(d => ({
        id: d.id,
        title: d.title,
        updated_at: d.updated_at,
      }));
    }
    setDrafts(
      drafts.map((d) => ({
        ...d,
        lastEdited: d.updated_at ? formatTimeAgo(new Date(d.updated_at)) : 'Just now',
      }))
    );
  };

  // --- Save logic (unchanged) ---
  const manuallySave = async () => {
    const canvas = canvasRef.current;
    const titleEl = titleRef.current;
    if (!canvas || !titleEl) return;

    const content = canvas.textContent || '';
    const title = titleEl.value || 'Untitled Draft';

    if (!currentDraftId) {
      try {
        const id = await saveDraftToSupabase(content, title);
        setCurrentDraftId(id);
        showToast('New draft saved', 'success');
        captureHistoryState();
      } catch (err) {
        console.error('Create draft failed:', err);
        showToast('Failed to create draft', 'error');
        updateAutosaveStatus('Save failed', 'error');
      }
    } else {
      setIsDirty(true);
      const userId = await getCurrentUserId();
      if (!userId) {
        saveToLocalDrafts({ id: currentDraftId, title, content, updated_at: new Date().toISOString() });
        updateAutosaveStatus('Saved locally', 'saved');
        showToast('Saved locally. Log in to sync.', 'info');
      } else {
        updateAutosaveStatus('Saving…', 'saving');
        try {
          await saveDraftToSupabase(content, title);
          updateAutosaveStatus('All changes saved', 'saved');
          showToast('Saved to cloud', 'success');
        } catch (err) {
          console.error('Manual save failed:', err);
          updateAutosaveStatus('Save failed', 'error');
        }
      }
    }
  };

  const autosave = async () => {
    if (!isDirty || !currentDraftId) return;
    const canvas = canvasRef.current;
    const titleEl = titleRef.current;
    if (!canvas || !titleEl) return;

    const content = canvas.textContent || '';
    const title = titleEl.value || 'Untitled Draft';

    const userId = await getCurrentUserId();
    if (!userId) {
      saveToLocalDrafts({ id: currentDraftId, title, content, updated_at: new Date().toISOString() });
      updateAutosaveStatus('Saved locally', 'saved');
      return;
    }

    updateAutosaveStatus('Saving…', 'saving');
    try {
      await saveDraftToSupabase(content, title);
      updateAutosaveStatus('All changes saved', 'saved');
    } catch (err) {
      console.error('Autosave failed:', err);
      updateAutosaveStatus('Save failed – retrying', 'error');
      setTimeout(() => {
        if (isDirty) autosave();
      }, 3000);
    }
  };

  const handleInput = () => {
    setIsDirty(true);
    updateWordCount();

    // Clear selection ref on edit (optional)
    lastValidSelectionTextRef.current = null;
    setHasActiveSelection(false);
    currentSelectionRangeRef.current = null;

    if (currentDraftId) {
      updateAutosaveStatus('Unsaved changes', 'unsaved');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(autosave, 2000);
      captureHistoryState();
    } else {
      updateAutosaveStatus('Creating draft…', 'saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(manuallySave, 500);
    }
  };

  // --- Keyboard shortcuts (unchanged) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        manuallySave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, currentDraftId]);

  // --- ✅ CRITICAL: Global selection tracker ---
  useEffect(() => {
    const handleSelectionChange = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setHasActiveSelection(false);
        return;
      }

      const range = selection.getRangeAt(0);
      if (!canvas.contains(range.commonAncestorContainer)) {
        setHasActiveSelection(false);
        return;
      }

      const text = selection.toString().trim();
      if (text) {
        lastValidSelectionTextRef.current = text;
        setHasActiveSelection(true);
      } else {
        lastValidSelectionTextRef.current = null;
        setHasActiveSelection(false);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // --- AI Functions (mostly unchanged) ---
  const callAiApi = async (body: any): Promise<any> => {
    const res = await fetch('/api/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'AI request failed');
    }
    return await res.json();
  };

  const showVariationPicker = (
    originalText: string,
    variations: string[],
    onChoose: (text: string) => void,
    onCancel: () => void
  ) => {
    if (variationPickerRef.current) {
      variationPickerRef.current.remove();
      variationPickerRef.current = null;
    }

    const modal = document.createElement('div');
    variationPickerRef.current = modal;
    modal.id = 'variation-picker-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: 80px;
      z-index: 10000;
    `;

    const picker = document.createElement('div');
    picker.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 640px;
      width: 90%;
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      padding: 20px;
      font-family: var(--font-spectral), serif;
      font-size: 1.05em;
      line-height: 1.6;
    `;

    picker.innerHTML = `
      <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <strong>Choose the best version</strong>
        <button id="picker-cancel" style="background:#f5f5f5; border:1px solid #ddd; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:1.2em;">✕</button>
      </div>
      <div style="margin-bottom: 12px; color: #666; font-size: 0.95em;">Original:</div>
      <div style="background:#f9f9f9; padding:12px; border-radius:6px; margin-bottom:20px; font-style:italic;">${escapeHtml(originalText)}</div>
      <div id="variations-list"></div>
    `;

    const list = picker.querySelector('#variations-list')!;
    variations
      .map(t => t.trim())
      .filter(Boolean)
      .forEach(text => {
        const item = document.createElement('div');
        item.style.cssText = `
          padding: 12px;
          border: 1px solid #eee;
          border-radius: 6px;
          margin-bottom: 10px;
          cursor: pointer;
          color: #000;
          transition: background 0.2s;
        `;
        item.textContent = text;
        item.addEventListener('click', () => {
          modal.remove();
          variationPickerRef.current = null;
          onChoose(text);
        });
        item.addEventListener('mouseenter', () => item.style.background = '#f0f7ff');
        item.addEventListener('mouseleave', () => item.style.background = '');
        list.appendChild(item);
      });

    if (list.children.length === 0) {
      list.innerHTML = '<div style="color:#888;">No valid variations received.</div>';
    }

    picker.querySelector('#picker-cancel')!.addEventListener('click', () => {
      modal.remove();
      variationPickerRef.current = null;
      onCancel();
    });

    modal.appendChild(picker);
    document.body.appendChild(modal);
  };

  const applyChosenText = (chosen: string, hadSelection: boolean, canvas: HTMLDivElement) => {
    if (hadSelection) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (!range.collapsed) {
          range.deleteContents();
          range.insertNode(document.createTextNode(chosen));
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        }
      }
    }
    canvas.textContent = chosen;
  };

 const handleGenerateSpark = async () => {
  if (!canvasRef.current || !titleRef.current) return;

  // Always capture current state before AI call
  captureHistoryState();
  setIsAiOperation(true);

  const title = titleRef.current.value.trim() || 'a new story';
  const fullContent = canvasRef.current.textContent?.trim() || '';
  const isEmpty = !fullContent;

  let prompt: string;

  if (isEmpty) {
    // Start fresh — use title if meaningful, otherwise generic
    const effectiveTitle = title === 'Untitled Draft' ? 'a new story' : title;
    prompt = `You are a master storyteller. Write exactly one vivid, engaging, grammatically correct English sentence to begin a story titled "${effectiveTitle}". DO NOT use quotation marks, markdown, bullet points, subtitles, or JSON. Return ONLY the sentence itself, ending with a period.`;
  } else {
    // ✅ Use last 250 characters of user's actual writing as context
    const context = fullContent.length > 250
      ? fullContent.slice(-250).trim()
      : fullContent;

    prompt = `You are a master storyteller. Continue the following narrative in exactly one natural, flowing, grammatically correct English sentence. DO NOT summarize, conclude, add commentary, or introduce new plot points abruptly. Keep tone and style consistent. DO NOT use quotes, markdown, JSON, bullet points, or titles. Return ONLY the sentence, ending with a period.\n\nNarrative so far: "${context}"`;
  }

  try {
    updateAutosaveStatus('✨ Generating spark...', 'saving');
    const data = await callAiApi({
      input: prompt, // ← send full prompt as input
      model: 'x-ai/grok-4.1-fast:free',
      editLevel: 'generate',
    });

    // Extract raw text robustly
    let text = data.generatedPost?.content || data.generatedPost || data.editedText || '';

    // Try to clean up accidental JSON or wrapper objects
    if (text.startsWith('{') && text.endsWith('}')) {
      try {
        const parsed = JSON.parse(text);
        text = parsed.excerpt || parsed.content || parsed.generatedPost || '';
      } catch (e) {
        // If JSON parse fails, keep original text
      }
    }

    // Extract first valid sentence
    let sentence = '';
    const firstSentenceMatch = text.trim().match(/^[^.!?]*[.!?]/);
    if (firstSentenceMatch) {
      sentence = firstSentenceMatch[0];
    } else {
      // Fallback: take first line and force punctuation
      sentence = (text.split('\n')[0] || '').trim();
      if (sentence && !/[.!?]$/.test(sentence)) {
        sentence += '.';
      }
    }

    // Ensure we have *something*
    if (!sentence.trim()) {
      sentence = 'And so the story continued.';
    }

    // Apply the spark
    setIsApplyingHistory(true);
    if (isEmpty) {
      canvasRef.current.textContent = sentence + ' ';
    } else {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.collapse(false); // insert at cursor
        range.insertNode(document.createTextNode(' ' + sentence + ' '));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Append if no cursor
        canvasRef.current.textContent += ' ' + sentence + ' ';
      }
    }
    setIsApplyingHistory(false);

    // Finalize
    captureHistoryState();
    setIsDirty(true);
    updateWordCount();
    updateAutosaveStatus('Spark inserted!', 'saved');
    showToast('✨ One-sentence spark added!', 'success');

  } catch (err) {
    console.error('Spark failed:', err);
    showToast('AI spark failed – try again', 'error');
    updateAutosaveStatus('Spark failed', 'error');
  } finally {
    setIsAiOperation(false);
    currentSelectionRangeRef.current = null;
    lastValidSelectionTextRef.current = null;
    setHasActiveSelection(false);
  }
};

  const handleRewriteSelection = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 🔥 Use the ref, not state
    const text = lastValidSelectionTextRef.current || canvas.textContent.trim();
    const hasSelection = !!lastValidSelectionTextRef.current;

    if (!text) {
      showToast('No text to rewrite', 'info');
      return;
    }
    if (hasSelection && text.split(' ').length > 50) {
      showToast('Please select ≤50 words for best results', 'info');
      return;
    }

    captureHistoryState();
    setIsAiOperation(true);

    try {
      updateAutosaveStatus('🧠 Generating rewrites...', 'saving');
      const data = await callAiApi({
        input: text,
        instruction: 'Rewrite this in fresh, clear language with the same meaning. Keep similar length. Return ONLY the rewritten text, nothing else.',
        model: 'x-ai/grok-4.1-fast:free',
        editLevel: 'rewrite',
        numVariations: 3,
      });

      const variations = Array.isArray(data.variations)
        ? data.variations
        : [data.editedText || data.generatedPost].filter(Boolean);

      if (!variations.length) throw new Error('No output');

      showVariationPicker(text, variations, (chosen) => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.focus();
          setIsApplyingHistory(true);
          applyChosenText(chosen, hasSelection, canvas);
          setIsApplyingHistory(false);
          captureHistoryState();
          
          setIsDirty(true);
          updateWordCount();
          updateAutosaveStatus('Rewritten!', 'saved');
          showToast('✅ Rewritten!', 'success');
        }
      }, () => {
        updateAutosaveStatus('Canceled', 'info');
      });
    } catch (err) {
      console.error('Rewrite failed:', err);
      showToast('Rewrite failed – try again', 'error');
      updateAutosaveStatus('Rewrite failed', 'error');
    } finally {
      setIsAiOperation(false);
      currentSelectionRangeRef.current = null;
      lastValidSelectionTextRef.current = null;
      setHasActiveSelection(false);
    }
  };

  const handleAdjustTone = async () => {
    // 🔥 Use the ref — no more "select text" false negatives!
    const text = lastValidSelectionTextRef.current;
    if (!text) {
      showToast('Select text to adjust tone', 'info');
      return;
    }

    captureHistoryState();
    setIsAiOperation(true);

    try {
      updateAutosaveStatus('🎭 Generating tones...', 'saving');
      const data = await callAiApi({
        input: text,
        instruction: 'Rewrite this to sound formal and professional. Keep the core meaning. Return ONLY the rewritten text, nothing else.',
        model: 'x-ai/grok-4.1-fast:free',
        editLevel: 'tone',
        numVariations: 3,
      });

      const variations = Array.isArray(data.variations)
        ? data.variations
        : [data.editedText || data.generatedPost].filter(Boolean);

      showVariationPicker(text, variations, (chosen) => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.focus();
          setIsApplyingHistory(true);
          applyChosenText(chosen, true, canvas); // always replace selection
          setIsApplyingHistory(false);
          captureHistoryState();
          setIsDirty(true);
          updateWordCount();
          updateAutosaveStatus('Tone adjusted!', 'saved');
          showToast('✅ Tone adjusted!', 'success');
        }
      }, () => {
        updateAutosaveStatus('Canceled', 'info');
      });
    } catch (err) {
      console.error('Tone failed:', err);
      showToast('Tone adjustment failed – try again', 'error');
      updateAutosaveStatus('Tone failed', 'error');
    } finally {
      setIsAiOperation(false);
      currentSelectionRangeRef.current = null;
      lastValidSelectionTextRef.current = null;
      setHasActiveSelection(false);
    }
  };

  const handleExpandText = async () => {
    const text = lastValidSelectionTextRef.current;
    if (!text) {
      showToast('Select text to expand', 'info');
      return;
    }
    if (text.split(' ').length > 50) {
      showToast('Select ≤50 words to expand', 'info');
      return;
    }

    captureHistoryState();
    setIsAiOperation(true);

    try {
      updateAutosaveStatus('📈 Generating expansions...', 'saving');
      const data = await callAiApi({
        input: text,
        instruction: 'Expand this text by adding more detail, examples, or explanation. Make it roughly 2–3 times longer while keeping the original meaning. Return ONLY the expanded text, nothing else.',
        model: 'x-ai/grok-4.1-fast:free',
        editLevel: 'expand',
        numVariations: 3,
      });

      const variations = Array.isArray(data.variations)
        ? data.variations
        : [data.editedText || data.generatedPost].filter(Boolean);

      showVariationPicker(text, variations, (chosen) => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.focus();
          setIsApplyingHistory(true);
          applyChosenText(chosen, true, canvas);
          setIsApplyingHistory(false);
          captureHistoryState();
          setIsDirty(true);
          updateWordCount();
          updateAutosaveStatus('Text expanded!', 'saved');
          showToast('✅ Text expanded!', 'success');
        }
      }, () => {
        updateAutosaveStatus('Canceled', 'info');
      });
    } catch (err) {
      console.error('Expand failed:', err);
      showToast('Expansion failed – try again', 'error');
      updateAutosaveStatus('Expansion failed', 'error');
    } finally {
      setIsAiOperation(false);
      currentSelectionRangeRef.current = null;
      lastValidSelectionTextRef.current = null;
      setHasActiveSelection(false);
    }
  };

  const handleCondenseText = async () => {
    const text = lastValidSelectionTextRef.current;
    if (!text) {
      showToast('Select text to condense', 'info');
      return;
    }
    if (text.split(' ').length < 15) {
      showToast('Text is too short to condense effectively', 'info');
      return;
    }

    captureHistoryState();
    setIsAiOperation(true);

    try {
      updateAutosaveStatus('📉 Generating condensed versions...', 'saving');
      const data = await callAiApi({
        input: text,
        instruction: 'Condense this text by removing redundant words and phrases, making it as concise as possible while preserving the core meaning. Aim for half the length. Return ONLY the condensed text, nothing else.',
        model: 'x-ai/grok-4.1-fast:free',
        editLevel: 'condense',
        numVariations: 3,
      });

      const variations = Array.isArray(data.variations)
        ? data.variations
        : [data.editedText || data.generatedPost].filter(Boolean);

      showVariationPicker(text, variations, (chosen) => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.focus();
          setIsApplyingHistory(true);
          applyChosenText(chosen, true, canvas);
          setIsApplyingHistory(false);
          captureHistoryState();
          setIsDirty(true);
          updateWordCount();
          updateAutosaveStatus('Text condensed!', 'saved');
          showToast('✅ Text condensed!', 'success');
        }
      }, () => {
        updateAutosaveStatus('Canceled', 'info');
      });
    } catch (err) {
      console.error('Condense failed:', err);
      showToast('Condensation failed – try again', 'error');
      updateAutosaveStatus('Condensation failed', 'error');
    } finally {
      setIsAiOperation(false);
      currentSelectionRangeRef.current = null;
      lastValidSelectionTextRef.current = null;
      setHasActiveSelection(false);
    }
  };

  // --- Initial load ---
  useEffect(() => {
    loadAllDrafts();
    resetHistory();
    captureHistoryState();
    updateWordCount();
  }, []);

  // --- Render UI ---
  return (
    <PageWithChrome>
      <div className="writing-app">
        {/* Sidebar */}
        <div className={`drafts-sidebar ${sidebarOpen ? 'active' : ''}`}>
          <div className="sidebar-header">
            <h3>Your Drafts</h3>
            <button
              className="btn btn-primary"
              onClick={() => {
                resetHistory();
                if (canvasRef.current) canvasRef.current.textContent = '';
                if (titleRef.current) titleRef.current.value = 'Untitled Draft';
                setCurrentDraftId(null);
                setIsDirty(false);
                currentSelectionRangeRef.current = null;
                captureHistoryState();
                updateWordCount();
                updateAutosaveStatus('New draft ready – start typing!', 'info');
                if (window.innerWidth <= 768) setSidebarOpen(false);
              }}
            >
              📄 New
            </button>
            <button className="btn" id="close-sidebar-btn" onClick={() => setSidebarOpen(false)}>
              ×
            </button>
          </div>
          <div className="drafts-list">
            {drafts.length > 0 ? (
              drafts.map((d) => (
                <div
                  key={d.id}
                  className={`draft-item ${d.id === currentDraftId ? 'active' : ''}`}
                  onClick={() => {
                    loadDraft(d.id);
                    if (window.innerWidth <= 768) setSidebarOpen(false);
                  }}
                >
                  <span className="draft-title">{escapeHtml(d.title)}</span>
                  <span className="draft-time">{d.lastEdited}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '16px', color: '#888', textAlign: 'center' }}>
                No drafts yet
              </div>
            )}
          </div>
        </div>

        {/* Main Writing Area */}
        <div className="writing-main">
          <div className="writing-header">
            <input
              type="text"
              ref={titleRef}
              placeholder="Untitled Draft"
              defaultValue="Untitled Draft"
              id="draft-title"
            />
            <button className="mobile-drafts-toggle" onClick={() => setSidebarOpen(true)}>
              Drafts
            </button>
            <div className="ai-controls-group">
              <div className="ai-controls-top">
                <button className="btn ai-btn" onClick={handleGenerateSpark}>
                  ✨ Spark
                </button>
                <button className="btn ai-btn" onClick={handleRewriteSelection}>
                  🧠 Rewrite
                </button>
                <button className="btn ai-btn" onClick={handleAdjustTone}>
                  🎭 Tone
                </button>
              </div>
              <div className="ai-controls-bottom">
                <button className="btn ai-btn" onClick={handleExpandText}>
                  📈 Expand
                </button>
                <button className="btn ai-btn" onClick={handleCondenseText}>
                  📉 Condense
                </button>
              </div>
            </div>
            <div className="header-actions">
              <div className="history-controls">
                <button className="btn history-btn" onClick={undo} title="Undo (Ctrl+Z)">
                  ↩️
                </button>
                <button className="btn history-btn" onClick={redo} title="Redo (Ctrl+Y)">
                  ↪️
                </button>
              </div>
              <span className={`autosave-status autosave-${autosaveStatusType}`}>{autosaveStatus}</span>
              <button
                className="btn"
                onClick={async () => {
                  if (!currentDraftId) {
                    showToast('Save your draft first', 'info');
                    return;
                  }
                  const userId = await getCurrentUserId();
                  if (!userId) {
                    showToast('Log in to save versions', 'info');
                    return;
                  }
                  const content = canvasRef.current?.textContent || '';
                  const { error } = await supabase.from('versions').insert({ draft_id: currentDraftId, content });
                  if (error) showToast('Version failed', 'error');
                  else showToast('Version saved', 'success');
                }}
              >
                💾 Version
              </button>
            </div>
          </div>
          <div
            ref={canvasRef}
            contentEditable
            className="writing-canvas"
            data-placeholder="Start writing your masterpiece…"
            onInput={handleInput}
            // We no longer need onSelect, onMouseUp, etc. for AI logic
          >
          </div>
          <div className="writing-footer">
            <span>{wordCount} words</span>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              padding: '12px 20px',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 500,
              backgroundColor:
                toast.type === 'success'
                  ? '#4caf50'
                  : toast.type === 'error'
                  ? '#f44336'
                  : '#2196f3',
              zIndex: 1001,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
    </PageWithChrome>
  );
}