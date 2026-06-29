import { useState } from 'react';

// Pre-login "Forgot password" request. Collects an email and asks the server to
// send a reset link. The server always responds generically (no account-exists
// signal), so on success we show the same confirmation regardless.
export default function ForgotPassword({ onRequest, onBack }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onRequest(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send the reset email. Please try again.');
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
        <h2>Forgot password</h2>

        {sent ? (
          <>
            <p className="hint">
              If an account with that email exists, we&apos;ve sent a link to reset your password.
              Check your inbox (and spam). The link expires in 1 hour.
            </p>
            <button type="button" className="btn-primary login-continue" onClick={onBack}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="hint">Enter your account email and we&apos;ll send you a reset link.</p>
            <label className="form-field login-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                onChange={(e) => {
                  setEmail(e.target.value);
                  error && setError('');
                }}
              />
            </label>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="btn-primary login-continue" disabled={!email || busy}>
              {busy ? 'Sending…' : 'Send reset link'}
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
