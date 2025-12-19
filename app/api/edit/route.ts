// app/api/edit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { splitIntoChunks } from '@/lib/chunking';
import { getSystemPrompt } from '@/lib/ai';

const ALLOWED_MODELS = [
  'mistralai/devstral-2512:free',
  'kwaipilot/kat-coder-pro:free',
  'anthropic/claude-3.5-sonnet:free',
  'google/gemini-flash-1.5-8b:free'
];

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      input,
      instruction,
      model: preferredModel,
      editLevel,
      useEditorialBoard = false,
    } = body;

    if (!instruction?.trim()) {
      return NextResponse.json({ error: 'Instruction required' }, { status: 400 });
    }
    if (editLevel !== 'generate' && !input?.trim()) {
      return NextResponse.json({ error: 'Input required' }, { status: 400 });
    }

    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
    }

    const wordCount = input.trim().split(/\s+/).length;
    let editedText: string;

    if (wordCount >= 1000) {
      // ✅ PARALLEL LARGE-DOC EDITING ACROSS ALL FREE MODELS
      const chunks = splitIntoChunks(input);
      const chunkPromises = chunks.map(async (chunk, index) => {
        const model = ALLOWED_MODELS[index % ALLOWED_MODELS.length]; // round-robin
        try {
          if (useEditorialBoard) {
            return await runSelfRefinementLoop(chunk, instruction, model, OPENROUTER_API_KEY, 0.7);
          } else {
            return await callModelWithTemp(chunk, instruction, model, editLevel, OPENROUTER_API_KEY, 0.7, false);
          }
        } catch (err) {
          console.warn(`Chunk ${index} failed on ${model}:`, (err as Error)?.message || err);
          return chunk; // fallback: keep original if edit fails
        }
      });

      const editedChunks = await Promise.all(chunkPromises);
      editedText = editedChunks.join('\n\n');
    } else {
      // Small doc: use preferred or fallback model
      const modelsToTry = [preferredModel, ...ALLOWED_MODELS.filter(m => m !== preferredModel)];
      let success = false;
      let tempEdited = '';

      for (const model of modelsToTry) {
        try {
          if (useEditorialBoard) {
            tempEdited = await runSelfRefinementLoop(input, instruction, model, OPENROUTER_API_KEY, 0.7);
          } else {
            tempEdited = await callModelWithTemp(input, instruction, model, editLevel, OPENROUTER_API_KEY, 0.7, false);
          }
          success = true;
          break;
        } catch (err) {
          console.warn(`Model ${model} failed:`, (err as Error)?.message || err);
        }
      }

      if (!success) {
        throw new Error('All models failed for small document');
      }
      editedText = tempEdited;
    }

    const { html: trackedHtml, changes } = generateTrackedChanges(input || '', editedText);

    return NextResponse.json({
      editedText,
      trackedHtml,
      changes,
      usedModel: 'parallel-free-models'
    });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('❌ Edit API error:', errorMessage);
    return NextResponse.json({ error: errorMessage || 'Internal server error' }, { status: 500 });
  }
}