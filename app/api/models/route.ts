// app/api/models/route.ts
import { NextResponse } from 'next/server';

const ALLOWED_MODELS = [
  { id: 'x-ai/grok-4.1-fast:free', name: 'Grok 4.1 (Fast & Accurate)' },
  { id: 'anthropic/claude-3.5-sonnet:free', name: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-flash-1.5-8b:free', name: 'Gemini Flash 1.5' },
];

export async function GET() {
  return NextResponse.json(ALLOWED_MODELS);
}