import { useState } from 'react';

// Credential sign-in. Accounts live in the backend user store; this validates
// against it but remains a soft UI gate, not real security.
export default function Login({ authenticate, onLogin, onForgot, onSignUp }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await authenticate(username, password);
      onLogin(user);
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
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
        <h2>Sign in</h2>
        <p className="hint">Enter your credentials to continue.</p>

        <label className="form-field login-field">
          <span>Username</span>
          <input
            value={username}
            autoFocus
            autoComplete="username"
            onChange={(e) => {
              setUsername(e.target.value);
              clearError();
            }}
          />
        </label>
        <label className="form-field login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => {
              setPassword(e.target.value);
              clearError();
            }}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button
          type="submit"
          className="btn-primary login-continue"
          disabled={!username || !password || busy}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {onForgot && (
          <button type="button" className="link-btn" onClick={onForgot}>
            Forgot password?
          </button>
        )}
        {onSignUp && (
          <button type="button" className="link-btn" onClick={onSignUp}>
            New here? Create an account
          </button>
        )}
      </form>
    </div>
  );
}
