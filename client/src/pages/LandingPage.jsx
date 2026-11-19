import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight, FaBell, FaBoxArchive, FaCheck, FaChevronDown, FaCloudArrowUp,
  FaClipboardCheck, FaHandHoldingDollar, FaMagnifyingGlassChart, FaUserGraduate,
  FaBuildingColumns, FaUserCheck, FaUserTie, FaStamp, FaDatabase, FaArrowUp, FaChartColumn, FaEnvelope, FaPhone, FaLocationDot, FaClock, FaCopy, FaFlask, FaGlobe,
} from 'react-icons/fa6';
import logo from '../assets/ayon-logo.png';
import { CONTACT } from '../data/helpContent';
import photoTeam       from '../assets/msirc-team.jpg';
import photoSpotlight  from '../assets/research-spotlight.jpg';
import photoConference from '../assets/msirc-conference.jpg';
import './LandingPage.css';

/* ───────────── data ───────────── */
/* the sample proposal in the hero: the same path and status names as in AYON */
const STAGES = ['Submitted', 'College', 'Validation', 'MSIRC Director', 'VCRED', 'Approved'];
const STAGE_STATUS = [
  'Submitted', 'For College Endorsement', 'For Validation',
  'For MSIRC Director Review', 'For VCRED Approval', 'Approved',
];

const FEED = [
  'The researcher submitted the proposal and its documents.',
  'The College Chairperson, College Coordinator and College Dean are endorsing it.',
  'The MSIRC Special Assistant is checking the documents against the checklist.',
  'The MSIRC Director is reviewing the proposal.',
  'Waiting for the final approval of VCRED.',
  'Approved and signed. Everyone involved was notified.',
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
  [FaBell,                'Stay notified',      'In-app alerts at every step, and an email when it is approved.'],
];

/* About: who AYON is for */
const ABOUT = [
  [FaUserGraduate, 'Researchers',           'Submit proposals, follow each step, and apply for grants and incentives without printing a form.'],
  [FaStamp,        'College and MSIRC approvers', 'Endorse, validate, review and sign digitally, with every remark kept in the record.'],
  [FaChartColumn,  'MSIRC',                 'See where every proposal is, download reports, and keep approved research in one repository.'],
];

const STATS = [
  [9, 'user roles', 'from Researcher to VCRED'],
  [5, 'submission types', 'research, grants and incentives'],
  [6, 'approval stages', 'each one tracked and visible'],
  [1, 'digital repository', 'for all approved research'],
];

/* [icon, who, what, details, the status while it is at this step] */
const STEPS = [
  [FaUserGraduate,    'Researcher',        'Uploads the proposal',      'Pick the proposal type, fill in the details, and attach the Main Proposal Document plus any supporting documents. Save it as a draft anytime and submit when it is ready.', 'Draft, then Submitted'],
  [FaBuildingColumns, 'College level',     'Endorses the proposal',     'The College Chairperson, then the College Coordinator, then the College Dean endorse it with their e-signature, or return it with remarks.', 'For College Endorsement'],
  [FaUserCheck,       'MSIRC Special Assistant', 'Validates completeness',    'Documents are checked against the digital checklist, then forwarded to the MSIRC Director or returned for correction.', 'For Validation'],
  [FaUserTie,         'MSIRC Director',    'Reviews and decides',       'The MSIRC Director reviews the validated proposal, then endorses it to VCRED, approves it, or returns it.', 'For MSIRC Director Review'],
  [FaStamp,           'VCRED',            'Gives the final approval',  'The Office of the Vice Chancellor for Research and Extension Development signs the final approval.', 'For VCRED Approval'],
  [FaDatabase,        'Repository',        'Shared with the campus',    'VCRED or the Administrator adds the approved research to the Research Repository, where it can be searched later.', 'Approved'],
];

/* what a researcher submits for approval: the same two groups as their two pages in AYON */
const TYPE_GROUPS = [
  [FaFlask,             'Research proposals',     'Submitted from My Research',            ['Research Spotlight', 'Internally Funded Research']],
  [FaHandHoldingDollar, 'Grants and incentives',  'Submitted from Grants and Incentives',  ['Travel Subsidy', 'Oral Presentation', 'Publication Incentive']],
];

const FAQ = [
  ['Who can create an account?',
   'Researchers can register on their own. MSIRC Staff, the MSIRC Director and the other roles are created by the Administrator.'],
  ['Why do I need to verify my email?',
   'After you register we send a link to your email. Click it to activate your account. The link is valid for 24 hours, and you can ask for a new one if it expires.'],
  ['What files can I upload?',
   'One Main Proposal Document (required) and up to 4 supporting documents, such as the Line-Item Budget or an endorsement letter. Each can be a PDF, DOC or DOCX file of up to 10 MB.'],
  ['Can I save my proposal and finish it later?',
   'Yes. Click Save as Draft on any step of the form. Only you can see a draft, and you can continue it from My Research or Grants and Incentives.'],
  ['How will I know what happened to my proposal?',
   'The status on your dashboard updates at every stage, and you get an in-app notification each time. When your proposal receives final approval, we also send you an email.'],
  ['Where do approved proposals go?',
   'VCRED or the Administrator adds them to the Research Repository, where they can be searched later.'],
  ['Who do I contact for help?',
   `The Mamitua Saber Institute of Research and Creation (MSIRC): ${CONTACT.email}, ${CONTACT.hours}.`],
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
            <span className={`lp-pill lp-pill-${at}`} key={at}>{STAGE_STATUS[at]}</span>
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
      {at === STAGES.length - 1 && <div className="lp-float lp-float-b"><FaBoxArchive /> Saved to repository</div>}
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

/* ───────────── footer: is the MSIRC office open right now? (Philippine time, Mon–Fri 8 AM–5 PM) ───────────── */
const officeStatus = (now = new Date()) => {
  const ph = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const day = ph.getDay();
  const mins = ph.getHours() * 60 + ph.getMinutes();
  const weekday = day >= 1 && day <= 5;
  if (weekday && mins >= 8 * 60 && mins < 17 * 60) return { open: true, text: 'Open now · until 5:00 PM' };
  if (weekday && mins < 8 * 60) return { open: false, text: 'Closed · opens today at 8:00 AM' };
  const next = day >= 5 || day === 0 ? (day === 0 ? 'tomorrow' : 'on Monday') : 'tomorrow';
  return { open: false, text: `Closed · opens ${next} at 8:00 AM` };
};

const Footer = () => {
  const [status, setStatus] = useState(officeStatus);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setStatus(officeStatus()), 60000);
    return () => clearInterval(id);
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.location.href = `mailto:${CONTACT.email}`;
    }
  };
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${CONTACT.office}, ${CONTACT.campus}`)}`;

  return (
    <footer className="lp-foot" id="contact">
      <div className="lp-foot-glow" aria-hidden="true"><i /><i /></div>
      <div className="lp-foot-in">
        <Reveal className="lp-foot-head">
          <div>
            <p className="lp-foot-eyebrow">Get in touch</p>
            <h2>Questions about your research? <span>Talk to MSIRC.</span></h2>
          </div>
          <span className={`lp-foot-status${status.open ? ' is-open' : ''}`} role="status">
            <i aria-hidden="true" />{status.text}
          </span>
        </Reveal>

        <div className="lp-foot-grid">
          <Reveal className="lp-foot-brand">
            <a href="#top" className="lp-brand">
              <img src={logo} alt="" className="lp-logo lp-foot-logo" />
              <span className="lp-wordmark">AYON</span>
            </a>
            <p>
              The Web-Based Integrated Research Services Management System of the {CONTACT.office},
              Mindanao State University – Main Campus.
            </p>
            <Link to="/login" className="lp-foot-portal">Sign in to AYON <FaArrowRight /></Link>
          </Reveal>

          <div className="lp-foot-contact">
            <Reveal delay={60} className="lp-tile lp-tile-wide">
              <span className="lp-tile-ic"><FaEnvelope /></span>
              <div className="lp-tile-tx"><small>Email</small><a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a></div>
              <button type="button" className={`lp-tile-btn${copied ? ' is-done' : ''}`} onClick={copy} aria-label="Copy the email address">
                {copied ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
              </button>
            </Reveal>
            <Reveal delay={120} className="lp-tile">
              <span className="lp-tile-ic"><FaPhone /></span>
              <div className="lp-tile-tx"><small>Phone</small><a href={`tel:${CONTACT.phone.replace(/\s/g, '')}`}>{CONTACT.phone}</a></div>
            </Reveal>
            <Reveal delay={180} className="lp-tile">
              <span className="lp-tile-ic"><FaClock /></span>
              <div className="lp-tile-tx"><small>Office hours</small><span>{CONTACT.hours}</span></div>
            </Reveal>
            <Reveal delay={240} className="lp-tile lp-tile-wide">
              <span className="lp-tile-ic"><FaLocationDot /></span>
              <div className="lp-tile-tx">
                <small>Visit us</small>
                <a href={map} target="_blank" rel="noopener noreferrer">{CONTACT.location}, {CONTACT.campus}</a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120} className="lp-foot-links">
            <p className="lp-foot-h">Explore</p>
            <a href="#about">About</a>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#faq">FAQ</a>
            <Link to="/register">Create an account</Link>
          </Reveal>
        </div>
      </div>

      <div className="lp-foot-mark" aria-hidden="true">AYON</div>

      <div className="lp-foot-bottom">
        <div className="lp-foot-in lp-foot-bottom-in">
          <span>© {new Date().getFullYear()} AYON · {CONTACT.office}, {CONTACT.campus}</span>
          <span className="lp-foot-legal"><Link to="/terms">Terms of Service</Link><Link to="/privacy">Privacy Policy</Link></span>
        </div>
      </div>
    </footer>
  );
};

/* ───────────── page ───────────── */
/* the headline appears word by word */
const Words = ({ text, from = 0 }) => text.split(' ').map((w, i) => (
  <span className="lp-word" key={`${w}${i}`} style={{ animationDelay: `${from + i * 70}ms` }}>{w}{' '}</span>
));

const LandingPage = () => {
  const rootRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [showTop,  setShowTop]  = useState(false);
  const [section,  setSection]  = useState('');

  /* scrolling: the progress line, the hero parallax and the back-to-top button.
     The moving values are CSS variables set straight on the page, so React does not redraw every frame. */
  useEffect(() => {
    const root = rootRef.current;
    const still = prefersReducedMotion();
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const hero = Math.min(1, y / Math.max(1, window.innerHeight * 0.9));
      if (root) {
        root.style.setProperty('--lp-progress', String(Math.min(1, y / max)));
        root.style.setProperty('--lp-hero', still ? '0' : hero.toFixed(3));
      }
      setScrolled(y > 8);
      setShowTop(y > 700);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); cancelAnimationFrame(raf); };
  }, []);

  /* the menu link of the section on screen stays highlighted */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const ids = ['about', 'features', 'how', 'faq'];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setSection(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    const top = () => { if (window.scrollY < 300) setSection(''); };
    window.addEventListener('scroll', top, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', top); };
  }, []);

  /* a soft glow follows the mouse on the feature cards */
  const glow = (e) => {
    const card = e.target.closest('.lp-card');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <div className="lp" ref={rootRef}>
      {/* ── Nav ── */}
      <nav className={`lp-nav${scrolled ? ' is-scrolled' : ''}`}>
        <span className="lp-progress" aria-hidden="true" />
        <div className="lp-nav-inner">
          <a href="#top" className="lp-brand">
            <img src={logo} alt="AYON logo" className="lp-logo" />
            <span className="lp-wordmark">AYON</span>
          </a>
          <div className="lp-nav-links">
            {[['top', 'Home'], ['about', 'About'], ['features', 'Features'], ['how', 'How it works'], ['faq', 'FAQ']].map(([id, label]) => (
              <a key={id} href={`#${id}`} className={(id === 'top' ? !section : section === id) ? 'is-active' : ''}
                aria-current={(id === 'top' ? !section : section === id) ? 'true' : undefined}>{label}</a>
            ))}
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
            <h1><Words text="Research management," from={150} /><span className="lp-hl"><Words text="without the paperwork." from={360} /></span></h1>
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

      {/* ── About ── */}
      <section className="lp-section lp-about" id="about">
        <Reveal><p className="lp-eyebrow">About AYON</p><h2>Built for MSIRC, made for researchers</h2></Reveal>
        <div className="lp-about-grid">
          <Reveal className="lp-about-photo">
            <img src={photoConference} alt="Researchers and staff of MSIRC gathered in the conference room" loading="lazy" />
            <span className="lp-about-tag">Mamitua Saber Institute of Research and Creation</span>
          </Reveal>
          <div className="lp-about-text">
            <Reveal delay={80}>
              <p className="lp-about-lead">
                AYON is the Web-Based Integrated Research Services Management System of the Mamitua Saber
                Institute of Research and Creation (MSIRC), Mindanao State University – Main Campus, Marawi City.
              </p>
              <p>
                It takes the research proposal process off paper. Instead of printed forms carried from office
                to office and follow-ups in person, every proposal, endorsement, signature and decision happens
                in one place, and everyone can see where a proposal is at any time.
              </p>
            </Reveal>
            <div className="lp-about-who">
              {ABOUT.map(([Icon, who, what], i) => (
                <Reveal key={who} delay={160 + i * 90} className="lp-about-card">
                  <span className="lp-about-icon"><Icon /></span>
                  <div><h3>{who}</h3><p>{what}</p></div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section" id="features">
        <Reveal><p className="lp-eyebrow">What it does</p><h2>Everything a proposal needs, in one place</h2></Reveal>
        <div className="lp-grid" onMouseMove={glow}>
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
        <Reveal><p className="lp-eyebrow">What you can submit</p><h2>Five kinds of submissions, one system</h2></Reveal>
        <div className="lp-groups">
          {TYPE_GROUPS.map(([Icon, title, where, items], g) => (
            <Reveal key={title} delay={g * 120} className="lp-group">
              <div className="lp-group-head">
                <span className="lp-group-ic"><Icon /></span>
                <div><h3>{title}</h3><p>{where}</p></div>
              </div>
              <div className="lp-types">
                {items.map(t => <span key={t} className="lp-type is-in"><FaCheck />{t}</span>)}
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={240} className="lp-types-note">
          <FaGlobe /><span>Research funded by an agency outside the University? Record it on the <b>External Research</b> page.</span>
        </Reveal>
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

      <button type="button" className={`lp-totop${showTop ? ' is-on' : ''}`} aria-label="Back to top"
        tabIndex={showTop ? 0 : -1} onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}>
        <FaArrowUp />
      </button>

      {/* ── Footer: contact ── */}
      <Footer />
    </div>
  );
};

export default LandingPage;