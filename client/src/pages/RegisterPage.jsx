import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/authService';
import './AuthPages.css';

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');

    if (form.password !== form.confirm_password) {
      return setError('Passwords do not match.');
    }
    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters.');
    }

    setLoading(true);
    try {
      await registerUser(form);
      setSuccess('Account created! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: 500 }}>
        <div className="auth-logo">
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        <h2>Create an account</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input name="first_name" value={form.first_name}
                onChange={handleChange} placeholder="Juan" required />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input name="last_name" value={form.last_name}
                onChange={handleChange} placeholder="Dela Cruz" required />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input type="text" name="email" value={form.email}
              onChange={handleChange} placeholder="you@msu.edu.ph" required />
          </div>

          <div className="form-group">
            <label>Employee / Student ID</label>
            <input name="employee_id" value={form.employee_id}
              onChange={handleChange} placeholder="EMP-12345" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Department</label>
              <input name="department" value={form.department}
                onChange={handleChange} placeholder="e.g. CS Dept." />
            </div>
            <div className="form-group">
              <label>College</label>
              <input name="college" value={form.college}
                onChange={handleChange} placeholder="e.g. CICS" />
            </div>
          </div>

          <div className="form-group">
            <label>Contact Number</label>
            <input name="contact_number" value={form.contact_number}
              onChange={handleChange} placeholder="09XX-XXX-XXXX" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Password</label>
              <input type="password" name="password" value={form.password}
                onChange={handleChange} placeholder="Min. 8 characters" required />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" name="confirm_password"
                value={form.confirm_password}
                onChange={handleChange} placeholder="Repeat password" required />
            </div>
          </div>

          {error   && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;