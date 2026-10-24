import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { isUuid } from '@/lib/security';
import { cleanPollInput, type MyPrediction, type PollView } from '@/lib/polls';

// Predictions are an author-controlled poll. The rules (who may do what, when) are enforced inside the database
// functions from 202610210001_prediction_polls.sql; this route validates input, rate-limits, and shapes the data.

type OptionRow = { id: string; label: string; position: number };
type PollRow = {
  id: string;
  story_id: string;
  author_id: string;
  question: string;
  status: 'open' | 'closed';
  correct_option_id: string | null;
  options: OptionRow[] | null;
};

export async function GET(request: Request) {
  const limited = await guard(request, { scope: 'polls:read', limit: 120, windowSec: 60 });
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // ?mine=1 -> every prediction this person has made, and whether they were right.
  if (params.get('mine') === '1') {
    if (!user) return fail('Sign in required.', 401);
    const { data, error } = await supabase
      .from('prediction_votes')
      .select('poll_id, option_id, created_at, option:prediction_options!option_id(label), poll:prediction_polls!poll_id(id, question, status, correct_option_id, story:stories!story_id(id, title))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return dbFailure(error, 'Could not load your predictions.');

    const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);
    const entries: MyPrediction[] = [];
    for (const row of data ?? []) {
      const poll = one(row.poll as never) as { id: string; question: string; status: string; correct_option_id: string | null; story: unknown } | null;
      const story = one(poll?.story as never) as { id: string; title: string } | null;
      const option = one(row.option as never) as { label: string } | null;
      if (!poll || !story || !option) continue;
      entries.push({
        pollId: poll.id,
        storyId: story.id,
        storyTitle: story.title,
        question: poll.question,
        myOption: option.label,
        status: poll.correct_option_id ? (poll.correct_option_id === row.option_id ? 'correct' : 'wrong') : poll.status === 'closed' ? 'closed' : 'pending',
      });
    }
    return json({
      entries,
      score: { correct: entries.filter((e) => e.status === 'correct').length, answered: entries.filter((e) => e.status === 'correct' || e.status === 'wrong').length },
    });
  }

  // ?storyId=... -> the story's latest prediction (open, closed or answered), or null.
  const storyId = params.get('storyId');
  if (!isUuid(storyId)) return fail('A valid storyId is required.', 400);

  const { data: rows, error } = await supabase
    .from('prediction_polls')
    .select('id, story_id, author_id, question, status, correct_option_id, options:prediction_options!poll_id(id, label, position)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return dbFailure(error, 'Could not load the prediction.');
  const poll = (rows?.[0] ?? null) as PollRow | null;
  if (!poll) return json({ poll: null });

  const isAuthor = user?.id === poll.author_id;

  let myOptionId: string | null = null;
  if (user) {
    const { data: mine } = await supabase.from('prediction_votes').select('option_id').eq('poll_id', poll.id).eq('user_id', user.id).maybeSingle();
    myOptionId = (mine as { option_id: string } | null)?.option_id ?? null;
  }

  // Results are shown once you have picked (so they can't sway your pick), when voting has closed, or to the author.
  const showResults = isAuthor || poll.status === 'closed' || myOptionId !== null;
  const counts = new Map<string, number>();
  if (showResults) {
    const { data: tally } = await supabase.rpc('prediction_option_counts', { p_poll_id: poll.id });
    for (const row of (tally ?? []) as { option_id: string; vote_count: number | string }[]) counts.set(row.option_id, Number(row.vote_count));
  }

  const options = [...(poll.options ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((option) => ({ id: option.id, label: option.label, position: option.position, votes: showResults ? counts.get(option.id) ?? 0 : null }));

  const view: PollView = {
    id: poll.id,
    storyId: poll.story_id,
    question: poll.question,
    status: poll.status,
    resolved: poll.correct_option_id !== null,
    correctOptionId: poll.correct_option_id,
    options,
    totalVotes: showResults ? options.reduce((sum, option) => sum + (option.votes ?? 0), 0) : null,
    myOptionId,
    isAuthor,
  };
  return json({ poll: view });
}

// A reader picks (or changes) their prediction.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in to make a prediction.', 401);
  const limited = await guard(request, { scope: 'polls:vote', limit: 30, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || !isUuid(body.pollId) || !isUuid(body.optionId)) return fail('A valid prediction and option are required.', 400);
  const { error } = await supabase.rpc('vote_on_prediction', { p_poll_id: body.pollId, p_option_id: body.optionId });
  if (error) return dbFailure(error, 'Could not save your prediction.');
  return json({ success: true });
}

// The author creates the prediction for a story (or edits it while nobody has voted yet).
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in first.', 401);
  const limited = await guard(request, { scope: 'polls:write', limit: 20, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request, 6_000);
  if (!body || !isUuid(body.storyId)) return fail('A valid storyId is required.', 400);
  const cleaned = cleanPollInput(body.question, body.options);
  if ('error' in cleaned) return fail(cleaned.error, 400);

  const { data, error } = await supabase.rpc('save_prediction_poll', { p_story_id: body.storyId, p_question: cleaned.question, p_options: cleaned.options });
  if (error) return dbFailure(error, 'Could not save the prediction.');
  return json({ pollId: data }, 201);
}

// The author closes voting, reopens it, or reveals the real answer.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in first.', 401);
  const limited = await guard(request, { scope: 'polls:write', limit: 20, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request);
  const action = body?.action;
  if (!body || !isUuid(body.pollId) || (action !== 'close' && action !== 'reopen' && action !== 'resolve')) return fail('A valid prediction and action are required.', 400);
  if (action === 'resolve' && !isUuid(body.optionId)) return fail('Choose which option turned out to be right.', 400);

  const { error } = await supabase.rpc('set_prediction_status', { p_poll_id: body.pollId, p_action: action, p_option_id: action === 'resolve' ? body.optionId : null });
  if (error) return dbFailure(error, 'Could not update the prediction.');
  return json({ success: true });
}

// The author removes a prediction that nobody has voted on yet.
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in first.', 401);
  const limited = await guard(request, { scope: 'polls:write', limit: 20, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const pollId = new URL(request.url).searchParams.get('pollId');
  if (!isUuid(pollId)) return fail('A valid prediction is required.', 400);

  const { data: tally } = await supabase.rpc('prediction_option_counts', { p_poll_id: pollId });
  const votes = ((tally ?? []) as { vote_count: number | string }[]).reduce((sum, row) => sum + Number(row.vote_count), 0);
  if (votes > 0) return fail('Readers have already voted. Close the prediction instead of removing it.', 409);

  // Row-level security only lets an author delete their own predictions.
  const { data, error } = await supabase.from('prediction_polls').delete().eq('id', pollId).select('id');
  if (error) return dbFailure(error, 'Could not remove the prediction.');
  if (!data?.length) return fail('That prediction was not found.', 404);
  return json({ success: true });
}