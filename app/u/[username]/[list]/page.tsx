import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

type ProfileSummary = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type FollowListItem = {
  created_at: string;
  follower: ProfileSummary | ProfileSummary[] | null;
  followed: ProfileSummary | ProfileSummary[] | null;
};

export default async function FollowListPage({
  params,
}: {
  params: Promise<{ username: string; list: string }>;
}) {
  const { username, list } = await params;

  if (list !== 'followers' && list !== 'following') notFound();

  const supabase = await createClient();

  const { data: owner } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .ilike('username', username)
    .maybeSingle();

  if (!owner) notFound();

  const column = list === 'followers' ? 'followed_id' : 'follower_id';

  const join =
    list === 'followers'
      ? 'follower:profiles!follows_follower_id_fkey(id,username,display_name,avatar_url)'
      : 'followed:profiles!follows_followed_id_fkey(id,username,display_name,avatar_url)';

  const { data, error } = await supabase
    .from('follows')
    .select(`created_at,${join}`)
    .eq(column, owner.id)
    .order('created_at', { ascending: false });

  const title = list === 'followers' ? 'Followers' : 'Following';

  const people: ProfileSummary[] = ((data ?? []) as unknown as FollowListItem[])
    .map((item) => {
      const person = item.follower ?? item.followed;
      return Array.isArray(person) ? person[0] : person;
    })
    .filter((person): person is ProfileSummary => person !== null && person !== undefined);

  return (
    <main className="auth-shell has-editorial-layout">
      <header className="auth-topbar">
        <Link href={`/u/${owner.username}`} className="creator-back">
          <ArrowLeft size={16} /> Back to profile
        </Link>

        <Link href="/" className="brand-lockup">
          <span className="brand-word">
            un<span>told</span><i>.</i>
          </span>
        </Link>

        <span />
      </header>

      <section
        className="auth-card account-card"
        style={{ maxWidth: 760 }}
      >
        <p className="creator-kicker">@{owner.username}</p>
        <h1>{title}</h1>

        {error ? (
          <p className="auth-intro">
            Could not load this list. Please try again later.
          </p>
        ) : people.length ? (
          <div className="account-story-list">
            {people.map((person) => (
              <article className="account-story-item" key={person.id}>
                <div className="account-avatar">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" />
                  ) : (
                    <UserRound size={20} />
                  )}
                </div>

                <div>
                  <h3>
                    <Link
                      href={
                        person.username
                          ? `/u/${person.username}`
                          : '/community'
                      }
                    >
                      {person.display_name ||
                        person.username ||
                        'UNTOLD reader'}
                    </Link>
                  </h3>

                  <p>
                    {person.username
                      ? `@${person.username}`
                      : 'Username not set'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="no-drafts">
            <UserRound size={22} />
            <strong>No {list} yet</strong>
            <p>
              This list will update as readers connect on UNTOLD.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
