import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import API from '../services/authService';
import { LOGOUT_REASON_KEY } from '../services/sessionGuard';
import PasswordInput from '../components/PasswordInput';
import { PasswordStrength, PasswordRules, checkNewPassword } from '../components/PasswordStrength';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';
import '../components/PasswordPages.css';
import { FaArrowLeft, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';

const NEW_LINK_MESSAGES = ['RESET_LINK_INVALID', 'RESET_LINK_EXPIRED'];

/* The page the emailed "Choose a new password" link opens:  /reset-password?token=...  */
const ResetPasswordPage = () => {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const token     = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const [deadLink, setDeadLink] = useState(
    token ? '' : 'This reset link is incomplete. Please use the link from your email.'
  );

  const submit = async (e) => {
    e.preventDefault();
    const problem = checkNewPassword(password, confirm);
    if (problem) return setError(problem);

    setBusy(true);
    setError('');
    try {
      await API.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      const data = err.response?.data;
      if (data && NEW_LINK_MESSAGES.includes(data.code)) setDeadLink(data.message);
      else setError(data?.message || 'Cannot reach the server. Please wait a minute and try again.');
    } finally {
      setBusy(false);
    }
  };

  const goToSignIn = () => {
    try {
      sessionStorage.setItem(LOGOUT_REASON_KEY, 'Your password was changed. Please sign in with your new password.');
    } catch { /* ignore */ }
    navigate('/login', { replace: true });
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        {deadLink ? (
          <div className="pw-done">
            <div className="pw-done-icon"><FaTriangleExclamation style={{ color: '#b7791f' }} /></div>
            <h2>Link Not Valid</h2>
            <p>{deadLink}</p>
            <Link to="/forgot-password" className="auth-btn" style={{
              display: 'block', textDecoration: 'none', textAlign: 'center', marginTop: 20,
            }}>Request a New Link</Link>
            <p className="auth-footer"><Link to="/login"><FaArrowLeft className="ic" />Back to Sign In</Link></p>
          </div>
        ) : done ? (
          <div className="pw-done">
            <div className="pw-done-icon"><FaCircleCheck style={{ color: '#276749' }} /></div>
            <h2>Password Updated</h2>
            <p>Your password was changed. You were signed out on all devices.</p>
            <button type="button" className="auth-btn" style={{ width: '100%', marginTop: 20 }} onClick={goToSignIn}>
              Go to Sign In
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            <h2 style={{ marginBottom: 0 }}>Choose a New Password</h2>
            <p style={{ textAlign: 'center', color: '#8a7a7d', fontSize: '0.88rem', lineHeight: 1.55 }}>
              You will be signed out on all devices.
            </p>

            {error && <p className="auth-error" role="alert">{error}</p>}

            <div className="form-group">
              <label>New Password</label>
              <PasswordInput
                name="new_password" value={password} autoComplete="new-password"
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
              />
              <PasswordStrength value={password} />
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <PasswordInput
                name="confirm_password" value={confirm} autoComplete="new-password"
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              />
            </div>

            <PasswordRules value={password} confirm={confirm} />

            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? 'Saving...' : 'Reset Password'}
            </button>

            <p className="auth-footer" style={{ marginTop: 4 }}>
              <Link to="/login"><FaArrowLeft className="ic" />Back to Sign In</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;