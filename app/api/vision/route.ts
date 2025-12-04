// app/api/vision/route.ts
import { NextRequest, NextResponse } from 'next/server';

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

    // 👇 NEW: Check if response is OK before parsing as JSON
    if (!response.ok) {
      const errorText = await response.text(); // Get raw text if JSON fails
      console.error('OpenRouter error:', errorText);
      return NextResponse.json(
        {
          error: 'OpenRouter API error',
          details: errorText || 'Unknown error',
          status: response.status,
        },
        { status: response.status }
      );
    }

    let data;
    try {
      data = await response.json(); // ✅ Now safe to parse
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      return NextResponse.json(
        {
          error: 'Invalid response from OpenRouter',
          details: 'Response was not valid JSON',
          raw: await response.text(), // Include raw response for debugging
        },
        { status: 502 }
      );
    }

    // Validate structure
    if (!data.choices?.[0]?.message?.content) {
      return NextResponse.json(
        {
          error: 'Unexpected response format',
          details: 'No answer found in AI response',
        },
        { status: 500 }
      );
    }

    const answer = data.choices[0].message.content.trim();
    return NextResponse.json({ answer });

  } catch (err: any) {
    console.error('Server error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    );
  }
}