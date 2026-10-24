import React, { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import logo from '../assets/ayon-logo.png';
import { LAST_UPDATED } from '../data/legalInfo';
import '../pages/LegalPages.css';

/**
 * Page shell for the Terms of Service and Privacy Policy.
 *   sections = [{ title, body: [text or JSX, ...], list: [text, ...] }, ...]
 */
const LegalLayout = ({ title, intro, sections }) => {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · AYON`;
    return () => { document.title = previous; };
  }, [title]);

  const navClass = ({ isActive }) => (isActive ? 'active' : undefined);

  return (
    <div className="legal">
      <header className="legal-top">
        <div className="legal-top-inner">
          <Link to="/" className="legal-brand">
            <img src={logo} alt="" />
            <span>AYON</span>
          </Link>
          <nav className="legal-nav" aria-label="Legal pages">
            <NavLink to="/terms" className={navClass}>Terms of Service</NavLink>
            <NavLink to="/privacy" className={navClass}>Privacy Policy</NavLink>
          </nav>
        </div>
      </header>

      <main className="legal-body">
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>
        {intro && <p className="legal-intro">{intro}</p>}

        <nav className="legal-toc" aria-label="Contents">
          <p>On this page</p>
          <ol>
            {sections.map((s, i) => (
              <li key={s.title}><a href={`#section-${i + 1}`}>{s.title}</a></li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.title} id={`section-${i + 1}`}>
            <h2>{i + 1}. {s.title}</h2>
            {(s.body || []).map((p, k) => <p key={k}>{p}</p>)}
            {s.list && (
              <ul>
                {s.list.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
            {(s.after || []).map((p, k) => <p key={`a${k}`}>{p}</p>)}
          </section>
        ))}
      </main>

      <footer className="legal-foot">
        <Link to="/register">← Back to registration</Link>
        <span>
          <Link to="/terms">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link>
        </span>
      </footer>
    </div>
  );
};

export default LegalLayout;