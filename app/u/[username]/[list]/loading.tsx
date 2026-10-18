import { CardGridSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main className="auth-shell has-editorial-layout">
      <header className="auth-topbar"><span /><span /><span /></header>
      <section className="auth-card account-card" style={{ maxWidth: 800 }}>
        <CardGridSkeleton count={4} />
      </section>
    </main>
  );
}
