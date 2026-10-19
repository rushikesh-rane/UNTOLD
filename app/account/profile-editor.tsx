'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Trash2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { errorText, prepareImage, randomFileId } from '@/lib/image-upload';

type Fields = { displayName: string; username: string; bio: string; avatarUrl: string | null };

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
  // Photo status is shown right beside the photo; the form message sits at the bottom, out of sight.
  const [photoMessage, setPhotoMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const cleanName = displayName.trim();
  const cleanUsername = username.trim().replace(/^@/, '');
  const cleanBio = bio.trim();
  const dirty = cleanName !== saved.displayName || cleanUsername !== saved.username || cleanBio !== saved.bio || avatarUrl !== saved.avatarUrl;

  // Saves just the photo to the profile right away, so choosing a photo is all it takes.
  async function persistAvatar(url: string | null) {
    const supabase = createClient();
    const { error } = await supabase.from('profiles').upsert(
      { id: userId, avatar_url: url, updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
    if (error) throw error;
    setAvatarUrl(url);
    setSaved((current) => ({ ...current, avatarUrl: url }));
    router.refresh();
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    setUploading(true);
    setPhotoMessage(null);
    try {
      const supabase = createClient();
      const upload = await prepareImage(file, { maxSide: 320, square: true, quality: 0.88 });
      const path = `${userId}/avatars/${randomFileId()}.${upload.ext}`;
      const { error } = await supabase.storage.from('story-images').upload(path, upload.blob, {
        contentType: upload.type,
        upsert: false,
        cacheControl: '31536000', // unique file names, so a long cache is safe
      });
      if (error) throw error;
      const { data } = supabase.storage.from('story-images').getPublicUrl(path);
      if (!data.publicUrl) throw new Error('Could not create the photo URL.');
      await persistAvatar(data.publicUrl);
      setPhotoMessage({ kind: 'ok', text: 'Profile photo updated.' });
    } catch (error) {
      setPhotoMessage({ kind: 'error', text: `Couldn’t update your photo: ${errorText(error, 'unknown error')}` });
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    setPhotoMessage(null);
    try {
      await persistAvatar(null);
      setPhotoMessage({ kind: 'ok', text: 'Profile photo removed.' });
    } catch (error) {
      setPhotoMessage({ kind: 'error', text: `Couldn’t remove your photo: ${errorText(error, 'unknown error')}` });
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
            <input type="file" accept="image/*,.heic,.heif" disabled={uploading} onChange={(event) => { const input = event.currentTarget; void uploadAvatar(input.files?.[0]).finally(() => { input.value = ''; }); }} hidden />
          </label>
          {avatarUrl && !uploading ? <button type="button" className="creator-image-button" onClick={() => void removeAvatar()}><Trash2 size={14} /> Remove</button> : null}
          {photoMessage ? <p className={`profile-edit-message ${photoMessage.kind}`} role="status" style={{ flexBasis: '100%', margin: 0 }}>{photoMessage.text}</p> : null}
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
