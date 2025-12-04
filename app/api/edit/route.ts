// app/api/edit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getSystemPrompt } from '@/lib/ai';

const ALLOWED_MODELS = [
  'x-ai/grok-4.1-fast:free',
  'alibaba/tongyi-deepresearch-30b-a3b:free',
  'kwaipilot/kat-coder-pro:free',
  'anthropic/claude-3.5-sonnet:free',
  'google/gemini-flash-1.5-8b:free'
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      input,
      instruction,
      model: preferredModel,
      editLevel,
      useEditorialBoard = false
    } = body;

    if (!input?.trim()) return NextResponse.json({ error: 'Input required' }, { status: 400 });
    if (!instruction?.trim()) return NextResponse.json({ error: 'Instruction required' }, { status: 400 });

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) return NextResponse.json({ error: 'Server config error' }, { status: 500 });

    // Build fallback order: preferred first, then others (no duplicates)
    const modelOrder = [
      preferredModel,
      ...ALLOWED_MODELS.filter(m => m !== preferredModel)
    ].filter(m => ALLOWED_MODELS.includes(m));

    let finalText: string | null = null;
    let usedModel: string | null = null;
    let lastError: unknown = null;

    for (const model of modelOrder) {
      try {
        const wordCount = input.trim().split(/\s+/).length;
        if (wordCount >= 1000) {
          finalText = await processChunkedEditWithModel(
            input,
            instruction,
            model,
            editLevel,
            useEditorialBoard,
            OPENROUTER_API_KEY
          );
        } else {
          if (useEditorialBoard) {
            finalText = await runSelfRefinementLoop(input, instruction, model, OPENROUTER_API_KEY);
          } else {
            finalText = await callModel(input, instruction, model, editLevel, OPENROUTER_API_KEY);
          }
        }
        usedModel = model;
        break; // Success
      } catch (err) {
        lastError = err;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ Model ${model} failed:`, errorMessage);
        // Continue to next model
      }
    }

    if (finalText === null) {
      const fallbackError = lastError instanceof Error ? lastError.message : String(lastError);
      return NextResponse.json(
        { error: 'All models failed. Last error: ' + fallbackError },
        { status: 500 }
      );
    }

    const { html: trackedHtml, changes } = generateTrackedChanges(input, finalText);

    return NextResponse.json({
      editedText: finalText,
      trackedHtml,
      changes,
      usedModel
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Edit API error:', errorMessage);
    return NextResponse.json({ error: errorMessage || 'Internal error' }, { status: 500 });
  }
}

// --- Core AI Functions ---

async function callModel(
  text: string,
  instruction: string,
  model: string,
  editLevel: string,
  apiKey: string
): Promise<string> {
  const system = getSystemPrompt(editLevel as any, instruction);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://beforepublishing.vercel.app',
      'X-Title': 'Before Publishing'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: text }
      ],
      max_tokens: 1000,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const errorMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(errorMsg);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Model returned empty content');
  }
  return content;
}

async function runSelfRefinementLoop(
  original: string,
  instruction: string,
  model: string,
  apiKey: string
): Promise<string> {
  let current = await callModel(original, instruction, model, 'custom', apiKey);
  const prompt2 = `Original: "${original}"\nYour edit: "${current}"\nReview your work. Fix errors. Return ONLY improved text.`;
  current = await callModel(prompt2, 'Self-review', model, 'custom', apiKey);
  const prompt3 = `Original: "${original}"\nCurrent: "${current}"\nFinal check. Return ONLY final text.`;
  current = await callModel(prompt3, 'Final polish', model, 'custom', apiKey);
  return current;
}

// --- Chunked Processing (returns string only) ---

async function processChunkedEditWithModel(
  input: string,
  instruction: string,
  model: string,
  editLevel: string,
  useEditorialBoard: boolean,
  apiKey: string
): Promise<string> {
  const chunks = splitIntoChunks(input);
  const editedChunks: string[] = [];

  for (const chunk of chunks) {
    let edited: string;
    if (useEditorialBoard) {
      edited = await runSelfRefinementLoop(chunk, instruction, model, apiKey);
    } else {
      edited = await callModel(chunk, instruction, model, editLevel, apiKey);
    }
    editedChunks.push(edited);
  }

  return editedChunks.join('\n\n');
}

// --- DIFF GENERATION ---

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;'); // ← Fixed: no space before /g
}

function generateTrackedChanges(original: string, edited: string): { html: string; changes: number } {
  const words1 = original.split(/\s+/);
  const words2 = edited.split(/\s+/);
  const html: string[] = [];
  let i = 0, j = 0;
  let changes = 0;

  while (i < words1.length || j < words2.length) {
    if (i < words1.length && j < words2.length && words1[i] === words2[j]) {
      html.push(escapeHtml(words1[i]));
      i++;
      j++;
    } else {
      const startI = i;
      const startJ = j;
      while (
        (i < words1.length && j < words2.length && words1[i] !== words2[j]) ||
        (i < words1.length && j >= words2.length) ||
        (i >= words1.length && j < words2.length)
      ) {
        if (i < words1.length) i++;
        if (j < words2.length) j++;
      }
      const deleted = words1.slice(startI, i).map(escapeHtml).join(' ');
      const inserted = words2.slice(startJ, j).map(escapeHtml).join(' ');
      if (deleted || inserted) {
        changes++;
        let group = '';
        if (deleted) group += `<del>${deleted}</del>`;
        if (inserted) group += `<ins>${inserted}</ins>`;
        html.push(`<span class="change-group">${group}</span>`);
      }
    }
  }

  return {
    html: `<div style="white-space: pre-wrap;">${html.join(' ')}</div>`,
    changes
  };
}