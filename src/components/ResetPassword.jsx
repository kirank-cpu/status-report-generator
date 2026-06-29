import { useState } from 'react';

// Pre-login reset page reached from the emailed link (/reset-password?token=…).
// Takes the token (read from the URL by App) plus a new password, then hands the
// user back to sign in. A missing token means the link was malformed.
export default function ResetPassword({ token, onReset, onBack }) {
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next.length < 6) return setError('Password must be at least 6 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await onReset(token, next);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not reset your password. The link may have expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span>Status Report</span>
        </div>
        <h2>Choose a new password</h2>

        {done ? (
          <>
            <div className="form-success">Your password has been reset. You can now sign in.</div>
            <button type="button" className="btn-primary login-continue" onClick={onBack}>
              Go to sign in
            </button>
          </>
        ) : !token ? (
          <>
            <div className="login-error">This reset link is missing its token. Request a new one.</div>
            <button type="button" className="btn-primary login-continue" onClick={onBack}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="hint">Enter a new password for your account.</p>
            <label className="form-field login-field">
              <span>New password</span>
              <input
                type="password"
                value={next}
                autoFocus
                autoComplete="new-password"
                onChange={(e) => {
                  setNext(e.target.value);
                  error && setError('');
                }}
              />
            </label>
            <label className="form-field login-field">
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirm(e.target.value);
                  error && setError('');
                }}
              />
            </label>

            {error && <div className="login-error">{error}</div>}

            <button
              type="submit"
              className="btn-primary login-continue"
              disabled={!next || !confirm || busy}
            >
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
            <button type="button" className="link-btn" onClick={onBack}>
              Back to sign in
            </button>
          </>
        )}
      </form>
    </div>
  );
}
