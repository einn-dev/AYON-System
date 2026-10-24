import React from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/ayon-logo.png';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="lp">

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <img src={logo} alt="AYON logo" className="lp-logo" />
            <span className="lp-wordmark">AYON</span>
          </div>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-link">Sign in</Link>
            <Link to="/register" className="lp-btn">Register</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="lp-hero">
        <img src={logo} alt="" className="lp-logo-hero" />
        <p className="lp-kicker">MSIRC · Mindanao State University – Main Campus</p>
        <h1>Research management,<br />without the paperwork.</h1>
        <p className="lp-lede">
          AYON moves the entire research lifecycle of the Mamitua Saber Institute
          of Research and Creation online — submission, validation, review,
          approval, and archiving in one place.
        </p>
        <div className="lp-cta">
          <Link to="/register" className="lp-btn lp-btn-lg">Create an account</Link>
          <Link to="/login" className="lp-link lp-link-lg">Sign in →</Link>
        </div>
        <p className="lp-flow">
          Submitted · Validated · Reviewed · Endorsed · Approved · Archived
        </p>
      </header>

      <hr className="lp-rule" />

      {/* ── What it does ── */}
      <section className="lp-section">
        <h2>What it does</h2>
        <div className="lp-list">
          {[
            ['Submit online',      'Proposals and documents uploaded from anywhere — no printed forms.'],
            ['Track in real time', 'Every proposal\u2019s status is visible from submission to approval.'],
            ['Validate digitally', 'Document completeness is checked against a digital checklist.'],
            ['Apply for grants',   'Travel, publication, spotlight, and internal funding — all in-app.'],
            ['Archive everything', 'Approved research lives in a searchable digital repository.'],
            ['Stay notified',      'Email and in-app alerts at every decision point.'],
          ].map(([t, d]) => (
            <div className="lp-item" key={t}>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="lp-rule" />

      {/* ── How it works ── */}
      <section className="lp-section">
        <h2>How it works</h2>
        <ol className="lp-steps">
          {[
            ['Researcher',        'uploads the proposal and requirements.'],
            ['College level',     'coordinator, chairperson, or dean endorses.'],
            ['Special Assistant', 'validates completeness, forwards or returns.'],
            ['MSRIC Director',    'reviews and decides.'],
            ['OVCRED',            'gives the final approval.'],
            ['System',            'archives the research and notifies everyone.'],
          ].map(([who, what], i) => (
            <li key={who}>
              <span className="lp-num">{i + 1}</span>
              <p><strong>{who}</strong> {what}</p>
            </li>
          ))}
        </ol>
      </section>

      <hr className="lp-rule" />

      {/* ── Final CTA ── */}
      <section className="lp-section lp-end">
        <h2>Ready to submit your research?</h2>
        <div className="lp-cta">
          <Link to="/register" className="lp-btn lp-btn-lg">Get started</Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-brand">
            <img src={logo} alt="" className="lp-logo lp-logo-sm" />
            <span className="lp-wordmark lp-wordmark-sm">AYON</span>
          </div>
          <p>
            Web-Based Integrated Research Services Management System<br />
            Mamitua Saber Institute of Research and Creation · MSU Main Campus, Marawi City
          </p>
          <p className="lp-credit">
            A Capstone Project · Pumbaya, Zainab A. &amp; Tocalo, Norhidaya A. · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;