// /app/api/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/documents';

const MAX_SAVED_DOCUMENTS = 10;

function generateDocumentId() {
  return 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies(); // ✅ await
  const ownerId = cookieStore.get('editor_owner_id')?.value;
  if (!ownerId) {
    return NextResponse.json({ documents: [] });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(MAX_SAVED_DOCUMENTS);

  if (error) {
    console.error('Supabase fetch error:', error);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }

  return NextResponse.json({ documents: data || [] });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies(); // ✅ await
  let ownerId = cookieStore.get('editor_owner_id')?.value;
  
  const body = await req.json();
  const {
    name,
    originalText,
    editedText,
    level = 'proofread',
    model = 'x-ai/grok-4.1-fast:free',
    customInstruction = '',
  } = body;

  if (!originalText || !editedText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!ownerId) {
    ownerId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  const supabase = createSupabaseServerClient();
  const docId = generateDocumentId();

  const { error } = await supabase.from('documents').insert({
    id: docId,
    owner_id: ownerId,
    name,
    original_text: originalText,
    edited_text: editedText,
    level,
    model,
    custom_instruction: customInstruction,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 });
  }

  // ✅ Set cookie via response
  const response = NextResponse.json({ id: docId, success: true });
  if (!cookieStore.get('editor_owner_id')) {
    response.cookies.set('editor_owner_id', ownerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });
  }
  return response;
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies(); // ✅ await
  const ownerId = cookieStore.get('editor_owner_id')?.value;
  if (!ownerId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 });
  }

  const body = await req.json();
  const { id, originalText, editedText } = body;

  if (!id || !originalText || !editedText) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('documents')
    .update({
      original_text: originalText,
      edited_text: editedText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) {
    console.error('Supabase update error:', error);
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies(); // ✅ await
  const ownerId = cookieStore.get('editor_owner_id')?.value;
  if (!ownerId) {
    return NextResponse.json({ error: 'No session' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing document ID' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) {
    console.error('Supabase delete error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// Add this at the top to use cookies
import { cookies } from 'next/headers';