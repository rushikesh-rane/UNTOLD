import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { isUuid } from '@/lib/security';

type VoteRow = { theory_id: string; user_id: string };

export async function GET(request: Request) {
  const limited = await guard(request, { scope: 'votes:read', limit: 120, windowSec: 60 });
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const theoryId = params.get('theoryId');
  const storyId = params.get('storyId');
  if ((theoryId && !isUuid(theoryId)) || (storyId && !isUuid(storyId))) return fail('That id is not valid.', 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Vote tallies come from a database function that returns only counts, so the list of who voted for what
  // does not need to be publicly readable. (Needs the 202610200001_security_hardening migration.)
  const counts: Record<string, number> = {};
  const { data: tally, error: tallyError } = await supabase.rpc('theory_vote_counts', { p_story_id: storyId ?? null });

  let ownVotes: string[] = [];
  if (!tallyError) {
    for (const row of (tally ?? []) as { theory_id: string; vote_count: number | string }[]) counts[row.theory_id] = Number(row.vote_count);
    if (user) {
      const { data: mine } = await supabase.from('theory_votes').select('theory_id').eq('user_id', user.id).limit(5000);
      ownVotes = ((mine ?? []) as { theory_id: string }[]).map((row) => row.theory_id).filter((id) => id in counts);
    }
  } else {
    // The migration has not been applied yet: fall back to counting the rows directly (the old behaviour).
    let query = supabase.from('theory_votes').select('theory_id,user_id').limit(5000);
    if (storyId) {
      const { data: storyTheories, error: theoriesError } = await supabase.from('theories').select('id').eq('story_id', storyId).limit(1000);
      if (theoriesError) return dbFailure(theoriesError, 'Could not load votes.');
      const ids = (storyTheories ?? []).map((row: { id: string }) => row.id);
      if (!ids.length) return json({ counts: {}, myVotes: [] });
      query = query.in('theory_id', ids);
    }
    const { data, error } = await query;
    if (error) return dbFailure(error, 'Could not load votes.');
    for (const vote of (data ?? []) as VoteRow[]) counts[vote.theory_id] = (counts[vote.theory_id] ?? 0) + 1;
    ownVotes = user ? ((data ?? []) as VoteRow[]).filter((vote) => vote.user_id === user.id).map((vote) => vote.theory_id) : [];
  }

  if (theoryId) {
    return json({ counts: theoryId in counts ? { [theoryId]: counts[theoryId] } : {}, myVotes: ownVotes.filter((id) => id === theoryId) });
  }
  return json({ counts, myVotes: ownVotes });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in to vote.', 401);
  const limited = await guard(request, { scope: 'votes:write', limit: 60, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || !isUuid(body.theoryId)) return fail('A valid theoryId is required.', 400);
  const { error } = await supabase.from('theory_votes').upsert(
    { user_id: user.id, theory_id: body.theoryId },
    { onConflict: 'user_id,theory_id', ignoreDuplicates: true },
  );
  if (error) return dbFailure(error, 'Could not save your vote.');
  return json({ success: true }, 201);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'votes:write', limit: 60, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const theoryId = new URL(request.url).searchParams.get('theoryId');
  if (!isUuid(theoryId)) return fail('A valid theoryId is required.', 400);
  const { error } = await supabase.from('theory_votes').delete().eq('user_id', user.id).eq('theory_id', theoryId);
  if (error) return dbFailure(error, 'Could not remove your vote.');
  return json({ success: true });
}
