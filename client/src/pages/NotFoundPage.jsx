import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_REDIRECTS } from '../utils/roleRoutes';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';
import { FaArrowLeft, FaMagnifyingGlass } from '../utils/icons';

/* An address that does not exist (a mistyped link, an old bookmark).
   Signed in: back to your own dashboard. Not signed in: Sign In or the home page.
   It never signs anyone out. */
const NotFoundPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const home = user ? `${ROLE_REDIRECTS[user.role] || ''}/dashboard` : '';
  useEffect(() => { document.title = 'Page Not Found · AYON'; }, []);

  return (
    <div className="auth-wrapper">
      <div className="auth-card status-card">
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        <div className="status-ico" aria-hidden="true"><FaMagnifyingGlass /></div>
        <h2>Page Not Found</h2>
        <p className="status-text">
          This page does not exist. The link may be mistyped or out of date.
        </p>

        {user ? (
          <Link to={home} className="auth-btn status-btn">Go to My Dashboard</Link>
        ) : (
          <Link to="/login" className="auth-btn status-btn">Go to Sign In</Link>
        )}
        <p className="auth-footer">
          {window.history.length > 1
            ? <button type="button" className="status-back" onClick={() => navigate(-1)}><FaArrowLeft className="ic" />Go Back</button>
            : <Link to="/home"><FaArrowLeft className="ic" />Go to the Home Page</Link>}
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;