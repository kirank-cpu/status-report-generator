// A row of initials avatars for everyone currently in the open report. Hovering
// an avatar reveals the full name (native title tooltip). The signed-in user is
// marked "(you)" and shown first.

const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

// Deterministic accent per user so an avatar keeps the same colour across views.
const COLORS = ['#ec008c', '#1f3864', '#2a9d8f', '#e76f51', '#6a4c93', '#0077b6', '#b5179e', '#d62828'];
const colorFor = (key) => {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
};

export default function PresenceBar({ users, me }) {
  if (!users?.length) return null;
  // Put "me" first, then everyone else.
  const sorted = [...users].sort((a, b) => (a.username === me ? -1 : b.username === me ? 1 : 0));
  const shown = sorted.slice(0, 6);
  const extra = sorted.length - shown.length;

  return (
    <div className="presence-bar" aria-label={`${users.length} people viewing`}>
      {shown.map((u) => {
        const isMe = u.username === me;
        return (
          <span
            key={u.username}
            className={`presence-avatar${isMe ? ' is-me' : ''}`}
            style={{ background: colorFor(u.username) }}
            title={isMe ? `${u.name} (you)` : u.name}
          >
            {initials(u.name)}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="presence-avatar presence-more" title={`${extra} more`}>
          +{extra}
        </span>
      )}
    </div>
  );
}
