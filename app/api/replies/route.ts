import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { cleanText, isUuid } from '@/lib/security';

export async function GET(request: Request) {
  const limited = await guard(request, { scope: 'replies:read', limit: 120, windowSec: 60 });
  if (limited) return limited;

  const url = new URL(request.url);
  const kind = url.searchParams.get('kind');
  const parentId = url.searchParams.get('parentId');
  const storyId = url.searchParams.get('storyId');
  // Either one parent (parentId) or every reply for a story's theories/predictions (storyId).
  if ((kind !== 'theory' && kind !== 'prediction') || (!parentId && !storyId)) {
    return fail('kind (theory or prediction) and parentId or storyId are required.', 400);
  }
  if ((parentId && !isUuid(parentId)) || (storyId && !isUuid(storyId))) return fail('That id is not valid.', 400);

  const supabase = await createClient();
  const column = kind === 'theory' ? 'theory_id' : 'prediction_id';
  let query = supabase.from('replies')
    .select(`id,user_id,story_id,theory_id,prediction_id,body,created_at,profile:profiles!replies_user_id_fkey(id,username,display_name,avatar_url)`);
  query = parentId ? query.eq(column, parentId) : query.eq('story_id', storyId as string).not(column, 'is', null);
  const { data, error } = await query.order('created_at', { ascending: true }).limit(500);
  if (error) return dbFailure(error, 'Could not load replies.');
  return json({ replies: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in to reply.', 401);
  const limited = await guard(request, { scope: 'replies:write', limit: 15, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request, 4_000);
  const text = cleanText(body?.body, 1, 1000);
  // Replies are for theories now. (Old free-text predictions can still be read, but no longer get new replies.)
  if (!body || body.kind !== 'theory' || !isUuid(body.parentId) || !isUuid(body.storyId) || !text) {
    return fail('A valid theory, story, and reply of 1–1000 characters are required.', 400);
  }
  const record = { user_id: user.id, story_id: body.storyId, theory_id: body.parentId, prediction_id: null, body: text };
  const { data, error } = await supabase.from('replies').insert(record).select('id,user_id,story_id,theory_id,prediction_id,body,created_at').single();
  if (error) return dbFailure(error, 'Could not post your reply.');
  return json({ reply: data }, 201);
}
