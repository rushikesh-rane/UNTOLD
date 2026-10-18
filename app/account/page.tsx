import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogOut, UserRound, BookOpen } from 'lucide-react';
import EditorialSidebar from '@/components/EditorialSidebar';
import { createClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect('/login?next=/account');

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/login');
  }

  const { data: publishedStories } = await supabase.from('stories').select('id,title,genre,synopsis,cover_url,published_at,chapters(id)').eq('author_id', user.id).eq('status', 'published').order('published_at', { ascending: false });

  const [{ count: followers }, { count: following }, { data: profileRow }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', user.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', user.id),
    supabase.from('profiles').select('username').eq('id', user.id).maybeSingle(),
  ]);
  const profileRoute = profileRow?.username || user.id;

  const displayName = typeof user.user_metadata?.display_name === 'string'
    ? user.user_metadata.display_name
    : 'Reader';

  return (
    <main className="auth-shell has-editorial-layout">
      <EditorialSidebar />
      <section className="auth-card account-card">
        <p className="creator-kicker">YOUR UNTOLD ACCOUNT</p>
        <h1>You&apos;re signed in.</h1>
        <div className="account-identity">
          <div className="account-avatar"><UserRound size={22} /></div>
          <div className="account-identity-copy"><span>DISPLAY NAME</span><strong>{displayName}</strong></div>
        </div>
        <div className="public-profile-stats">
          <Link href={`/u/${profileRoute}/followers`}><strong>{followers ?? 0}</strong><span>Followers</span></Link>
          <Link href={`/u/${profileRoute}/following`}><strong>{following ?? 0}</strong><span>Following</span></Link>
        </div>
        <div className="account-detail"><span>EMAIL ADDRESS</span><strong>{user.email ?? 'No email on this account'}</strong>{user.email_confirmed_at ? <small className="account-confirmed">Email confirmed</small> : <small className="account-pending">Email confirmation pending</small>}</div>
        <section className="account-published-stories" aria-labelledby="account-published-title"><div className="saved-drafts-head"><div><p className="creator-kicker">YOUR WRITING</p><h2 id="account-published-title">Published stories</h2></div><span className="draft-count">{publishedStories?.length ?? 0}</span></div>{publishedStories?.length ? <div className="account-story-list">{publishedStories.map((story) => <article className="account-story-item" id={`published-${story.id}`} key={story.id}>{story.cover_url ? <img src={story.cover_url} alt="" /> : null}<div><h3>{story.title}</h3><p>{story.synopsis || 'No synopsis added.'}</p><small>{story.genre} · {story.chapters?.length ?? 0} chapters · Published {story.published_at ? new Date(story.published_at).toLocaleDateString() : 'date unavailable'}</small></div></article>)}</div> : <div className="no-drafts"><BookOpen size={22} /><strong>No published stories yet</strong><p>Your published stories will appear here after you publish them in Creator Studio.</p><Link href="/write" className="creator-text-link">Write a story →</Link></div>}</section>
        <div className="account-actions">
          <Link href="/" className="creator-secondary account-discover">Explore stories</Link>
          <form action={signOut}><button className="creator-primary account-signout" type="submit"><LogOut size={16} /> Sign out</button></form>
        </div>
      </section>
    </main>
  );
}