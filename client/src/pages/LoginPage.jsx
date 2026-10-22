import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginUser } from '../services/authService';
import PasswordInput from '../components/PasswordInput';
import ResendVerification from '../components/ResendVerification';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';

const ROLE_REDIRECTS = {
  researcher:           '/researcher',
  msric_staff:          '/msric-staff',
  research_coordinator: '/coordinator',
  chairperson:          '/chairperson',
  college_dean:         '/college-dean',
  special_assistant:    '/special-assistant',
  msric_director:       '/director',
  ovcred:               '/ovcred',
  admin:                '/admin',
};

const EMPTY_FORM = { email: '', password: '' };

const LoginPage = () => {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]             = useState(EMPTY_FORM);
  const [error, setError]           = useState('');
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading]       = useState(false);

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
      const redirect = ROLE_REDIRECTS[res.data.user.role] || '/login';
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
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        <h2>Sign in to your account</h2>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={markTyped}
          onPaste={markTyped}
          className="auth-form"
          autoComplete="off"
        >
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="text"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@gmail.com"
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

          {error && <p className="auth-error">{error}</p>}

          {unverified && (
            <ResendVerification email={form.email.trim().toLowerCase()} />
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;