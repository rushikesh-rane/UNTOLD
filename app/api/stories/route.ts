import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Explicitly name the stories -> profiles foreign key. Supabase/PostgREST
    // cannot infer the intended relationship when multiple FKs connect these tables.
    const { data: stories, error } = await supabase
      .from('stories')
      .select(`
        id,
        title,
        genre,
        synopsis,
        cover_url,
        author_id,
        published_at,
        author:profiles!stories_author_id_fkey(display_name, username),
        chapters(id, title, body, position, is_revealed)
      `)
      .eq('status', 'published')
      .order('published_at', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('[GET /api/stories] Supabase query failed:', error.message);
      return NextResponse.json(
        { error: 'Could not load published stories.', stories: [] },
        { status: 500 },
      );
    }

    // Keep the public feed limited to revealed chapters. RLS must also enforce
    // chapter visibility in the database; filtering here is not the security boundary.
    const visibleStories = (stories ?? []).map((story) => ({
      ...story,
      chapters: (story.chapters ?? [])
        .filter((chapter) => chapter.is_revealed === true)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }));

    return NextResponse.json(
      { stories: visibleStories },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch (error) {
    console.error('[GET /api/stories] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Unable to load published stories.', stories: [] },
      { status: 500 },
    );
  }
}
