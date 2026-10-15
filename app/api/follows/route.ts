import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const { data, error } = await supabase
    .from('follows')
    .select('followed_id,created_at,profile:profiles!follows_followed_id_fkey(id,username,display_name,avatar_url)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ follows: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.creatorId !== 'string') return NextResponse.json({ error: 'creatorId is required.' }, { status: 400 });
  if (body.creatorId === user.id) return NextResponse.json({ error: 'You cannot follow yourself.' }, { status: 400 });
  const { error } = await supabase.from('follows').upsert(
    { follower_id: user.id, followed_id: body.creatorId },
    { onConflict: 'follower_id,followed_id', ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const creatorId = new URL(request.url).searchParams.get('creatorId');
  if (!creatorId) return NextResponse.json({ error: 'creatorId is required.' }, { status: 400 });
  const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', creatorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
