import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// This is a simplified version - in production, add proper validation
export async function POST(request: Request) {
  try {
    const { documentName, content, editLevel, customInstruction } = 
      await request.json();

    // Validate input
    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Save to database using service role key (never exposed to client)
    const { data, error } = await supabase
      .from('documents')
      .insert([
        {
          name: documentName || `Document ${Date.now()}`,
          original_text: content,
          edit_level: editLevel || 'proofread',
          custom_instruction: customInstruction || null,
          user_id: 'public-user', // In real app: get from auth
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, documentId: data.id });
  } catch (error) {
    console.error('Document save error:', error);
    return NextResponse.json(
      { error: 'Failed to save document' },
      { status: 500 }
    );
  }
}