import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { cleanText, isUuid } from '@/lib/security';

export async function GET(request: Request) {
  const limited = await guard(request, { scope: 'predictions:read', limit: 120, windowSec: 60 });
  if (limited) return limited;

  const storyId = new URL(request.url).searchParams.get('storyId');
  if (!isUuid(storyId)) return fail('A valid storyId is required.', 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('predictions')
    .select('id,user_id,story_id,body,created_at,profile:profiles!predictions_user_id_fkey(display_name,username)')
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return dbFailure(error, 'Could not load predictions.');
  return json({ predictions: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in to submit a prediction.', 401);
  const limited = await guard(request, { scope: 'predictions:write', limit: 10, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request, 4_000);
  const text = cleanText(body?.body, 8, 1000);
  if (!body || !isUuid(body.storyId) || !text) return fail('A story and a prediction of 8–1000 characters are required.', 400);

  const { data, error } = await supabase.from('predictions')
    .insert({ user_id: user.id, story_id: body.storyId, body: text })
    .select('id,user_id,story_id,body,created_at').single();
  if (error) return dbFailure(error, 'Could not post your prediction.');
  return json({ prediction: data }, 201);
}
