export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo" aria-label="SocialFlow OS">
      <div className="logo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {!compact && (
        <div className="logo-copy">
          <strong>SocialFlow</strong>
          <small>LOCAL OS</small>
        </div>
      )}
    </div>
  );
}

