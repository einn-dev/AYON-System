import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';
import './AuthPages.css';

const COLLEGES = [
  'College of Information and Computing Sciences (CICS)',
  'College of Engineering',
  'College of Natural Sciences and Mathematics',
  'College of Social Sciences and Humanities',
  'College of Education',
  'College of Agriculture',
  'College of Business Administration and Accountancy',
  'College of Health Sciences',
  'College of Fisheries',
  'College of Forestry and Environmental Studies',
  'College of Public Affairs',
  'King Faisal Center for Islamic, Arabic and Asian Studies',
  'Other',
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '',
    password: '', confirm_password: '',
    employee_id: '', department: '', college: '', contact_number: '',
  });
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed,  setAgreed]  = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  /* ── Password strength ── */
  const getStrength = (pw) => {
    if (!pw) return { level: 0, label: '', color: '#e8edf2' };
    let score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
      { level: 1, label: 'Weak',   color: '#e53e3e' },
      { level: 2, label: 'Fair',   color: '#dd6b20' },
      { level: 3, label: 'Good',   color: '#d69e2e' },
      { level: 4, label: 'Strong', color: '#38a169' },
    ];
    return levels[score - 1] || levels[0];
  };

  const strength = getStrength(form.password);

  /* ── Validation ── */
  const validate = () => {
    if (!form.first_name.trim() || !form.last_name.trim())
      return 'First name and last name are required.';
    if (!form.email.trim())
      return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return 'Please enter a valid email address.';
    if (!form.college)
      return 'Please select your college.';
    if (form.contact_number && !/^09\d{9}$/.test(form.contact_number.replace(/[-\s]/g, '')))
      return 'Contact number must be a valid PH mobile number (e.g. 09XXXXXXXXX).';
    if (form.password.length < 8)
      return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password))
      return 'Password must contain at least one uppercase letter and one number.';
    if (form.password !== form.confirm_password)
      return 'Passwords do not match.';
    if (!agreed)
      return 'Please agree to the terms to continue.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    const validationError = validate();
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      // Note: role is NOT sent — the server always registers public
      // sign-ups as 'researcher' for security.
      await registerUser({
        first_name:     form.first_name.trim(),
        last_name:      form.last_name.trim(),
        email:          form.email.trim().toLowerCase(),
        password:       form.password,
        employee_id:    form.employee_id.trim()    || null,
        department:     form.department.trim()     || null,
        college:        form.college               || null,
        contact_number: form.contact_number.trim() || null,
      });
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 540 }}>
        <div className="auth-logo">
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        <h2>Researcher Registration</h2>
        <p style={{
          textAlign: 'center', fontSize: '0.82rem', color: '#718096',
          marginTop: -16, marginBottom: 24,
        }}>
          Create your researcher account to submit proposals,<br />
          apply for grants, and track your research.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* ── Personal Info ── */}
          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input name="first_name" value={form.first_name}
                onChange={handleChange} placeholder="Juan" />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input name="last_name" value={form.last_name}
                onChange={handleChange} placeholder="Dela Cruz" />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address *</label>
            <input type="text" name="email" value={form.email}
              onChange={handleChange} placeholder="you@msumain.edu.ph" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Employee / Faculty ID</label>
              <input name="employee_id" value={form.employee_id}
                onChange={handleChange} placeholder="e.g. EMP-2024-001" />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input name="contact_number" value={form.contact_number}
                onChange={handleChange} placeholder="09XXXXXXXXX" />
            </div>
          </div>

          {/* ── Affiliation ── */}
          <div className="form-group">
            <label>College *</label>
            <select name="college" value={form.college} onChange={handleChange}>
              <option value="">— Select your college —</option>
              {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Department</label>
            <input name="department" value={form.department}
              onChange={handleChange} placeholder="e.g. Information Technology Department" />
          </div>

          {/* ── Password ── */}
          <div className="form-row">
            <div className="form-group">
              <label>Password *</label>
              <input type="password" name="password" value={form.password}
                onChange={handleChange} placeholder="Min. 8 characters" />
            </div>
            <div className="form-group">
              <label>Confirm Password *</label>
              <input type="password" name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange} placeholder="Repeat password" />
            </div>
          </div>

          {/* Password strength meter */}
          {form.password && (
            <div style={{ marginTop: -8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i <= strength.level ? strength.color : '#e8edf2',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: strength.color,
                margin: 0, fontWeight: 600 }}>
                {strength.label} — use 8+ characters with uppercase, numbers &amp; symbols
              </p>
            </div>
          )}

          {/* ── Terms ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: 'pointer', padding: '4px 0',
          }} onClick={() => setAgreed(!agreed)}>
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
              border: `2px solid ${agreed ? '#1a3a5c' : '#d1d9e0'}`,
              background: agreed ? '#1a3a5c' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '0.7rem', fontWeight: 700,
              transition: 'all 0.15s',
            }}>{agreed ? '✓' : ''}</div>
            <span style={{ fontSize: '0.8rem', color: '#4a5568', lineHeight: 1.5 }}>
              I confirm that the information provided is accurate and I agree to the
              AYON research data policies of MSIRC – MSU Main Campus.
            </span>
          </div>

          {error   && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating your account...' : 'Create Researcher Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
        <p style={{
          textAlign: 'center', fontSize: '0.72rem',
          color: '#a0aec0', marginTop: 10,
        }}>
          Staff, Director, and other roles are created by the system administrator.
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;