import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight, FaBell, FaBoxArchive, FaCheck, FaChevronDown, FaCloudArrowUp,
  FaClipboardCheck, FaHandHoldingDollar, FaMagnifyingGlassChart, FaUserGraduate,
  FaBuildingColumns, FaUserCheck, FaUserTie, FaStamp, FaDatabase,
} from 'react-icons/fa6';
import logo from '../assets/ayon-logo.png';
import photoTeam       from '../assets/msirc-team.jpg';
import photoSpotlight  from '../assets/research-spotlight.jpg';
import photoConference from '../assets/msirc-conference.jpg';
import './LandingPage.css';

/* ───────────── data ───────────── */
const STAGES = ['Submitted', 'Endorsed', 'Validated', 'Under review', 'Approved', 'Archived'];

const FEED = [
  'Researcher uploaded the proposal and requirements.',
  'College level endorsed the proposal.',
  'Special Assistant checked the documents against the checklist.',
  'MSRIC Director is reviewing the proposal.',
  'OVCRED gave the final approval.',
  'Saved to the repository. Everyone was notified.',
];

const PHOTOS = [
  [photoTeam,       'The MSIRC team holding the Mamitua Saber Institute of Research and Creation banner', 'The MSIRC team', 'center 35%'],
  [photoSpotlight,  'A speaker at the 25th Research Spotlight, hosted by the College of Natural Sciences and Mathematics', '25th Research Spotlight', 'center 72%'],
  [photoConference, 'Researchers and staff gathered in the conference room', 'Research in the room', 'center 55%'],
];

const FEATURES = [
  [FaCloudArrowUp,        'Submit online',      'Proposals and documents uploaded from anywhere, with no printed forms.'],
  [FaMagnifyingGlassChart,'Track in real time', 'Every proposal’s status is visible from submission to approval.'],
  [FaClipboardCheck,      'Validate digitally', 'Document completeness is checked against a digital checklist.'],
  [FaHandHoldingDollar,   'Apply for grants',   'Travel, publication, spotlight and internal funding, all in-app.'],
  [FaBoxArchive,          'Archive everything', 'Approved research lives in a searchable digital repository.'],
  [FaBell,                'Stay notified',      'Email and in-app alerts at every decision point.'],
];

const STATS = [
  [9, 'user roles', 'from Researcher to OVCRED'],
  [5, 'proposal types', 'one place for every submission'],
  [6, 'approval stages', 'each one tracked and visible'],
  [1, 'digital repository', 'for all approved research'],
];

const STEPS = [
  [FaUserGraduate,    'Researcher',        'Uploads the proposal',      'Pick the proposal type, fill in the details and attach the requirements. Nothing to print or carry around.', 'Submitted'],
  [FaBuildingColumns, 'College level',     'Endorses the proposal',     'The coordinator, chairperson or dean of your college reviews and endorses it, or sends it back with comments.', 'Endorsed'],
  [FaUserCheck,       'Special Assistant', 'Validates completeness',    'Documents are checked against the digital checklist, then forwarded or returned for correction.', 'Validated'],
  [FaUserTie,         'MSRIC Director',    'Reviews and decides',       'The director reviews the validated proposal and makes the institute’s decision.', 'Under review'],
  [FaStamp,           'OVCRED',            'Gives the final approval',  'The Office of the Vice Chancellor for Research and Extension Development signs off.', 'Approved'],
  [FaDatabase,        'System',            'Archives and notifies',     'Approved research is saved to the repository and every person involved gets an alert.', 'Archived'],
];

const TYPES = [
  'Research Spotlight',
  'Internally Funded Research',
  'Publication Incentive',
  'Travel Subsidy / Oral Presentation',
  'Externally Funded Research',
];

const FAQ = [
  ['Who can create an account?',
   'Researchers can register on their own. Staff, director and other roles are created by the system administrator.'],
  ['Why do I need to verify my email?',
   'After you register we send a link to your email. Click it to activate your account. The link is valid for 24 hours, and you can ask for a new one if it expires.'],
  ['What files can I upload?',
   'PDF, DOC and DOCX files, up to 10MB each.'],
  ['How will I know what happened to my proposal?',
   'The status on your dashboard updates at every stage, and you get an in-app notification and an email at each decision point.'],
  ['Where do approved proposals go?',
   'They are archived in the digital repository, where they can be searched later.'],
];

/* ───────────── small helpers ───────────── */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* fades an element in the first time it scrolls into view */
const Reveal = ({ children, delay = 0, as: Tag = 'div', className = '' }) => {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`lp-reveal${shown ? ' is-in' : ''} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
};

/* counts up from 0 once it is visible */
const Counter = ({ to }) => {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') { setN(to); return undefined; }
    let raf;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1100;
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{n}</span>;
};

/* ───────────── hero: photos that slide ───────────── */
const HeroPhotos = () => {
  const n = PHOTOS.length;
  const [i, setI]       = useState(0);        // where the strip is; i === n is a copy of the first photo
  const [snap, setSnap] = useState(false);    // true while jumping back to the start with no animation
  const [cycle, setCycle] = useState(0);      // restarts the timer after a click
  const slides = [...PHOTOS, PHOTOS[0]];      // the copy lets the last photo slide into the first one

  useEffect(() => {
    if (prefersReducedMotion() || snap) return undefined;
    const id = setTimeout(() => setI((x) => (x >= n ? x : x + 1)), 5600);
    return () => clearTimeout(id);
  }, [i, cycle, snap, n]);

  useEffect(() => {
    if (!snap) return undefined;
    let r2;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setSnap(false)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [snap]);

  const onEnd = (e) => {
    if (e.target !== e.currentTarget) return;
    if (i >= n) { setSnap(true); setI(0); }   // we are on the copy: quietly go back to the real first photo
  };

  const shown = i % n;
  return (
    <div className="lp-photos">
      <div className={`lp-slides${snap ? ' is-snap' : ''}`} style={{ transform: `translateX(-${i * 100}%)` }} onTransitionEnd={onEnd}>
        {slides.map(([src, alt, , pos], k) => (
          <div className="lp-slide" key={k} aria-hidden={k === shown ? undefined : 'true'}>
            <img src={src} alt={k === shown ? alt : ''} style={{ objectPosition: pos }} loading={k === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>
      <div className="lp-photos-shade" />
      <div className="lp-photos-top">
        <span className="lp-photos-cap" key={shown}>{PHOTOS[shown][2]}</span>
        <div className="lp-photos-dots">
          {PHOTOS.map(([, , label], k) => (
            <button key={label} type="button" aria-label={`Show photo: ${label}`} className={k === shown ? 'is-on' : ''}
              onClick={() => { setSnap(false); setI(k); setCycle((c) => c + 1); }} />
          ))}
        </div>
      </div>
    </div>
  );
};

/* ───────────── hero: a sample proposal moving through the stages ───────────── */
const TrackerDemo = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setStep(STAGES.length - 1); return undefined; }
    const id = setInterval(() => setStep((s) => (s + 1) % (STAGES.length + 1)), 1700);
    return () => clearInterval(id);
  }, []);
  const at = Math.min(step, STAGES.length - 1);      // the extra tick is a short pause before it restarts
  const done = at === STAGES.length - 1 && step < STAGES.length;

  return (
    <div className="lp-demo" aria-hidden="true">
      <div className="lp-demo-card">
        <div className="lp-demo-bar"><i /><i /><i /><span>Sample proposal</span></div>
        <div className="lp-demo-body">
          <p className="lp-demo-type">Internally Funded Research</p>
          <h3>Community Water Quality Monitoring</h3>
          <div className="lp-demo-status">
            <span className={`lp-pill lp-pill-${at}`} key={at}>{STAGES[at]}</span>
            <span className="lp-demo-time">Updated just now</span>
          </div>

          <div className="lp-track">
            <div className="lp-track-line"><div style={{ width: `${(at / (STAGES.length - 1)) * 100}%` }} /></div>
            {STAGES.map((s, i) => (
              <div key={s} className={`lp-track-dot${i < at ? ' is-done' : ''}${i === at ? ' is-now' : ''}`}>
                <span>{i < at || (i === at && done) ? <FaCheck /> : i + 1}</span>
                <em>{s}</em>
              </div>
            ))}
          </div>

          <p className="lp-demo-feed" key={at}>{FEED[at]}</p>
        </div>
      </div>
      <div className="lp-float lp-float-a" key={`n${at}`}><FaBell /> Notification sent</div>
      <div className="lp-float lp-float-b"><FaBoxArchive /> Saved to repository</div>
    </div>
  );
};

/* ───────────── How it works: auto-plays, click to pick ───────────── */
const HowItWorks = () => {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle]   = useState(0);          // restarts the timer after a click

  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), 4200);
    return () => clearTimeout(id);
  }, [active, paused, cycle]);

  const Icon = STEPS[active][0];
  return (
    <div className="lp-how" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <ol className="lp-how-list">
        {STEPS.map(([, who], i) => (
          <li key={who}>
            <button type="button" className={`lp-how-step${i === active ? ' is-active' : ''}${i < active ? ' is-past' : ''}`}
              onClick={() => { setActive(i); setCycle((c) => c + 1); }}>
              <span className="lp-how-num">{i + 1}</span>
              <span className="lp-how-who">{who}</span>
              {i === active && !paused && <span className="lp-how-bar" key={`${active}-${cycle}`} />}
            </button>
          </li>
        ))}
      </ol>
      <div className="lp-how-panel" key={active}>
        <span className="lp-how-icon"><Icon /></span>
        <p className="lp-how-kicker">Step {active + 1} of {STEPS.length} · {STEPS[active][1]}</p>
        <h3>{STEPS[active][2]}</h3>
        <p>{STEPS[active][3]}</p>
        <span className="lp-pill lp-pill-static">Status: {STEPS[active][4]}</span>
      </div>
    </div>
  );
};

/* ───────────── FAQ ───────────── */
const Faq = () => {
  const [open, setOpen] = useState(0);
  return (
    <div className="lp-faq">
      {FAQ.map(([q, a], i) => (
        <div className={`lp-faq-item${open === i ? ' is-open' : ''}`} key={q}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{q}</span><FaChevronDown />
          </button>
          <div className="lp-faq-a"><div><p>{a}</p></div></div>
        </div>
      ))}
    </div>
  );
};

/* ───────────── page ───────────── */
const LandingPage = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="lp">
      {/* ── Nav ── */}
      <nav className={`lp-nav${scrolled ? ' is-scrolled' : ''}`}>
        <div className="lp-nav-inner">
          <a href="#top" className="lp-brand">
            <img src={logo} alt="AYON logo" className="lp-logo" />
            <span className="lp-wordmark">AYON</span>
          </a>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="lp-nav-actions">
            <Link to="/login" className="lp-link">Sign in</Link>
            <Link to="/register" className="lp-btn">Register</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="lp-hero" id="top">
        <HeroPhotos />
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <p className="lp-kicker"><span />MSIRC · Mindanao State University – Main Campus</p>
            <h1>Research management, <span className="lp-hl">without the paperwork.</span></h1>
            <p className="lp-lede">
              AYON moves the entire research lifecycle of the Mamitua Saber Institute
              of Research and Creation online: submission, validation, review,
              approval and archiving in one place.
            </p>
            <div className="lp-cta">
              <Link to="/register" className="lp-btn lp-btn-lg">Create an account <FaArrowRight /></Link>
              <Link to="/login" className="lp-link lp-link-lg">Sign in</Link>
            </div>
          </div>
          <div className="lp-visual">
            <TrackerDemo />
          </div>
        </div>
      </header>

      {/* ── Numbers ── */}
      <section className="lp-stats">
        {STATS.map(([n, label, sub], i) => (
          <Reveal key={label} delay={i * 90} className="lp-stat">
            <strong><Counter to={n} /></strong>
            <span>{label}</span>
            <small>{sub}</small>
          </Reveal>
        ))}
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="features">
        <Reveal><p className="lp-eyebrow">What it does</p><h2>Everything a proposal needs, in one place</h2></Reveal>
        <div className="lp-grid">
          {FEATURES.map(([Icon, t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 90} className="lp-card">
              <span className="lp-card-icon"><Icon /></span>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="lp-section lp-tint" id="how">
        <div className="lp-section-in">
          <Reveal><p className="lp-eyebrow">How it works</p><h2>From upload to archive, step by step</h2></Reveal>
          <Reveal delay={100}><HowItWorks /></Reveal>
        </div>
      </section>

      {/* ── Proposal types ── */}
      <section className="lp-section">
        <Reveal><p className="lp-eyebrow">What you can submit</p><h2>Five kinds of proposals, one system</h2></Reveal>
        <div className="lp-types">
          {TYPES.map((t, i) => (
            <Reveal key={t} delay={i * 70} className="lp-type"><FaCheck />{t}</Reveal>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section lp-tint" id="faq">
        <div className="lp-section-in lp-narrow">
          <Reveal><p className="lp-eyebrow">FAQ</p><h2>Common questions</h2></Reveal>
          <Reveal delay={100}><Faq /></Reveal>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="lp-final">
        <Reveal>
          <h2>Ready to submit your research?</h2>
          <p>Create your researcher account in a minute and send your first proposal.</p>
          <Link to="/register" className="lp-btn lp-btn-lg lp-btn-light">Get started <FaArrowRight /></Link>
        </Reveal>
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
          <p className="lp-legal"><Link to="/terms">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link></p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;