'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CardGridSkeleton } from '@/components/Skeletons';
import YourPredictions from '@/components/YourPredictions';
import { Bookmark, BookOpen, Heart, MessageCircle, Send, Users, Lightbulb, RefreshCw } from 'lucide-react';

type Story = { id: string; title: string; synopsis?: string; genre?: string; author_id: string; author?: { display_name?: string; username?: string } | null; profiles?: { display_name?: string; username?: string } | null };
type Follow = { followed_id: string; profile?: { id: string; display_name?: string; username?: string } | null };
type Note = { id: string; story_id: string; body: string; user_id: string; created_at: string; profile?: { id?: string; display_name?: string; username?: string } | null };
type BookmarkRecord = { story_id: string; created_at: string };

type Tab = 'reading-list' | 'following' | 'theories' | 'predictions';

export default function CommunityPage() {
  const [tab, setTab] = useState<Tab>('reading-list');
  const [stories, setStories] = useState<Story[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<string[]>([]);
  const [selectedStory, setSelectedStory] = useState('');
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('Loading your UNTOLD community space…');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [storyRes, bookmarkRes, followRes] = await Promise.all([
        fetch('/api/stories', { cache: 'no-store' }),
        fetch('/api/bookmarks', { cache: 'no-store' }),
        fetch('/api/follows', { cache: 'no-store' }),
      ]);
      const storyJson = await storyRes.json().catch(() => ({}));
      const bookmarkJson = await bookmarkRes.json().catch(() => ({}));
      const followJson = await followRes.json().catch(() => ({}));
      if (storyRes.ok) setStories(storyJson.stories ?? []);
      if (bookmarkRes.ok) setBookmarks(bookmarkJson.bookmarks ?? []);
      if (followRes.ok) setFollows(followJson.follows ?? []);
      const failures = [storyRes, bookmarkRes, followRes].filter((response) => !response.ok);
      setMessage(failures.length ? 'Some sections require you to sign in. Sign in and refresh to load your saved data.' : 'Your saved stories and creator follows are synced with your account.');
    } catch {
      setMessage('Could not connect to UNTOLD. Check your connection and try again.');
    } finally {
      setBusy(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (requested === 'following' || requested === 'reading-list' || requested === 'theories' || requested === 'predictions') {
      setTab(requested);
    }
    void refresh();
  }, [refresh]);

  const loadNotes = useCallback(async (storyId: string) => {
    if (!storyId) { setNotes([]); return; }
    const response = await fetch(`/api/theories?storyId=${encodeURIComponent(storyId)}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setNotes(payload.theories ?? []);
      const voteResponse = await fetch('/api/theory-votes', { cache: 'no-store' });
      const votePayload = await voteResponse.json().catch(() => ({}));
      if (voteResponse.ok) { setVoteCounts(votePayload.counts ?? {}); setMyVotes(votePayload.myVotes ?? []); }
    } else { setNotes([]); setMessage(payload.error || 'Could not load theories.'); }
  }, []);

  useEffect(() => { if (tab === 'theories') void loadNotes(selectedStory); }, [tab, selectedStory, loadNotes]);

  async function follow(creatorId: string, isFollowing: boolean) {
    const response = await fetch(isFollowing ? `/api/follows?creatorId=${encodeURIComponent(creatorId)}` : '/api/follows', {
      method: isFollowing ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: isFollowing ? undefined : JSON.stringify({ creatorId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(payload.error || 'Could not update follow.'); return; }
    await refresh();
    setMessage(isFollowing ? 'Creator unfollowed.' : 'You are now following this creator.');
  }

  async function submitNote(event: FormEvent) {
    event.preventDefault();
    if (!selectedStory || draft.trim().length < 8) return;
    const response = await fetch('/api/theories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyId: selectedStory, body: draft.trim() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(payload.error || 'Could not submit. Sign in and try again.'); return; }
    setDraft('');
    await loadNotes(selectedStory);
    setMessage('Your theory has been published.');
  }

  const bookmarkedStories = stories.filter((story) => bookmarks.some((bookmark) => bookmark.story_id === story.id));
  const followedIds = new Set(follows.map((item) => item.followed_id));
  const authors = new Map<string, { id: string; name: string; username: string }>();
  for (const story of stories) {
    const profile = story.author ?? story.profiles;
    if (story.author_id && !authors.has(story.author_id)) authors.set(story.author_id, { id: story.author_id, name: profile?.display_name || 'UNTOLD creator', username: profile?.username || '' });
  }

  return (
    <main className="community-page">
      <header className="community-header"><Link href="/" className="brand-lockup" aria-label="UNTOLD home"><span className="brand-mark"><BookOpen size={19} /></span><span className="brand-word">un<span>told</span><i>.</i></span></Link><Link href="/" className="community-back">← Back to Discover</Link></header>
      <section className="community-intro"><p className="community-kicker">YOUR UNTOLD SPACE</p><h1>Stories are better <em>together.</em></h1><p>Keep the stories you love close, follow the people behind them, and share what you think happens next.</p><button className="community-refresh" onClick={() => void refresh()} disabled={busy}><RefreshCw size={15}/> Refresh your space</button></section>
      <nav className="community-tabs" aria-label="Community sections">
        <button className={tab === 'reading-list' ? 'selected' : ''} onClick={() => setTab('reading-list')}><Bookmark size={16}/> Reading list</button>
        <button className={tab === 'following' ? 'selected' : ''} onClick={() => setTab('following')}><Users size={16}/> Following</button>
        <button className={tab === 'theories' ? 'selected' : ''} onClick={() => setTab('theories')}><Lightbulb size={16}/> Theory Room</button>
        <button className={tab === 'predictions' ? 'selected' : ''} onClick={() => setTab('predictions')}><MessageCircle size={16}/> Predictions</button>
      </nav>
      <p className="community-status" role="status">{message}</p>
      {!loaded && <CardGridSkeleton />}

      {loaded && tab === 'reading-list' && <section className="community-section"><h2>Your saved stories</h2><p className="community-muted">Bookmarks are stored against your signed-in account.</p>{bookmarkedStories.length ? <div className="community-grid">{bookmarkedStories.map((story) => <article className="community-card" key={story.id}><span className="community-genre">{story.genre || 'Mystery'}</span><h3>{story.title}</h3><p>{story.synopsis || 'A story waiting to be discovered.'}</p><Link href="/">Open Discover →</Link></article>)}</div> : <div className="community-empty"><Bookmark size={24}/><strong>Your reading list is empty</strong><span>Save a published story from Discover, then refresh this section.</span><Link href="/" className="community-empty-link">Explore Discover</Link></div>}</section>}

      {loaded && tab === 'following' && <section className="community-section"><h2>Creators to follow</h2><p className="community-muted">Follow authors to build your own reading community.</p>{Array.from(authors.values()).length ? <div className="community-grid">{Array.from(authors.values()).map((author) => <article className="community-card" key={author.id}><Link href={`/u/${author.id}`} className="community-profile-link"><span className="community-avatar">{author.name.slice(0, 1).toUpperCase()}</span><h3>{author.name}</h3></Link><p>{author.username ? `@${author.username}` : 'UNTOLD creator'}</p><button className="community-action" onClick={() => void follow(author.id, followedIds.has(author.id))}><Heart size={15} fill={followedIds.has(author.id) ? 'currentColor' : 'none'}/>{followedIds.has(author.id) ? 'Following · Unfollow' : 'Follow creator'}</button></article>)}</div> : <div className="community-empty"><Users size={24}/><strong>No published creators found yet</strong><span>Published stories will make their creators available here.</span></div>}</section>}

      {loaded && tab === 'theories' && <section className="community-section"><h2>The Theory Room</h2><p className="community-muted">Share your own idea about what is really going on, based on what you have read so far. Please don&apos;t reveal anything that hasn&apos;t been released.</p><label className="community-label" htmlFor="community-story">Choose a published story</label><select id="community-story" value={selectedStory} onChange={(event) => setSelectedStory(event.target.value)}><option value="">Select a story…</option>{stories.map((story) => <option value={story.id} key={story.id}>{story.title}</option>)}</select>{selectedStory && <form className="community-note-form" onSubmit={submitNote}><label htmlFor="community-note">Your theory</label><textarea id="community-note" value={draft} onChange={(event) => setDraft(event.target.value)} minLength={8} maxLength={2000} placeholder="What clue do you think matters most?" required/><div><span>{draft.length} characters</span><button type="submit" disabled={draft.trim().length < 8}><Send size={14}/> Share theory</button></div></form>}{selectedStory && <div className="community-notes">{notes.map((note) => <article className="community-note" key={note.id}>{note.profile?.id ? <Link href={`/u/${note.profile.id}`} className="community-note-author"><strong>{note.profile?.display_name || note.profile?.username || 'Reader'}</strong></Link> : <strong>{note.profile?.display_name || note.profile?.username || 'Reader'}</strong>}<time>{new Date(note.created_at).toLocaleDateString()}</time><p>{note.body}</p><button className="community-vote" onClick={async () => { const voted = myVotes.includes(note.id); const response = await fetch(voted ? `/api/theory-votes?theoryId=${encodeURIComponent(note.id)}` : '/api/theory-votes', { method: voted ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: voted ? undefined : JSON.stringify({ theoryId: note.id }) }); const payload = await response.json().catch(() => ({})); if (!response.ok) { setMessage(payload.error || 'Sign in to vote.'); return; } await loadNotes(selectedStory); }}><Heart size={14} fill={myVotes.includes(note.id) ? 'currentColor' : 'none'}/> {voteCounts[note.id] ?? 0} {myVotes.includes(note.id) ? 'Voted · remove vote' : 'Vote for theory'}</button></article>)}{!notes.length && <div className="community-empty"><MessageCircle size={22}/><strong>Start the conversation</strong><span>Be the first to share a theory for this story.</span></div>}</div>}</section>}

      {loaded && tab === 'predictions' && <section className="community-section"><h2>Your predictions</h2><YourPredictions /></section>}
    </main>
  );
}
