// app/api/edit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getSystemPrompt } from '@/lib/ai';

// --- NEW: Import Job Queue System ---
// You will need to set up a simple job queue. For simplicity, we'll use an in-memory array.
// In production, use Redis, BullMQ, or a managed service like Upstash Queue.
const jobQueue: {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  result?: {
    editedText: string;
    variations: string[];
    trackedHtml: string;
    changes: number;
    usedModel: string;
    variationCount: number;
  };
  error?: string;
}[] = [];

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

    // Validate inputs (same as before)
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

    // Generate a unique job ID
    const jobId = crypto.randomUUID();

    // Enqueue the job
    jobQueue.push({
      id: jobId,
      status: 'queued',
    });

    // Start processing in the background
    processJob(jobId, {
      input,
      instruction,
      preferredModel,
      editLevel,
      useEditorialBoard,
      numVariations,
      OPENROUTER_API_KEY
    }).catch(err => {
      console.error(`❌ Job ${jobId} failed:`, err);
      const jobIndex = jobQueue.findIndex(j => j.id === jobId);
      if (jobIndex !== -1) {
        jobQueue[jobIndex].status = 'failed';
        jobQueue[jobIndex].error = err instanceof Error ? err.message : String(err);
      }
    });

    // Immediately respond with the job ID
    return NextResponse.json({
      jobId,
      message: 'Processing started. Poll /api/edit/status?jobId=YOUR_JOB_ID to check status.'
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Edit API error:', errorMessage);
    return NextResponse.json({ error: errorMessage || 'Internal error' }, { status: 500 });
  }
}

// --- NEW: GET endpoint to check job status ---
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId parameter is required' }, { status: 400 });
  }

  const job = jobQueue.find(j => j.id === jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}

// --- NEW: Background Job Processor ---
async function processJob(
  jobId: string,
  params: {
    input: string;
    instruction: string;
    preferredModel: string;
    editLevel: string;
    useEditorialBoard: boolean;
    numVariations: number;
    OPENROUTER_API_KEY: string;
  }
) {
  const {
    input,
    instruction,
    preferredModel,
    editLevel,
    useEditorialBoard,
    numVariations,
    OPENROUTER_API_KEY
  } = params;

  const ALLOWED_MODELS = [
    'x-ai/grok-4.1-fast:free',
    'alibaba/tongyi-deepresearch-30b-a3b:free',
    'kwaipilot/kat-coder-pro:free',
    'anthropic/claude-3.5-sonnet:free',
    'google/gemini-flash-1.5-8b:free'
  ];

  const modelOrder = [
    preferredModel,
    ...ALLOWED_MODELS.filter(m => m !== preferredModel)
  ].filter(m => ALLOWED_MODELS.includes(m));

  let variationsResult: string[] | null = null;
  let usedModel: string | null = null;
  let lastError: unknown = null;

  // Find the job in the queue and update its status
  const jobIndex = jobQueue.findIndex(j => j.id === jobId);
  if (jobIndex === -1) {
    throw new Error('Job not found in queue');
  }
  jobQueue[jobIndex].status = 'processing';

  try {
    for (const model of modelOrder) {
      try {
        const wordCount = input?.trim().split(/\s+/).length || 0;
        if (wordCount >= 1000) {
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
          const promises = [];
          for (let i = 0; i < Math.min(3, Math.max(1, Math.floor(numVariations))); i++) {
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
      throw new Error('All models failed. Last error: ' + (lastError instanceof Error ? lastError.message : String(lastError)));
    }

    const primary = variationsResult[0];
    const { html: trackedHtml, changes } = generateTrackedChanges(input || '', primary);

    // Update the job with the result
    jobQueue[jobIndex].status = 'completed';
    jobQueue[jobIndex].result = {
      editedText: primary,
      variations: variationsResult,
      trackedHtml,
      changes,
      usedModel: usedModel || 'unknown',
      variationCount: variationsResult.length
    };

  } catch (err) {
    // Update the job with the error
    jobQueue[jobIndex].status = 'failed';
    jobQueue[jobIndex].error = err instanceof Error ? err.message : String(err);
  }
}

// --- The rest of your functions remain unchanged ---

async function callModelWithTemp(
  text: string,
  instruction: string,
  model: string,
  editLevel: string,
  apiKey: string,
  temperature: number,
  useEditorialBoard: boolean
): Promise<string> {
  if (useEditorialBoard) {
    return runSelfRefinementLoop(text, instruction, model, apiKey, temperature);
  }
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
      edited = await runSelfRefinementLoop(chunk, instruction, model, apiKey, 0.7);
    } else {
      edited = await callModelWithTemp(chunk, instruction, model, editLevel, apiKey, 0.7, false);
    }
    editedChunks.push(edited);
  }

  return editedChunks.join('\n\n');
}

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