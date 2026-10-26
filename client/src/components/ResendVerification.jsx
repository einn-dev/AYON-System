import React, { useEffect, useState } from 'react';
import API from '../services/authService';

const COOLDOWN_SECONDS = 60;

/**
 * "Resend verification email" button with a 60-second cooldown.
 *   <ResendVerification email="juan@mail.com" />   -> email already known
 *   <ResendVerification askForEmail />             -> shows an email box
 */
const ResendVerification = ({ email: presetEmail = '', askForEmail = false }) => {
  const [email,  setEmail]  = useState(presetEmail);
  const [wait,   setWait]   = useState(0);
  const [busy,   setBusy]   = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => { setEmail(presetEmail); }, [presetEmail]);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const resend = async () => {
    if (!email.trim()) {
      return setStatus({ type: 'error', msg: 'Please enter your email address.' });
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await API.post('/auth/resend-verification', {
        email: email.trim().toLowerCase(),
      });
      setStatus({ type: 'success', msg: res.data.message });
      setWait(COOLDOWN_SECONDS);
    } catch (err) {
      setStatus({
        type: 'error',
        msg: err.response?.data?.message || 'Could not send the email. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || wait > 0;

  return (
    <div style={{ marginTop: 14 }}>
      {askForEmail && (
        <input
          type="text"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@msumain.edu.ph"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 10,
            border: '1px solid #e0d3d5', borderRadius: 8, padding: '10px 14px',
            fontSize: '0.95rem', background: '#faf7f7', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      )}
      <button
        type="button"
        onClick={resend}
        disabled={disabled}
        style={{
          width: '100%', padding: '10px', borderRadius: 8,
          border: '1px solid #8d1b2d', background: '#fff', color: '#8d1b2d',
          fontSize: '0.88rem', fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {busy ? 'Sending...' : wait > 0 ? `Resend available in ${wait}s` : 'Resend verification email'}
      </button>
      {status && (
        <p className={status.type === 'success' ? 'auth-success' : 'auth-error'}
           style={{ marginTop: 10, textAlign: 'left' }}>
          {status.msg}
        </p>
      )}
    </div>
  );
};

export default ResendVerification;