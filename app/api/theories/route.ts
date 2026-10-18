import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';


export async function GET(request: Request) {
  const supabase = await createClient();
  const storyId = new URL(request.url).searchParams.get('storyId');

  if (!storyId) {
    return NextResponse.json(
      { error: 'storyId is required.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('theories')
    .select(`
      id,
      user_id,
      story_id,
      body,
      created_at,
      profiles!theories_user_id_fkey(display_name, username)
    `)
    .eq('story_id', storyId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ theories: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.storyId !== 'string' || typeof body.body !== 'string' || body.body.trim().length < 1 || body.body.length > 2000) {
    return NextResponse.json({ error: 'A story and a theory of 1–2000 characters are required.' }, { status: 400 });
  }
  const { data, error } = await supabase.from('theories').insert({ user_id: user.id, story_id: body.storyId, body: body.body.trim() }).select('id,user_id,story_id,body,created_at').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ theory: data }, { status: 201 });
}
