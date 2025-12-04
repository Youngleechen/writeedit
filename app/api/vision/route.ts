// app/api/vision/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60; // Optional: increase if needed
export const runtime = 'edge'; // Optional: can remove if not using Edge

export async function POST(req: NextRequest) {
  const { imageBase64, prompt } = await req.json();

  if (!imageBase64 || !prompt) {
    return NextResponse.json(
      { error: 'Missing image or prompt' },
      { status: 400 }
    );
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: 'Server misconfiguration: missing API key' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.get('origin') || 'https://beforerepublishing.vercel.app',
        'X-Title': 'Vision Test - Before Publishing',
      },
      body: JSON.stringify({
        model: 'nvidia/nemotron-nano-12b-v2-vl:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Vision API error:', data);
      return NextResponse.json(
        {
          error: 'Vision analysis failed',
          details: data.error?.message || 'Unknown error',
        },
        { status: response.status }
      );
    }

    const answer = data.choices?.[0]?.message?.content?.trim() || 'No response.';
    return NextResponse.json({ answer });
  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}