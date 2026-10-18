'use client';

import StoryEditor, {

  type StoryEditorHandle,

} from '@/components/StoryEditor';

import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';

import type React from 'react';

import { createClient } from '@/lib/supabase/client';

import { ArrowLeft, BookOpen, Check, ChevronDown, Clock3, Eye, FileText, ImagePlus, Plus, Save, Send, Sparkles, Trash2 } from 'lucide-react';





type Chapter = { id: string; title: string; body: string; reveal: 'now' | 'later' };

type Draft = { id: string; title: string; category: string; synopsis: string; coverUrl?: string; chapters: Chapter[]; updatedAt: string };

type PublishedStory = { id: string; title: string; genre: string; synopsis: string | null; cover_url?: string | null; published_at: string | null; chapters?: { id: string }[] };

type EditableChapterRow = { id: string; title: string | null; body: string | null; position: number; is_revealed: boolean };



function renderChapterBody(body: string) {

  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

  const content: React.ReactNode[] = [];

  let lastIndex = 0;

  let match: RegExpExecArray | null;

  let index = 0;



  while ((match = imagePattern.exec(body)) !== null) {

    const textBefore = body.slice(lastIndex, match.index).trim();



    if (textBefore) {

      content.push(

        ...textBefore.split(/\n{2,}/).map((paragraph) => (

          <p

            key={`text-${index++}`}

            style={{ whiteSpace: 'pre-line' }}

          >

            {paragraph}

          </p>

        ))

      );

    }



    content.push(

      <figure

        key={`image-${index++}`}

        style={{ margin: '20px 0' }}

      >

        <img

          src={match[2]}

          alt={match[1] || 'Story illustration'}

          style={{

            display: 'block',

            width: '100%',

            maxHeight: '560px',

            objectFit: 'contain',

            borderRadius: '12px',

          }}

        />

        {match[1] && (

          <figcaption style={{ marginTop: '8px' }}>

            {match[1]}

          </figcaption>

        )}

      </figure>

    );



    lastIndex = imagePattern.lastIndex;

  }



  const remainingText = body.slice(lastIndex).trim();



  if (remainingText) {

    content.push(

      ...remainingText.split(/\n{2,}/).map((paragraph) => (

        <p

          key={`text-${index++}`}

          style={{ whiteSpace: 'pre-line' }}

        >

          {paragraph}

        </p>

      ))

    );

  }



  return content;

}



const makeChapter = (n: number): Chapter => ({ id: `${Date.now()}-${n}`, title: n === 1 ? 'The setup' : `Part ${n}`, body: '', reveal: n === 1 ? 'now' : 'later' });



export default function WritePage() {

  const [title, setTitle] = useState('');

  const [category, setCategory] = useState('Mystery');

  const [synopsis, setSynopsis] = useState('');

  const [chapters, setChapters] = useState<Chapter[]>([makeChapter(1)]);

  const [activeChapter, setActiveChapter] = useState(0);

  const [drafts, setDrafts] = useState<Draft[]>([]);

  const [publishedStories, setPublishedStories] = useState<PublishedStory[]>([]);

  const [coverUrl, setCoverUrl] = useState('');

  const [uploadingImage, setUploadingImage] = useState(false);

  const storyEditorRef = useRef<StoryEditorHandle>(null);

  const [notice, setNotice] = useState('');

  const [preview, setPreview] = useState(false);

  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);

  const [activeStoryStatus, setActiveStoryStatus] = useState<'draft' | 'published'>('draft');

  const [busy, setBusy] = useState(false);



  useEffect(() => {

    let alive = true;

    async function loadCloudDrafts() {

      try {

        const supabase = createClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) { if (alive) notify('Please sign in to use Creator Studio.'); return; }

        const { data, error } = await supabase.from('stories').select('id,title,genre,synopsis,cover_url,updated_at,status').eq('author_id', user.id).eq('status', 'draft').order('updated_at', { ascending: false });

        if (error) throw error;

        const { data: publishedRows, error: publishedError } = await supabase.from('stories').select('id,title,genre,synopsis,cover_url,published_at,chapters(id)').eq('author_id', user.id).eq('status', 'published').order('published_at', { ascending: false });

        if (publishedError) throw publishedError;

        if (alive) setPublishedStories((publishedRows ?? []) as PublishedStory[]);

        const rows = data ?? [];

        const hydrated: Draft[] = await Promise.all(rows.map(async (row) => {

          const { data: chapterRows } = await supabase.from('chapters').select('id,title,body,is_revealed').eq('story_id', row.id).order('position');

          return { id: row.id, title: row.title, category: row.genre, synopsis: row.synopsis ?? '', coverUrl: row.cover_url ?? '', updatedAt: row.updated_at, chapters: (chapterRows ?? []).map((c, i) => ({ id: c.id, title: c.title, body: c.body, reveal: c.is_revealed ? 'now' as const : 'later' as const })).concat((chapterRows ?? []).length ? [] : [makeChapter(1)]) };

        }));

        if (alive) setDrafts(hydrated);

      } catch (error) { if (alive) notify(error instanceof Error ? error.message : 'Could not load cloud drafts.'); }

    }

    loadCloudDrafts();

    return () => { alive = false; };

  }, []);

  function notify(message: string) { setNotice(message); window.setTimeout(() => setNotice(''), 3500); }

  async function saveDraft() {

    if (title.trim().length < 4) { notify('Give your story a title of at least 4 characters.'); return; }

    if (!chapters.some((chapter) => chapter.body.trim().length > 0)) { notify('Write something in at least one chapter before saving.'); return; }

    setBusy(true);

    try {

      const supabase = createClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) throw new Error('Your session has expired. Please sign in again.');

      let storyId = activeStoryId;

      const payload = { author_id: user.id, title: title.trim(), genre: category, synopsis: synopsis.trim(), cover_url: coverUrl || null, status: activeStoryStatus };

      if (storyId) { const { error } = await supabase.from('stories').update(payload).eq('id', storyId); if (error) throw error; }

      else { const { data, error } = await supabase.from('stories').insert(payload).select('id').single(); if (error) throw error; storyId = data.id; setActiveStoryId(storyId); }

      const { error: deleteError } = await supabase.from('chapters').delete().eq('story_id', storyId); if (deleteError) throw deleteError;

      const chapterRows = chapters.map((c, i) => ({ story_id: storyId!, author_id: user.id, position: i + 1, title: c.title.trim() || `Part ${i + 1}`, body: c.body, is_revealed: c.reveal === 'now' }));

      const { error: chapterError } = await supabase.from('chapters').insert(chapterRows); if (chapterError) throw chapterError;

      const draft: Draft = { id: storyId!, title: title.trim(), category, synopsis: synopsis.trim(), coverUrl, chapters, updatedAt: new Date().toISOString() };

      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);

      notify('Draft saved to your UNTOLD account.');

    } catch (error) { notify(error instanceof Error ? error.message : 'Could not save draft.'); }

    finally { setBusy(false); }

  }

  async function publishStory() {

    if (title.trim().length < 4) { notify('Give your story a title of at least 4 characters.'); return; }

    if (!chapters.some((item) => item.reveal === 'now' && item.body.trim().length > 0)) { notify('Add content to at least one chapter marked Available now.'); return; }

    setBusy(true);

    try {

      const supabase = createClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) throw new Error('Please sign in before publishing.');

      let storyId = activeStoryId;

      const payload = { author_id: user.id, title: title.trim(), genre: category, synopsis: synopsis.trim(), cover_url: coverUrl || null, status: 'published' as const };

      if (storyId) { const { error } = await supabase.from('stories').update(payload).eq('id', storyId); if (error) throw error; }

      else { const { data, error } = await supabase.from('stories').insert(payload).select('id').single(); if (error) throw error; storyId = data.id; setActiveStoryId(storyId); }

      const { error: deleteError } = await supabase.from('chapters').delete().eq('story_id', storyId); if (deleteError) throw deleteError;

      const chapterRows = chapters.map((c, i) => ({ story_id: storyId!, author_id: user.id, position: i + 1, title: c.title.trim() || `Part ${i + 1}`, body: c.body, is_revealed: c.reveal === 'now' }));

      const { error: chapterError } = await supabase.from('chapters').insert(chapterRows); if (chapterError) throw chapterError;

      setDrafts((current) => current.filter((item) => item.id !== storyId));

      const { data: refreshedPublished, error: refreshError } = await supabase.from('stories').select('id,title,genre,synopsis,cover_url,published_at,chapters(id)').eq('author_id', user.id).eq('status', 'published').order('published_at', { ascending: false });

      if (refreshError) throw refreshError;

      setPublishedStories((refreshedPublished ?? []) as PublishedStory[]);

      notify('Story published. It now appears in your Published Stories list.');

    } catch (error) { notify(error instanceof Error ? error.message : 'Could not publish story.'); }

    finally { setBusy(false); }

  }

  async function loadDraft(draft: Draft) { setActiveStoryStatus('draft'); setActiveStoryId(draft.id); setTitle(draft.title); setCategory(draft.category); setSynopsis(draft.synopsis); setCoverUrl(draft.coverUrl || ''); setChapters(draft.chapters); setActiveChapter(0); window.scrollTo({ top: 0, behavior: 'smooth' }); notify(`Loaded “${draft.title}”.`); }

  async function editPublishedStory(story: PublishedStory) {

    setBusy(true);

    try {

      const supabase = createClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) throw new Error('Please sign in again.');

      const { data: row, error } = await supabase.from('stories').select('id,title,genre,synopsis,cover_url,status,chapters(id,title,body,position,is_revealed)').eq('id', story.id).eq('author_id', user.id).eq('status', 'published').single();

      if (error) throw error;

      const rows = [...((row.chapters ?? []) as EditableChapterRow[])].sort((a, b) => a.position - b.position);

      setActiveStoryId(row.id); setActiveStoryStatus('published'); setTitle(row.title); setCategory(row.genre || 'Mystery'); setSynopsis(row.synopsis || ''); setCoverUrl(row.cover_url || '');

      setChapters(rows.length ? rows.map((c) => ({ id: c.id, title: c.title || '', body: c.body || '', reveal: c.is_revealed ? 'now' as const : 'later' as const })) : [makeChapter(1)]);

      setActiveChapter(0); window.scrollTo({ top: 0, behavior: 'smooth' }); notify(`Loaded published story “${row.title}” for editing.`);

    } catch (error) { notify(error instanceof Error ? error.message : 'Could not load this story.'); }

    finally { setBusy(false); }

  }

  async function deletePublishedStory(story: PublishedStory) {

    if (!window.confirm(`Delete “${story.title}” permanently? This cannot be undone.`)) return;

    setBusy(true);

    try {

      const supabase = createClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) throw new Error('Please sign in again.');

      const { error } = await supabase.from('stories').delete().eq('id', story.id).eq('author_id', user.id).eq('status', 'published');

      if (error) throw error;

      setPublishedStories((items) => items.filter((item) => item.id !== story.id));

      if (activeStoryId === story.id) { setActiveStoryId(null); setActiveStoryStatus('draft'); }

      notify('Published story deleted.');

    } catch (error) { notify(error instanceof Error ? error.message : 'Could not delete story. Check database permissions.'); }

    finally { setBusy(false); }

  }

  function startNewStory() { setActiveStoryId(null); setActiveStoryStatus('draft'); setTitle(''); setCategory('Mystery'); setSynopsis(''); setCoverUrl(''); setChapters([makeChapter(1)]); setActiveChapter(0); notify('Started a new story.'); }

  const chapter = chapters[activeChapter];



  async function insertChapterImage(file?: File) {

    if (!file) return;



    if (!file.type.startsWith('image/')) {

      notify('Choose an image file.');

      return;

    }



    if (file.size > 5 * 1024 * 1024) {

      notify('Images must be 5 MB or smaller.');

      return;

    }



    setUploadingImage(true);



    try {

      const supabase = createClient();

      const {

        data: { user },

        error: authError,

      } = await supabase.auth.getUser();



      if (authError || !user) {

        throw new Error('Sign in before adding images.');

      }



      const extension =

        file.name.split('.').pop()?.toLowerCase()

          .replace(/[^a-z0-9]/g, '') || 'jpg';



      const path = `${user.id}/${crypto.randomUUID()}.${extension}`;



      const { error: uploadError } = await supabase.storage

        .from('story-images')

        .upload(path, file, {

          contentType: file.type,

          upsert: false,

        });



      if (uploadError) throw uploadError;



      const { data } = supabase.storage

        .from('story-images')

        .getPublicUrl(path);



      if (!data.publicUrl) {

        throw new Error('Could not create the image URL.');

      }



      storyEditorRef.current?.insertImage(

        data.publicUrl,

        file.name

      );



      notify('Image uploaded and inserted into your story.');

    } catch (error) {

      notify(

        error instanceof Error

          ? error.message

          : 'Could not upload image. Check the story-images bucket.'

      );

    } finally {

      setUploadingImage(false);

    }

  }



  function updateChapter(key: 'title' | 'body' | 'reveal', value: string) { setChapters((all) => all.map((item, index) => index === activeChapter ? { ...item, [key]: value } : item)); }



  return <main className="creator-shell">



    <header className="creator-topbar"><Link href="/" className="creator-back"><ArrowLeft size={16} /> Back to Discover</Link><Link href="/" className="brand-lockup"><span className="brand-mark"><BookOpen size={19} /></span><span className="brand-word">un<span>told</span><i>.</i></span></Link><span className="creator-status"><span /> DRAFT WORKSPACE</span></header>

    <div className="creator-layout">

      <section className="creator-main">

        <div className="creator-kicker"><Sparkles size={14} /> THE CREATOR STUDIO</div>{activeStoryId && <div className="editing-story-banner"><span>EDITING {activeStoryStatus.toUpperCase()} STORY</span><button type="button" onClick={startNewStory}>＋ New story</button></div>}

        <h1>Every mystery<br />starts <em>somewhere.</em></h1>

        <p className="creator-lead">Build your story one reveal at a time. Drafts and published stories are stored in your UNTOLD Supabase account.</p>

        <div className="creator-step-heading"><span>01</span><div><h2>Set the scene</h2><p>Give readers just enough to want more.</p></div></div>

        <label className="creator-label" htmlFor="creator-title">STORY TITLE</label><input id="creator-title" className="creator-input creator-title-input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="The thing nobody noticed…" />

        <div className="creator-two-col"><div><label className="creator-label" htmlFor="creator-category">GENRE</label><div className="creator-select-wrap"><select id="creator-category" className="creator-input" value={category} onChange={(e) => setCategory(e.target.value)}>{['Mystery', 'Real life', 'Thriller', 'Romance', 'Horror', 'Drama', 'Science fiction', 'Fantasy'].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></div></div><div><label className="creator-label" htmlFor="creator-synopsis">SHORT TEASER</label><input id="creator-synopsis" className="creator-input" value={synopsis} onChange={(e) => setSynopsis(e.target.value)} maxLength={220} placeholder="A hint, not the answer…" /></div></div>

        <div className="creator-image-field"><label className="creator-label" htmlFor="creator-cover-url">COVER IMAGE URL (OPTIONAL)</label><input id="creator-cover-url" className="creator-input" type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" /><span className="creator-help">Use a direct image URL for the story cover.</span></div>

        <div className="creator-step-heading creator-chapter-heading"><span>02</span><div><h2>Write the chapters</h2><p>Decide what readers learn now—and what stays hidden.</p></div></div>

        <div className="chapter-tabs">{chapters.map((item, index) => <button key={item.id} className={activeChapter === index ? 'chapter-tab active' : 'chapter-tab'} onClick={() => setActiveChapter(index)}><FileText size={14} />{item.title || `Part ${index + 1}`}<span>{index + 1}</span></button>)}<button className="add-chapter" onClick={() => { const next = [...chapters, makeChapter(chapters.length + 1)]; setChapters(next); setActiveChapter(next.length - 1); }}><Plus size={15} /> Add part</button></div>

        {chapter && <div className="chapter-editor"><label className="creator-label" htmlFor="chapter-name">PART TITLE</label><input id="chapter-name" className="creator-input" value={chapter.title} onChange={(e) => updateChapter('title', e.target.value)} placeholder="The setup" maxLength={80} /><div className="creator-image-toolbar"><label className="creator-label body-label" htmlFor="chapter-body">THE STORY</label><label className={`creator-image-button ${uploadingImage ? 'is-disabled' : ''}`}><ImagePlus size={15} />{uploadingImage ? 'Uploading image…' : 'Insert image'}<input type="file" accept="image/*" disabled={uploadingImage} onChange={(event) => { void insertChapterImage(event.target.files?.[0]); event.currentTarget.value = ''; }} hidden /></label></div>

          <div className="creator-textarea story-editor-wrapper">

            <StoryEditor

              ref={storyEditorRef}

              value={chapter.body}

              onChange={(markdown) => updateChapter('body', markdown)}

            />

          </div>



          <p className="creator-help">

            Maximum 5 MB per image.

          </p>





          <div className="editor-foot"><span>{chapter.body.length.toLocaleString()} / 12,000 characters</span><span>Tip: end the part with a question, clue, or contradiction.</span></div><div className="reveal-setting"><div className="reveal-setting-icon"><Clock3 size={17} /></div><div className="reveal-setting-copy"><strong>When should this part appear?</strong><span>Reveal timing is a planning setting in this prototype.</span></div><select aria-label="Chapter reveal timing" value={chapter.reveal} onChange={(e) => updateChapter('reveal', e.target.value)}><option value="now">Available now</option><option value="later">Reveal later</option></select></div>{chapters.length > 1 && <button className="remove-chapter" onClick={() => { const next = chapters.filter((_, index) => index !== activeChapter); setChapters(next); setActiveChapter(Math.max(0, activeChapter - 1)); }}><Trash2 size={14} /> Remove this part</button>}</div>}

        <div className="creator-actions"><button className="creator-secondary" onClick={() => setPreview(true)}><Eye size={16} /> Preview</button><button className="creator-secondary" disabled={busy} onClick={saveDraft}><Save size={16} /> Save draft</button><button className="creator-primary" disabled={busy} onClick={publishStory}><Send size={16} /> {busy ? 'Saving…' : 'Publish story'}</button></div>

        <div className="creator-publish-note"><Check size={16} /><p><strong>Cloud-connected workspace.</strong> Your drafts and chapters are stored in Supabase and tied to your signed-in account. Unrevealed chapters are marked separately and protected by database policies.</p></div>

      </section>

      <aside className="creator-aside"><section className="creator-aside-card creator-guide-card"><span className="aside-icon"><BookOpen size={18} /></span><p className="creator-label">A GOOD UNTOLD STORY</p><h3>Leave a little<br /><em>unsaid.</em></h3><ul><li><span>01</span><div><strong>Open with a moment</strong><p>Start where something changes.</p></div></li><li><span>02</span><div><strong>Plant a clue</strong><p>Give readers something specific to notice.</p></div></li><li><span>03</span><div><strong>Hold back the answer</strong><p>End a part with a reason to return.</p></div></li></ul><Link href="/how-it-works" className="creator-text-link">How UNTOLD works <span>→</span></Link></section>

        <section className="creator-aside-card published-stories-card">
          <div className="saved-drafts-head">
            <div><p className="creator-label">YOUR WORK</p><h3>Published stories</h3></div>
            <span className="draft-count">{publishedStories.length}</span>
          </div>
          {publishedStories.length ? <div className="ps-list">
            {publishedStories.map((story) => {
              const chapterCount = story.chapters?.length ?? 0;
              return (
                <article className="ps-card" key={story.id}>
                  <div className="ps-body">
                    <div className="ps-meta">
                      <span className="ps-genre">{story.genre || 'Story'}</span>
                      <span className="ps-chapters">{chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}</span>
                      <span className="ps-live"><i /> Live</span>
                    </div>
                    <h4 className="ps-title">{story.title}</h4>
                    <p className={`ps-synopsis${story.synopsis ? '' : ' muted'}`}>{story.synopsis || 'Your story is live on UNTOLD.'}</p>
                    <div className="ps-date"><Clock3 size={13} /><span>Published {story.published_at ? new Date(story.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date unavailable'}</span></div>
                  </div>
                  <div className="ps-cover">
                    {story.cover_url ? <img src={story.cover_url} alt={`Cover for ${story.title}`} loading="lazy" /> : <div className="ps-cover-placeholder"><BookOpen size={22} /><span>UNTOLD</span></div>}
                  </div>
                  <div className="ps-actions">
                    <button type="button" className="ps-btn ps-btn-delete" aria-label={`Delete ${story.title}`} title="Delete story" disabled={busy} onClick={() => void deletePublishedStory(story)}><Trash2 size={15} /></button>
                    <button type="button" className="ps-btn ps-btn-edit" disabled={busy} onClick={() => void editPublishedStory(story)}><FileText size={14} /> Edit</button>
                    <Link href={`/account#published-${story.id}`} className="ps-btn ps-btn-view">View <ArrowLeft size={14} /></Link>
                  </div>
                </article>
              );
            })}
          </div> : <div className="no-drafts"><FileText size={22} /><strong>No published stories yet</strong><p>Stories you publish will appear here and on your profile.</p></div>}
        </section>

        <section className="creator-aside-card saved-drafts-card"><div className="saved-drafts-head"><div><p className="creator-label">YOUR WORK</p><h3>Saved drafts</h3></div><span className="draft-count">{drafts.length}</span></div>{drafts.length ? <div className="saved-draft-list">{drafts.map((draft) => <div className="saved-draft" key={draft.id}><button onClick={() => loadDraft(draft)}><strong>{draft.title}</strong><span>{draft.category} · {draft.chapters.length} part{draft.chapters.length === 1 ? '' : 's'}</span><small>Updated {new Date(draft.updatedAt).toLocaleDateString()}</small></button><button aria-label={`Delete ${draft.title}`} className="delete-draft" onClick={async () => { const supabase = createClient(); const { error } = await supabase.from('stories').delete().eq('id', draft.id); if (error) notify(error.message); else { setDrafts((current) => current.filter((item) => item.id !== draft.id)); notify('Draft deleted.'); } }}><Trash2 size={14} /></button></div>)}</div> : <div className="no-drafts"><FileText size={22} /><strong>No drafts yet</strong><p>Your cloud drafts will appear here on any device after you sign in.</p></div>}</section>

      </aside>

    </div>

    {notice && <div className="creator-toast" role="status"><Check size={16} />{notice}</div>}

    {preview && <div className="creator-preview-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreview(false); }}><section className="creator-preview" role="dialog" aria-modal="true" aria-labelledby="preview-title"><button className="preview-close" onClick={() => setPreview(false)}>×</button><p className="creator-label">STORY PREVIEW · NOT PUBLISHED</p><span className="preview-genre">{category.toUpperCase()}</span><h2 id="preview-title">{title || 'Your story title'}</h2><p className="preview-synopsis">{synopsis || 'Your short teaser will appear here.'}</p>{chapters.map((item, index) => <section className={`preview-part ${item.reveal === 'later' ? 'preview-part-locked' : ''}`} key={item.id}><p className="creator-label">PART {String(index + 1).padStart(2, '0')} · {item.reveal === 'later' ? 'REVEAL LATER' : 'AVAILABLE NOW'}</p><h3>{item.title || `Part ${index + 1}`}</h3>{item.reveal === 'later' ? <><div className="preview-locked-copy" aria-label="Chapter content hidden until reveal"><div className="preview-chapter-content">

      {renderChapterBody(

        item.body || 'Your chapter text will appear here as you write.'

      )}

    </div></div><div className="preview-locked-overlay"><span className="preview-lock-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg></span><strong>This part is still hidden</strong><span>The story continues when the creator reveals it.</span></div></> : <div className="preview-chapter-content">

      {renderChapterBody(

        item.body || 'Your chapter text will appear here as you write.'

      )}

    </div>}</section>)}<button className="creator-primary preview-done" onClick={() => setPreview(false)}>Back to editor</button></section></div>}

  </main>;

}