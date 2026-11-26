import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_REDIRECTS } from '../utils/roleRoutes';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';
import { FaArrowLeft, FaLock } from '../utils/icons';

/* A page that belongs to another role (for example a researcher opening an Admin link).
   Same look as "Page Not Found": back to your own dashboard, or go back. */
const Unauthorized = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const home = user ? `${ROLE_REDIRECTS[user.role] || ''}/dashboard` : '/login';

  return (
    <div className="auth-wrapper">
      <div className="auth-card status-card">
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        <div className="status-ico" aria-hidden="true"><FaLock /></div>
        <h2>No Access to This Page</h2>
        <p className="status-text">
          This page is for another role, so your account cannot open it.
        </p>

        <Link to={home} className="auth-btn status-btn">{user ? 'Go to My Dashboard' : 'Go to Sign In'}</Link>
        <p className="auth-footer">
          <button type="button" className="status-back" onClick={() => navigate(-1)}><FaArrowLeft className="ic" />Go Back</button>
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;