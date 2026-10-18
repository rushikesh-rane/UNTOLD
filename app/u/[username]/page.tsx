import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, UserRound, Users, CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import ProfileFollowButton from './follow-button';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username: routeKey } = await params;
  const supabase = await createClient();
  const profileQuery = supabase.from('profiles').select('id,username,display_name,bio,avatar_url,created_at');
  const { data: profile, error: profileError } = UUID.test(routeKey)
    ? await profileQuery.eq('id', routeKey).maybeSingle()
    : await profileQuery.ilike('username', routeKey).maybeSingle();
  if (profileError || !profile) notFound();

  const [{ count: followers }, { count: following }, { data: stories }, { data: { user } }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followed_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase.from('stories').select('id,title,genre,synopsis,published_at').eq('author_id', profile.id).eq('status', 'published').order('published_at', { ascending: false }),
    supabase.auth.getUser(),
  ]);
  const isOwnProfile = user?.id === profile.id;
  const profileRoute = profile.username || profile.id;
  const displayName = profile.display_name || profile.username || 'UNTOLD reader';

  return <main className="auth-shell has-editorial-layout"><header className="auth-topbar"><Link href="/" className="creator-back"><ArrowLeft size={16}/> Back to Discover</Link><Link href="/" className="brand-lockup"><span className="brand-word">un<span>told</span><i>.</i></span></Link><span/></header>
    <section className="auth-card account-card public-profile-card" style={{ maxWidth: 800 }}>
      <div className="account-identity"><div className="account-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt={`${displayName}'s avatar`} /> : <UserRound size={26}/>}</div><div className="account-identity-copy"><span>UNTOLD STORYTELLER</span><strong>{displayName}</strong><small>{profile.username ? `@${profile.username}` : 'UNTOLD member'}</small></div></div>
      <p className="auth-intro">{profile.bio || 'This storyteller has not added a bio yet.'}</p>
      <p className="public-profile-joined"><CalendarDays size={14}/> Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'UNTOLD'}</p>
      <div className="public-profile-stats"><Link href={`/u/${profileRoute}/followers`}><strong>{followers ?? 0}</strong><span>Followers</span></Link><Link href={`/u/${profileRoute}/following`}><strong>{following ?? 0}</strong><span>Following</span></Link></div>
      {!isOwnProfile && user ? <ProfileFollowButton creatorId={profile.id} /> : null}
      {isOwnProfile ? <Link className="creator-secondary" href="/account">Manage your account</Link> : null}
      <section className="account-published-stories"><div className="saved-drafts-head"><div><p className="creator-kicker">THEIR WRITING</p><h2>Published stories</h2></div><span className="draft-count">{stories?.length ?? 0}</span></div>
        {stories?.length ? <div className="account-story-list">{stories.map((story) => <article className="account-story-item" key={story.id}><div><h3><Link href={`/?story=${story.id}`}>{story.title}</Link></h3><p>{story.synopsis || 'No synopsis added.'}</p><small>{story.genre || 'Story'} · {story.published_at ? new Date(story.published_at).toLocaleDateString() : 'Publication date unavailable'}</small></div></article>)}</div> : <div className="no-drafts"><BookOpen size={22}/><strong>No published stories yet</strong><p>When this creator publishes a story, it will appear here.</p></div>}
      </section><div className="account-actions"><Link href="/community" className="creator-secondary"><Users size={15}/> Community</Link><Link href="/" className="creator-primary">Explore stories</Link></div>
    </section></main>;
}
