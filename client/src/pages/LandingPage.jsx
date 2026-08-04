import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="lp">

      {/* ── Navbar ── */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <span className="lp-brand-mark">AYON</span>
            <span className="lp-brand-sub">MSIRC · MSU Main</span>
          </div>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <a href="#about">About MSIRC</a>
          </div>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-btn-ghost">Sign in</Link>
            <Link to="/register" className="lp-btn-solid">Register</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="lp-hero">
        <div className="lp-hero-inner">
          <p className="lp-eyebrow">Web-Based Integrated Research Services Management System</p>
          <h1 className="lp-title">
            Research moves forward.<br />
            <span className="lp-title-accent">Paperwork doesn't follow.</span>
          </h1>
          <p className="lp-lede">
            AYON digitizes the entire research lifecycle at the Mamitua Saber Institute
            of Research and Creation — from proposal submission to final approval and
            archiving — so faculty and researchers spend time on research, not queues.
          </p>
          <div className="lp-hero-cta">
            <Link to="/register" className="lp-btn-solid lp-btn-lg">
              Create researcher account
            </Link>
            <Link to="/login" className="lp-btn-outline lp-btn-lg">
              Sign in to AYON
            </Link>
          </div>

          {/* Status pipeline — the signature element */}
          <div className="lp-pipeline" aria-hidden="true">
            {[
              { label: 'Submitted', cls: 'p-blue'   },
              { label: 'Validated', cls: 'p-teal'   },
              { label: 'Reviewed',  cls: 'p-amber'  },
              { label: 'Endorsed',  cls: 'p-purple' },
              { label: 'Approved',  cls: 'p-green'  },
              { label: 'Archived',  cls: 'p-navy'   },
            ].map((s, i) => (
              <React.Fragment key={s.label}>
                <div className={`lp-pill ${s.cls}`} style={{ animationDelay: `${i * 0.15}s` }}>
                  {s.label}
                </div>
                {i < 5 && <div className="lp-pipe-line" style={{ animationDelay: `${i * 0.15 + 0.08}s` }} />}
              </React.Fragment>
            ))}
          </div>
          <p className="lp-pipeline-caption">
            Every proposal's journey, tracked live — no more asking "where is my paper now?"
          </p>
        </div>
      </header>

      {/* ── Problem strip ── */}
      <section className="lp-strip">
        <div className="lp-strip-inner">
          <div className="lp-strip-item">
            <span className="lp-strip-was">Before</span>
            <p>Printed forms, physical queues, lost documents, weeks of waiting</p>
          </div>
          <div className="lp-strip-arrow">→</div>
          <div className="lp-strip-item lp-strip-now">
            <span className="lp-strip-is">With AYON</span>
            <p>Online submission, digital validation, real-time status, instant notifications</p>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <p className="lp-eyebrow">What AYON does</p>
          <h2 className="lp-h2">One platform for the whole research lifecycle</h2>

          <div className="lp-grid">
            {[
              { icon: '📤', title: 'Online proposal submission',
                desc: 'Submit research proposals and required documents from anywhere — no printed forms, no office visits.' },
              { icon: '✅', title: 'Digital document validation',
                desc: 'The Special Assistant checks completeness against a digital checklist and forwards or returns in one click.' },
              { icon: '🧭', title: 'Real-time status tracking',
                desc: 'Follow your proposal from submitted to approved. Every stage is visible, timestamped, and transparent.' },
              { icon: '🎓', title: 'Grants & incentives',
                desc: 'Apply for travel subsidies, publication incentives, research spotlight, and internal funding — all in-app.' },
              { icon: '🗄', title: 'Digital repository',
                desc: 'Approved research is archived and searchable, with public and private access levels per output.' },
              { icon: '🔔', title: 'Email + in-app notifications',
                desc: 'Get notified at every decision point — endorsements, approvals, rejections — the moment they happen.' },
              { icon: '🔐', title: 'Role-based access',
                desc: 'Nine roles, each with its own dashboard. Coordinators and deans see only their own college\'s research.' },
              { icon: '📊', title: 'One-click reports',
                desc: 'Administrators export PDF reports on proposals, grants, repository, and system activity instantly.' },
            ].map(f => (
              <article className="lp-card" key={f.title}>
                <div className="lp-card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ── */}
      <section className="lp-section lp-section-alt" id="workflow">
        <div className="lp-section-inner">
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-h2">Six stages. Zero paper.</h2>

          <ol className="lp-steps">
            {[
              { who: 'Researcher',        what: 'Uploads the proposal and requirements through AYON.' },
              { who: 'College level',     what: 'Coordinator, Chairperson, or Dean views and endorses the submission.' },
              { who: 'Special Assistant', what: 'Validates document completeness — forwards if complete, returns if not.' },
              { who: 'MSRIC Director',    what: 'Reviews via dashboard, then approves, rejects, or endorses to OVCRED.' },
              { who: 'OVCRED',            what: 'Issues the final university-level approval or rejection.' },
              { who: 'System',            what: 'Stores approved research in the repository and notifies everyone automatically.' },
            ].map((s, i) => (
              <li className="lp-step" key={s.who}>
                <span className="lp-step-num">{i + 1}</span>
                <div>
                  <h3>{s.who}</h3>
                  <p>{s.what}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── About ── */}
      <section className="lp-section" id="about">
        <div className="lp-section-inner lp-about">
          <div>
            <p className="lp-eyebrow">About the institute</p>
            <h2 className="lp-h2">Mamitua Saber Institute of Research and Creation</h2>
            <p className="lp-body">
              MSIRC is the official research arm of Mindanao State University – Main Campus
              in Marawi City. It formulates research policies, provides research and travel
              grants, monitors funded projects, manages the university's official journals,
              and preserves the scholarly and creative heritage of Mindanao.
            </p>
            <p className="lp-body">
              AYON supports that mission by replacing manual, paper-based processes with a
              secure, transparent, and accessible digital workflow — advancing the
              university's commitment to research excellence and accountability.
            </p>
          </div>
          <div className="lp-about-stats">
            <div className="lp-stat">
              <span className="lp-stat-num">9</span>
              <span className="lp-stat-label">User roles served</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-num">5</span>
              <span className="lp-stat-label">Grant &amp; incentive types</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-num">6</span>
              <span className="lp-stat-label">Workflow stages, fully digital</span>
            </div>
            <div className="lp-stat">
              <span className="lp-stat-num">0</span>
              <span className="lp-stat-label">Printed forms required</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <h2>Ready to submit your research?</h2>
          <p>Create your researcher account in under a minute.</p>
          <div className="lp-hero-cta">
            <Link to="/register" className="lp-btn-light lp-btn-lg">Get started</Link>
            <Link to="/login" className="lp-btn-outline-light lp-btn-lg">I already have an account</Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div>
            <span className="lp-brand-mark lp-footer-brand">AYON</span>
            <p>Web-Based Integrated Research Services Management System<br />
              Mamitua Saber Institute of Research and Creation<br />
              Mindanao State University – Main Campus, Marawi City</p>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#workflow">How it works</a>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Register</Link>
          </div>
        </div>
        <p className="lp-footer-note">
          A Capstone Project by Pumbaya, Zainab A. &amp; Tocalo, Norhidaya A. · BSIT Major in Database Systems · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;