// app/api/edit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getSystemPrompt } from '@/lib/ai';

const ALLOWED_MODELS = [
    'alibaba/tongyi-deepresearch-30b-a3b:free',
  'kwaipilot/kat-coder-pro:free',
  'anthropic/claude-3.5-sonnet:free',
  'google/gemini-flash-1.5-8b:free'
];

// Helper: call model with timeout and signal
async function callModelWithTemp(
  text: string,
  instruction: string,
  model: string,
  editLevel: string,
  apiKey: string,
  temperature: number,
  signal: AbortSignal
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
      temperature,
      top_p: temperature > 0.8 ? 0.95 : 0.9
    }),
    signal
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const errorMsg = `HTTP ${res.status} ${res.statusText}: ${errText}`;
    throw new Error(`OpenRouter error: ${errorMsg}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Model returned empty content');
  }
  return content;
}

// Updated self-refinement with signal support
async function runSelfRefinementLoop(
  original: string,
  instruction: string,
  model: string,
  apiKey: string,
  baseTemp: number,
  signal: AbortSignal
): Promise<string> {
  let current = await callModelWithTemp(original, instruction, model, 'custom', apiKey, baseTemp, signal);
  const prompt2 = `Original: "${original}"\nYour edit: "${current}"\nReview your work. Fix errors. Return ONLY improved text.`;
  current = await callModelWithTemp(prompt2, 'Self-review', model, 'custom', apiKey, Math.min(1.0, baseTemp + 0.1), signal);
  const prompt3 = `Original: "${original}"\nCurrent: "${current}"\nFinal check. Return ONLY final text.`;
  current = await callModelWithTemp(prompt3, 'Final polish', model, 'custom', apiKey, Math.min(1.0, baseTemp + 0.2), signal);
  return current;
}

// Chunked processing with timeout support
async function processChunkedEditWithModel(
  input: string,
  instruction: string,
  model: string,
  editLevel: string,
  useEditorialBoard: boolean,
  apiKey: string,
  signal: AbortSignal
): Promise<string> {
  const chunks = splitIntoChunks(input);
  const editedChunks: string[] = [];

  for (const chunk of chunks) {
    let edited: string;
    if (useEditorialBoard) {
      edited = await runSelfRefinementLoop(chunk, instruction, model, apiKey, 0.7, signal);
    } else {
      edited = await callModelWithTemp(chunk, instruction, model, editLevel, apiKey, 0.7, signal);
    }
    editedChunks.push(edited);
  }

  return editedChunks.join('\n\n');
}

// Diff generation (unchanged)
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

// Main POST handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      input,
      instruction,
      model: preferredModel,
      editLevel,
      useEditorialBoard = false,
      numVariations = 1
    } = body;

    const variationCount = Math.min(3, Math.max(1, Math.floor(numVariations)));

    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'Instruction required' }, { status: 400 });
    }

    if (editLevel !== 'generate' && !input?.trim()) {
      return NextResponse.json({ error: 'Input required' }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    const modelOrder = [
      preferredModel,
      ...ALLOWED_MODELS.filter(m => m !== preferredModel)
    ].filter(m => ALLOWED_MODELS.includes(m));

    let variationsResult: string[] | null = null;
    let usedModel: string | null = null;
    const modelErrors: Record<string, string> = {};
    let lastError: unknown = null;

    for (const model of modelOrder) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

      try {
        const wordCount = input?.trim().split(/\s+/).length || 0;
        let result: string[];

        if (wordCount >= 1000) {
          const single = await processChunkedEditWithModel(
            input || '',
            instruction,
            model,
            editLevel,
            useEditorialBoard,
            OPENROUTER_API_KEY,
            controller.signal
          );
          result = [single];
        } else {
          const promises = [];
          for (let i = 0; i < variationCount; i++) {
            const temperature = 0.7 + (i * 0.2);
            if (useEditorialBoard) {
              promises.push(
                runSelfRefinementLoop(
                  input || '',
                  instruction,
                  model,
                  OPENROUTER_API_KEY,
                  temperature,
                  controller.signal
                )
              );
            } else {
              promises.push(
                callModelWithTemp(
                  input || '',
                  instruction,
                  model,
                  editLevel,
                  OPENROUTER_API_KEY,
                  temperature,
                  controller.signal
                )
              );
            }
          }
          const results = await Promise.all(promises);
          const unique = [...new Set(results.map(r => r.trim()))].filter(Boolean);
          result = unique.length > 0 ? unique : [results[0]];
        }

        variationsResult = result;
        usedModel = model;
        clearTimeout(timeoutId);
        break; // success — exit loop
      } catch (err) {
        clearTimeout(timeoutId);
        const errorMessage = err instanceof Error
          ? err.name === 'AbortError'
            ? `Model ${model} timed out after 8 seconds`
            : err.message
          : String(err);
        modelErrors[model] = errorMessage;
        lastError = err;
        console.warn(`⚠️ Model ${model} failed:`, errorMessage);
      }
    }

    if (variationsResult === null) {
      console.error('❌ All models failed', { modelErrors, lastError });
      return NextResponse.json(
        {
          error: 'All AI models failed. Check modelErrors for details.',
          modelErrors,
          lastError: lastError instanceof Error ? lastError.message : String(lastError)
        },
        { status: 500 }
      );
    }

    const primary = variationsResult[0];
    const { html: trackedHtml, changes } = generateTrackedChanges(input || '', primary);

    return NextResponse.json({
      editedText: primary,
      variations: variationsResult,
      trackedHtml,
      changes,
      usedModel,
      variationCount: variationsResult.length
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Top-level Edit API error:', {
      error: errorMessage,
      stack: err instanceof Error ? err.stack : undefined
    });
    return NextResponse.json({ error: errorMessage || 'Internal server error' }, { status: 500 });
  }
}