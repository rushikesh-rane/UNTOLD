import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, UserRound, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('id,username,display_name,bio,avatar_url,created_at').ilike('username', username).maybeSingle();
  if (!profile) notFound();

  const [{ count: followers }, { count: following }, { data: stories }, { data: { user } }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase.from('stories').select('id,title,genre,synopsis,published_at').eq('author_id', profile.id).eq('status', 'published').order('published_at', { ascending: false }),
    supabase.auth.getUser(),
  ]);
  const isOwnProfile = user?.id === profile.id;
  return <main className="auth-shell has-editorial-layout"><header className="auth-topbar"><Link href="/" className="creator-back"><ArrowLeft size={16}/> Back to Discover</Link><Link href="/" className="brand-lockup"><span className="brand-word">un<span>told</span><i>.</i></span></Link><span/></header>
    <section className="auth-card account-card" style={{ maxWidth: 760 }}>
      <div className="account-identity"><div className="account-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : <UserRound size={24}/>}</div><div className="account-identity-copy"><span>UNTOLD STORYTELLER</span><strong>{profile.display_name || profile.username}</strong><small>@{profile.username}</small></div></div>
      <p className="auth-intro">{profile.bio || 'This storyteller has not added a bio yet.'}</p>
      <div style={{ display: 'flex', gap: 24, margin: '20px 0' }}><Link href={`/u/${profile.username}/followers`}><strong>{followers ?? 0}</strong> Followers</Link><Link href={`/u/${profile.username}/following`}><strong>{following ?? 0}</strong> Following</Link></div>
      {isOwnProfile ? <Link className="creator-secondary" href="/account">Manage your account</Link> : null}
      <section className="account-published-stories"><div className="saved-drafts-head"><div><p className="creator-kicker">THEIR WRITING</p><h2>Published stories</h2></div><span className="draft-count">{stories?.length ?? 0}</span></div>
        {stories?.length ? <div className="account-story-list">{stories.map(story => <article className="account-story-item" key={story.id}><div><h3>{story.title}</h3><p>{story.synopsis || 'No synopsis added.'}</p><small>{story.genre} · {story.published_at ? new Date(story.published_at).toLocaleDateString() : 'Publication date unavailable'}</small></div></article>)}</div> : <div className="no-drafts"><BookOpen size={22}/><strong>No published stories yet</strong><p>When this creator publishes a story, it will appear here.</p></div>}
      </section><div className="account-actions"><Link href="/community" className="creator-secondary"><Users size={15}/> Community</Link><Link href="/" className="creator-primary">Explore stories</Link></div>
    </section></main>;
}
