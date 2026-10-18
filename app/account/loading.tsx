import EditorialSidebar from '@/components/EditorialSidebar';
import { ProfileSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main className="auth-shell has-editorial-layout">
      <EditorialSidebar />
      <section className="auth-card account-card">
        <ProfileSkeleton />
      </section>
    </main>
  );
}
