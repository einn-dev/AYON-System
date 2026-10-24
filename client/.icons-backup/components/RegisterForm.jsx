import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { registerUser } from '../services/authService';
import PasswordInput from './PasswordInput';
import ResendVerification from './ResendVerification';
import logo from '../assets/ayon-logo.png';
import { COLLEGES, getDepartments } from '../data/Colleges';

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '',
  password: '', confirm_password: '',
  department: '', college: '', contact_number: '',
};

/* Contact number: digits only, must start with 09, at most 11 digits.
   Letters, symbols and spaces are thrown away as the person types or pastes. */
const cleanPhone = (raw) => {
  let v = String(raw).replace(/\D/g, '').slice(0, 11);
  if (v.length >= 1 && v[0] !== '0') v = '';
  if (v.length >= 2 && v[1] !== '9') v = v.slice(0, 1);
  return v;
};

const RegisterForm = () => {
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed,  setAgreed]  = useState(false);
  const [agreedLegal, setAgreedLegal] = useState(false);   // Terms of Service + Privacy Policy
  const [done,    setDone]    = useState(null);   // { email, emailSent } after sign-up

  const formRef  = useRef(null);
  const typedRef = useRef(false);   // turns true once the person really types

  /* Empties every field in React AND in the browser itself
     (the browser's autofill can fill a field without React knowing). */
  const clearFields = useCallback(() => {
    setForm(EMPTY_FORM);
    setAgreed(false);
    setAgreedLegal(false);
    setError('');
    if (formRef.current) {
      formRef.current.querySelectorAll('input, select').forEach((el) => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
      });
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
    const { name, value } = e.target;
    if (name === 'college') {
      // a different college has different departments, so the old choice no longer applies
      setForm({ ...form, college: value, department: '' });
    } else {
      setForm({ ...form, [name]: name === 'contact_number' ? cleanPhone(value) : value });
    }
    setError('');
  };

  const getStrength = (pw) => {
    if (!pw) return { level: 0, label: '', color: '#e0d3d5' };
    let score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
      { level: 1, label: 'Weak',   color: '#e53e3e' },
      { level: 2, label: 'Fair',   color: '#dd6b20' },
      { level: 3, label: 'Good',   color: '#b09519' },
      { level: 4, label: 'Strong', color: '#38a169' },
    ];
    return levels[score - 1] || levels[0];
  };

  const strength = getStrength(form.password);
  const departments = getDepartments(form.college);

  const validate = () => {
    if (!form.first_name.trim() || !form.last_name.trim())
      return 'First name and last name are required.';
    if (!form.email.trim())
      return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return 'Please enter a valid email address.';
    if (!form.college)
      return 'Please select your college.';
    if (!form.department)
      return 'Please select your department.';
    if (form.contact_number && !/^09\d{9}$/.test(form.contact_number))
      return 'Contact number must be exactly 11 digits, numbers only, starting with 09 (e.g. 09123456789).';
    if (form.password.length < 8)
      return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password))
      return 'Password must contain at least one uppercase letter and one number.';
    if (form.password !== form.confirm_password)
      return 'Passwords do not match.';
    if (!agreed)
      return 'Please agree to the terms to continue.';
    if (!agreedLegal)
      return 'Please agree to the Terms of Service and Privacy Policy to continue.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      const res = await registerUser({
        first_name:     form.first_name.trim(),
        last_name:      form.last_name.trim(),
        email:          form.email.trim().toLowerCase(),
        password:       form.password,
        department:     form.department.trim()     || null,
        college:        form.college               || null,
        contact_number: form.contact_number.trim() || null,
      });
      setDone({
        email:     res.data.email || form.email.trim().toLowerCase(),
        emailSent: res.data.emailSent !== false,
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        (err.response
          ? 'Registration failed. Please try again.'
          : 'Cannot reach the server. It may be waking up. Please wait a minute and try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="reg-form-side as-register-side">
      {/* the normal registration form (kept mounted, just hidden, after sign-up
          so "Typed the wrong email?" brings back what was typed) */}
      <div className={`as-form-wrap${done ? ' is-hidden' : ''}`} aria-hidden={done ? 'true' : undefined}>
        <div className="reg-mobile-head">
          <img src={logo} alt="AYON logo" />
          <span>AYON</span>
        </div>

        <h2>Researcher Registration</h2>
        <p className="reg-sub">
          Fill in your details. We will email you a link to verify your account.
        </p>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          onKeyDown={markTyped}
          onMouseDown={markTyped}
          onPaste={markTyped}
          className="reg-grid"
          autoComplete="off"
        >
          <div className="form-group reg-half">
            <label>First Name *</label>
            <input name="first_name" value={form.first_name}
              onChange={handleChange} placeholder="Juan" autoComplete="off" />
          </div>

          <div className="form-group reg-half">
            <label>Last Name *</label>
            <input name="last_name" value={form.last_name}
              onChange={handleChange} placeholder="Dela Cruz" autoComplete="off" />
          </div>

          <div className="form-group reg-half">
            <label>Email Address *</label>
            <input type="text" name="email" value={form.email}
              onChange={handleChange} placeholder="you@gmail.com" autoComplete="off" />
          </div>

          <div className="form-group reg-half">
            <label>Contact Number</label>
            <input name="contact_number" value={form.contact_number}
              onChange={handleChange} placeholder="09XXXXXXXXX" autoComplete="off"
              inputMode="numeric" maxLength={11} />
          </div>

          <div className="form-group reg-half reg-wide-sm">
            <label>College *</label>
            <select name="college" value={form.college} title={form.college}
              onChange={handleChange} autoComplete="off">
              <option value="">— Select your college —</option>
              {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group reg-half reg-wide-sm">
            <label>Department *</label>
            <select name="department" value={form.department} title={form.department}
              onChange={handleChange} autoComplete="off" disabled={!form.college}>
              <option value="">
                {form.college ? '— Select your department —' : '— Select a college first —'}
              </option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="form-group reg-third">
            <label>Password *</label>
            <PasswordInput name="password" value={form.password}
              onChange={handleChange} placeholder="Min. 8 characters"
              autoComplete="new-password" />
          </div>

          <div className="form-group reg-third">
            <label>Confirm Password *</label>
            <PasswordInput name="confirm_password" value={form.confirm_password}
              onChange={handleChange} placeholder="Repeat password"
              autoComplete="new-password" />
          </div>

          <div className="form-group reg-third reg-wide-sm">
            <label>Password Strength</label>
            <div className="reg-strength">
              <div className="reg-bars">
                {[1, 2, 3, 4].map(i => (
                  <span key={i}
                    style={i <= strength.level ? { background: strength.color } : undefined} />
                ))}
              </div>
              <span className="reg-strength-label"
                style={form.password ? { color: strength.color } : undefined}>
                {form.password ? strength.label : '8+ characters, 1 uppercase, 1 number'}
              </span>
            </div>
          </div>

          <div className="reg-terms-group reg-span-3">
            <label className="reg-terms">
              <input type="checkbox" checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)} />
              <span>
                I confirm that the information provided is accurate and I agree to the
                AYON research data policies of MSIRC – MSU Main Campus.
              </span>
            </label>

            <label className="reg-terms">
              <input type="checkbox" checked={agreedLegal}
                onChange={(e) => setAgreedLegal(e.target.checked)} />
              <span>
                By creating an account, you agree to our{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
              </span>
            </label>
          </div>

          {error && <p className="auth-error reg-span-3">{error}</p>}

          <button type="submit" className="auth-btn reg-span-3" disabled={loading}>
            {loading ? 'Creating your account...' : 'Create Researcher Account'}
          </button>
        </form>

        <p className="reg-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p className="reg-note">
          Staff, Director, and other roles are created by the system administrator.
        </p>
      </div>

      {/* after sign-up: "Check your email" */}
      {done && (
        <div className="as-done">
          <div className="as-done-icon">📧</div>
          <h2>Check your email</h2>

          {done.emailSent ? (
            <p className="as-done-text">
              We sent a verification link to<br />
              <strong>{done.email}</strong><br />
              Click the link in that email to activate your account.
              It is valid for 24 hours.
            </p>
          ) : (
            <p className="auth-error" style={{ textAlign: 'left' }}>
              Your account was created, but we could not send the verification
              email right now. Please press the button below to try again.
            </p>
          )}

          <p className="as-done-hint">Can&apos;t find it? Check your spam or junk folder.</p>

          <ResendVerification email={done.email} />

          <button type="button" className="as-link-btn" onClick={() => setDone(null)}>
            Typed the wrong email? Go back and fix it
          </button>

          <p className="reg-footer"><Link to="/login">Back to sign in</Link></p>
        </div>
      )}
    </section>
  );
};

export default RegisterForm;