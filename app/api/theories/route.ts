import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { cleanText, isUuid } from '@/lib/security';

export async function GET(request: Request) {
  const limited = await guard(request, { scope: 'theories:read', limit: 120, windowSec: 60 });
  if (limited) return limited;

  const storyId = new URL(request.url).searchParams.get('storyId');
  if (!isUuid(storyId)) return fail('A valid storyId is required.', 400);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('theories')
    .select(`
      id,
      user_id,
      story_id,
      body,
      created_at,
      profiles!theories_user_id_fkey(id, display_name, username, avatar_url)
    `)
    .eq('story_id', storyId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return dbFailure(error, 'Could not load theories.');
  return json({ theories: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'theories:write', limit: 10, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request, 6_000);
  const text = cleanText(body?.body, 1, 2000);
  if (!body || !isUuid(body.storyId) || !text) return fail('A story and a theory of 1–2000 characters are required.', 400);

  const { data, error } = await supabase.from('theories').insert({ user_id: user.id, story_id: body.storyId, body: text }).select('id,user_id,story_id,body,created_at').single();
  if (error) return dbFailure(error, 'Could not post your theory.');
  return json({ theory: data }, 201);
}
