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

// Vercel has a 10s timeout for Hobby plan, 60s for Pro
// We'll set our timeout to 25s to leave room for processing
const API_TIMEOUT = 25000; // 25 seconds
const MAX_RETRIES = 2;
const BASE_DELAY = 1000; // 1 second

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

    // Clamp numVariations between 1 and 3
    const variationCount = Math.min(3, Math.max(1, Math.floor(numVariations)));

    // Instruction is always required
    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'Instruction required' }, { status: 400 });
    }

    // Input is only required for editing (not for generation like "Spark")
    if (editLevel !== 'generate' && !input?.trim()) {
      return NextResponse.json({ error: 'Input required' }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Server config error' }, { status: 500 });
    }

    // Build fallback order: preferred first, then others
    const modelOrder = [
      preferredModel,
      ...ALLOWED_MODELS.filter(m => m !== preferredModel)
    ].filter(m => ALLOWED_MODELS.includes(m));

    let variationsResult: string[] | null = null;
    let usedModel: string | null = null;
    let lastError: unknown = null;

    for (const model of modelOrder) {
      try {
        const wordCount = input?.trim().split(/\s+/).length || 0;
        if (wordCount >= 1000) {
          // For large docs, we don't support variations
          const single = await processChunkedEditWithModel(
            input || '',
            instruction,
            model,
            editLevel,
            useEditorialBoard,
            OPENROUTER_API_KEY
          );
          variationsResult = [single];
        } else {
          // Generate multiple variations
          const promises = [];
          for (let i = 0; i < variationCount; i++) {
            const temperature = 0.7 + (i * 0.2);
            promises.push(
              callModelWithTemp(
                input || '',
                instruction,
                model,
                editLevel,
                OPENROUTER_API_KEY,
                temperature,
                useEditorialBoard
              )
            );
          }
          const results = await Promise.all(promises);
          const unique = [...new Set(results.map(r => r.trim()))].filter(Boolean);
          variationsResult = unique.length > 0 ? unique : [results[0]];
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

    // For backward compatibility + UI
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
    console.error('❌ Edit API error:', errorMessage);
    return NextResponse.json({ error: errorMessage || 'Internal error' }, { status: 500 });
  }
}

// Updated: callModel now handles timeouts and retries
async function callModelWithTemp(
  text: string,
  instruction: string,
  model: string,
  editLevel: string,
  apiKey: string,
  temperature: number,
  useEditorialBoard: boolean,
  retries = MAX_RETRIES,
  delay = BASE_DELAY
): Promise<string> {
  if (useEditorialBoard) {
    return runSelfRefinementLoop(text, instruction, model, apiKey, temperature);
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

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
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errorMsg = errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      
      // Handle 504 specifically
      if (res.status === 504) {
        throw new Error('OpenRouter API timed out. Please try again.');
      }
      
      throw new Error(errorMsg);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Model returned empty content');
    }
    return content;
  } catch (err) {
    if (retries > 0 && (err instanceof Error) && 
        (err.name === 'AbortError' || err.message.includes('timed out') || 
         err.message.includes('Failed to fetch') || err.message.includes('504'))) {
      
      // Exponential backoff
      const nextDelay = delay * 2;
      console.log(`Timeout error. Retrying in ${nextDelay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, nextDelay));
      
      return callModelWithTemp(
        text, 
        instruction, 
        model, 
        editLevel, 
        apiKey, 
        temperature, 
        useEditorialBoard,
        retries - 1,
        nextDelay
      );
    }
    
    throw err;
  }
}

// Updated self-refinement to accept temperature
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

// Optimized chunked processing with timeout handling
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
  const MAX_CONCURRENT = 2; // Limit concurrent requests to avoid rate limits

  for (let i = 0; i < chunks.length; i++) {
    try {
      let edited: string;
      if (useEditorialBoard) {
        edited = await runSelfRefinementLoop(chunks[i], instruction, model, apiKey, 0.7);
      } else {
        edited = await callModelWithTemp(chunks[i], instruction, model, editLevel, apiKey, 0.7, false);
      }
      editedChunks[i] = edited;
    } catch (err) {
      console.error(`Error processing chunk ${i}:`, err);
      editedChunks[i] = chunks[i]; // Fallback to original chunk on error
    }

    // Add small delay between chunks to avoid rate limits
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return editedChunks.join('\n\n');
}

// --- DIFF GENERATION (unchanged) ---
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