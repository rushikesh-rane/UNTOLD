
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Person = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type FollowRow = {
  created_at: string;
  person: Person | Person[] | null;
};

export default async function FollowListPage({
  params,
}: {
  params: Promise<{ username: string; list: string }>;
}) {
  const { username: routeKey, list } = await params;

  if (list !== 'followers' && list !== 'following') {
    notFound();
  }

  const supabase = await createClient();

  const ownerQuery = supabase
    .from('profiles')
    .select('id,username,display_name');

  const { data: owner } = UUID.test(routeKey)
    ? await ownerQuery.eq('id', routeKey).maybeSingle()
    : await ownerQuery.ilike('username', routeKey).maybeSingle();

  if (!owner) {
    notFound();
  }

  const column = list === 'followers' ? 'followed_id' : 'follower_id';

  const join =
    list === 'followers'
      ? 'person:profiles!follows_follower_id_fkey(id,username,display_name,avatar_url)'
      : 'person:profiles!follows_followed_id_fkey(id,username,display_name,avatar_url)';

  const { data, error } = await supabase
    .from('follows')
    .select(`created_at,${join}`)
    .eq(column, owner.id)
    .order('created_at', { ascending: false });

  const people = ((data ?? []) as unknown as FollowRow[])
    .map((item) => {
      const person = item.person;
      return Array.isArray(person) ? person[0] ?? null : person;
    })
    .filter((person): person is Person => Boolean(person));

  const ownerRoute = owner.username || owner.id;
  const title = list === 'followers' ? 'Followers' : 'Following';

  return (
    <main className="auth-shell has-editorial-layout">
      <header className="auth-topbar">
        <Link href={`/u/${ownerRoute}`} className="creator-back">
          <ArrowLeft size={16} />
          Back to profile
        </Link>

        <Link href="/" className="brand-lockup">
          <span className="brand-word">
            un<span>told</span>
            <i>.</i>
          </span>
        </Link>

        <span />
      </header>

      <section
        className="auth-card account-card"
        style={{ maxWidth: 760 }}
      >
        <p className="creator-kicker">
          {owner.username
            ? `@${owner.username}`
            : owner.display_name || 'UNTOLD member'}
        </p>

        <h1>{title}</h1>

        {error ? (
          <p className="auth-intro">
            Could not load this list. Please try again later.
          </p>
        ) : people.length ? (
          <div className="account-story-list">
            {people.map((person) => (
              <article
                className="account-story-item public-person-row"
                key={person.id}
              >
                <div className="account-avatar">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={
                        person.display_name
                          ? `${person.display_name}'s avatar`
                          : 'Profile avatar'
                      }
                    />
                  ) : (
                    <UserRound size={20} />
                  )}
                </div>

                <div>
                  <h3>
                    <Link href={`/u/${person.username || person.id}`}>
                      {person.display_name ||
                        person.username ||
                        'UNTOLD reader'}
                    </Link>
                  </h3>

                  <p>
                    {person.username
                      ? `@${person.username}`
                      : 'UNTOLD member'}
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
