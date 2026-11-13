import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/authService';
import {
  FaBell, FaCircleCheck, FaCircleXmark, FaClipboardList, FaPaperPlane, FaSignature, FaArrowRight,
} from 'react-icons/fa6';
import './NotificationBell.css';
import { LIVE_UPDATE, OPEN_BELL } from '../utils/liveRefresh';

/* ─────────────────────────────────────────────────────────────
   The bell in the top bar. Clicking it opens a small panel with the
   latest notifications, without leaving the page.
     - click a notification: it is marked as read and opens where it belongs
       (the office queues open the proposal, like the "Review" button on the
       Notifications page; everyone else goes to their Notifications page)
     - "Mark all as read"
     - "See all notifications" opens the full page
   ───────────────────────────────────────────────────────────── */

const SHOWN = 8;

const ICONS = {
  submission:  <FaPaperPlane />,
  review:      <FaClipboardList />,
  endorsement: <FaSignature />,
  approval:    <FaCircleCheck />,
  rejection:   <FaCircleXmark />,
  general:     <FaBell />,
};

/* the queue each office's "Review" button opens (same as their Notifications page) */
const OFFICE_QUEUE = {
  special_assistant: '/special-assistant/validate',
  msric_director:    '/director/for-review',
  ovcred:            '/ovcred/for-endorsement',
  msric_staff:       '/msric-staff/submissions',
};
const isGrantAlert = (n) => /^new grant application/i.test(n.title || '');
const isRepoNews   = (n) => /^new research in the repository/i.test(n.title || '');

const whereTo = (n, role, base, notifPath) => {
  const queue = OFFICE_QUEUE[role];
  if (!queue) return notifPath;
  if (isRepoNews(n) && role === 'msric_staff') return '/msric-staff/repository';
  if (isGrantAlert(n)) return `${base}/grants`;
  if (n.proposal_id) return `${queue}?open=${n.proposal_id}`;
  return notifPath;
};

const ago = (d) => {
  if (!d) return '';
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'} ago`; }
  if (s < 7 * 86400) { const n = Math.floor(s / 86400); return n === 1 ? 'Yesterday' : `${n} days ago`; }
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* tells the sidebar and the bell to refresh the unread count */
const announce = () => { try { window.dispatchEvent(new Event('ayon:notifs-changed')); } catch { /* ignore */ } };

const NotificationBell = ({ role, base, notifPath, unread = 0 }) => {
  const navigate = useNavigate();
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed,  setFailed]  = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const wrapRef = useRef(null);
  const btnRef  = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await API.get('/notifications');
      setNotifs(res.data.notifications || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  /* "View notifications" on the live message opens the panel;
     a live update while it is open reloads the list */
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_BELL, show);
    return () => window.removeEventListener(OPEN_BELL, show);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener(LIVE_UPDATE, load);
    return () => window.removeEventListener(LIVE_UPDATE, load);
  }, [open, load]);

  /* close on Esc or a click outside the panel */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); } };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => (n.notif_id === id ? { ...n, is_read: true } : n)));
      announce();
    } catch { /* stays unread; nothing is lost */ }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await API.patch('/notifications/read-all');
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      announce();
    } catch { /* the full page can try again */ } finally {
      setBusy(false);
    }
  };

  const openIt = async (n) => {
    if (!n.is_read) await markRead(n.notif_id);
    setOpen(false);
    navigate(whereTo(n, role, base, notifPath));
  };

  const seeAll = () => { setOpen(false); navigate(notifPath); };

  const newCount = notifs.length ? notifs.filter((n) => !n.is_read).length : unread;
  const list = (onlyNew ? notifs.filter((n) => !n.is_read) : notifs).slice(0, SHOWN);

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button type="button" ref={btnRef} className={`tb-icon${open ? ' on' : ''}`} title="Notifications"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <FaBell />
        {unread > 0 && <i className="tb-badge">{unread > 99 ? '99+' : unread}</i>}
      </button>

      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <div className="nb-head">
            <h3>Notifications</h3>
            {newCount > 0 && (
              <button type="button" className="nb-link" onClick={markAll} disabled={busy}>
                {busy ? 'Working...' : 'Mark all as read'}
              </button>
            )}
          </div>
          <div className="nb-chips" role="group" aria-label="Show">
            <button type="button" className={`nb-chip${!onlyNew ? ' on' : ''}`} aria-pressed={!onlyNew}
              onClick={() => setOnlyNew(false)}>All</button>
            <button type="button" className={`nb-chip${onlyNew ? ' on' : ''}`} aria-pressed={onlyNew}
              onClick={() => setOnlyNew(true)}>Unread{newCount > 0 ? ` (${newCount})` : ''}</button>
          </div>

          <div className="nb-list">
            {loading && !notifs.length ? (
              <p className="nb-empty">Loading...</p>
            ) : failed ? (
              <div className="nb-empty">
                Could not load your notifications.
                <button type="button" className="nb-link" onClick={load}>Try again</button>
              </div>
            ) : list.length === 0 ? (
              <div className="nb-empty">
                <span className="nb-empty-ic"><FaBell /></span>
                {onlyNew ? 'You are all caught up.' : 'No notifications yet.'}
              </div>
            ) : (
              list.map((n) => (
                <button key={n.notif_id} type="button" className={`nb-item${n.is_read ? '' : ' unread'}`}
                  onClick={() => openIt(n)}>
                  <span className="nb-ic" aria-hidden="true">{ICONS[n.notif_type] || <FaBell />}</span>
                  <span className="nb-body">
                    <span className="nb-title">{n.title}</span>
                    <span className="nb-msg">{n.message}</span>
                    <span className="nb-time">{ago(n.date_sent)}</span>
                  </span>
                  {!n.is_read && <span className="nb-dot" aria-label="Unread" />}
                </button>
              ))
            )}
          </div>

          <button type="button" className="nb-foot" onClick={seeAll}>
            See all notifications<FaArrowRight className="ic-r" />
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;