import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/terms';
import './WelcomeBanner.css';
import { PiHandWavingBold } from 'react-icons/pi';

/* ─────────────────────────────────────────────────────────────
   The greeting at the top of every dashboard:
     "Bolos ka, Norhidaya!"  (Bolos ka: "welcome" in Meranaw)
   on a slowly moving background in the AYON colors.
     <WelcomeBanner text="What this dashboard is for" aside={<select … />} />
   The movement stops for people who turned on "reduce motion".
   ───────────────────────────────────────────────────────────── */
const today = () => new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const WelcomeBanner = ({ text, aside = null }) => {
  const { user } = useAuth() || {};
  const name = String(user?.first_name || '').trim();
  const role = ROLE_LABEL[user?.role] || (user?.role === 'admin' ? 'Administrator' : '');
  return (
    <header className="wb" aria-label="Welcome">
      <span className="wb-blob one" aria-hidden="true" />
      <span className="wb-blob two" aria-hidden="true" />
      <span className="wb-blob three" aria-hidden="true" />
      <span className="wb-sparks" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
      <div className="wb-text">
        <div className="wb-meta">
          {role && <span className="wb-role">{role}</span>}
          <span className="wb-date">{today()}</span>
        </div>
        <h1 className="wb-title">
          Bolos ka{name ? <>, <span className="wb-name">{name}</span></> : ''}!{' '}
          <PiHandWavingBold className="wb-wave" aria-hidden="true" />
        </h1>
        {text && <p className="wb-sub">{text}</p>}
      </div>
      {aside && <div className="wb-aside">{aside}</div>}
    </header>
  );
};

export default WelcomeBanner;