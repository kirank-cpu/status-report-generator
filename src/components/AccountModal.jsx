import { useEffect, useState } from 'react';

// Signed-in account settings: update your recovery email and change your
// password. Both sections submit independently and surface their own status.
// `onChangePassword` / `onUpdateEmail` return { error } on failure, else the
// updated value is assumed saved.
export default function AccountModal({ user, onClose, onChangePassword, onUpdateEmail }) {
  const [email, setEmail] = useState(user.email || '');
  const [emailMsg, setEmailMsg] = useState(null); // { ok, text }
  const [emailBusy, setEmailBusy] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Close on Escape, matching the profile menu's behaviour.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const saveEmail = async (e) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailMsg(null);
    const res = await onUpdateEmail(email.trim());
    setEmailBusy(false);
    setEmailMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'Email saved.' });
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 6) return setPwMsg({ ok: false, text: 'New password must be at least 6 characters.' });
    if (next !== confirm) return setPwMsg({ ok: false, text: 'New password and confirmation do not match.' });
    setPwBusy(true);
    const res = await onChangePassword(current, next);
    setPwBusy(false);
    if (res?.error) return setPwMsg({ ok: false, text: res.error });
    setPwMsg({ ok: true, text: 'Password updated.' });
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const status = (msg) =>
    msg && <div className={msg.ok ? 'form-success' : 'login-error'}>{msg.text}</div>;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Account settings</h2>
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="hint">Signed in as {user.name || user.username}.</p>

        <form className="modal-section" onSubmit={saveEmail}>
          <h3>Recovery email</h3>
          <p className="hint">Used to reset your password if you forget it. Leave blank to remove.</p>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              placeholder="you@example.com"
              autoComplete="email"
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailMsg(null);
              }}
            />
          </label>
          {status(emailMsg)}
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={emailBusy}>
              {emailBusy ? 'Saving…' : 'Save email'}
            </button>
          </div>
        </form>

        <div className="profile-menu-sep" />

        <form className="modal-section" onSubmit={savePassword}>
          <h3>Change password</h3>
          <label className="form-field">
            <span>Current password</span>
            <input
              type="password"
              value={current}
              autoComplete="current-password"
              onChange={(e) => {
                setCurrent(e.target.value);
                setPwMsg(null);
              }}
            />
          </label>
          <label className="form-field">
            <span>New password</span>
            <input
              type="password"
              value={next}
              autoComplete="new-password"
              onChange={(e) => {
                setNext(e.target.value);
                setPwMsg(null);
              }}
            />
          </label>
          <label className="form-field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirm}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirm(e.target.value);
                setPwMsg(null);
              }}
            />
          </label>
          {status(pwMsg)}
          <div className="modal-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={pwBusy || !current || !next || !confirm}
            >
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
