import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { data, error } = await supabase.from('bookmarks').select('story_id,created_at').eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ bookmarks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.storyId !== 'string') return NextResponse.json({ error: 'storyId is required.' }, { status: 400 });
  const { error } = await supabase.from('bookmarks').upsert({ user_id: user.id, story_id: body.storyId }, { onConflict: 'user_id,story_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const storyId = searchParams.get('storyId');
  if (!storyId) return NextResponse.json({ error: 'storyId is required.' }, { status: 400 });
  const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('story_id', storyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
