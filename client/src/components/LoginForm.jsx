import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/authService';
import PasswordInput from './PasswordInput';
import ResendVerification from './ResendVerification';
import { ROLE_REDIRECTS } from '../utils/roleRoutes';
import './PasswordPages.css';
import logo from '../assets/ayon-logo.png';
import { LOGOUT_REASON_KEY } from '../services/sessionGuard';

/* shown once when the person was signed out by the server (deactivated, role changed, session ended) */
const NOTICE_STYLE = {
  background: '#faf3d9', border: '1px solid #e9d98a', color: '#6e5c0e',
  borderRadius: 8, padding: '10px 12px', fontSize: '0.85rem',
  margin: '0 0 16px', lineHeight: 1.5,
};

const EMPTY_FORM = { email: '', password: '' };

const LoginForm = () => {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]             = useState(EMPTY_FORM);
  const [error, setError]           = useState('');
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [notice]                    = useState(() => {
    try { return sessionStorage.getItem(LOGOUT_REASON_KEY) || ''; } catch { return ''; }
  });

  // show the notice only once: forget it as soon as the page has opened
  useEffect(() => {
    try { sessionStorage.removeItem(LOGOUT_REASON_KEY); } catch { /* ignore */ }
  }, []);

  const formRef  = useRef(null);
  const typedRef = useRef(false);   // turns true once the person really types

  /* Empties the fields in React AND in the browser itself
     (the browser's autofill can fill a field without React knowing). */
  const clearFields = useCallback(() => {
    setForm(EMPTY_FORM);
    setError('');
    setUnverified(false);
    if (formRef.current) {
      formRef.current.querySelectorAll('input').forEach((el) => { el.value = ''; });
    }
  }, []);

  useEffect(() => {
    // 1) clear as soon as the page opens
    clearFields();

    // 2) Chrome sometimes autofills a moment AFTER the page loads,
    //    so clear again a few times, but never once the person started typing
    const timers = [150, 600, 1500].map((ms) =>
      setTimeout(() => { if (!typedRef.current) clearFields(); }, ms)
    );

    // 3) coming back with the browser's Back button can restore the old page
    const onPageShow = (e) => {
      if (e.persisted) {
        typedRef.current = false;
        clearFields();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [clearFields]);

  const markTyped = () => { typedRef.current = true; };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
    setUnverified(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setUnverified(false);
    setLoading(true);
    try {
      const res = await loginUser(form);
      login(res.data.user, res.data.token);
      // signed in with a temporary password from an Admin: must choose a new one first
      const redirect = res.data.user.must_change_password
        ? '/change-password'
        : (ROLE_REDIRECTS[res.data.user.role] || '/login');
      navigate(redirect, { replace: true });
    } catch (err) {
      const data = err.response?.data;
      setUnverified(data?.code === 'EMAIL_NOT_VERIFIED');
      setError(
        data?.message ||
        (err.response
          ? 'Login failed. Please try again.'
          : 'Cannot reach the server. It may be waking up. Please wait a minute and try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="reg-form-side as-login-side">
      <div className="reg-mobile-head">
        <img src={logo} alt="AYON logo" />
        <span>AYON</span>
      </div>

      <div className="as-login-inner">
        <h2>Sign In</h2>
        <p className="reg-sub">Welcome back! Enter your details to continue.</p>

        {notice && <p role="status" style={NOTICE_STYLE}>{notice}</p>}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={markTyped}
          onMouseDown={markTyped}
          onPaste={markTyped}
          className="as-login-form"
          autoComplete="off"
        >
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="text"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@msumain.edu.ph"
              autoComplete="off"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <PasswordInput
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
            />
          </div>

          <div className="as-forgot">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          {error && <p className="auth-error">{error}</p>}

          {unverified && (
            <ResendVerification email={form.email.trim().toLowerCase()} />
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="reg-footer">
          Don&apos;t have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </section>
  );
};

export default LoginForm;