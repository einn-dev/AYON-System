import React, { useState } from 'react';
import { FaXmark } from '../utils/icons';

/* A short notice in a soft maroon box: "INFO: …".
   Used where something is not available yet or needs explaining: it says why and what to do.
   action:     an optional button or link shown at the end of the box
   dismissKey: when given, the box has an × to close it, and stays closed in this browser
               (only for notes that explain a page; never for something the person must do) */
const KEY = (k) => `ayon_info_closed_${k}`;
const wasClosed = (k) => { try { return !!k && localStorage.getItem(KEY(k)) === '1'; } catch { return false; } };

const InfoNotice = ({ label = 'Info', children, action = null, style, dismissKey }) => {
  const [closed, setClosed] = useState(() => wasClosed(dismissKey));
  if (closed) return null;
  const close = () => {
    try { localStorage.setItem(KEY(dismissKey), '1'); } catch { /* storage off: closed until the page reloads */ }
    setClosed(true);
  };
  return (
    <div className={`info-notice${action || dismissKey ? ' has-action' : ''}`} role="note" style={style}>
      <span><b className="info-notice-label">{label}:</b> {children}</span>
      {action}
      {dismissKey && (
        <button type="button" className="info-notice-x" onClick={close} aria-label="Close this note" title="Close">
          <FaXmark />
        </button>
      )}
    </div>
  );
};

export default InfoNotice;