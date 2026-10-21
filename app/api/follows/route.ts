import { createClient } from '@/lib/supabase/server';
import { dbFailure, fail, guard, json, readJson } from '@/lib/api';
import { isUuid } from '@/lib/security';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'follows:read', limit: 120, windowSec: 60, userId: user.id });
  if (limited) return limited;

  const { data, error } = await supabase
    .from('follows')
    .select(`
      follower_id,
      followed_id,
      created_at,
      profile:profiles!follows_followed_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return dbFailure(error, 'Could not load who you follow.');
  return json({ follows: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'follows:write', limit: 30, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const body = await readJson(request);
  if (!body || !isUuid(body.creatorId)) return fail('A valid creatorId is required.', 400);
  if (body.creatorId === user.id) return fail('You cannot follow yourself.', 400);
  const { error } = await supabase.from('follows').upsert(
    { follower_id: user.id, followed_id: body.creatorId },
    { onConflict: 'follower_id,followed_id', ignoreDuplicates: true },
  );
  if (error) return dbFailure(error, 'Could not follow that person.');
  return json({ success: true }, 201);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail('Sign in required.', 401);
  const limited = await guard(request, { scope: 'follows:write', limit: 30, windowSec: 60, mutating: true, userId: user.id });
  if (limited) return limited;

  const creatorId = new URL(request.url).searchParams.get('creatorId');
  if (!isUuid(creatorId)) return fail('A valid creatorId is required.', 400);
  const { error } = await supabase.from('follows').delete().eq('follower_id', user.id).eq('followed_id', creatorId);
  if (error) return dbFailure(error, 'Could not unfollow that person.');
  return json({ success: true });
}
