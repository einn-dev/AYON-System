import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/authService';
import './Layout.css';
import './OfficeNotifications.css';
import { FaBell, FaCircleCheck, FaCircleXmark, FaClipboardList, FaPaperPlane, FaSignature } from 'react-icons/fa6';

/* Notifications page for the Special Assistant, MSIRC Director and OVCRED.
     queuePath: where "Open" goes (their queue), for example "/director/for-review"   */

const ICONS = {
  submission:  <FaPaperPlane />,
  review:      <FaClipboardList />,
  endorsement: <FaSignature />,
  approval:    <FaCircleCheck />,
  rejection:   <FaCircleXmark />,
  general:     <FaBell />,
};

const isGrantAlert = (n) => /^new grant application/i.test(n.title || '');
const isReminder = (n) => /^reminder/i.test(n.title || '');
const isWaiting  = (n) => !!n.proposal_id && !isReminder(n);

/* tells the sidebar to refresh its unread count */
const announce = () => { try { window.dispatchEvent(new Event('ayon:notifs-changed')); } catch { /* ignore */ } };

const OfficeNotifications = ({ queuePath, intro }) => {
  const navigate = useNavigate();
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);
  const [filter,  setFilter]  = useState('all');
  const [busy,    setBusy]    = useState(false);
  const [problem, setProblem] = useState('');

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

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs((prev) => prev.map((n) => (n.notif_id === id ? { ...n, is_read: true } : n)));
      announce();
    } catch { /* leave it unread; nothing is lost */ }
  };

  const markAll = async () => {
    setBusy(true);
    setProblem('');
    try {
      await API.patch('/notifications/read-all');
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      announce();
    } catch {
      setProblem('Could not mark them as read. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  /* a grant alert opens the Grant Applications page of the same office ("/director/..." -> "/director/grants") */
  const grantsPath = `/${String(queuePath || '').split('/')[1]}/grants`;

  const openIt = async (n) => {
    if (!n.is_read) await markRead(n.notif_id);
    navigate(isGrantAlert(n) ? grantsPath : `${queuePath}?open=${n.proposal_id}`);
  };

  const unread  = notifs.filter((n) => !n.is_read).length;
  const shown = notifs.filter((n) => {
    if (filter === 'unread')   return !n.is_read;
    if (filter === 'waiting')  return isWaiting(n);
    if (filter === 'reminder') return isReminder(n);
    return true;
  });

  return (
    <>
      <div className="page-header">
        <h1>Notifications</h1>
        <p>{intro || 'Proposals waiting for you and alerts from the MSIRC Administrator.'}</p>
      </div>

      {problem && <div className="alert alert-error" role="alert">{problem}</div>}

      <div className="panel">
        <div className="panel-header">
          <div className="on-toolbar">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter notifications">
              <option value="all">All Notifications</option>
              <option value="unread">Unread Only</option>
              <option value="waiting">Proposals Waiting for Me</option>
              <option value="reminder">Reminders from the Administrator</option>
            </select>
            {unread > 0
              ? <span className="badge badge-blue">{unread} unread</span>
              : !loading && !failed && <span className="badge badge-green">All Caught Up</span>}
            {unread > 0 && (
              <button type="button" className="btn btn-outline btn-sm on-spacer"
                onClick={markAll} disabled={busy}>
                {busy ? 'Working...' : 'Mark All as Read'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading notifications...</p></div>
        ) : failed ? (
          <div className="empty-state">
            <p>Could not load your notifications.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={load}>Try Again</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '2rem', margin: 0 }}><FaBell /></p>
            <p>{filter === 'all' ? 'No notifications yet.' : 'Nothing matches this filter.'}</p>
          </div>
        ) : (
          shown.map((n) => (
            <div key={n.notif_id} className={`on-item${n.is_read ? '' : ' unread'}`}
              onClick={() => { if (!n.is_read) markRead(n.notif_id); }}>
              <div className="on-ico" aria-hidden="true">{ICONS[n.notif_type] || <FaBell />}</div>
              <div className="on-body">
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{n.date_sent ? new Date(n.date_sent).toLocaleString() : ''}</small>
              </div>
              <div className="on-act">
                {!n.is_read && <span className="badge badge-blue">New</span>}
                {n.proposal_id && (
                  <button type="button" className="btn btn-primary btn-sm"
                    onClick={(e) => { e.stopPropagation(); openIt(n); }}>
                    Review
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        {!loading && !failed && notifs.length >= 100 && (
          <div className="on-note">Showing your latest 100 notifications.</div>
        )}
      </div>
    </>
  );
};

export default OfficeNotifications;