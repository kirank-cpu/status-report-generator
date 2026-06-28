import { useState } from 'react';

// Pre-login sign-up. Collects username, email and password, then asks the server
// to create a pending account and email a verification link. Users are warned not
// to use their organisational email address (requirement #3).
export default function SignUp({ onSignUp, onBack }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await onSignUp(username.trim(), email.trim(), password);
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const clearError = () => error && setError('');

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-mark">MSR</span>
          <span>Monthly Status Report</span>
        </div>
        <h2>Create your account</h2>

        {done ? (
          <>
            <div className="form-success">
              Account created! We’ve emailed you a verification link — click it to activate your
              account. After verifying, an admin will review your sign-up and grant access. 
              You can still sign in to view reports, but you won’t be able to edit them until an admin approves your account.
            </div>
            <button type="button" className="btn-primary login-continue" onClick={onBack}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="hint">Sign up to view reports. An admin grants edit access after approval.</p>
            <div className="login-warn">
              ⚠ Please use a <strong>personal</strong> email address — not your organisational/work email.
            </div>

            <label className="form-field login-field">
              <span>Username</span>
              <input
                value={username}
                autoFocus
                autoComplete="username"
                placeholder="e.g. jsmith"
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearError();
                }}
              />
            </label>
            <label className="form-field login-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                autoComplete="email"
                placeholder="you@personal.com"
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
              />
            </label>
            <label className="form-field login-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                autoComplete="new-password"
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
              />
            </label>
            <label className="form-field login-field">
              <span>Confirm password</span>
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(e) => {
                  setConfirm(e.target.value);
                  clearError();
                }}
              />
            </label>

            {error && <div className="login-error">{error}</div>}

            <button
              type="submit"
              className="btn-primary login-continue"
              disabled={!username || !email || !password || !confirm || busy}
            >
              {busy ? 'Creating…' : 'Create account'}
            </button>
            <button type="button" className="link-btn" onClick={onBack}>
              Already have an account? Sign in
            </button>
          </>
        )}
      </form>
    </div>
  );
}
