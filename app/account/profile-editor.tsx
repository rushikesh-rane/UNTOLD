'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { prepareAvatar } from '@/lib/avatar-image';

type Fields = { displayName: string; username: string; bio: string; avatarUrl: string | null };

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const USERNAME = /^[a-zA-Z0-9_]{3,24}$/;
const BIO_MAX = 280;
const NAME_MAX = 40;

export default function ProfileEditor({ userId, initial }: { userId: string; initial: Fields }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Fields>(initial);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const cleanName = displayName.trim();
  const cleanUsername = username.trim().replace(/^@/, '');
  const cleanBio = bio.trim();
  const dirty = cleanName !== saved.displayName || cleanUsername !== saved.username || cleanBio !== saved.bio || avatarUrl !== saved.avatarUrl;

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { setMessage({ kind: 'error', text: 'Use a JPG, PNG, WebP or GIF image.' }); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage({ kind: 'error', text: 'Images must be 5 MB or smaller.' }); return; }
    setUploading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const upload = await prepareAvatar(file);
      const path = `${userId}/avatars/${crypto.randomUUID()}.${upload.ext}`;
      const { error } = await supabase.storage.from('story-images').upload(path, upload.blob, {
        contentType: upload.blob.type,
        upsert: false,
        cacheControl: '31536000', // unique file names, so a long cache is safe
      });
      if (error) throw error;
      const { data } = supabase.storage.from('story-images').getPublicUrl(path);
      if (!data.publicUrl) throw new Error('Could not create the photo URL.');
      setAvatarUrl(data.publicUrl);
      setMessage({ kind: 'ok', text: 'Photo ready. Press Save changes to keep it.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Could not upload the photo.' });
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    if (!cleanName || cleanName.length > NAME_MAX) { setMessage({ kind: 'error', text: `Display name must be 1–${NAME_MAX} characters.` }); return; }
    if (cleanUsername && !USERNAME.test(cleanUsername)) { setMessage({ kind: 'error', text: 'Usernames are 3–24 letters, numbers or underscores.' }); return; }
    setSaving(true);
    setMessage(null);
    try {
      const supabase = createClient();
      // Profile links match usernames ignoring case, so "Sam" and "sam" must not both exist.
      if (cleanUsername && cleanUsername.toLowerCase() !== saved.username.toLowerCase()) {
        const pattern = cleanUsername.replace(/[\\%_]/g, '\\$&');
        const { data: clash } = await supabase.from('profiles').select('id').ilike('username', pattern).neq('id', userId).limit(1);
        if (clash?.length) { setMessage({ kind: 'error', text: 'That username is already taken.' }); return; }
      }
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        display_name: cleanName,
        username: cleanUsername || null,
        bio: cleanBio,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (error) {
        setMessage({ kind: 'error', text: error.code === '23505' ? 'That username is already taken.' : error.code === '23514' ? 'Usernames are 3–24 letters, numbers or underscores.' : 'Could not save your profile. Please try again.' });
        return;
      }
      setSaved({ displayName: cleanName, username: cleanUsername, bio: cleanBio, avatarUrl });
      setDisplayName(cleanName);
      setUsername(cleanUsername);
      setBio(cleanBio);
      setMessage({ kind: 'ok', text: 'Profile saved.' });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Could not save your profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-edit" onSubmit={save} noValidate>
      <div className="profile-edit-photo">
        <div className="account-avatar profile-edit-avatar">{avatarUrl ? <img src={avatarUrl} alt="Your profile photo" /> : <UserRound size={26} />}</div>
        <div className="cover-upload-actions">
          <label className={`creator-image-button ${uploading ? 'is-disabled' : ''}`}>
            <ImagePlus size={15} />{uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={uploading} onChange={(event) => { void uploadAvatar(event.target.files?.[0]); event.currentTarget.value = ''; }} hidden />
          </label>
          {avatarUrl && !uploading ? <button type="button" className="creator-image-button" onClick={() => setAvatarUrl(null)}><Trash2 size={14} /> Remove</button> : null}
        </div>
      </div>

      <label className="creator-label" htmlFor="profile-display-name">DISPLAY NAME</label>
      <input id="profile-display-name" className="creator-input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={NAME_MAX} autoComplete="name" />

      <label className="creator-label" htmlFor="profile-username">USERNAME (OPTIONAL)</label>
      <input id="profile-username" className="creator-input" value={username} onChange={(event) => setUsername(event.target.value)} maxLength={25} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="yourname" />
      <span className="creator-help">3–24 letters, numbers or underscores. Your profile link becomes /u/{cleanUsername || 'yourname'}.</span>

      <label className="creator-label" htmlFor="profile-bio">BIO</label>
      <textarea id="profile-bio" className="creator-textarea profile-edit-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={BIO_MAX} placeholder="A line or two about you and what you write." />
      <span className="creator-help">{bio.length}/{BIO_MAX}</span>

      <div className="profile-edit-footer">
        <button type="submit" className="creator-primary" disabled={!dirty || saving || uploading}>{saving ? 'Saving…' : 'Save changes'}</button>
        {message ? <p className={`profile-edit-message ${message.kind}`} role="status">{message.text}</p> : null}
      </div>
    </form>
  );
}
