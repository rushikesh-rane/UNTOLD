'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, Clock3,
  Headphones, Heart, Image as ImageIcon, MessageCircle, Pause,
  Plus, Search, Send, Sparkles, Volume2, X, Home, Compass, Flame, Users, BookmarkCheck, CircleHelp, ChevronRight, UserRound,
} from 'lucide-react';
import { stories as seedStories, type Story } from '@/lib/stories';
import { createClient } from '@/lib/supabase/client';

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
  genre: string | null;
  title: string;
  synopsis: string | null;
  author?: CloudAuthor | CloudAuthor[] | null;
  profiles?: CloudAuthor | CloudAuthor[] | null;
  chapters?: CloudChapter[] | null;
};

type CloudTheory = {
  body: string;
  profiles?: CloudAuthor | CloudAuthor[] | null;
};

type MediaStory = Story & {
  body: string[];
  lockedChapters?: { title: string; body: string }[];
  images: { src: string; alt: string; caption: string }[];
  theories: { author: string; text: string; votes: number }[];
  audioLabel: string;
};

const storyDetails: Record<string, Omit<MediaStory, keyof Story>> = {
  'blue-tick': {
    body: [
      'At 2:13 AM, a message appeared on my phone: “Are you awake? I need to tell you something.”',
      'I replied almost immediately. The typing bubble appeared, disappeared, then appeared again. Three minutes later, the message was gone. By morning, he said he had been asleep all night.',
      'I wanted to believe him. Then I checked the photo he had posted the previous evening. In the reflection of a window, there was a second phone on the table — one I had never seen before.',
      'I zoomed in. The lock screen showed a notification from someone saved in his contacts as “Do not answer.” I know that sounds impossible. I know what I saw. And I still haven’t told him I found it.',
    ],
    images: [
      { src: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=85', alt: 'Phone glowing in a dark room', caption: '2:13 AM · The deleted message' },
      { src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=85', alt: 'Laptop and phone on a desk', caption: 'The photo that changed everything' },
      { src: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=85', alt: 'Dark night sky over a quiet landscape', caption: 'The night it happened' },
    ],
    theories: [
      { author: 'noahafterdark', text: '“Do not answer” sounds like a contact name someone uses to hide the real identity. Maybe it is a second account?', votes: 128 },
      { author: 'mila.jpg', text: 'The reflection might be from an old photo. I need to know when the picture was taken.', votes: 94 },
      { author: 'quietstorm', text: 'The deleted message matters more than the phone. Someone else was using his account.', votes: 61 },
    ],
    audioLabel: 'Listen to the opening',
  },
  'room-09': {
    body: [
      'The hotel had eight floors. I checked the directory twice before getting into the elevator. Eight floors, a basement, and a rooftop restaurant. Nothing else.',
      'At 11:48 PM, the elevator stopped between seven and eight. The lights blinked. Then a button I had never noticed before lit up: 9.',
      'The doors opened onto a corridor with green carpet and framed photographs of guests. Every photograph showed the same woman, standing in a different year. In the final frame, she was holding my room key.',
      'At the end of the corridor was Room 09. I heard someone inside whisper my name. I had never told anyone at the hotel who I was.',
    ],
    images: [
      { src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85', alt: 'Quiet hotel corridor at night', caption: 'The floor that should not exist' },
      { src: 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=85', alt: 'Moody geometric architecture', caption: 'A building with a hidden level' },
      { src: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=85', alt: 'Dark ocean under a grey sky', caption: 'The sound behind the door' },
    ],
    theories: [
      { author: 'paperghost', text: 'The woman in the photographs is the narrator from a different timeline.', votes: 142 },
      { author: 'ash_reads', text: 'Room 09 is not a physical room. It could be a memory or a loop.', votes: 86 },
      { author: 'lune', text: 'The hotel staff know. Look at how the story keeps mentioning the directory.', votes: 39 },
    ],
    audioLabel: 'Listen to the opening',
  },
  birthday: {
    body: [
      'By ten in the evening, my phone was still silent. Not one birthday message from the people who promised they would never forget.',
      'I ordered food, turned off the lights, and decided I was done expecting anything from anyone. Then someone knocked.',
      'A woman I had never seen before stood outside holding a photograph of me at six years old. Behind me in the picture was a boy I barely remembered — my childhood neighbour, who moved away after the accident.',
      'She said, “He asked me to find you on this day.” Then she handed me an envelope with my name on it, written in handwriting I had not seen in fifteen years.',
    ],
    images: [
      { src: 'https://images.unsplash.com/photo-1464349153735-7db50ed83c84?auto=format&fit=crop&w=1200&q=85', alt: 'Birthday cake with candles', caption: 'A birthday nobody remembered' },
      { src: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?auto=format&fit=crop&w=1200&q=85', alt: 'Friends gathered together', caption: 'A memory from another year' },
      { src: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=85', alt: 'Portrait in soft evening light', caption: 'The person in the photograph' },
    ],
    theories: [
      { author: 'sundayletters', text: 'The boy is the reason the narrator is still here. The letter is probably an apology.', votes: 77 },
      { author: 'devonwrites', text: 'The stranger might be his sister or someone from the old neighbourhood.', votes: 53 },
      { author: 'littleorbit', text: 'What if everyone did remember, but they were planning a surprise?', votes: 31 },
    ],
    audioLabel: 'Listen to the opening',
  },
};

const initialStories: MediaStory[] = seedStories.map((story) => ({
  ...story,
  ...storyDetails[story.id],
}));

const SAVED_KEY = 'untold.saved-stories.v1';
const THEORIES_KEY = 'untold.reader-theories.v1';
const VOTES_KEY = 'untold.theory-votes.v1';
const PUBLISHED_KEY = 'untold.published-stories.v1';
type LocalPublishedStory = { id: string; title: string; category: string; synopsis: string; chapters: { id: string; title: string; body: string; reveal: 'now' | 'later' }[]; author?: string; publishedAt?: string };

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
  const [theoryVotes, setTheoryVotes] = useState<Record<string, number>>({});
  const [selectedStory, setSelectedStory] = useState<MediaStory | null>(null);
  const [prediction, setPrediction] = useState('');
  const [submittedPredictions, setSubmittedPredictions] = useState<Record<string, string[]>>({});
  const [showPublish, setShowPublish] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newOpening, setNewOpening] = useState('');
  const [notice, setNotice] = useState('');
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; caption: string } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    async function loadCloudData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: bookmarks } = await supabase.from('bookmarks').select('story_id').eq('user_id', user.id);
          if (alive && bookmarks) setSavedStories(bookmarks.map((item) => item.story_id));
        }
        const response = await fetch('/api/stories', { cache: 'no-store' });
        const payload = (await response.json()) as { stories?: CloudStory[] };
        if (response.ok && Array.isArray(payload.stories) && alive) {
          const cloudStories: MediaStory[] = payload.stories.map((item) => {
            const authorSource = item.author ?? item.profiles;
            const author = Array.isArray(authorSource) ? authorSource[0] : authorSource;
            const chapters = (item.chapters ?? []).filter((chapter) => chapter.is_revealed && (!chapter.reveal_at || new Date(chapter.reveal_at) <= new Date())).sort((a, b) => a.position - b.position);
            const body = chapters.flatMap((chapter) => [chapter.title, chapter.body]).filter((text): text is string => Boolean(text));
            return { id: item.id, category: /real life/i.test(item.genre ?? '') ? 'REAL LIFE' : 'FICTION', title: item.title, excerpt: item.synopsis || 'A new story, waiting to be discovered.', author: author?.display_name || 'UNTOLD reader', handle: author?.username ? `@${author.username}` : '@reader', initials: (author?.display_name || 'UR').slice(0, 2).toUpperCase(), color: 'violet', readTime: `${Math.max(1, Math.ceil(body.join(' ').length / 900))} min read`, predictions: 0, comments: 0, reveal: 'Continue reading', progress: 50, body, images: [], theories: [], audioLabel: 'Listen to the opening' };
          });
          setPublishedStories((current) => [...cloudStories, ...current.filter((old) => !cloudStories.some((cloud) => cloud.id === old.id))]);
        }
      } catch { /* Keep the sample discovery experience available if cloud loading fails. */ }
    }
    loadCloudData();
    const refreshPublishedStories = () => { if (document.visibilityState === 'visible') void loadCloudData(); };
    window.addEventListener('focus', refreshPublishedStories);
    document.addEventListener('visibilitychange', refreshPublishedStories);
    try {
      setSavedStories((current) => current.length ? current : JSON.parse(localStorage.getItem(SAVED_KEY) || '[]') as string[]);
      setSubmittedPredictions(JSON.parse(localStorage.getItem(THEORIES_KEY) || '{}') as Record<string, string[]>);
      setTheoryVotes(JSON.parse(localStorage.getItem(VOTES_KEY) || '{}') as Record<string, number>);
      const published = JSON.parse(localStorage.getItem(PUBLISHED_KEY) || '[]') as LocalPublishedStory[];
      setPublishedStories(published.map((item) => {
        const available = item.chapters.filter((chapter) => chapter.reveal === 'now');
        const locked = item.chapters.filter((chapter) => chapter.reveal === 'later');
        const category = /real life/i.test(item.category) ? 'REAL LIFE' as const : 'FICTION' as const;
        return { id: item.id, category, title: item.title, excerpt: item.synopsis || 'A new story, waiting to be discovered.', author: item.author || 'You', handle: '@you', initials: 'YO', color: 'violet', readTime: `${Math.max(1, Math.ceil(available.reduce((n, c) => n + c.body.length, 0) / 900))} min read`, predictions: 0, comments: 0, reveal: locked.length ? 'More to come' : 'Complete', progress: locked.length ? 50 : 100, body: available.flatMap((chapter) => [chapter.title, chapter.body]).filter(Boolean), images: [], theories: [], audioLabel: 'Listen to the opening', lockedChapters: locked.map(({ title, body }) => ({ title, body })) };
      }));
    } catch { /* Ignore malformed local prototype data and keep the sample stories available. */ }
    return () => { alive = false; window.removeEventListener('focus', refreshPublishedStories); document.removeEventListener('visibilitychange', refreshPublishedStories); };
  }, []);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const allStories = useMemo(() => [...publishedStories, ...initialStories], [publishedStories]);
  const filteredStories = useMemo(() => allStories.filter((story) => {
    const haystack = `${story.title} ${story.excerpt} ${story.category} ${story.author} ${story.body.join(' ')}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'For you' || (activeTab === 'Trending' ? story.predictions > 150 : activeTab === 'New' ? story.progress < 60 : true);
    const matchesSaved = activeNav !== 'Reading list' || savedStories.includes(story.id);
    return matchesSearch && matchesTab && matchesSaved;
  }), [allStories, activeTab, activeNav, savedStories, searchTerm]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  async function toggleSave(id: string) {
    const isSaved = savedStories.includes(id);
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
      try {
        const response = await fetch(isSaved ? `/api/bookmarks?storyId=${encodeURIComponent(id)}` : '/api/bookmarks', isSaved ? { method: 'DELETE' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyId: id }) });
        if (!response.ok) { const result = await response.json().catch(() => ({})); showNotice(result.error || 'Sign in to save stories.'); return; }
      } catch { showNotice('Could not update your reading list.'); return; }
    } else {
      try { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) { showNotice('Sample stories cannot be cloud-bookmarked yet.'); return; } } catch { /* Local sample fallback. */ }
    }
    setSavedStories((current) => { const next = isSaved ? current.filter((item) => item !== id) : [...current, id]; localStorage.setItem(SAVED_KEY, JSON.stringify(next)); return next; });
    showNotice(isSaved ? 'Removed from your reading list.' : 'Saved to your reading list.');
  }

  async function openStory(story: MediaStory) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setPrediction('');
    setSelectedStory(story);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(story.id)) {
      try {
        const response = await fetch(`/api/theories?storyId=${encodeURIComponent(story.id)}`, { cache: 'no-store' });
        const result = await response.json();
        if (response.ok && Array.isArray(result.theories)) {
          const theoryPayload = result as { theories?: CloudTheory[] };
          const theories = (theoryPayload.theories ?? []).map((item) => {
            const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
            return { author: profile?.username || profile?.display_name || 'reader', text: item.body, votes: 0 };
          });
          setSelectedStory((current) => current?.id === story.id ? { ...current, theories } : current);
        }
      } catch { /* Reader can still use the story if theories fail to load. */ }
    }
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
    const utterance = new SpeechSynthesisUtterance(`${selectedStory.title}. ${selectedStory.body.join(' ')}`);
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
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(selectedStory.id)) {
      try {
        const response = await fetch('/api/theories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyId: selectedStory.id, body: prediction.trim() }) });
        const result = await response.json();
        if (!response.ok) { showNotice(result.error || 'Sign in to submit a theory.'); return; }
      } catch { showNotice('Could not submit your theory.'); return; }
    }
    setSubmittedPredictions((current) => { const next = { ...current, [selectedStory.id]: [...(current[selectedStory.id] ?? []), prediction.trim()] }; localStorage.setItem(THEORIES_KEY, JSON.stringify(next)); return next; });
    setPrediction('');
    showNotice(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(selectedStory.id) ? 'Your theory was shared with UNTOLD readers.' : 'Theory added to this sample story on this device.');
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
                <div className="feed-tabs" role="tablist" aria-label="Story feed filters">
                  {['For you', 'Trending', 'New'].map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === 'Trending') setActiveNav('Trending');
                        else if (activeNav === 'Trending') setActiveNav('Discover');
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
                        <span className="story-index">{String(index + 1).padStart(2, '0')}</span>
                        <span className="story-row-copy">
                          <span className="story-row-meta">
                            <span className={`category-pill ${story.category === 'FICTION' ? 'pill-fiction' : ''}`}>
                              {story.category === 'FICTION' ? 'FICTION' : 'REAL LIFE'}
                            </span>
                            <span><Clock3 size={13} /> {story.readTime}</span>
                            <span className="story-row-author">by {story.author}</span>
                          </span>
                          <strong className="story-row-title">{story.title}</strong>
                          <span className="story-row-excerpt">{story.excerpt}</span>
                          <span className="story-row-bottom">
                            <span><MessageCircle size={14} /> {story.comments} theories</span>
                            <span><Heart size={14} /> {story.predictions} predictions</span>
                            <span className="row-read">Open story <ArrowRight size={14} /></span>
                          </span>
                        </span>
                      </button>
                      <button
                        className={`row-bookmark ${savedStories.includes(story.id) ? 'is-saved' : ''}`}
                        aria-label={savedStories.includes(story.id) ? 'Remove bookmark' : 'Bookmark story'}
                        onClick={() => toggleSave(story.id)}
                      >
                        {savedStories.includes(story.id) ? <Check size={17} /> : <Bookmark size={17} />}
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Search size={23} />
                  <strong>{activeNav === 'Reading list' ? 'Your reading list is empty' : 'No stories found'}</strong>
                  <span>{activeNav === 'Reading list' ? 'Save a story and it will be waiting here.' : 'Try another search or tab.'}</span>
                  <button onClick={() => {
                    setSearchTerm('');
                    setActiveTab('For you');
                    setActiveNav('Discover');
                  }}>
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
            <div className="reader-meta"><span className={`category-pill ${selectedStory.category === 'FICTION' ? 'pill-fiction' : ''}`}>{selectedStory.category}</span><span><Clock3 size={13} /> {selectedStory.readTime}</span><span>PART I · THE SETUP</span></div>
            <h1 className="reader-title">{selectedStory.title}</h1>
            <p className="reader-deck">{selectedStory.excerpt}</p>
            <div className="reader-byline"><Avatar initials={selectedStory.initials} color={selectedStory.color} /><div><strong>{selectedStory.author}</strong><span>{selectedStory.handle} · Storyteller</span></div><button className="follow-button" onClick={() => showNotice('Following will be available when accounts are connected.')}>Follow <Plus size={13} /></button></div>
            <div className="reader-tools"><button className={`listen-button ${isSpeaking ? 'listening' : ''}`} onClick={toggleNarration}>{isSpeaking ? <Pause size={16} /> : <Headphones size={16} />}{isSpeaking ? 'Pause narration' : 'Listen to story'}<span><Volume2 size={13} /> browser audio</span></button><button className={`reader-save ${savedStories.includes(selectedStory.id) ? 'is-saved' : ''}`} onClick={() => toggleSave(selectedStory.id)}>{savedStories.includes(selectedStory.id) ? <Check size={16} /> : <Bookmark size={16} />}{savedStories.includes(selectedStory.id) ? 'Saved' : 'Save story'}</button></div>
            <div className="reader-body">{selectedStory.body.slice(0, 2).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <section className="media-section"><div className="media-heading"><div><p className="eyebrow muted-eyebrow"><ImageIcon size={13} /> EVIDENCE & MOMENTS</p><h2>Look a little <em>closer.</em></h2></div><span>01 — {String(selectedStory.images.length).padStart(2, '0')}</span></div><div className="image-gallery">{selectedStory.images.map((image, index) => <button className={`gallery-image gallery-image-${index + 1}`} key={image.src} onClick={() => setLightbox(image)}><img src={image.src} alt={image.alt} /><span className="gallery-caption">{image.caption}</span><span className="gallery-expand"><Plus size={16} /></span></button>)}</div><p className="gallery-hint">A few details may matter more than they seem. Tap an image to look closer.</p></section>
            {(selectedStory.lockedChapters?.length || selectedStory.body.length > 2 || selectedStory.progress < 100) ? <section className="locked-chapter-list"><div className="reveal-card"><div className="reveal-card-icon"><Clock3 size={18} /></div><div><span className="eyebrow muted-eyebrow">THE REST IS STILL HIDDEN</span><h3>The story isn&apos;t over.</h3><p>Titles are visible. The words stay hidden until the creator reveals them.</p></div><span className="reveal-status">REVEAL PENDING</span></div>{(selectedStory.lockedChapters?.length ? selectedStory.lockedChapters : selectedStory.body.slice(2).map((body, index) => ({ title: index === 0 ? 'The next clue' : `Part II · ${index + 1}`, body }))).map((chapter, index) => <section className="reader-locked-part" key={`${chapter.title}-${index}`}><p className="eyebrow muted-eyebrow">PART {String(index + 2).padStart(2, '0')} · REVEAL LATER</p><h3>{chapter.title}</h3><div className="reader-locked-copy" aria-label="Chapter content hidden">{chapter.body || 'The next part is waiting to be revealed.'}</div><div className="reader-locked-message"><Clock3 size={16} /><strong>This part is still hidden</strong><span>Come back when the creator reveals it.</span></div></section>)}</section> : null}
            <section className="theory-section"><div className="theory-heading"><div><p className="eyebrow muted-eyebrow">THE THEORY ROOM</p><h2>What do you <em>think?</em></h2></div><span>{selectedStory.theories.length + (submittedPredictions[selectedStory.id]?.length ?? 0)} THEORIES</span></div><form className="theory-form" onSubmit={(event) => { event.preventDefault(); submitPrediction(); }}><label htmlFor="theory-input">PUT YOUR THEORY ON THE TABLE</label><textarea id="theory-input" value={prediction} onChange={(event) => setPrediction(event.target.value)} placeholder="I think the detail that matters is…" maxLength={500} rows={3} /><div className="theory-form-bottom"><span>{prediction.length}/500 · Be curious, not cruel.</span><button type="submit" disabled={prediction.trim().length < 8}>Submit theory <Send size={14} /></button></div></form><div className="theory-list">{(submittedPredictions[selectedStory.id] ?? []).map((text, index) => <article className="theory-card own-theory" key={`${text}-${index}`}><div className="theory-author"><span className="theory-avatar">Y</span><strong>you</strong><span>just now</span><span className="own-label">YOUR THEORY</span></div><p>{text}</p></article>)}{selectedStory.theories.map((theory) => <article className="theory-card" key={theory.author}><div className="theory-author"><span className="theory-avatar">{theory.author.slice(0, 1).toUpperCase()}</span><strong>{theory.author}</strong><span>reader theory</span></div><p>{theory.text}</p><div className="theory-votes"><button onClick={() => { const key = `${selectedStory.id}:${theory.author}`; setTheoryVotes((current) => { const next = { ...current, [key]: (current[key] ?? 0) + 1 }; localStorage.setItem(VOTES_KEY, JSON.stringify(next)); return next; }); }}><Heart size={14} /> {theory.votes + (theoryVotes[`${selectedStory.id}:${theory.author}`] ?? 0)}</button><button onClick={() => { setPrediction(`@${theory.author} — `); document.getElementById('theory-input')?.focus(); }}><MessageCircle size={14} /> Reply</button></div></article>)}</div></section>
          </article>
        </div>
      )}

      {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={15} /></button></div>}

      {lightbox && <div className="lightbox-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}><button className="lightbox-close" onClick={() => setLightbox(null)} aria-label="Close image"><X size={22} /></button><img src={lightbox.src} alt={lightbox.alt} /><p>{lightbox.caption}</p></div>}

      {showPublish && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPublish(false); }}><section className="modal-card publish-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><button className="modal-close" onClick={() => setShowPublish(false)} aria-label="Close dialog"><X size={18} /></button><span className="eyebrow muted-eyebrow"><BookOpen size={13} /> YOUR STORY STARTS HERE</span><h2 id="publish-title">Leave them <em>wondering.</em></h2><p className="modal-description">A strong opening gives readers a reason to stay.</p><label className="field-label" htmlFor="story-title">STORY TITLE</label><input id="story-title" className="publish-input" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="The night everything changed…" maxLength={100} /><label className="field-label" htmlFor="story-opening">THE FIRST PART</label><textarea id="story-opening" className="publish-textarea" value={newOpening} onChange={(event) => setNewOpening(event.target.value)} placeholder="Start at the moment everything changed…" rows={5} maxLength={5000} /><div className="publish-modal-bottom"><span>Draft only · Publishing will be connected later</span><button className="modal-primary" onClick={publishDraft}>Save draft <ArrowRight size={15} /></button></div></section></div>}
    </main>
  );
}
