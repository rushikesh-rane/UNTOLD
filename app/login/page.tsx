'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice('');
    try {
      const supabase = createClient();
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName.trim() || 'Reader' }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setNotice('Account created. Check your email to confirm your address before signing in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(searchParams.get('next') || '/');
        router.refresh();
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><header className="auth-topbar"><Link href="/" className="creator-back"><ArrowLeft size={16}/> Back to Discover</Link><Link href="/" className="brand-lockup"><span className="brand-mark"><BookOpen size={19}/></span><span className="brand-word">un<span>told</span><i>.</i></span></Link><span /></header><section className="auth-card"><div className="auth-mark"><BookOpen size={22}/></div><p className="creator-kicker">YOUR NEXT CHAPTER STARTS HERE</p><h1>{mode === 'signin' ? 'Welcome back.' : 'Find your voice.'}</h1><p className="auth-intro">{mode === 'signin' ? 'Sign in to keep your stories and theories together.' : 'Create an account to save stories and start writing.'}</p><form onSubmit={submit} className="auth-form">{mode === 'signup' && <label className="creator-label">DISPLAY NAME<input className="creator-input" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60} placeholder="What readers call you" autoComplete="name"/></label>}<label className="creator-label">EMAIL ADDRESS<input className="creator-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com"/></label><label className="creator-label">PASSWORD<input className="creator-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters"/></label><button className="creator-primary auth-submit" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="auth-spinner"/> : null}{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form>{notice && <p role="status" className="auth-notice">{notice}</p>}<p className="auth-switch">{mode === 'signin' ? 'New to UNTOLD?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setNotice(''); }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>{process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO === 'true' && <div className="local-demo-box"><p className="auth-footnote">Just exploring? Open the local demo without creating an account.</p><a className="creator-secondary" href="/demo-access">Enter demo mode</a></div>}<p className="auth-footnote">Your account is secured by Supabase authentication.</p></section></main>;
}
