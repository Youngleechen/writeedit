import { NextRequest, NextResponse } from 'next/server';
import { getSystemPrompt } from '@/lib/ai';

const ALLOWED_MODELS = [
  'mistralai/devstral-2512:free',
  'kwaipilot/kat-coder-pro:free',
  'openai/gpt-oss-20b:free',
  'tngtech/deepseek-r1t2-chimera:free'
];

// Maximum words per chunk (optimized for speed + context limits)
const MAX_CHUNK_WORDS = 800;
// Hard limit for single-request processing
const MAX_SINGLE_REQUEST_WORDS = 2000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      input,
      instruction,
      model: preferredModel,
      editLevel,
      useEditorialBoard = false,
      numVariations = 1,
      chunkIndex = -1, // New: -1 means full doc, >=0 means single chunk
      totalChunks = 1   // New: only relevant when chunkIndex >=0
    } = body;

    // Validate instruction
    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'Instruction required' }, { status: 400 });
    }

    // Input required except for generation mode
    if (editLevel !== 'generate' && !input?.trim()) {
      return NextResponse.json({ error: 'Input required' }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    // Determine processing mode
    const isChunkRequest = chunkIndex >= 0;
    const wordCount = input.trim().split(/\s+/).length;
    
    // For chunk requests: disable variations and editorial board
    const effectiveVariations = isChunkRequest ? 1 : Math.min(3, Math.max(1, Math.floor(numVariations)));
    const effectiveEditorial = isChunkRequest ? false : useEditorialBoard;

    // For full documents over limit: reject and force frontend chunking
    if (!isChunkRequest && wordCount > MAX_SINGLE_REQUEST_WORDS) {
      return NextResponse.json({ 
        error: `Document exceeds ${MAX_SINGLE_REQUEST_WORDS} word limit. Please process in chunks.`,
        requiresChunking: true,
        maxChunkWords: MAX_CHUNK_WORDS
      }, { status: 413 });
    }

    // For chunks over limit: reject immediately
    if (isChunkRequest && wordCount > MAX_CHUNK_WORDS * 1.2) { // 20% buffer
      return NextResponse.json({ 
        error: `Chunk exceeds ${MAX_CHUNK_WORDS} word limit. Please split smaller.` 
      }, { status: 413 });
    }

    // Model fallback logic
    const modelOrder = [
      preferredModel,
      ...ALLOWED_MODELS.filter(m => m !== preferredModel)
    ].filter(m => ALLOWED_MODELS.includes(m));

    let variationsResult: string[] | null = null;
    let usedModel: string | null = null;
    let lastError: unknown = null;

    for (const model of modelOrder) {
      try {
        if (effectiveEditorial) {
          // Single-pass with self-refinement
          const refined = await runSelfRefinementLoop(
            input,
            instruction,
            model,
            OPENROUTER_API_KEY,
            effectiveVariations > 1 ? 0.7 : 0.5 // Lower temp for editorial
          );
          variationsResult = [refined];
        } else if (effectiveVariations > 1) {
          // Generate variations
          const promises = Array.from({ length: effectiveVariations }, (_, i) => 
            callModelWithTemp(
              input,
              instruction,
              model,
              editLevel,
              OPENROUTER_API_KEY,
              0.7 + (i * 0.2),
              false
            )
          );
          
          const results = await Promise.all(promises);
          const unique = [...new Set(results.map(r => r.trim()))].filter(Boolean);
          variationsResult = unique.length > 0 ? unique : [results[0]];
        } else {
          // Single variation
          const single = await callModelWithTemp(
            input,
            instruction,
            model,
            editLevel,
            OPENROUTER_API_KEY,
            0.7,
            false
          );
          variationsResult = [single];
        }
        usedModel = model;
        break;
      } catch (err) {
        lastError = err;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.warn(`⚠️ Model ${model} failed:`, errorMessage);
      }
    }

    if (variationsResult === null) {
      const fallbackError = lastError instanceof Error ? lastError.message : String(lastError);
      return NextResponse.json(
        { error: 'All models failed. Last error: ' + fallbackError },
        { status: 500 }
      );
    }

    // Only generate tracked changes for non-chunk requests
    const primary = variationsResult[0];
    const trackedData = isChunkRequest 
      ? { html: primary, changes: 0 }
      : generateTrackedChanges(input, primary);

    return NextResponse.json({
      editedText: primary,
      variations: variationsResult,
      trackedHtml: trackedData.html,
      changes: trackedData.changes,
      usedModel,
      variationCount: variationsResult.length,
      isChunk: isChunkRequest,
      chunkIndex: isChunkRequest ? chunkIndex : undefined,
      totalChunks: isChunkRequest ? totalChunks : undefined
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Edit API error:', errorMessage);
    return NextResponse.json({ error: errorMessage || 'Internal error' }, { status: 500 });
  }
}

// --- Core processing functions (unchanged but simplified) ---
async function callModelWithTemp(
  text: string,
  instruction: string,
  model: string,
  editLevel: string,
  apiKey: string,
  temperature: number,
  useEditorialBoard: boolean
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
      max_tokens: 1200, // Increased for chunk safety
      temperature,
      top_p: temperature > 0.8 ? 0.95 : 0.9
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
  apiKey: string,
  baseTemp: number
): Promise<string> {
  let current = await callModelWithTemp(original, instruction, model, 'custom', apiKey, baseTemp, false);
  const prompt2 = `Original: "${original}"\nYour edit: "${current}"\nReview your work. Fix errors. Return ONLY improved text.`;
  current = await callModelWithTemp(prompt2, 'Self-review', model, 'custom', apiKey, Math.min(1.0, baseTemp + 0.1), false);
  const prompt3 = `Original: "${original}"\nCurrent: "${current}"\nFinal check. Return ONLY final text.`;
  current = await callModelWithTemp(prompt3, 'Final polish', model, 'custom', apiKey, Math.min(1.0, baseTemp + 0.2), false);
  return current;
}

// --- DIFF GENERATION (optimized) ---
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateTrackedChanges(original: string, edited: string): { html: string; changes: number } {
  const words1 = original.split(/\s+/).filter(w => w);
  const words2 = edited.split(/\s+/).filter(w => w);
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
      
      // Find next match within reasonable distance
      const maxLookahead = 10;
      let lookahead = 0;
      while (
        (i < words1.length && j < words2.length && words1[i] !== words2[j]) &&
        lookahead < maxLookahead
      ) {
        if (i < words1.length) i++;
        if (j < words2.length) j++;
        lookahead++;
      }
      
      // If we found a match, step back to process differences
      if (i < words1.length && j < words2.length && words1[i] === words2[j]) {
        i--; j--;
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