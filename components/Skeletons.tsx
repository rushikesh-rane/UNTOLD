// Placeholder shapes shown while data loads. Plain server-safe markup, no hooks.

function Sk({ w, h, className = '' }: { w?: string | number; h?: string | number; className?: string }) {
  return <span className={`sk ${className}`} style={{ width: w, height: h }} aria-hidden="true" />;
}

function Status({ children, label = 'Loading…' }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sk-sr">{label}</span>
      {children}
    </div>
  );
}

export function StoryListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Status label="Loading stories…">
      <div className="sk-list">
        {Array.from({ length: count }, (_, i) => (
          <div className="sk-row" key={i}>
            <Sk className="sk-cover" w={56} h={76} />
            <div className="sk-grow">
              <Sk h={11} w="22%" />
              <Sk h={18} w="64%" className="sk-gap" />
              <Sk h={12} w="92%" className="sk-gap" />
              <Sk h={12} w="70%" className="sk-gap" />
            </div>
          </div>
        ))}
      </div>
    </Status>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Status>
      <div className="sk-grid">
        {Array.from({ length: count }, (_, i) => (
          <div className="sk-card" key={i}>
            <Sk h={11} w="30%" />
            <Sk h={18} w="70%" className="sk-gap" />
            <Sk h={12} w="95%" className="sk-gap" />
            <Sk h={12} w="60%" className="sk-gap" />
          </div>
        ))}
      </div>
    </Status>
  );
}

export function TheorySkeleton({ count = 2 }: { count?: number }) {
  return (
    <Status label="Loading theories…">
      {Array.from({ length: count }, (_, i) => (
        <div className="sk-card sk-theory" key={i}>
          <div className="sk-inline">
            <Sk className="sk-circle" w={30} h={30} />
            <Sk h={12} w="28%" />
          </div>
          <Sk h={12} w="96%" className="sk-gap" />
          <Sk h={12} w="78%" className="sk-gap" />
        </div>
      ))}
    </Status>
  );
}

export function ProfileSkeleton({ stories = 2 }: { stories?: number }) {
  return (
    <Status label="Loading profile…">
      <div className="sk-inline sk-profile-head">
        <Sk className="sk-avatar" w={72} h={72} />
        <div className="sk-grow">
          <Sk h={11} w="26%" />
          <Sk h={20} w="48%" className="sk-gap" />
          <Sk h={12} w="30%" className="sk-gap" />
        </div>
      </div>
      <Sk h={12} w="90%" className="sk-gap" />
      <Sk h={12} w="64%" className="sk-gap" />
      <div className="sk-inline sk-stats">
        <Sk h={44} w={110} />
        <Sk h={44} w={110} />
      </div>
      {Array.from({ length: stories }, (_, i) => (
        <div className="sk-card sk-story" key={i}>
          <Sk h={16} w="55%" />
          <Sk h={12} w="90%" className="sk-gap" />
          <Sk h={11} w="35%" className="sk-gap" />
        </div>
      ))}
    </Status>
  );
}
