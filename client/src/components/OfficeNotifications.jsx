import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/authService';
import './Layout.css';
import './OfficeNotifications.css';
import { useLiveRefresh } from '../utils/liveRefresh';
import { FaBell, FaCircleCheck, FaCircleXmark, FaChevronRight, FaClipboardList, FaPaperPlane, FaSignature } from 'react-icons/fa6';

/* Notifications page for the MSIRC Special Assistant, MSIRC Director, VCRED and MSIRC Staff.
     queuePath:   where "Open" goes (their queue), for example "/director/for-review"
     openLabel:   the link text at the right of each row (default "Open")
     filters:     the filter list, [value, label, test(n)] (default: the office filters)
     repoPath:    where a "New research in the Repository" notice opens (optional)       */

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
const isRepoNews = (n) => /^new research in the repository/i.test(n.title || '');
const isTerminalNews = (n) => /terminal report/i.test(n.title || '');

const OFFICE_FILTERS = [
  ['all',      'All Notifications',                () => true],
  ['unread',   'Unread Only',                      (n) => !n.is_read],
  ['waiting',  'Proposals Waiting for Me',         isWaiting],
  ['reminder', 'Reminders from the Administrator', isReminder],
];

/* tells the sidebar to refresh its unread count */
const announce = () => { try { window.dispatchEvent(new Event('ayon:notifs-changed')); } catch { /* ignore */ } };

const OfficeNotifications = ({ queuePath, intro, openLabel = 'Open', filters = OFFICE_FILTERS, repoPath }) => {
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
  useLiveRefresh(load);                    // new notifications appear while the page is open

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
  /* a Terminal Report notice opens the Terminal Reports page (MSIRC Special Assistant, MSIRC Director) */
  const officeBase = String(queuePath || '').split('/')[1];
  const terminalPath = ['special-assistant', 'director'].includes(officeBase) ? `/${officeBase}/terminal-reports` : '';

  const openIt = async (n) => {
    if (!n.is_read) await markRead(n.notif_id);
    if (isRepoNews(n) && repoPath) { navigate(repoPath); return; }
    if (isTerminalNews(n) && terminalPath) { navigate(terminalPath); return; }
    navigate(isGrantAlert(n) ? grantsPath : `${queuePath}?open=${n.proposal_id}`);
  };

  const unread  = notifs.filter((n) => !n.is_read).length;
  const test  = (filters.find(([v]) => v === filter) || filters[0])[2];
  const shown = notifs.filter((n) => test(n));

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
              {filters.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
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
          <div className="empty-state loading-state" role="status"><p>Loading notifications…</p></div>
        ) : failed ? (
          <div className="empty-state error-state" role="alert">
            <p>Could not load your notifications.</p>
            <button type="button" className="btn btn-outline btn-sm" onClick={load}>Try again</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '2rem', margin: 0 }}><FaBell /></p>
            <p>{filter === 'all' ? 'No notifications yet.' : 'Nothing matches this filter.'}</p>
          </div>
        ) : (
          shown.map((n) => {
            /* like the college pages: clicking the notification itself opens what it is about */
            const opens = !!n.proposal_id || (!!repoPath && isRepoNews(n));
            const click = () => (opens ? openIt(n) : (!n.is_read && markRead(n.notif_id)));
            return (
            <div key={n.notif_id} className={`on-item${n.is_read ? '' : ' unread'}${opens ? ' opens' : ''}`}
              onClick={click}
              {...(opens ? {
                role: 'button', tabIndex: 0, title: n.proposal_id ? 'Open this proposal' : 'Open the Research Repository',
                onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } },
              } : {})}>
              <div className="on-ico" aria-hidden="true">{ICONS[n.notif_type] || <FaBell />}</div>
              <div className="on-body">
                <strong>{n.title}</strong>
                <p>{n.message}</p>
                <small>{n.date_sent ? new Date(n.date_sent).toLocaleString() : ''}</small>
              </div>
              <div className="on-act">
                {!n.is_read && <span className="badge badge-blue">New</span>}
                {opens && (
                  <span className="on-open">{openLabel} <FaChevronRight aria-hidden="true" /></span>
                )}
              </div>
            </div>
            );
          })
        )}
        {!loading && !failed && notifs.length >= 100 && (
          <div className="on-note">Showing your latest 100 notifications.</div>
        )}
      </div>
    </>
  );
};

export default OfficeNotifications;