import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import { ROLE_LABELS, errText, fmtWhen, startOfDay, Pager } from './adminShared';

const PAGE_SIZE = 25;

/* What each kind of action is called, and the badge color it gets */
const ACTIONS = {
  user_created:       { label: 'User created',        badge: 'badge-blue'   },
  user_updated:       { label: 'User edited',         badge: 'badge-gray'   },
  role_changed:       { label: 'Role changed',        badge: 'badge-purple' },
  user_activated:     { label: 'Account activated',   badge: 'badge-green'  },
  user_deactivated:   { label: 'Account deactivated', badge: 'badge-red'    },
  password_reset:     { label: 'Password reset',      badge: 'badge-gray'   },
  password_changed:   { label: 'Password changed',    badge: 'badge-gray'   },
  password_reset_requested: { label: 'Reset link requested', badge: 'badge-amber' },
  password_reset_completed: { label: 'Password reset by link', badge: 'badge-green' },
  email_verified:     { label: 'Email verified',      badge: 'badge-green'  },
  verification_resent:{ label: 'Verification resent', badge: 'badge-amber'  },
  email_resent:       { label: 'Email resent',        badge: 'badge-amber'  },
  repository_created: { label: 'Repository added',    badge: 'badge-amber'  },
  repository_updated: { label: 'Repository edited',   badge: 'badge-amber'  },
  login_success:      { label: 'Login',               badge: 'badge-green'  },
  login_failed:       { label: 'Login failed',        badge: 'badge-red'    },
};

const FIELD_LABELS = {
  first_name: 'First name', last_name: 'Last name', email: 'Email',
  college: 'College', department: 'Department',
};

const LOGIN_REASONS = {
  wrong_password:      'Wrong password',
  unknown_email:       'Email not registered',
  account_deactivated: 'Account is deactivated',
  email_not_verified:  'Email not verified yet',
};

const roleName = (r) => ROLE_LABELS[r] || r || '—';
const show     = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

/* The "details" of one entry as plain text (used in the table and the CSV file) */
const detailsText = (log) => {
  const d = log.details || {};
  switch (log.action) {
    case 'role_changed':
      return `${roleName(d.from)} → ${roleName(d.to)}`;
    case 'user_updated':
      return Object.entries(d.changes || {})
        .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${show(v.from)} → ${show(v.to)}`)
        .join('; ');
    case 'user_created':
      return `Role: ${roleName(d.role)}${d.email ? ` · ${d.email}` : ''}`;
    case 'user_deactivated':
      return d.reason ? `Reason: ${d.reason}` : '';
    case 'password_reset':
      return 'Temporary password created; must be changed at next sign-in';
    case 'password_changed':
      return d.forced ? 'Required change after an Admin reset' : 'Changed by the account owner';
    case 'password_reset_requested':
      return 'Asked for a reset link ("Forgot password")';
    case 'password_reset_completed':
      return 'Chose a new password through the emailed link';
    case 'email_verified':
      return d.by === 'admin' ? 'Marked as verified by an Admin' : '';
    case 'verification_resent':
    case 'email_resent':
      return d.sent === false ? 'Could not be sent' : 'Sent';
    case 'repository_created':
      return `Access: ${show(d.access_type)} · ${show(d.source_type)}`;
    case 'repository_updated':
      return d.access_type ? `Access: ${show(d.access_type.from)} → ${show(d.access_type.to)}` : '';
    case 'login_failed':
      return LOGIN_REASONS[d.reason] || 'Failed attempt';
    default:
      return '';
  }
};

/* A spreadsheet can run text that starts with = + - @ as a formula, so those get a leading ' */
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const AuditLogPage = () => {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [stats,   setStats]   = useState({ today: 0, role_changes_7d: 0, failed_logins_7d: 0 });
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [search,     setSearch]     = useState('');
  const [searchTerm, setSearchTerm] = useState('');   // the search box, after a short pause
  const [action,     setAction]     = useState('');
  const [date,       setDate]       = useState('');
  const [exporting,  setExporting]  = useState(false);

  // wait until the person stops typing before asking the server
  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildParams = useCallback(() => {
    const params = { today_from: startOfDay().toISOString() };
    if (action)     params.action = action;
    if (searchTerm) params.q      = searchTerm;
    if (date) {
      // the picked day, from midnight to midnight in the admin's own time zone
      const [y, m, d] = date.split('-').map(Number);
      const from = new Date(y, m - 1, d, 0, 0, 0, 0);
      const to   = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
      params.from = from.toISOString();
      params.to   = to.toISOString();
    }
    return params;
  }, [action, searchTerm, date]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/admin/audit-logs', {
        params: { ...buildParams(), page, page_size: PAGE_SIZE },
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      if (res.data.stats) setStats(res.data.stats);
    } catch (err) {
      setError(errText(err, 'Could not load the audit log.'));
    } finally {
      setLoading(false);
    }
  }, [buildParams, page]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    setError('');
    try {
      const res  = await API.get('/admin/audit-logs', { params: { ...buildParams(), export: 1 } });
      const rows = res.data.logs || [];
      const head = ['When', 'Who', 'Who (role)', 'Action', 'Target', 'Details', 'IP address'];
      const body = rows.map(l => [
        new Date(l.created_at).toLocaleString('en-US'),
        l.actor_name || '',
        l.actor_role ? roleName(l.actor_role) : '',
        (ACTIONS[l.action] || {}).label || l.action,
        l.target_name || '',
        detailsText(l),
        l.ip_address || '',
      ]);
      const csv  = [head, ...body].map(r => r.map(csvCell).join(',')).join('\r\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `ayon-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(errText(err, 'Could not export the audit log.'));
    } finally {
      setExporting(false);
    }
  };

  const filtersOn = !!(action || searchTerm || date);

  return (
    <>
      <div className="page-header">
        <h1>Audit Log</h1>
        <p>A permanent record of who did what, and when. Entries can't be edited or deleted from the app.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">Events today</span>
          <span className="stat-value">{stats.today}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Role changes (7 days)</span>
          <span className="stat-value">{stats.role_changes_7d}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Failed logins (7 days)</span>
          <span className="stat-value">{stats.failed_logins_7d}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search by person..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 170 }}
              value={action} onChange={e => { setAction(e.target.value); setPage(1); }}>
              <option value="">All actions</option>
              {Object.entries(ACTIONS).map(([key, a]) => (
                <option key={key} value={key}>{a.label}</option>
              ))}
            </select>
            <input className="search-input" type="date" style={{ minWidth: 150 }}
              value={date} onChange={e => { setDate(e.target.value); setPage(1); }} />
            {filtersOn && (
              <button className="btn btn-outline btn-sm" onClick={() => {
                setSearch(''); setSearchTerm(''); setAction(''); setDate(''); setPage(1);
              }}>Clear filters</button>
            )}
          </div>
          <div className="am-actions">
            <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>Refresh</button>
            <button className="btn btn-outline btn-sm" onClick={exportCsv} disabled={exporting || total === 0}>
              {exporting ? 'Preparing…' : 'Export CSV'}
            </button>
          </div>
        </div>

        <div className="am-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                const meta = ACTIONS[l.action] || { label: l.action, badge: 'badge-gray' };
                const d    = l.details || {};
                return (
                  <tr key={l.audit_id}>
                    <td className="am-muted" style={{ whiteSpace: 'nowrap' }}
                      title={new Date(l.created_at).toLocaleString('en-US')}>
                      {fmtWhen(l.created_at)}
                    </td>
                    <td>
                      {l.actor_name || '—'}
                      {l.actor_role && <span className="am-sub">{roleName(l.actor_role)}</span>}
                    </td>
                    <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                    <td>{l.target_name || '—'}</td>
                    <td className="am-chg">
                      {l.action === 'role_changed'
                        ? <><s>{roleName(d.from)}</s> → <b>{roleName(d.to)}</b></>
                        : (detailsText(l) || '—')}
                      {(l.action === 'login_failed' || l.action === 'login_success') && l.ip_address && (
                        <span className="am-sub am-ip">IP {l.ip_address}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <p>{filtersOn ? 'No entries match these filters.' : 'Nothing has been recorded yet.'}</p>
                  </div>
                </td></tr>
              )}
              {loading && logs.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><p>Loading…</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

        <div className="am-legend">
          Recorded: user created · user edited · role changed · activated / deactivated · password reset ·
          email verified / resent · repository changes · logins (successful and failed)
        </div>
      </div>
    </>
  );
};

export default AuditLogPage;