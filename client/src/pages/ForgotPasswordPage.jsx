import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/authService';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';
import '../components/PasswordPages.css';

const WAIT_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* "Forgot your password?"  ->  asks for the email, then says "Check your email". */
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);
  const [sentTo, setSentTo] = useState('');      // set once the request went through
  const [wait,  setWait]  = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    if (wait <= 0) return undefined;
    timer.current = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer.current);
  }, [wait]);

  const send = async (e) => {
    if (e) e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) return setError('Please enter a valid email address.');

    setBusy(true);
    setError('');
    try {
      await API.post('/auth/forgot-password', { email: value });
      setSentTo(value);
      setWait(WAIT_SECONDS);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Cannot reach the server. It may be waking up. Please wait a minute and try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        {!sentTo ? (
          <form className="auth-form" onSubmit={send} noValidate>
            <h2 style={{ marginBottom: 0 }}>Forgot your password?</h2>
            <p style={{ textAlign: 'center', color: '#8a7a7d', fontSize: '0.88rem', lineHeight: 1.55 }}>
              Enter the email you registered with. We will send you a link to
              choose a new password.
            </p>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <div className="form-group">
              <label htmlFor="fp-email">Email Address</label>
              <input
                id="fp-email" type="email" value={email} autoComplete="email"
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@msumain.edu.ph"
              />
            </div>

            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? 'Sending...' : 'Send reset link'}
            </button>

            <p className="auth-footer" style={{ marginTop: 4 }}>
              <Link to="/login">← Back to sign in</Link>
            </p>
          </form>
        ) : (
          <div className="pw-done">
            <div className="pw-done-icon">📧</div>
            <h2>Check your email</h2>
            <p>
              If <strong>{sentTo}</strong> has an AYON account, we sent a link to
              reset your password. The link works for <strong>1 hour</strong>.
            </p>
            <p style={{ marginTop: 10 }}>Can&apos;t find it? Check your spam or junk folder.</p>

            {error && <p className="auth-error" role="alert" style={{ marginTop: 12, textAlign: 'left' }}>{error}</p>}

            <button type="button" className="pw-outline-btn" disabled={busy || wait > 0} onClick={() => send()}>
              {busy ? 'Sending...' : wait > 0 ? `Send again in ${wait}s` : 'Send again'}
            </button>

            <p className="auth-footer"><Link to="/login">← Back to sign in</Link></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;