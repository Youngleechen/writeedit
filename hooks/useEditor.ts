// /hooks/useEditor.ts
'use client';

import { useState, useEffect } from 'react';

export type EditLevel = 'proofread' | 'rewrite' | 'formal' | 'custom' | 'generate';

export interface EditorState {
  inputText: string;
  editedText: string;
  trackedHtml: string;
  changeCount: number;
  editLevel: EditLevel;
  customInstruction: string;
  selectedModel: string;
  isLoading: boolean;
  error: string | null;
  viewMode: 'clean' | 'tracked';
  isEditorialBoard: boolean;
  documentId: string | null;
  wordCount: number;
}

const DEFAULT_MODEL = 'x-ai/grok-4.1-fast:free';

export function useEditor() {
  const [state, setState] = useState<EditorState>({
    inputText: '',
    editedText: '',
    trackedHtml: '',
    changeCount: 0,
    editLevel: 'proofread',
    customInstruction: '',
    selectedModel: DEFAULT_MODEL,
    isLoading: false,
    error: null,
    viewMode: 'clean',
    isEditorialBoard: false,
    documentId: null,
    wordCount: 0,
  });

  // Auto-update word count
  useEffect(() => {
    const words = state.inputText.trim()
      ? state.inputText.trim().split(/\s+/).filter(Boolean).length
      : 0;
    if (state.wordCount !== words) {
      setState((prev) => ({ ...prev, wordCount: words }));
    }
  }, [state.inputText]);

  // --- Setters ---
  const setInputText = (text: string) =>
    setState((prev) => ({ ...prev, inputText: text }));

  const setEditedText = (text: string) =>
    setState((prev) => ({ ...prev, editedText: text }));

  const setEditLevel = (level: EditLevel) =>
    setState((prev) => ({ ...prev, editLevel: level }));

  const setCustomInstruction = (instruction: string) =>
    setState((prev) => ({ ...prev, customInstruction: instruction }));

  const setSelectedModel = (model: string) =>
    setState((prev) => ({ ...prev, selectedModel: model }));

  const setIsEditorialBoard = (enabled: boolean) =>
    setState((prev) => ({ ...prev, isEditorialBoard: enabled }));

  const setViewMode = (mode: 'clean' | 'tracked') =>
    setState((prev) => ({ ...prev, viewMode: mode }));

  const setDocumentId = (id: string | null) =>
    setState((prev) => ({ ...prev, documentId: id }));

  // --- Load a full document
  const loadDocument = (
    documentId: string,
    docData: {
      originalText: string;
      editedText: string;
      level?: string;
      model?: string;
      customInstruction?: string;
    }
  ) => {
    console.log('[useEditor] loadDocument called with:', {
      documentId,
      originalTextLength: docData.originalText?.length || 0,
      editedTextLength: docData.editedText?.length || 0,
    });

    setState((prev) => ({
      ...prev,
      inputText: docData.originalText || '',
      editedText: docData.editedText || '',
      trackedHtml: '',
      changeCount: 0,
      editLevel: (docData.level as EditLevel) || 'proofread',
      customInstruction: docData.customInstruction || '',
      selectedModel: docData.model || DEFAULT_MODEL,
      isLoading: false,
      error: null,
      viewMode: 'tracked',
      isEditorialBoard: false,
      documentId: documentId,
      wordCount:
        docData.originalText?.trim()?.split(/\s+/)?.filter(Boolean)?.length || 0,
    }));
  };

  const reset = () => {
    setState({
      inputText: '',
      editedText: '',
      trackedHtml: '',
      changeCount: 0,
      editLevel: 'proofread',
      customInstruction: '',
      selectedModel: DEFAULT_MODEL,
      isLoading: false,
      error: null,
      viewMode: 'clean',
      isEditorialBoard: false,
      documentId: null,
      wordCount: 0,
    });
  };

  // --- Apply Edit via API
  const applyEdit = async () => {
    const { inputText, editLevel, customInstruction, selectedModel, isEditorialBoard } = state;

    if (!inputText.trim()) {
      setState((prev) => ({ ...prev, error: 'Please enter text to edit.' }));
      return;
    }

    if (editLevel === 'custom' && !customInstruction.trim()) {
      setState((prev) => ({ ...prev, error: 'Custom instruction is required.' }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const res = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputText,
          instruction: customInstruction || getInstructionForLevel(editLevel),
          model: selectedModel,
          editLevel,
          useEditorialBoard: isEditorialBoard,
          documentId: state.documentId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Edit failed');
      }

      const result = await res.json();
      setState((prev) => ({
        ...prev,
        editedText: result.editedText,
        trackedHtml: result.trackedHtml,
        changeCount: result.changeCount,
        isLoading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({ ...prev, isLoading: false, error: err.message }));
    }
  };

  return {
    ...state,
    setInputText,
    setEditedText,
    setEditLevel,
    setCustomInstruction,
    setSelectedModel,
    setIsEditorialBoard,
    setViewMode,
    setDocumentId,
    loadDocument,
    applyEdit,
    reset,
  };
}

function getInstructionForLevel(level: EditLevel): string {
  switch (level) {
    case 'proofread':
      return 'Fix spelling/grammar ONLY. Preserve tone. Return text.';
    case 'rewrite':
      return 'Improve clarity and flow while preserving core meaning.';
    case 'formal':
      return 'Convert to professional, formal tone. Remove slang and contractions.';
    case 'custom':
      return '';
    case 'generate':
      return 'Generate a complete blog post.';
    default:
      return '';
  }
}