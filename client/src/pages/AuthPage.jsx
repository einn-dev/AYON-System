import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowLeft } from '../utils/icons';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import AuthBackdrop from '../components/AuthBackdrop';
import logo from '../assets/ayon-logo.png';
import msircLogo from '../assets/msirc-emblem.png';
import './AuthPages.css';
import './RegisterPage.css';
import './AuthSlider.css';
import './AuthMotion.css';

/*
  One card, two faces. The maroon panel slides between the left side
  (Register) and the right side (Login).

  /login and /register are still two routes, so React rebuilds this page when
  you switch. To still get the slide, we remember which side the panel was on
  (`lastShownMode`) and start there, then move it to the right side one moment
  after the page is painted.
*/
let lastShownMode = null;
let forgetTimer = null;

/* the logo goes back to the home page */
const Brand = () => (
  <Link to="/" className="reg-brand-top as-home-link" aria-label="AYON home page">
    <div className="reg-logo-chip">
      <img src={logo} alt="AYON logo" />
    </div>
    <span className="reg-wordmark">AYON</span>
  </Link>
);

/* the office AYON is made for, at the bottom of the maroon panel */
const BrandFoot = () => (
  <p className="reg-brand-foot as-msirc">
    <span className="as-msirc-chip"><img src={msircLogo} alt="MSIRC logo" /></span>
    <span>Mamitua Saber Institute of Research and Creation<small>MSU Main Campus</small></span>
  </p>
);

const AuthPage = ({ mode }) => {
  // first visit: no animation. Coming from the other page: start where it was.
  const [shown, setShown] = useState(
    lastShownMode && lastShownMode !== mode ? lastShownMode : mode
  );

  useEffect(() => {
    clearTimeout(forgetTimer);
    lastShownMode = mode;

    let r2;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setShown(mode));
    });

    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      // if the person leaves the auth pages, forget, so the next visit does not animate
      forgetTimer = setTimeout(() => { lastShownMode = null; }, 1000);
    };
  }, [mode]);

  return (
    <div className="auth-wrapper as-wrapper">
      {/* the animated background behind the card */}
      <AuthBackdrop />
      <Link to="/" className="as-back-home"><FaArrowLeft className="ic" />Back to home</Link>
      <div className={`reg-card as-card is-${shown}`}>

        {/* The sliding maroon panel */}
        <aside className="as-overlay">
          {/* shown while on Register (left side) */}
          <div className="as-face as-face-register reg-brand">
            <div>
              <Brand />
              <h1>Let&apos;s get<br />started</h1>
              <p className="reg-brand-text">
                Create your researcher account to submit proposals, apply for
                grants, and track your research.
              </p>
              <ul className="reg-points">
                <li>Submit proposals online</li>
                <li>Track every stage in real time</li>
                <li>Apply for grants and incentives</li>
                <li>Keep your research in one archive</li>
              </ul>
              <Link to="/login" className="as-ghost-btn">Sign in</Link>
            </div>
            <BrandFoot />
          </div>

          {/* shown while on Login (right side) */}
          <div className="as-face as-face-login reg-brand">
            <div>
              <Brand />
              <h1>Welcome<br />back!</h1>
              <p className="reg-brand-text">
                Sign in to continue managing your proposals, grants and
                research records.
              </p>
              <ul className="reg-points">
                <li>Pick up where you left off</li>
                <li>See your proposal status</li>
                <li>Get notified at every stage</li>
              </ul>
              <Link to="/register" className="as-ghost-btn">Create an account</Link>
            </div>
            <BrandFoot />
          </div>
        </aside>

        {/* The two forms sit in the same spot; the one that is not active fades out */}
        <div className="as-clip">
          <div className="as-stage">
            <div className="as-panel as-panel-login"><LoginForm /></div>
            <div className="as-panel as-panel-register"><RegisterForm /></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;