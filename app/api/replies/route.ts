import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const parentId = url.searchParams.get('parentId');
  if ((kind !== 'theory' && kind !== 'prediction') || !parentId) {
    return NextResponse.json({ error: 'kind (theory or prediction) and parentId are required.' }, { status: 400 });
  }
  const supabase = await createClient();
  const column = kind === 'theory' ? 'theory_id' : 'prediction_id';
  const { data, error } = await supabase.from('replies')
    .select(`id,user_id,story_id,theory_id,prediction_id,body,created_at,profile:profiles!replies_user_id_fkey(id,username,display_name,avatar_url)`)
    .eq(column, parentId).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ replies: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to reply.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || (body.kind !== 'theory' && body.kind !== 'prediction') || typeof body.parentId !== 'string' || typeof body.storyId !== 'string' || typeof body.body !== 'string' || !body.body.trim() || body.body.trim().length > 1000) {
    return NextResponse.json({ error: 'A valid parent, story, and reply of 1–1000 characters are required.' }, { status: 400 });
  }
  const record = { user_id: user.id, story_id: body.storyId, theory_id: body.kind === 'theory' ? body.parentId : null, prediction_id: body.kind === 'prediction' ? body.parentId : null, body: body.body.trim() };
  const { data, error } = await supabase.from('replies').insert(record).select('id,user_id,story_id,theory_id,prediction_id,body,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reply: data }, { status: 201 });
}
