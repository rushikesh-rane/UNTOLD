import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { isUuid } from '@/lib/security';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'bookmarks:read', limit: 120, windowSec: 60, userId: user.id });
  if (limited) return limited;

  const { data, error } = await supabase.from('bookmarks').select('story_id,created_at').eq('user_id', user.id).limit(1000);
  if (error) return dbFailure(error, 'Could not load your bookmarks.');
  return json({ bookmarks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'bookmarks:write', limit: 60, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || !isUuid(body.storyId)) return fail('A valid storyId is required.', 400);
  const { error } = await supabase.from('bookmarks').upsert({ user_id: user.id, story_id: body.storyId }, { onConflict: 'user_id,story_id' });
  if (error) return dbFailure(error, 'Could not save that bookmark.');
  return json({ success: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'bookmarks:write', limit: 60, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const storyId = new URL(request.url).searchParams.get('storyId');
  if (!isUuid(storyId)) return fail('A valid storyId is required.', 400);
  const { error } = await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('story_id', storyId);
  if (error) return dbFailure(error, 'Could not remove that bookmark.');
  return json({ success: true });
}
