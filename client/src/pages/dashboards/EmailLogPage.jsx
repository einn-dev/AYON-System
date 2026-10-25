import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import { errText, fmtWhen, Pager } from './adminShared';

const PAGE_SIZE = 25;

const TYPE_LABELS = {
  verification: 'Verification',
  notification: 'Notification',
};

const EmailLogPage = () => {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [stats,   setStats]   = useState({ sent_7d: 0, failed_7d: 0 });
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [alert,   setAlert]   = useState(null);
  const [sending, setSending] = useState(null);     // email_id being resent

  const [search,     setSearch]     = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [status,     setStatus]     = useState('');
  const [type,       setType]       = useState('');

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (status)     params.status = status;
      if (type)       params.type   = type;
      if (searchTerm) params.q      = searchTerm;

      const res = await API.get('/admin/email-logs', { params });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      if (res.data.stats) setStats(res.data.stats);
    } catch (err) {
      setAlert({ type: 'error', msg: errText(err, 'Could not load the email log.') });
    } finally {
      setLoading(false);
    }
  }, [page, status, type, searchTerm]);

  useEffect(() => { load(); }, [load]);

  // messages disappear by themselves
  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => setAlert(null), 7000);
    return () => clearTimeout(t);
  }, [alert]);

  const resend = async (log) => {
    setSending(log.email_id);
    setAlert(null);
    try {
      await API.post(`/admin/email-logs/${log.email_id}/resend`);
      setAlert({ type: 'success', msg: `Email sent again to ${log.recipient_email}.` });
    } catch (err) {
      setAlert({ type: 'error', msg: errText(err, 'The email could not be sent again.') });
    } finally {
      setSending(null);
      load();      // shows the new entry (sent, or failed with its error)
    }
  };

  const filtersOn = !!(status || type || searchTerm);

  return (
    <>
      <div className="page-header">
        <h1>Email Log</h1>
        <p>Every email the system tried to send, and whether the mail provider accepted it.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="stats-grid">
        <div className="stat-card green">
          <span className="stat-label">Sent (7 days)</span>
          <span className="stat-value">{stats.sent_7d}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Failed (7 days)</span>
          <span className="stat-value">{stats.failed_7d}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search recipient or subject..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 150 }}
              value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
            </select>
            <select className="search-input" style={{ minWidth: 150 }}
              value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">All types</option>
              <option value="verification">Verification</option>
              <option value="notification">Notification</option>
            </select>
            {filtersOn && (
              <button className="btn btn-outline btn-sm" onClick={() => {
                setSearch(''); setSearchTerm(''); setStatus(''); setType(''); setPage(1);
              }}>Clear filters</button>
            )}
          </div>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>Refresh</button>
        </div>

        <div className="am-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Type</th>
                <th>Status</th>
                <th>Error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.email_id}>
                  <td className="am-muted" style={{ whiteSpace: 'nowrap' }}>
                    {fmtWhen(l.created_at || l.sent_at)}
                  </td>
                  <td>
                    {l.recipient_email}
                    {l.subject && <span className="am-sub">{l.subject}</span>}
                  </td>
                  <td>{TYPE_LABELS[l.email_type] || l.email_type || 'Notification'}</td>
                  <td>
                    <span className={`badge ${l.status === 'sent' ? 'badge-green' : l.status === 'failed' ? 'badge-red' : 'badge-amber'}`}>
                      {l.status === 'sent' ? 'Sent' : l.status === 'failed' ? 'Failed' : 'Pending'}
                    </span>
                  </td>
                  <td className="am-muted" style={{ maxWidth: 260 }}>{l.error_message || '—'}</td>
                  <td>
                    {l.status === 'failed' && (
                      <button className="btn btn-primary btn-sm"
                        disabled={sending === l.email_id} onClick={() => resend(l)}>
                        {sending === l.email_id ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <p>{filtersOn ? 'No emails match these filters.' : 'No emails have been sent yet.'}</p>
                  </div>
                </td></tr>
              )}
              {loading && logs.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><p>Loading…</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

        <div className="am-legend">
          "Sent" means the mail provider accepted the email. It can't confirm the inbox, so ask the
          person to check their spam folder too.
        </div>
      </div>
    </>
  );
};

export default EmailLogPage;