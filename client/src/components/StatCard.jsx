import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight } from '../utils/icons';

/* ─────────────────────────────────────────────────────────────
   A number card on a dashboard.
     <StatCard color="green" label="Approved" value={3} to="/director/approved" />
   With "to", the whole card is a link: it lifts on hover, and a click opens
   that tab and folds the sidebar in (Layout listens for COLLAPSE_MENU), so the
   list has more room. Without "to" it is a plain card.
   ───────────────────────────────────────────────────────────── */
export const COLLAPSE_MENU = 'ayon:collapse-menu';
export const collapseMenu = () => { try { window.dispatchEvent(new Event(COLLAPSE_MENU)); } catch { /* ignore */ } };

/* numbers count up to their value (from the old value when it changes); text is shown as it is */
const CountUp = ({ value }) => {
  const [shown, setShown] = useState(typeof value === 'number' ? 0 : value);
  const from = useRef(0);
  useEffect(() => {
    if (typeof value !== 'number') { setShown(value); return undefined; }
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still) { setShown(value); from.current = value; return undefined; }
    const start = from.current, t0 = performance.now(), dur = 700;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
};

const StatCard = ({ label, value, color = '', to, children }) => {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value"><CountUp value={value} /></span>
      {children}
    </>
  );
  if (!to) return <div className={`stat-card ${color}`}>{body}</div>;
  return (
    <Link to={to} className={`stat-card stat-link ${color}`} onClick={collapseMenu}
      aria-label={`${label}: ${value}. Open the list`}>
      {body}
      <FaArrowRight className="stat-go" aria-hidden="true" />
    </Link>
  );
};

export default StatCard;