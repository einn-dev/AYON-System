import React, { useCallback, useEffect, useState } from 'react';
import API from '../services/authService';
import { FaBell, FaCircleInfo, FaTriangleExclamation, FaXmark } from 'react-icons/fa6';
import './Announcements.css';

/* ─────────────────────────────────────────────────────────────
   Announcements shown at the top of every dashboard page.
   Info and Reminder can be closed with ×; this is remembered on this
   browser until the Administrator edits the announcement.
   Urgent cannot be closed while it is showing.
   ───────────────────────────────────────────────────────────── */

export const ANN_TYPES = {
  info:     { label: 'Info',     badge: 'badge-blue'  },
  reminder: { label: 'Reminder', badge: 'badge-amber' },
  urgent:   { label: 'Urgent',   badge: 'badge-red'   },
};

/* the Admin page fires this after a change so the banner updates right away */
export const ANN_CHANGED = 'ayon:announcements-changed';

const STORE_KEY = 'ayon_ann_dismissed';
const MAX_SHOWN = 3;
const REFRESH_MS = 5 * 60 * 1000;

const readDismissed = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDismissed = (map) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* private window: just not remembered */ }
};

const ICON = { info: <FaCircleInfo />, reminder: <FaBell />, urgent: <FaTriangleExclamation /> };

export const AnnouncementCard = ({ a, onClose }) => (
  <div className={`ann ann-${a.ann_type}`} role={a.ann_type === 'urgent' ? 'alert' : 'status'}>
    <span className="ann-ic" aria-hidden="true">{ICON[a.ann_type] || ICON.info}</span>
    <div className="ann-text">
      <strong>{a.title}</strong>
      <p>{a.message}</p>
    </div>
    {a.ann_type !== 'urgent' && onClose && (
      <button type="button" className="ann-x" onClick={onClose} aria-label={`Close announcement: ${a.title}`} title="Close">
        <FaXmark />
      </button>
    )}
  </div>
);

const AnnouncementBanner = () => {
  const [items,     setItems]     = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [showAll,   setShowAll]   = useState(false);

  const load = useCallback(() => {
    API.get('/announcements/active')
      .then((res) => setItems(res.data?.announcements || []))
      .catch(() => { /* announcements are extra: never break the page */ });
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    window.addEventListener(ANN_CHANGED, load);
    return () => { clearInterval(t); window.removeEventListener(ANN_CHANGED, load); };
  }, [load]);

  const close = (a) => {
    const next = { ...dismissed, [a.announcement_id]: a.updated_at || '1' };
    setDismissed(next);
    writeDismissed(next);
  };

  /* closed = closed for this version; an edit by the Admin shows it again */
  const visible = items.filter(a => a.ann_type === 'urgent'
    || dismissed[a.announcement_id] !== (a.updated_at || '1'));
  if (!visible.length) return null;

  const shown = showAll ? visible : visible.slice(0, MAX_SHOWN);
  const extra = visible.length - MAX_SHOWN;

  return (
    <div className="ann-wrap" aria-label="Announcements">
      {shown.map(a => <AnnouncementCard key={a.announcement_id} a={a} onClose={() => close(a)} />)}
      {extra > 0 && (
        <button type="button" className="ann-more" onClick={() => setShowAll(v => !v)}>
          {showAll ? 'Show fewer' : `Show ${extra} more`}
        </button>
      )}
    </div>
  );
};

export default AnnouncementBanner;