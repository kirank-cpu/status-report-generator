import { useEffect, useRef, useState } from 'react';

// Pre-login email-verification page reached from the emailed link
// (/verify-email?token=…). Verifies the token on mount, then sends the user to
// sign in.
export default function VerifyEmail({ token, onVerify, onBack }) {
  const [state, setState] = useState(token ? 'verifying' : 'missing'); // verifying | ok | error | missing
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current || !token) return;
    ran.current = true;
    (async () => {
      try {
        await onVerify(token);
        setState('ok');
      } catch (err) {
        setError(err.message || 'This verification link is invalid or has expired.');
        setState('error');
      }
    })();
  }, [token, onVerify]);

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">MSR</span>
          <span>Monthly Status Report</span>
        </div>
        <h2>Email verification</h2>

        {state === 'verifying' && <p className="hint">Verifying your email…</p>}
        {state === 'missing' && (
          <div className="login-error">This verification link is missing its token.</div>
        )}
        {state === 'error' && <div className="login-error">{error}</div>}
        {state === 'ok' && (
          <div className="form-success">
            Your email is verified. You can sign in now — an admin will grant edit access after
            reviewing your sign-up.
          </div>
        )}

        <button type="button" className="btn-primary login-continue" onClick={onBack}>
          Go to sign in
        </button>
      </div>
    </div>
  );
}
