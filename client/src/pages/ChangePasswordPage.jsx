import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ROLE_REDIRECTS } from '../utils/roleRoutes';
import PasswordInput from '../components/PasswordInput';
import { PasswordStrength, checkNewPassword } from '../components/PasswordStrength';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';
import '../components/PasswordPages.css';

/* Shown right after someone signs in with a temporary password the Administrator gave them.
   The server blocks everything else until this is done. */
const ChangePasswordPage = () => {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();

  const [current,  setCurrent]  = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  if (loading) return <div className="loading">Loading...</div>;
  if (!user)   return <Navigate to="/login" replace />;
  // nothing to change: go to the person's own dashboard
  if (!user.must_change_password) {
    return <Navigate to={ROLE_REDIRECTS[user.role] || '/login'} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!current) return setError('Please enter the temporary password you were given.');
    const problem = checkNewPassword(password, confirm, current);
    if (problem) return setError(problem);

    setBusy(true);
    setError('');
    try {
      const res = await API.post('/auth/change-password', {
        current_password: current,
        new_password:     password,
      });
      // new login for this device; the page then moves on to the dashboard by itself
      login({ ...user, ...res.data.user, must_change_password: false }, res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot reach the server. Please wait a minute and try again.');
      setBusy(false);
    }
  };

  const signOut = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        <form className="auth-form" onSubmit={submit} noValidate>
          <h2 style={{ marginBottom: 0 }}>Set a New Password</h2>

          <p className="pw-notice" role="status">
            The Administrator reset your password. For your security, choose a new
            password before you continue.
          </p>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <div className="form-group">
            <label>Temporary Password</label>
            <PasswordInput
              name="current_password" value={current} autoComplete="current-password"
              placeholder="The one the Administrator gave you"
              onChange={(e) => { setCurrent(e.target.value); setError(''); }}
            />
          </div>

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

          <button type="submit" className="auth-btn" disabled={busy}>
            {busy ? 'Saving...' : 'Save and Continue'}
          </button>

          <p className="auth-footer" style={{ marginTop: 4 }}>
            Signed in as <strong>{user.email}</strong> ·{' '}
            <button type="button" className="pw-linkbtn" onClick={signOut}>Sign Out</button>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordPage;