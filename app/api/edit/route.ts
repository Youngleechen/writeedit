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

// Timeout constants
const MODEL_REQUEST_TIMEOUT = 30000; // 30 seconds per model request
const CHUNK_PROCESSING_TIMEOUT = 60000; // 60 seconds for chunked processing
const MAX_RETRIES = 2; // Max retries for transient errors
const CHUNK_MAX_RETRIES = 3; // More retries for chunked processing

export async function POST(req: NextRequest) {
  try {
    // Set a reasonable timeout for the entire request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes total timeout
    
    try {
      return await processRequest(req, controller.signal);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Edit API error:', errorMessage);
    return NextResponse.json({ error: errorMessage || 'Internal error' }, { status: 500 });
  }
}

async function processRequest(req: NextRequest, signal: AbortSignal) {
  const body = await req.json();
  const {
    input,
    instruction,
    model: preferredModel,
    editLevel,
    useEditorialBoard = false,
    numVariations = 1
  } = body;

  // Clamp numVariations between 1 and 3 (to control cost/latency)
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

  // Calculate document size for adaptive processing
  const wordCount = input?.trim().split(/\s+/).length || 0;
  const isLargeDocument = wordCount >= 1000;
  
  console.log(`📝 Processing ${isLargeDocument ? 'large' : 'standard'} document with ${wordCount} words`);

  // For very large documents, force single variation to prevent timeouts/costs
  const effectiveVariationCount = isLargeDocument ? 1 : variationCount;
  
  for (const model of modelOrder) {
    try {
      console.log(`🚀 Attempting model: ${model}`);
      
      if (isLargeDocument) {
        console.log('📚 Processing large document with chunking');
        // Use a separate timeout controller for chunked processing
        const chunkController = new AbortController();
        const chunkTimeout = setTimeout(() => chunkController.abort(), CHUNK_PROCESSING_TIMEOUT);
        
        try {
          const single = await processChunkedEditWithModel(
            input || '',
            instruction,
            model,
            editLevel,
            useEditorialBoard,
            OPENROUTER_API_KEY,
            chunkController.signal
          );
          variationsResult = [single];
        } finally {
          clearTimeout(chunkTimeout);
        }
      } else {
        console.log(`✨ Generating ${effectiveVariationCount} variations`);
        // Process variations sequentially to avoid overwhelming the API
        const variations: string[] = [];
        
        for (let i = 0; i < effectiveVariationCount; i++) {
          try {
            // Slightly different temperature per variation for diversity
            const temperature = 0.7 + (i * 0.2);
            const variation = await callModelWithTemp(
              input || '',
              instruction,
              model,
              editLevel,
              OPENROUTER_API_KEY,
              temperature,
              useEditorialBoard,
              signal
            );
            variations.push(variation.trim());
          } catch (variationError) {
            console.warn(`⚠️ Variation ${i+1} failed:`, variationError instanceof Error ? variationError.message : String(variationError));
            // Don't fail the whole request if one variation fails
            if (i === 0) {
              throw variationError; // First variation is critical
            }
          }
        }
        
        // Dedupe & filter empty
        const unique = [...new Set(variations)].filter(Boolean);
        variationsResult = unique.length > 0 ? unique : [variations[0]];
      }
      
      usedModel = model;
      console.log(`✅ Successfully processed with model: ${model}`);
      break;
    } catch (err) {
      lastError = err;
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Model ${model} failed:`, errorMessage);
      
      // If this is the last model, we'll use the error after the loop
      if (model === modelOrder[modelOrder.length - 1]) {
        console.error('❌ All models failed. Last error:', errorMessage);
      }
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
}

// --- Enhanced callModel with timeout and retry logic ---
async function callModelWithTemp(
  text: string,
  instruction: string,
  model: string,
  editLevel: string,
  apiKey: string,
  temperature: number,
  useEditorialBoard: boolean,
  signal?: AbortSignal
): Promise<string> {
  if (useEditorialBoard) {
    return runSelfRefinementLoop(text, instruction, model, apiKey, temperature, signal);
  }
  
  const system = getSystemPrompt(editLevel as any, instruction);
  
  // Retry with exponential backoff
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🧠 Calling model ${model} (attempt ${attempt}/${MAX_RETRIES})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MODEL_REQUEST_TIMEOUT);
      
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: signal || controller.signal,
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
            // Some models require this for non-determinism
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
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      if (attempt < MAX_RETRIES) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${delay}ms due to error:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('Failed to get response from model after retries');
}

// --- Updated self-refinement with retry support ---
async function runSelfRefinementLoop(
  original: string,
  instruction: string,
  model: string,
  apiKey: string,
  baseTemp: number,
  signal?: AbortSignal
): Promise<string> {
  // Single retry for the entire refinement loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let current = await callModelWithTemp(
        original, 
        instruction, 
        model, 
        'custom', 
        apiKey, 
        baseTemp, 
        false,
        signal
      );
      
      const prompt2 = `Original: "${original}"\nYour edit: "${current}"\nReview your work. Fix errors. Return ONLY improved text.`;
      current = await callModelWithTemp(
        prompt2, 
        'Self-review', 
        model, 
        'custom', 
        apiKey, 
        Math.min(1.0, baseTemp + 0.1), 
        false,
        signal
      );
      
      const prompt3 = `Original: "${original}"\nCurrent: "${current}"\nFinal check. Return ONLY final text.`;
      current = await callModelWithTemp(
        prompt3, 
        'Final polish', 
        model, 
        'custom', 
        apiKey, 
        Math.min(1.0, baseTemp + 0.2), 
        false,
        signal
      );
      
      return current;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.log(`🔄 Retrying self-refinement loop (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Self-refinement loop failed after retries');
}

// --- Enhanced Chunked Processing with resilience ---
async function processChunkedEditWithModel(
  input: string,
  instruction: string,
  model: string,
  editLevel: string,
  useEditorialBoard: boolean,
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const chunks = splitIntoChunks(input);
  console.log(`🗂️ Processing document in ${chunks.length} chunks`);
  
  const editedChunks: string[] = [];
  let completedChunks = 0;
  
  // Process chunks sequentially to avoid overwhelming the API
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    let edited: string;
    let attempt = 1;
    let lastError: Error | null = null;
    
    console.log(`🧩 Processing chunk ${chunkIndex + 1}/${chunks.length} (words: ${chunk.split(/\s+/).length})`);
    
    while (attempt <= CHUNK_MAX_RETRIES) {
      try {
        if (signal?.aborted) {
          throw new Error('Processing aborted by timeout');
        }
        
        if (useEditorialBoard) {
          edited = await runSelfRefinementLoop(
            chunk, 
            instruction, 
            model, 
            apiKey, 
            0.7,
            signal
          );
        } else {
          edited = await callModelWithTemp(
            chunk, 
            instruction, 
            model, 
            editLevel, 
            apiKey, 
            0.7, 
            false,
            signal
          );
        }
        
        editedChunks.push(edited);
        completedChunks++;
        console.log(`✅ Chunk ${chunkIndex + 1}/${chunks.length} completed`);
        break; // Success - exit retry loop
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`⚠️ Chunk ${chunkIndex + 1} failed on attempt ${attempt}/${CHUNK_MAX_RETRIES}:`, lastError.message);
        
        if (attempt < CHUNK_MAX_RETRIES) {
          // Add increasing delay between retries
          const delay = 1000 * attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
        } else {
          // If we've exhausted retries for this chunk, use the original text as fallback
          console.error(`❌ Chunk ${chunkIndex + 1} failed after ${CHUNK_MAX_RETRIES} attempts. Using original text.`);
          editedChunks.push(chunk); // Fallback to original chunk
          completedChunks++;
          break;
        }
      }
    }
    
    // Progress update to prevent timeout (Vercel has 60s limit for serverless functions)
    if (chunkIndex > 0 && chunkIndex % 3 === 0) {
      console.log(`📊 Progress: ${completedChunks}/${chunks.length} chunks completed`);
    }
  }
  
  console.log(`✅ Chunk processing complete: ${completedChunks}/${chunks.length} chunks processed`);
  return editedChunks.join('\n\n');
}

// --- DIFF GENERATION (optimized for large documents) ---
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function generateTrackedChanges(original: string, edited: string): { html: string; changes: number } {
  // For very large documents, skip detailed diff to prevent timeouts
  const wordCount = original.split(/\s+/).length;
  if (wordCount > 5000) {
    console.log('⏩ Skipping detailed diff generation for large document');
    return {
      html: `<div style="white-space: pre-wrap;">${escapeHtml(edited)}</div>`,
      changes: 0
    };
  }
  
  // For smaller documents, do the detailed diff
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