import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: stories, error } = await supabase.from('stories').select(`
      id,title,genre,synopsis,cover_url,author_id,published_at,
      author:profiles!stories_author_id_fkey(display_name, username),
      chapters(id,title,body,position,is_revealed)
    `).eq('status', 'published').order('published_at', { ascending: false, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: 'Could not load published stories.', stories: [] }, { status: 500 });
    }

    const visibleStories = (stories ?? []).map((story) => ({
      ...story,
      chapters: (story.chapters ?? [])
        .filter((chapter) => chapter.is_revealed === true)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));

    return NextResponse.json({ stories: visibleStories }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Unable to load published stories.', stories: [] }, { status: 500 });
  }
}
