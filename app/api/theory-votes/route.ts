import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const theoryId = params.get('theoryId');
  const storyId = params.get('storyId');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let query = supabase.from('theory_votes').select('theory_id,user_id');
  if (theoryId) query = query.eq('theory_id', theoryId);
  if (storyId) {
    // Scope the tally to one story without relying on an embedded join.
    const { data: storyTheories, error: theoriesError } = await supabase.from('theories').select('id').eq('story_id', storyId);
    if (theoriesError) return NextResponse.json({ error: theoriesError.message }, { status: 400 });
    const ids = (storyTheories ?? []).map((row: { id: string }) => row.id);
    if (!ids.length) return NextResponse.json({ counts: {}, myVotes: [] });
    query = query.in('theory_id', ids);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const votes = (data ?? []) as { theory_id: string; user_id: string }[];
  return NextResponse.json({
    counts: votes.reduce<Record<string, number>>((counts, vote) => { counts[vote.theory_id] = (counts[vote.theory_id] ?? 0) + 1; return counts; }, {}),
    myVotes: user ? votes.filter((vote) => vote.user_id === user.id).map((vote) => vote.theory_id) : [],
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to vote.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.theoryId !== 'string') return NextResponse.json({ error: 'theoryId is required.' }, { status: 400 });
  const { error } = await supabase.from('theory_votes').upsert(
    { user_id: user.id, theory_id: body.theoryId },
    { onConflict: 'user_id,theory_id', ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  const theoryId = new URL(request.url).searchParams.get('theoryId');
  if (!theoryId) return NextResponse.json({ error: 'theoryId is required.' }, { status: 400 });
  const { error } = await supabase.from('theory_votes').delete().eq('user_id', user.id).eq('theory_id', theoryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}