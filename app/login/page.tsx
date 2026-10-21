
'use client';

import Link from 'next/link';
import { Suspense, type FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, LoaderCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Turnstile from '@/components/Turnstile';
import { safeNextPath } from '@/lib/security';

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const MIN_PASSWORD_LENGTH = 10;
const MAX_FAILED_ATTEMPTS = 5;
const COOL_DOWN_SECONDS = 30;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');

    // A short cool-down after repeated failures. (Supabase enforces the real limits server-side; this just
    // slows down a script or a person guessing passwords from this page.)
    const waitSeconds = Math.ceil((lockedUntil - Date.now()) / 1000);
    if (waitSeconds > 0) {
      setNotice(`Too many attempts. Please wait ${waitSeconds} seconds and try again.`);
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setNotice(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setNotice('Your password needs at least one letter and one number.');
        return;
      }
      if (password.toLowerCase().includes(cleanEmail.split('@')[0]) && cleanEmail.split('@')[0].length >= 4) {
        setNotice('Your password should not contain your email name.');
        return;
      }
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setNotice('Please wait for the security check to finish, then try again.');
      return;
    }

    setBusy(true);

    try {
      const supabase = createClient();
      const captchaOptions = captchaToken ? { captchaToken } : {};

      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: displayName.trim().slice(0, 60) || 'Reader',
            },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            ...captchaOptions,
          },
        });

        if (error) throw error;

        setNotice(
          'Account created. Check your email to confirm your address before signing in.',
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
          options: { ...captchaOptions },
        });

        if (error) throw error;

        setFailedAttempts(0);
        router.push(safeNextPath(searchParams.get('next')));
        router.refresh();
      }
    } catch (error) {
      if (mode === 'signin') {
        const attempts = failedAttempts + 1;
        setFailedAttempts(attempts);
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          setLockedUntil(Date.now() + COOL_DOWN_SECONDS * 1000);
          setFailedAttempts(0);
        }
      }
      setNotice(
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
      // A CAPTCHA token works once, so ask for a fresh one for the next attempt.
      if (TURNSTILE_SITE_KEY) setCaptchaReset((value) => value + 1);
    }
  }

  return (
    <main className="auth-shell">
      <header className="auth-topbar">
        <Link href="/" className="creator-back">
          <ArrowLeft size={16} />
          Back to Discover
        </Link>

        <Link href="/" className="brand-lockup">
          <span className="brand-mark">
            <BookOpen size={19} />
          </span>
          <span className="brand-word">
            un<span>told</span>
            <i>.</i>
          </span>
        </Link>

        <span />
      </header>

      <section className="auth-card">
        <div className="auth-mark">
          <BookOpen size={22} />
        </div>

        <p className="creator-kicker">YOUR NEXT CHAPTER STARTS HERE</p>

        <h1>{mode === 'signin' ? 'Welcome back.' : 'Find your voice.'}</h1>

        <p className="auth-intro">
          {mode === 'signin'
            ? 'Sign in to keep your stories and theories together.'
            : 'Create an account to save stories and start writing.'}
        </p>

        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && (
            <label className="creator-label">
              DISPLAY NAME
              <input
                className="creator-input"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={60}
                placeholder="What readers call you"
                autoComplete="name"
              />
            </label>
          )}

          <label className="creator-label">
            EMAIL ADDRESS
            <input
              className="creator-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="creator-label">
            PASSWORD
            <input
              className="creator-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              maxLength={128}
              autoComplete={
                mode === 'signin' ? 'current-password' : 'new-password'
              }
              placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD_LENGTH} characters, with a letter and a number` : 'Your password'}
            />
          </label>

          {TURNSTILE_SITE_KEY ? (
            <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setCaptchaToken} resetKey={captchaReset} />
          ) : null}

          <button
            className="creator-primary auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy && <LoaderCircle size={16} className="auth-spinner" />}
            {busy
              ? 'Please wait…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        {notice && (
          <p role="status" className="auth-notice">
            {notice}
          </p>
        )}

        <p className="auth-switch">
          {mode === 'signin'
            ? 'New to UNTOLD?'
            : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setNotice('');
            }}
          >
            {mode === 'signin' ? 'Create an account' : 'Sign in'}
          </button>
        </p>

        {process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEMO === 'true' && (
          <div className="local-demo-box">
            <p className="auth-footnote">
              Just exploring? Open the local demo without creating an account.
            </p>
            <a className="creator-secondary" href="/demo-access">
              Enter demo mode
            </a>
          </div>
        )}

        <p className="auth-footnote">
          Your account is secured by Supabase authentication.
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-shell">
          <section className="auth-card" aria-label="Loading login">
            <LoaderCircle size={24} className="auth-spinner" />
            <p className="auth-intro">Loading your next chapter…</p>
          </section>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
