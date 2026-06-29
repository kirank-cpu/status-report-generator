import { useEffect, useRef } from 'react';

// A lockable editor section. Focusing it (when editable and not held by someone
// else) acquires the section lock; moving focus out releases it. While a
// collaborator holds it, the panel renders read-only with their name. `children`
// is a render prop receiving the effective read-only flag.
//
//   sectionKey   unique key, e.g. `${squadId}:defects`
//   baseReadOnly read-only regardless of locks (no edit rights)
//   locks        { sectionKey: { username, name } } from the presence poll
//   me           current username
//   onAcquire/onRelease(sectionKey)
export default function LockPanel({ sectionKey, title, baseReadOnly, locks, me, onAcquire, onRelease, children }) {
  const owner = locks?.[sectionKey];
  const lockedByOther = !!owner && owner.username !== me;
  const heldByMe = !!owner && owner.username === me;
  const ro = baseReadOnly || lockedByOther;

  // Release on unmount (navigation fires no blur). Refs keep the cleanup current
  // without re-running it every render.
  const heldRef = useRef(false);
  const releaseRef = useRef(null);
  useEffect(() => {
    heldRef.current = heldByMe;
    releaseRef.current = () => onRelease?.(sectionKey);
  });
  useEffect(() => () => heldRef.current && releaseRef.current?.(), []);

  const handleFocus = () => {
    if (!baseReadOnly && !lockedByOther && !heldByMe) onAcquire?.(sectionKey);
  };
  const handleBlur = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return; // focus stayed inside
    if (heldByMe) onRelease?.(sectionKey);
  };

  return (
    <section
      className={`panel lock-panel${lockedByOther ? ' is-locked' : ''}${heldByMe ? ' is-mine' : ''}`}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
    >
      <div className="panel-head">
        <h3>{title}</h3>
        {lockedByOther && <span className="lock-badge">🔒 {owner.name} is editing</span>}
        {heldByMe && <span className="lock-badge mine">✏ You’re editing</span>}
      </div>
      {children(ro)}
    </section>
  );
}
