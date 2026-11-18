import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight } from 'react-icons/fa6';

/* ─────────────────────────────────────────────────────────────
   A number card on a dashboard.
     <StatCard color="green" label="Approved" value={3} to="/director/approved" />
   With "to", the whole card is a link: it lifts on hover, and a click opens
   that tab and folds the sidebar in (Layout listens for COLLAPSE_MENU), so the
   list has more room. Without "to" it is a plain card.
   ───────────────────────────────────────────────────────────── */
export const COLLAPSE_MENU = 'ayon:collapse-menu';
export const collapseMenu = () => { try { window.dispatchEvent(new Event(COLLAPSE_MENU)); } catch { /* ignore */ } };

const StatCard = ({ label, value, color = '', to, children }) => {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
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