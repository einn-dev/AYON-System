import React, { useState } from 'react';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import PasswordInput from './PasswordInput';
import { PasswordStrength, checkNewPassword } from './PasswordStrength';
import './PasswordPages.css';

/* "Change password" box inside the My Profile pop-up.
   It has its own button, so the profile's Save Changes is never mixed up with it.
   It sits inside the profile <form>, so Enter is handled here (not submitted twice). */
const ChangePasswordBox = () => {
  const { user, login } = useAuth();
  const [current,  setCurrent]  = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [alert,    setAlert]    = useState(null);     // { type, msg }
  const [busy,     setBusy]     = useState(false);

  const update = async () => {
    setAlert(null);
    if (!current) return setAlert({ type: 'error', msg: 'Please enter your current password.' });
    const problem = checkNewPassword(password, confirm, current);
    if (problem) return setAlert({ type: 'error', msg: problem });

    setBusy(true);
    try {
      const res = await API.post('/auth/change-password', {
        current_password: current,
        new_password:     password,
      });
      // this device gets a fresh login, every other device is signed out
      login({ ...user, ...res.data.user }, res.data.token);
      setCurrent(''); setPassword(''); setConfirm('');
      setAlert({ type: 'success', msg: 'Password updated. Your other devices were signed out.' });
    } catch (err) {
      setAlert({
        type: 'error',
        msg: err.response?.data?.message || 'Could not change the password. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (!busy) update(); }
  };

  const clear = (setter) => (e) => { setter(e.target.value); setAlert(null); };

  return (
    <div className="pw-box" onKeyDown={onKeyDown}>
      <h4>Change password</h4>
      <p className="pw-box-sub">
        Enter your current password first. We ask so nobody can change it from a
        computer you left signed in.
      </p>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="form-group">
        <label>Current Password</label>
        <PasswordInput name="current_password" value={current} autoComplete="current-password"
          onChange={clear(setCurrent)} />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>New Password</label>
          <PasswordInput name="new_password" value={password} autoComplete="new-password"
            placeholder="Min. 8 characters" onChange={clear(setPassword)} />
          <PasswordStrength value={password} />
        </div>
        <div className="form-group">
          <label>Confirm New Password</label>
          <PasswordInput name="confirm_password" value={confirm} autoComplete="new-password"
            placeholder="Repeat password" onChange={clear(setConfirm)} />
        </div>
      </div>

      <div className="pw-box-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={update}>
          {busy ? 'Updating...' : 'Update Password'}
        </button>
        <span className="pw-box-hint">
          You stay signed in on this device. Other devices will be signed out.
        </span>
      </div>
    </div>
  );
};

export default ChangePasswordBox;