'use client';

import { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';

export default function ProfileFollowButton({ creatorId }: { creatorId: string }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/follows', { cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => ({})) }))
      .then(({ response, payload }) => {
        if (active && response.ok && Array.isArray(payload.follows)) {
          setFollowing(payload.follows.some((item: { followed_id: string }) => item.followed_id === creatorId));
        }
      }).catch(() => undefined);
    return () => { active = false; };
  }, [creatorId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(following ? `/api/follows?creatorId=${encodeURIComponent(creatorId)}` : '/api/follows', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: following ? undefined : JSON.stringify({ creatorId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(payload.error || 'Could not update follow.'); return; }
      setFollowing(!following);
      setMessage(!following ? 'You are now following this creator.' : 'You unfollowed this creator.');
    } catch {
      setMessage('Could not connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="public-profile-follow"><button className="creator-primary" type="button" onClick={() => void toggle()} disabled={busy}>{busy ? 'Please wait…' : following ? <><Check size={15}/> Following</> : <><Plus size={15}/> Follow</>}</button>{message ? <p role="status">{message}</p> : null}</div>;
}
