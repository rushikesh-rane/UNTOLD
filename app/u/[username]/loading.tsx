import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProfileSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main className="auth-shell has-editorial-layout">
      <header className="auth-topbar">
        <Link href="/" className="creator-back"><ArrowLeft size={16} /> Back to Discover</Link>
        <Link href="/" className="brand-lockup"><span className="brand-word">un<span>told</span><i>.</i></span></Link>
        <span />
      </header>
      <section className="auth-card account-card public-profile-card" style={{ maxWidth: 800 }}>
        <ProfileSkeleton />
      </section>
    </main>
  );
}
