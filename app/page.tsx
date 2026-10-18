'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, Clock3,
  Headphones, Heart, Image as ImageIcon, MessageCircle, Pause,
  Plus, Search, Send, Sparkles, Volume2, X, Home, Compass, Flame, Users, BookmarkCheck, CircleHelp, ChevronRight, UserRound,
} from 'lucide-react';
import { type Story } from '@/lib/stories';
import { createClient } from '@/lib/supabase/client';
import { buildReaderParts, buildUpcomingParts, countdownLabel, formatRevealDate, partsToPlainText, type ReaderPart, type UpcomingPart } from '@/lib/reader';
import ThemeToggle from '@/components/ThemeToggle';
import { StoryListSkeleton, TheorySkeleton } from '@/components/Skeletons';

type CloudAuthor = {
  display_name?: string | null;
  username?: string | null;
};

type CloudChapter = {
  title: string | null;
  body: string | null;
  is_revealed: boolean;
  reveal_at: string | null;
  position: number;
};

type CloudStory = {
  id: string;
  author_id?: string | null;
  genre: string | null;
  title: string;
  synopsis: string | null;
  cover_url?: string | null;
  author?: CloudAuthor | CloudAuthor[] | null;
  profiles?: CloudAuthor | CloudAuthor[] | null;
  chapters?: CloudChapter[] | null;
  upcoming?: { position: number; reveal_at: string | null }[] | null;
  theories?: { count: number }[] | null;
  predictions?: { count: number }[] | null;
};

type CloudTheory = {
  id: string;
  user_id?: string | null;
  body: string;
  created_at?: string | null;
  profiles?: CloudAuthor | CloudAuthor[] | null;
};

type CloudReply = {
  id: string;
  user_id?: string | null;
  theory_id?: string | null;
  body: string;
  created_at?: string | null;
  profile?: CloudAuthor | CloudAuthor[] | null;
};

type Reply = { id: string; userId?: string; author: string; text: string; createdAt?: string };
type Theory = { id: string; userId?: string; author: string; text: string; votes: number; createdAt?: string; replies: Reply[] };

type MediaStory = Story & {
  authorId?: string;
  coverUrl?: string;
  body: string[];
  /** Every released chapter, in order. This is what the reader renders. */
  parts: ReaderPart[];
  /** Scheduled parts that readers cannot open yet: part number and release time only. */
  upcoming: UpcomingPart[];
  images: { src: string; alt: string; caption: string }[];
  theories: Theory[];
  audioLabel: string;
};

// Old prototype data that earlier builds kept in the browser. It is cleared so it can never show up as ghost stories, saves or likes.
const LEGACY_KEYS = ['untold.saved-stories.v1', 'untold.reader-theories.v1', 'untold.theory-votes.v1', 'untold.theory-replies.v1', 'untold.published-stories.v1'];
function timeAgo(iso?: string) {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Turns one story from /api/stories into what the app displays. Shared by the first load and by
// the refresh that runs when a scheduled part unlocks while someone is reading.
function mapCloudStory(item: CloudStory): MediaStory {
  const authorSource = item.author ?? item.profiles;
  const author = Array.isArray(authorSource) ? authorSource[0] : authorSource;
  const { parts, images } = buildReaderParts(item.chapters ?? []);
  const upcoming = buildUpcomingParts(item.upcoming);
  const body = parts.flatMap((part) => part.paragraphs);
  return { id: item.id, authorId: item.author_id || undefined, coverUrl: item.cover_url || undefined, category: /real life/i.test(item.genre ?? '') ? 'REAL LIFE' : 'FICTION', title: item.title, excerpt: item.synopsis || 'A new story, waiting to be discovered.', author: author?.display_name || 'UNTOLD reader', handle: author?.username ? `@${author.username}` : '@reader', initials: (author?.display_name || 'UR').slice(0, 2).toUpperCase(), color: 'violet', readTime: `${Math.max(1, Math.ceil(body.join(' ').length / 900))} min read`, predictions: item.predictions?.[0]?.count ?? 0, comments: item.theories?.[0]?.count ?? 0, reveal: upcoming.length ? countdownLabel(upcoming[0]).text : 'Continue reading', progress: 50, body, parts, upcoming, images, theories: [], audioLabel: 'Listen to the opening' };
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return <span className={`avatar avatar-${color}`}>{initials}</span>;
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('For you');
  const [activeNav, setActiveNav] = useState('Discover');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [savedStories, setSavedStories] = useState<string[]>([]);
  const [publishedStories, setPublishedStories] = useState<MediaStory[]>([]);
  const [likedTheories, setLikedTheories] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const likeBusy = useRef<Set<string>>(new Set());
  const [selectedStory, setSelectedStory] = useState<MediaStory | null>(null);
  const [prediction, setPrediction] = useState('');
  const [storiesLoaded, setStoriesLoaded] = useState(false);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOpening, setNewOpening] = useState('');
  const [notice, setNotice] = useState('');
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; caption: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const autoRefreshed = useRef<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    let lastLoad = 0;
    async function loadCloudData() {
      lastLoad = Date.now();
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: bookmarks } = await supabase.from('bookmarks').select('story_id').eq('user_id', user.id);
          if (alive && bookmarks) setSavedStories(bookmarks.map((item) => item.story_id));
          if (alive) setCurrentUserId(user.id);
          const { data: followRows } = await supabase.from('follows').select('followed_id').eq('follower_id', user.id);
          if (alive && followRows) setFollowedIds(followRows.map((row) => row.followed_id));
        }
        const response = await fetch('/api/stories', { cache: 'no-store' });
        const payload = (await response.json()) as { stories?: CloudStory[] };
        if (response.ok && Array.isArray(payload.stories) && alive) {
          const cloudStories: MediaStory[] = payload.stories.map(mapCloudStory);
          setPublishedStories((current) => [...cloudStories, ...current.filter((old) => !cloudStories.some((cloud) => cloud.id === old.id))]);
        }
      } catch { /* Stories stay empty if loading fails; the next refresh retries. */ }
      finally { if (alive) setStoriesLoaded(true); }
    }
    loadCloudData();
    // At most once a minute: every refresh re-downloads all stories with their chapters.
    const refreshPublishedStories = () => { if (document.visibilityState === 'visible' && Date.now() - lastLoad > 60_000) void loadCloudData(); };
    window.addEventListener('focus', refreshPublishedStories);
    document.addEventListener('visibilitychange', refreshPublishedStories);
    try {
      LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch { /* Storage can be unavailable (private mode). */ }
    return () => { alive = false; window.removeEventListener('focus', refreshPublishedStories); document.removeEventListener('visibilitychange', refreshPublishedStories); };
  }, []);

  // Keeps "reveals in 2 days" honest while the page stays open.
  const anyUpcoming = publishedStories.some((story) => story.upcoming.length > 0);
  useEffect(() => {
    if (!anyUpcoming) return;
    setNowTick(Date.now());
    const timer = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [anyUpcoming]);

  // Re-downloads the open story so a part that just unlocked appears without a manual reload.
  async function refreshSelectedStory() {
    const id = selectedStory?.id;
    if (!id) return;
    try {
      const response = await fetch('/api/stories', { cache: 'no-store' });
      const payload = (await response.json()) as { stories?: CloudStory[] };
      const fresh = response.ok ? payload.stories?.find((item) => item.id === id) : undefined;
      if (!fresh) return;
      const mapped = mapCloudStory(fresh);
      setPublishedStories((current) => current.map((story) => story.id === id ? mapped : story));
      setSelectedStory((current) => current && current.id === id ? { ...mapped, theories: current.theories } : current);
    } catch { /* The "Read Part N" button stays so the reader can retry. */ }
  }

  useEffect(() => {
    if (!selectedStory) return;
    const due = selectedStory.upcoming.find((part) => Date.parse(part.revealAt) <= nowTick);
    if (!due) return;
    const key = `${selectedStory.id}:${due.position}`;
    if (autoRefreshed.current.has(key)) return; // try once automatically; the button covers retries
    autoRefreshed.current.add(key);
    void refreshSelectedStory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowTick, selectedStory]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const allStories = useMemo(() => publishedStories, [publishedStories]);

  // Deep link from profiles: /?story=<id> opens that story once the list has loaded.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!storiesLoaded || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const id = new URLSearchParams(window.location.search).get('story');
    if (!id) return;
    const target = publishedStories.find((story) => story.id === id);
    if (target) void openStory(target);
  }, [storiesLoaded, publishedStories]);
  const filteredStories = useMemo(() => allStories.filter((story) => {
    const haystack = `${story.title} ${story.excerpt} ${story.category} ${story.author} ${story.body.join(' ')}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const isTrending = story.predictions + story.comments > 0;
    const matchesTab = activeTab === 'For you' || (activeTab === 'Trending' ? isTrending : activeTab === 'New' ? story.progress < 60 : true);
    const matchesSaved = activeNav !== 'Reading list' || savedStories.includes(story.id);
    return matchesSearch && matchesTab && matchesSaved;
  }).sort((a, b) => activeTab === 'Trending' ? (b.predictions + b.comments) - (a.predictions + a.comments) : 0), [allStories, activeTab, activeNav, savedStories, searchTerm]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  async function toggleFollow(story: MediaStory) {
    const creatorId = story.authorId;
    if (!creatorId) { showNotice('This story has no author account to follow.'); return; }
    if (followBusy) return;
    const isFollowing = followedIds.includes(creatorId);
    const restore = () => setFollowedIds((current) => isFollowing ? (current.includes(creatorId) ? current : [...current, creatorId]) : current.filter((id) => id !== creatorId));
    setFollowBusy(true);
    setFollowedIds((current) => isFollowing ? current.filter((id) => id !== creatorId) : [...current, creatorId]);
    try {
      const response = await fetch(isFollowing ? `/api/follows?creatorId=${encodeURIComponent(creatorId)}` : '/api/follows', isFollowing ? { method: 'DELETE' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creatorId }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); restore(); showNotice(result.error || 'Sign in to follow creators.'); return; }
      showNotice(isFollowing ? `Unfollowed ${story.author}.` : `You are now following ${story.author}.`);
    } catch { restore(); showNotice('Could not update follow. Please try again.'); }
    finally { setFollowBusy(false); }
  }

  async function toggleSave(id: string) {
    const isSaved = savedStories.includes(id);
    try {
      const response = await fetch(isSaved ? `/api/bookmarks?storyId=${encodeURIComponent(id)}` : '/api/bookmarks', isSaved ? { method: 'DELETE' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyId: id }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); showNotice(result.error || 'Sign in to save stories.'); return; }
    } catch { showNotice('Could not update your reading list.'); return; }
    setSavedStories((current) => isSaved ? current.filter((item) => item !== id) : [...current, id]);
    showNotice(isSaved ? 'Removed from your reading list.' : 'Saved to your reading list.');
  }

  // Loads theories, like counts, my likes and replies for a cloud story in one go.
  async function loadDiscussion(storyId: string) {
    const id = encodeURIComponent(storyId);
    try {
      const [theoriesRes, votesRes, repliesRes] = await Promise.all([
        fetch(`/api/theories?storyId=${id}`, { cache: 'no-store' }),
        fetch(`/api/theory-votes?storyId=${id}`, { cache: 'no-store' }),
        fetch(`/api/replies?kind=theory&storyId=${id}`, { cache: 'no-store' }),
      ]);
      const theoriesBody = (await theoriesRes.json().catch(() => ({}))) as { theories?: CloudTheory[] };
      if (!theoriesRes.ok || !Array.isArray(theoriesBody.theories)) return;
      const votesBody = (votesRes.ok ? await votesRes.json().catch(() => ({})) : {}) as { counts?: Record<string, number>; myVotes?: string[] };
      const repliesBody = (repliesRes.ok ? await repliesRes.json().catch(() => ({})) : {}) as { replies?: CloudReply[] };
      const counts = votesBody.counts ?? {};
      const mine = new Set(votesBody.myVotes ?? []);
      const repliesByTheory: Record<string, Reply[]> = {};
      for (const item of repliesBody.replies ?? []) {
        if (!item.theory_id) continue;
        const profile = Array.isArray(item.profile) ? item.profile[0] : item.profile;
        (repliesByTheory[item.theory_id] ??= []).push({ id: item.id, userId: item.user_id || undefined, author: profile?.username || profile?.display_name || 'reader', text: item.body, createdAt: item.created_at || undefined });
      }
      const theories: Theory[] = theoriesBody.theories.map((item) => {
        const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return { id: item.id, userId: item.user_id || undefined, author: profile?.username || profile?.display_name || 'reader', text: item.body, createdAt: item.created_at || undefined, votes: counts[item.id] ?? 0, replies: repliesByTheory[item.id] ?? [] };
      });
      setLikedTheories((current) => ({ ...current, ...Object.fromEntries(theories.map((theory) => [theory.id, mine.has(theory.id)])) }));
      setSelectedStory((current) => current?.id === storyId ? { ...current, theories } : current);
    } catch { /* Reader can still use the story if the discussion fails to load. */ }
  }

  async function openStory(story: MediaStory) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setPrediction('');
    setReplyingTo(null);
    setReplyDraft('');
    setDiscussionLoading(true);
    setSelectedStory(story);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { await loadDiscussion(story.id); } finally { setDiscussionLoading(false); }
  }

  // One like per person per theory: clicking again removes it. Cloud likes are enforced by the database too.
  async function toggleLike(theory: Theory) {
    if (!selectedStory || likeBusy.current.has(theory.id)) return;
    const storyId = selectedStory.id;
    if (!currentUserId) { showNotice('Sign in to like theories.'); return; }
    const wasLiked = Boolean(likedTheories[theory.id]);
    const apply = (liked: boolean) => {
      setLikedTheories((current) => ({ ...current, [theory.id]: liked }));
      setSelectedStory((current) => current?.id === storyId ? { ...current, theories: current.theories.map((item) => item.id === theory.id ? { ...item, votes: Math.max(0, item.votes + (liked ? 1 : -1)) } : item) } : current);
    };
    apply(!wasLiked);
    likeBusy.current.add(theory.id);
    try {
      const response = await fetch(wasLiked ? `/api/theory-votes?theoryId=${encodeURIComponent(theory.id)}` : '/api/theory-votes', wasLiked ? { method: 'DELETE' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theoryId: theory.id }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})); apply(wasLiked); showNotice(response.status === 401 ? 'Sign in to like theories.' : result.error || 'Could not update your like.'); }
    } catch { apply(wasLiked); showNotice('Could not update your like. Please try again.'); }
    finally { likeBusy.current.delete(theory.id); }
  }

  // Opens the reply box directly under the theory being answered (optionally pre-mentioning a person in that thread).
  function openReply(theory: Theory, mention?: string) {
    if (replyingTo === theory.id && !mention) { setReplyingTo(null); setReplyDraft(''); return; }
    if (!currentUserId) { showNotice('Sign in to reply.'); return; }
    setReplyingTo(theory.id);
    setReplyDraft(mention ? `@${mention} ` : '');
  }

  async function submitReply(theory: Theory) {
    const text = replyDraft.trim();
    if (!selectedStory || !text || replyBusy) return;
    const storyId = selectedStory.id;
    setReplyBusy(true);
    try {
      const response = await fetch('/api/replies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'theory', parentId: theory.id, storyId, body: text }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { showNotice(response.status === 401 ? 'Sign in to reply.' : result.error || 'Could not post your reply.'); return; }
      await loadDiscussion(storyId);
    } catch { showNotice('Could not post your reply. Please try again.'); return; }
    finally { setReplyBusy(false); }
    setReplyDraft('');
    setReplyingTo(null);
    showNotice('Reply posted.');
  }

  function toggleNarration() {
    if (!selectedStory || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showNotice('Audio narration is not supported in this browser.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(`${selectedStory.title}. ${partsToPlainText(selectedStory.parts)}`);
    utterance.rate = 0.94;
    utterance.pitch = 0.96;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }

  async function submitPrediction() {
    if (!selectedStory || prediction.trim().length < 8) return;
    try {
      const response = await fetch('/api/theories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyId: selectedStory.id, body: prediction.trim() }) });
      const result = await response.json();
      if (!response.ok) { showNotice(result.error || 'Sign in to submit a theory.'); return; }
    } catch { showNotice('Could not submit your theory.'); return; }
    setPrediction('');
    await loadDiscussion(selectedStory.id);
    showNotice('Your theory was shared with UNTOLD readers.');
  }

  function publishDraft() {
    if (newTitle.trim().length < 4 || newOpening.trim().length < 20) {
      showNotice('Add a title and an opening of at least 20 characters.');
      return;
    }
    setShowPublish(false);
    showNotice('Draft captured in this session. Publishing will be connected to accounts and the database later.');
    setNewTitle('');
    setNewOpening('');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a href="#top" className="brand-lockup" onClick={() => setSelectedStory(null)} aria-label="UNTOLD home">
          <span className="brand-mark"><BookOpen size={19} strokeWidth={2} /></span>
          <span className="brand-word">un<span>told</span><i>.</i></span>
        </a>
        <div className="topbar-note"><span className="live-dot" /> STORIES IN PROGRESS</div>
        <div className="topbar-actions">
          <button className="icon-button" aria-label="Search stories" onClick={() => setSearchOpen(!searchOpen)}><Search size={18} /></button>
          <ThemeToggle />
          <Link href="/community" className="profile-button" aria-label="Your community" title="Reading list, following, theories and predictions"><Users size={17} /><span>Community</span></Link>
          <Link href="/account" className="profile-button" aria-label="Your profile" title="Your profile"><UserRound size={17} /><span>Profile</span></Link>
          <Link href="/write" className="publish-button"><Plus size={16} /><span>Write a story</span></Link>
        </div>
      </header>

      {searchOpen && <div className="search-panel"><Search size={17} /><input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Find a story, feeling, or mystery…" aria-label="Search stories" /><button onClick={() => { setSearchOpen(false); setSearchTerm(''); }} aria-label="Close search"><X size={17} /></button></div>}

      {!selectedStory ? (
        <div className="workspace-grid" id="top">
          <aside className="left-sidebar" aria-label="Main navigation">
            <div className="sidebar-label">YOUR SPACE</div>
            <button className={`sidebar-link ${activeNav === 'Discover' ? 'sidebar-link-active' : ''}`} onClick={() => { setActiveNav('Discover'); setActiveTab('For you'); }}><Home size={17} /> <span>Discover</span></button>
            <button className={`sidebar-link ${activeNav === 'Trending' ? 'sidebar-link-active' : ''}`} onClick={() => { setActiveNav('Trending'); setActiveTab('Trending'); }}><Flame size={17} /> <span>Trending</span></button>
            <button className={`sidebar-link ${activeNav === 'Reading list' ? 'sidebar-link-active' : ''}`} onClick={() => { setActiveNav('Reading list'); setActiveTab('For you'); }}><BookmarkCheck size={17} /> <span>Reading list</span><span className="sidebar-count">{savedStories.length}</span></button>
            <Link href="/community?tab=following" className="sidebar-link"><Users size={17} /> <span>Following creators</span></Link>
            <Link href="/community?tab=theories" className="sidebar-link"><MessageCircle size={17} /> <span>Theory Room</span></Link>
            <Link href="/community?tab=predictions" className="sidebar-link"><Sparkles size={17} /> <span>Predictions</span></Link>
            <div className="sidebar-divider" />
            <div className="sidebar-label">EXPLORE</div>
            <button className="sidebar-link" onClick={() => { setActiveNav('Discover'); setActiveTab('New'); }}><Compass size={17} /> <span>Fresh stories</span></button>
            <Link href="/how-it-works" className="sidebar-link"><CircleHelp size={17} /> <span>How it works</span></Link>
            <div className="sidebar-note"><span className="sidebar-note-mark"><BookOpen size={15} /></span><strong>Every story has a missing piece.</strong><p>Read a little. Guess a lot. Discover the truth.</p></div>
          </aside>

          <div className="feed-page">
            <section className="intro-block">
              <p className="eyebrow"><span /> EVERY STORY HAS A MISSING PIECE</p>
              <h1>Read between<br />the <em>unfinished.</em></h1>
              <p className="intro-copy">A little of the story. A thousand possible endings.<br className="desktop-break" /> Come for the mystery. Stay for the reveal.</p>
            </section>


            <section className="feed-section" aria-label="Discover stories">
              <div className="feed-toolbar">
                <div
                  className="feed-tabs"
                  role="tablist"
                  aria-label="Story feed filters"
                >
                  {['For you', 'Trending', 'New'].map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => {
                        setActiveTab(tab);

                        if (tab === 'Trending') {
                          setActiveNav('Trending');
                        } else if (activeNav === 'Trending') {
                          setActiveNav('Discover');
                        }
                      }}
                      className={activeTab === tab ? 'tab-active' : ''}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <span className="toolbar-note">
                  <Sparkles size={13} /> Curiosity, not chronology
                </span>
              </div>

              {filteredStories.length ? (
                <div className="story-list">
                  {filteredStories.map((story, index) => (
                    <article className="story-row" key={story.id}>
                      <button
                        className="story-row-main"
                        onClick={() => openStory(story)}
                        aria-label={`Read ${story.title}`}
                      >
                        <span className="story-index">
                          {String(index + 1).padStart(2, '0')}
                        </span>

                        <span className={`story-row-cover${story.coverUrl ? ' has-cover' : ' no-cover'}`} aria-hidden="true">
                          {story.coverUrl ? (
                            <img
                              src={story.coverUrl}
                              alt=""
                              loading={index < 3 ? 'eager' : 'lazy'}
                              decoding="async"
                              onError={(event) => {
                                event.currentTarget.style.display = 'none';
                                event.currentTarget.parentElement?.classList.add('cover-load-failed');
                              }}
                            />
                          ) : null}
                          {!story.coverUrl ? <span className="story-cover-fallback"><BookOpen size={22} /><span>UNTOLD</span></span> : null}
                        </span>

                        <span className="story-row-copy">
                          <span className="story-row-meta">
                            <span
                              className={`category-pill ${story.category === 'FICTION' ? 'pill-fiction' : ''
                                }`}
                            >
                              {story.category === 'FICTION' ? 'FICTION' : 'REAL LIFE'}
                            </span>

                            <span>
                              <Clock3 size={13} /> {story.readTime}
                            </span>

                            {story.upcoming.length ? <span className="story-row-reveal"><Clock3 size={13} /> {countdownLabel(story.upcoming[0], new Date(nowTick)).text}</span> : null}

                            <span className="story-row-author">
                              by {story.author}
                            </span>
                          </span>

                          <strong className="story-row-title">
                            {story.title}
                          </strong>

                          <span className="story-row-excerpt">
                            {story.excerpt}
                          </span>

                          <span className="story-row-bottom">
                            <span>
                              <MessageCircle size={14} /> {story.comments} theories
                            </span>

                            <span>
                              <Heart size={14} /> {story.predictions} predictions
                            </span>

                            <span className="row-read">
                              Open story <ArrowRight size={14} />
                            </span>
                          </span>
                        </span>
                      </button>

                      <button
                        className={`row-bookmark ${savedStories.includes(story.id) ? 'is-saved' : ''
                          }`}
                        aria-label={
                          savedStories.includes(story.id)
                            ? 'Remove bookmark'
                            : 'Bookmark story'
                        }
                        onClick={() => toggleSave(story.id)}
                      >
                        {savedStories.includes(story.id) ? (
                          <Check size={17} />
                        ) : (
                          <Bookmark size={17} />
                        )}
                      </button>
                    </article>
                  ))}
                </div>
              ) : !storiesLoaded ? (
                <StoryListSkeleton />
              ) : (
                <div className="empty-state">
                  <Search size={23} />

                  <strong>
                    {activeNav === 'Reading list'
                      ? 'Your reading list is empty'
                      : storiesLoaded ? 'No stories yet' : 'Loading stories…'}
                  </strong>

                  <span>
                    {activeNav === 'Reading list'
                      ? 'Save a story and it will be waiting here.'
                      : storiesLoaded ? 'Check back soon, or try another search or tab.' : 'One moment.'}
                  </span>

                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setActiveTab('For you');
                      setActiveNav('Discover');
                    }}
                  >
                    Explore stories
                  </button>
                </div>
              )}
            </section>

            <footer className="page-footer"><span className="footer-brand">un<span>told</span><i>.</i></span><span>Stay curious. The rest comes later.</span><span>© 2026 UNTOLD · EARLY PROTOTYPE</span></footer>
          </div>

          <aside className="right-sidebar" aria-label="Story discovery tools">
            <section className="right-widget explore-widget">
              <div className="widget-heading"><span>FIND YOUR KIND OF STORY</span><Compass size={15} /></div>
              <h3>What are you in the mood for?</h3>
              <p className="widget-copy">Choose a lane to narrow the feed. You can always come back to everything.</p>
              <div className="mood-options">
                <button onClick={() => { setSearchTerm(''); setActiveNav('Discover'); setActiveTab('Trending'); }}><span className="mood-icon mood-violet"><Flame size={16} /></span><span><strong>Popular theories</strong><small>Stories readers are debating</small></span><ChevronRight size={15} /></button>
                <button onClick={() => { setSearchTerm('real life'); setActiveNav('Discover'); setActiveTab('For you'); }}><span className="mood-icon mood-coral"><Heart size={16} /></span><span><strong>Real-life moments</strong><small>Confessions and close calls</small></span><ChevronRight size={15} /></button>
                <button onClick={() => { setSearchTerm('fiction'); setActiveNav('Discover'); setActiveTab('For you'); }}><span className="mood-icon mood-blue"><Sparkles size={16} /></span><span><strong>Fiction & mystery</strong><small>Clues, twists, strange places</small></span><ChevronRight size={15} /></button>
              </div>
              <button className="reset-discovery" onClick={() => { setSearchTerm(''); setActiveNav('Discover'); setActiveTab('For you'); }}>Show all stories <ArrowRight size={14} /></button>
            </section>
            <section className="right-widget how-widget">
              <div className="widget-heading"><span>HOW UNTOLD WORKS</span><BookOpen size={15} /></div>
              <h3>Read a little. Figure out the rest.</h3>
              <ol className="how-steps"><li><span>01</span><div><strong>Read the opening</strong><p>Every story starts with a piece of the picture.</p></div></li><li><span>02</span><div><strong>Spot the clues</strong><p>Look through the details and form a theory.</p></div></li><li><span>03</span><div><strong>Come back for more</strong><p>Follow the next part as the truth unfolds.</p></div></li></ol>
            </section>
          </aside>
        </div>
      ) : (
        <div className="reader-page">
          <button className="back-button" onClick={() => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); setIsSpeaking(false); setSelectedStory(null); }}><ArrowLeft size={16} /> Back to stories</button>
          <article className="reader-article">
            <div className="reader-meta"><span className={`category-pill ${selectedStory.category === 'FICTION' ? 'pill-fiction' : ''}`}>{selectedStory.category}</span><span><Clock3 size={13} /> {selectedStory.readTime}</span><span>{selectedStory.parts.length > 1 ? `${selectedStory.parts.length} PARTS` : 'ONE PART'}</span></div>
            <h1 className="reader-title">{selectedStory.title}</h1>
            <p className="reader-deck">{selectedStory.excerpt}</p>
            <div className="reader-byline"><Avatar initials={selectedStory.initials} color={selectedStory.color} /><div><strong>{selectedStory.author}</strong><span>{selectedStory.handle} · Storyteller</span></div>{!(currentUserId && selectedStory.authorId === currentUserId) && <button className={`follow-button${selectedStory.authorId && followedIds.includes(selectedStory.authorId) ? ' is-following' : ''}`} aria-pressed={Boolean(selectedStory.authorId && followedIds.includes(selectedStory.authorId))} onClick={() => void toggleFollow(selectedStory)}>{selectedStory.authorId && followedIds.includes(selectedStory.authorId) ? <>Following <Check size={13} /></> : <>Follow <Plus size={13} /></>}</button>}</div>
            <div className="reader-tools"><button className={`listen-button ${isSpeaking ? 'listening' : ''}`} onClick={toggleNarration}>{isSpeaking ? <Pause size={16} /> : <Headphones size={16} />}{isSpeaking ? 'Pause narration' : 'Listen to story'}<span><Volume2 size={13} /> browser audio</span></button><button className={`reader-save ${savedStories.includes(selectedStory.id) ? 'is-saved' : ''}`} onClick={() => toggleSave(selectedStory.id)}>{savedStories.includes(selectedStory.id) ? <Check size={16} /> : <Bookmark size={16} />}{savedStories.includes(selectedStory.id) ? 'Saved' : 'Save story'}</button></div>
            <div className="reader-body">{selectedStory.parts.map((part) => <section className="reader-part" key={part.position} aria-label={`Part ${part.position}`}>{selectedStory.parts.length > 1 ? <p className="eyebrow muted-eyebrow reader-part-label">PART {String(part.position).padStart(2, '0')}</p> : null}{part.heading ? <h2 className="reader-part-title">{part.heading}</h2> : null}{part.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}</div>
            {selectedStory.upcoming.length ? <section className="reveal-countdown-list" aria-label="Parts that unlock later">{selectedStory.upcoming.map((part, index) => {
              const countdown = countdownLabel(part, new Date(nowTick));
              return <div className={`reveal-card reveal-countdown${index === 0 ? ' is-next' : ''}${countdown.ready ? ' is-ready' : ''}`} key={part.position}>
                <div className="reveal-card-icon"><Clock3 size={18} /></div>
                <div>
                  <span className="eyebrow muted-eyebrow">{countdown.ready ? 'JUST UNLOCKED' : index === 0 ? 'THE NEXT PART' : 'COMING LATER'}</span>
                  <h3>{countdown.text}</h3>
                  <p>{countdown.ready ? 'Loading it now. If it does not appear, tap the button.' : `Unlocks ${formatRevealDate(part.revealAt)}. Until then the words stay hidden, even from us.`}</p>
                  {countdown.ready ? <button type="button" className="reveal-refresh" onClick={() => void refreshSelectedStory()}>Read Part {part.position}</button> : null}
                </div>
                <span className="reveal-status">{countdown.ready ? 'LIVE' : 'REVEAL PENDING'}</span>
              </div>;
            })}</section> : null}
            <section className="media-section"><div className="media-heading"><div><p className="eyebrow muted-eyebrow"><ImageIcon size={13} /> EVIDENCE & MOMENTS</p><h2>Look a little <em>closer.</em></h2></div><span>01 — {String(selectedStory.images.length).padStart(2, '0')}</span></div><div className="image-gallery">{selectedStory.images.map((image, index) => <button className={`gallery-image gallery-image-${index + 1}`} key={image.src} onClick={() => setLightbox(image)}><img src={image.src} alt={image.alt} loading="lazy" decoding="async" /><span className="gallery-caption">{image.caption}</span></button>)}</div><p className="gallery-hint">A few details may matter more than they seem. Tap an image to look closer.</p></section>
            <section className="theory-section"><div className="theory-heading"><div><p className="eyebrow muted-eyebrow">THE THEORY ROOM</p><h2>What do you <em>think?</em></h2></div><span>{selectedStory.theories.length} THEORIES</span></div><form className="theory-form" onSubmit={(event) => { event.preventDefault(); submitPrediction(); }}><label htmlFor="theory-input">PUT YOUR THEORY ON THE TABLE</label><textarea id="theory-input" value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="I think the detail that matters is…" maxLength={500} rows={3} /><div className="theory-form-bottom"><span>{prediction.length}/500 · Be curious, not cruel.</span><button type="submit" disabled={prediction.trim().length < 8}>Submit theory <Send size={14} /></button></div></form><div className="theory-list">{discussionLoading && !selectedStory.theories.length ? <TheorySkeleton /> : null}{selectedStory.theories.map((theory) => {
              const liked = Boolean(likedTheories[theory.id]);
              const isReplying = replyingTo === theory.id;
              return <article className="theory-card" key={theory.id}>
                <div className="theory-author"><span className="theory-avatar">{theory.author.slice(0, 1).toUpperCase()}</span>{theory.userId ? <Link href={`/u/${theory.userId}`} className="theory-profile-link"><strong>{theory.author}</strong></Link> : <strong>{theory.author}</strong>}<span>{theory.createdAt ? timeAgo(theory.createdAt) : 'reader theory'}</span></div>
                <p>{theory.text}</p>
                <div className="theory-votes">
                  <button type="button" className={`like-button${liked ? ' is-liked' : ''}`} aria-pressed={liked} aria-label={liked ? `Unlike this theory (${theory.votes} likes)` : `Like this theory (${theory.votes} likes)`} onClick={() => void toggleLike(theory)}><Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {theory.votes}</button>
                  <button type="button" className={isReplying ? 'is-active' : ''} aria-expanded={isReplying} onClick={() => openReply(theory)}><MessageCircle size={14} /> Reply{theory.replies.length ? ` · ${theory.replies.length}` : ''}</button>
                </div>
                {(theory.replies.length > 0 || isReplying) && <div className="theory-replies">
                  {theory.replies.map((reply) => <div className="reply-card" key={reply.id}>
                    <div className="theory-author"><span className="theory-avatar reply-avatar">{reply.author.slice(0, 1).toUpperCase()}</span>{reply.userId ? <Link href={`/u/${reply.userId}`} className="theory-profile-link"><strong>{reply.author}</strong></Link> : <strong>{reply.author}</strong>}<span>{timeAgo(reply.createdAt)}</span></div>
                    <p>{reply.text}</p>
                    <div className="theory-votes"><button type="button" onClick={() => openReply(theory, reply.author)}><MessageCircle size={13} /> Reply</button></div>
                  </div>)}
                  {isReplying && <form className="reply-form" onSubmit={(event) => { event.preventDefault(); void submitReply(theory); }}>
                    <label htmlFor={`reply-${theory.id}`}>REPLYING TO @{theory.author}</label>
                    <textarea id={`reply-${theory.id}`} autoFocus value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} placeholder={`Reply to ${theory.author}…`} maxLength={1000} rows={2} />
                    <div className="reply-form-actions"><button type="button" className="reply-cancel" onClick={() => { setReplyingTo(null); setReplyDraft(''); }}>Cancel</button><button type="submit" className="reply-submit" disabled={!replyDraft.trim() || replyBusy}>{replyBusy ? 'Posting…' : <>Reply <Send size={13} /></>}</button></div>
                  </form>}
                </div>}
              </article>;
            })}</div></section>
          </article>
        </div>
      )}

      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={15} /></button></div>}

      {lightbox && <div className="lightbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}><button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close image"><X size={22} /></button><img src={lightbox.src} alt={lightbox.alt} /><p>{lightbox.caption}</p></div>}

      {showPublish && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPublish(false); }}><section className="modal-card publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><button className="modal-close" onClick={() => setShowPublish(false)} aria-label="Close dialog"><X size={18} /></button><span className="eyebrow muted-eyebrow"><BookOpen size={13} /> YOUR STORY STARTS HERE</span><h2 id="publish-title">Leave them <em>wondering.</em></h2><p className="modal-description">A strong opening gives readers a reason to stay.</p><label className="field-label" htmlFor="story-title">STORY TITLE</label><input id="story-title" className="publish-input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="The night everything changed…" maxLength={100} /><label className="field-label" htmlFor="story-opening">THE FIRST PART</label><textarea id="story-opening" className="publish-textarea" value={newOpening} onChange={(event) => setNewOpening(event.target.value)} placeholder="Start at the moment everything changed…" rows={5} maxLength={5000} /><div className="publish-modal-bottom"><span>Draft only · Publishing will be connected later</span><button className="modal-primary" onClick={publishDraft}>Save draft <ArrowRight size={15} /></button></div></section></div>}
    </main>
  );
}