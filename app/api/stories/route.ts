import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { guard } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limited = await guard(request, { scope: 'stories:read', limit: 120, windowSec: 60 });
  if (limited) return limited;

  try {
    const supabase = await createClient();
    const { data: stories, error } = await supabase.from('stories').select(`
      id,title,genre,synopsis,cover_url,author_id,published_at,
      author:profiles!stories_author_id_fkey(display_name, username),
      chapters(id,title,body,position,is_revealed,reveal_at)
    `).eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false })
      .limit(200); // the feed is capped so a single request can never pull an unbounded amount of data

    if (error) {
      return NextResponse.json({ error: 'Could not load published stories.', stories: [] }, { status: 500 });
    }

    const visibleStories = (stories ?? []).map((story) => ({
      ...story,
      chapters: (story.chapters ?? [])
        .filter((chapter) => chapter.is_revealed === true && (!chapter.reveal_at || new Date(chapter.reveal_at) <= new Date()))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));

    // Discussion counts are a nice-to-have: fetch them separately so a failure here can never hide stories.
    const theoryCounts: Record<string, number> = {};
    const predictionCounts: Record<string, number> = {};
    try {
      const ids = visibleStories.map((story) => story.id);
      if (ids.length) {
        const [theoryRows, predictionRows] = await Promise.all([
          supabase.from('theories').select('story_id').in('story_id', ids),
          supabase.from('predictions').select('story_id').in('story_id', ids),
        ]);
        for (const row of (theoryRows.data ?? []) as { story_id: string }[]) theoryCounts[row.story_id] = (theoryCounts[row.story_id] ?? 0) + 1;
        for (const row of (predictionRows.data ?? []) as { story_id: string }[]) predictionCounts[row.story_id] = (predictionCounts[row.story_id] ?? 0) + 1;
      }
    } catch { /* Counts stay at zero. */ }
    // Scheduled parts: only the part number and release time, never the text (see upcoming_chapters()).
    // Like the counts, this is best-effort: if the migration has not been applied yet, stories still load.
    const upcomingByStory: Record<string, { position: number; reveal_at: string }[]> = {};
    try {
      const { data: upcomingRows } = await supabase.rpc('upcoming_chapters');
      for (const row of (upcomingRows ?? []) as { story_id: string; position: number; reveal_at: string }[]) {
        (upcomingByStory[row.story_id] ??= []).push({ position: row.position, reveal_at: row.reveal_at });
      }
    } catch { /* No countdowns; the stories themselves are unaffected. */ }
    const storiesWithCounts = visibleStories.map((story) => ({ ...story, upcoming: upcomingByStory[story.id] ?? [], theories: [{ count: theoryCounts[story.id] ?? 0 }], predictions: [{ count: predictionCounts[story.id] ?? 0 }] }));

    return NextResponse.json({ stories: storiesWithCounts }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load published stories.', stories: [] }, { status: 500 });
  }
}