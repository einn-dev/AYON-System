import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminOverview.css';
import { ROLE_LABELS, roleBadge, userStatus, STATUS_META, errText } from './adminShared';
import { FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, statusBadge, TYPE_LABEL } from '../../utils/terms';

const RANGES = [
  { value: 'all',  label: 'All time'     },
  { value: 'year', label: 'This year'    },
  { value: '90',   label: 'Last 90 days' },
  { value: '30',   label: 'Last 30 days' },
];

const STATUS_LABELS = STATUS_LABEL;
const TYPE_LABELS   = TYPE_LABEL;

const WAIT_OPTIONS = [3, 7, 14, 30];
const SHOWN_IN_LIST = 8;

const shortCollege = (name) => String(name || '').replace(/^College of /, '');

const monthLabel = (key, long) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: long ? 'long' : 'short', year: long ? 'numeric' : undefined, timeZone: 'UTC',
  });
};

const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

/* ── horizontal bars: one row per category ── */
const HBars = ({ rows, total, onTip, onTipEnd }) => {
  if (rows.length === 0 || rows.every(r => r.count === 0)) {
    return <div className="ao-empty">No proposals in this period.</div>;
  }
  const max = Math.max(...rows.map(r => r.count), 1);

  return (
    <ul className="ao-hbars">
      {rows.map(r => (
        <li key={r.name} className="ao-hbar"
          onMouseMove={e => onTip(e, r.full || r.name, `${r.count} proposal${r.count === 1 ? '' : 's'} · ${percent(r.count, total)}% of total`)}
          onMouseLeave={onTipEnd}>
          <span className="ao-hbar-name">{r.name}</span>
          <span className="ao-hbar-track">
            <span className="ao-hbar-bar" style={{ width: `${(r.count / max) * 82}%` }} />
            <span className="ao-hbar-val">{r.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

/* ── columns: one per month ── */
const MonthColumns = ({ months, onTip, onTipEnd }) => {
  const peak = Math.max(...months.map(m => m.count), 1);
  const top  = Math.ceil(peak / 4) * 4 || 4;

  return (
    <>
      <div className="ao-cols">
        {[25, 50, 75].map(p => <div key={p} className="ao-gridline" style={{ bottom: `${p}%` }} />)}
        {months.map(m => (
          <div key={m.month} className="ao-col"
            onMouseMove={e => onTip(e, monthLabel(m.month, true), `${m.count} proposal${m.count === 1 ? '' : 's'} submitted`)}
            onMouseLeave={onTipEnd}>
            <span className="ao-col-cap">{m.count}</span>
            <div className="ao-col-bar" style={{ height: `${(m.count / top) * 90}%` }} />
          </div>
        ))}
      </div>
      <div className="ao-xlabels">
        {months.map(m => <span key={m.month}>{monthLabel(m.month)}</span>)}
      </div>
    </>
  );
};

const healthClass = (value, badWhenPositive) => {
  if (value === null || value === undefined) return '';
  if (value === 0) return 'ok';
  return badWhenPositive;
};

/* ─────────── the page ─────────── */
const AdminOverview = ({ users }) => {
  const [range,   setRange]   = useState('all');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [waitMin, setWaitMin] = useState(7);
  const [tip,     setTip]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/admin/dashboard', { params: { range } });
      setData(res.data);
    } catch (err) {
      setError(errText(err, 'Could not load the dashboard numbers.'));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const showTip = (e, title, text) => setTip({ x: e.clientX, y: e.clientY, title, text });
  const hideTip = () => setTip(null);

  const kpis   = data?.kpis;
  const total  = kpis?.total || 0;

  const statusRows = useMemo(
    () => STATUS_ORDER.map(s => ({ name: STATUS_LABELS[s], count: data?.by_status?.[s] || 0 })),
    [data]
  );

  const collegeRows = useMemo(() => {
    const all  = data?.by_college || [];
    const top  = all.slice(0, 6).map(c => ({ name: shortCollege(c.name), full: c.name, count: c.count }));
    const rest = all.slice(6).reduce((sum, c) => sum + c.count, 0);
    if (rest > 0) top.push({ name: 'Other colleges', count: rest });
    return top;
  }, [data]);

  const typeRows = useMemo(
    () => Object.entries(TYPE_LABELS)
      .map(([key, label]) => ({ name: label, count: data?.by_type?.[key] || 0 }))
      .sort((a, b) => b.count - a.count),
    [data]
  );

  const waiting = useMemo(
    () => (data?.needs_attention || []).filter(p => p.waiting_days >= waitMin),
    [data, waitMin]
  );

  const health = data?.health || {};
  const show   = (v) => (v === null || v === undefined ? '—' : v);

  return (
    <>
      <div className="ao-top">
        <div className="page-header">
          <h1>Administrator Dashboard</h1>
          <p>How research proposals are moving through AYON, and what needs attention.</p>
        </div>
        <label className="ao-field">
          Period
          <select value={range} onChange={e => setRange(e.target.value)}>
            {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}{' '}
          <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
        </div>
      )}

      <div className={loading && data ? 'ao-loading' : undefined}>
        <div className="ao-kpis">
          <div className="ao-tile">
            <div className="ao-tile-label">Total Proposals</div>
            <div className="ao-tile-value">{kpis ? kpis.total : '—'}</div>
            <div className="ao-tile-sub">submitted in this period</div>
          </div>
          <div className="ao-tile">
            <div className="ao-tile-label">In Progress</div>
            <div className="ao-tile-value">{kpis ? kpis.in_progress : '—'}</div>
            <div className="ao-tile-sub">at the college, submitted, under review or endorsed</div>
          </div>
          <div className="ao-tile">
            <div className="ao-tile-label">Approval Rate</div>
            <div className="ao-tile-value">
              {kpis && kpis.approval_rate !== null ? `${kpis.approval_rate}%` : '—'}
            </div>
            <div className="ao-tile-sub">
              {kpis && kpis.decided > 0 ? `${kpis.approved} of ${kpis.decided} decided` : 'no decisions yet'}
            </div>
          </div>
          <div className="ao-tile">
            <div className="ao-tile-label">Average Days to Decision</div>
            <div className="ao-tile-value">
              {kpis && kpis.avg_decision_days !== null ? kpis.avg_decision_days : '—'}
            </div>
            <div className="ao-tile-sub">from submission to approved / rejected</div>
          </div>
        </div>

        <div className="ao-grid">
          <div className="ao-card">
            <h2>Proposals by Status</h2>
            <div className="ao-card-sub">Where every proposal in this period stands right now</div>
            <HBars rows={statusRows} total={total} onTip={showTip} onTipEnd={hideTip} />
          </div>
          <div className="ao-card">
            <h2>Submissions per Month</h2>
            <div className="ao-card-sub">New proposals submitted, last 6 months</div>
            {data
              ? <MonthColumns months={data.months || []} onTip={showTip} onTipEnd={hideTip} />
              : <div className="ao-empty">Loading…</div>}
          </div>
        </div>

        <div className="ao-grid">
          <div className="ao-card">
            <h2>Proposals by College</h2>
            <div className="ao-card-sub">Top 6 colleges, the rest grouped as “Other colleges”</div>
            <HBars rows={collegeRows} total={total} onTip={showTip} onTipEnd={hideTip} />
          </div>
          <div className="ao-card">
            <h2>Proposals by Type</h2>
            <div className="ao-card-sub">The five proposal types</div>
            <HBars rows={typeRows} total={total} onTip={showTip} onTipEnd={hideTip} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Needs Attention</h2>
              <div className="ao-sub">Open proposals that haven't moved for a while — oldest first</div>
            </div>
            <label className="ao-field">
              Waiting longer than
              <select value={waitMin} onChange={e => setWaitMin(Number(e.target.value))}>
                {WAIT_OPTIONS.map(d => <option key={d} value={d}>{d} days</option>)}
              </select>
            </label>
          </div>
          <div className="ao-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Research Title</th>
                  <th>Researcher</th>
                  <th>College</th>
                  <th>Stage</th>
                  <th>Waiting</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {waiting.slice(0, SHOWN_IN_LIST).map(p => (
                  <tr key={p.proposal_id}>
                    <td>
                      <strong>{p.title}</strong>
                      <span className="ao-type">{TYPE_LABELS[p.proposal_type] || p.proposal_type}</span>
                    </td>
                    <td>{p.researcher}</td>
                    <td style={{ color: '#6b5e61' }}>{shortCollege(p.college) || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadge(p.status)}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td>
                      <span className={`ao-wait ${p.waiting_days >= 30 ? 'hot' : p.waiting_days >= 14 ? 'warm' : ''}`}>
                        {p.waiting_days >= 30 ? <FaTriangleExclamation className="ic" /> : ''}{p.waiting_days} day{p.waiting_days === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td>
                      <Link className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}
                        to={`/admin/proposals?open=${p.proposal_id}`}>Open</Link>
                    </td>
                  </tr>
                ))}
                {data && waiting.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty-state"><p><FaCircleCheck className="ic" style={{ color: '#276749' }} />Nothing is waiting longer than {waitMin} days.</p></div>
                  </td></tr>
                )}
                {!data && (
                  <tr><td colSpan={6}><div className="empty-state"><p>Loading…</p></div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="ao-note">
            {waiting.length > SHOWN_IN_LIST && <>Showing the {SHOWN_IN_LIST} longest of {waiting.length}. </>}
            “Waiting” counts from the proposal's last recorded action (submission, endorsement, checklist,
            review or status change). The Administrator can't approve proposals; this list is for spotting a stuck step
            and following up with the person responsible.
          </div>
        </div>

        <div className="ao-health">
          <div className="ao-h">
            <span className="ao-tile-label">Failed Emails (7 Days)</span>
            <span className={`ao-h-value ${healthClass(health.failed_emails_7d, 'bad')}`}>{show(health.failed_emails_7d)}</span>
            <Link to="/admin/emails">Open Email Log →</Link>
          </div>
          <div className="ao-h">
            <span className="ao-tile-label">Failed Logins (7 Days)</span>
            <span className={`ao-h-value ${healthClass(health.failed_logins_7d, 'warn')}`}>{show(health.failed_logins_7d)}</span>
            <Link to="/admin/audit">Open Audit Log →</Link>
          </div>
          <div className="ao-h">
            <span className="ao-tile-label">Pending Verification</span>
            <span className={`ao-h-value ${healthClass(health.pending_verification, 'warn')}`}>{show(health.pending_verification)}</span>
            <Link to="/admin/users">Open User Accounts →</Link>
          </div>
          <div className="ao-h">
            <span className="ao-tile-label">Active Accounts</span>
            <span className="ao-h-value ok">{show(health.active_accounts)}</span>
            <Link to="/admin/users">Open User Accounts →</Link>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Newest Accounts</h2></div>
        <div className="ao-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 5).map(u => {
                const meta = STATUS_META[userStatus(u)];
                return (
                  <tr key={u.user_id}>
                    <td><strong>{u.first_name} {u.last_name}</strong></td>
                    <td style={{ color: '#718096' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${roleBadge(u.role_type)}`}>
                        {ROLE_LABELS[u.role_type] || u.role_type}
                      </span>
                    </td>
                    <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={4}>
                  <div className="empty-state"><p>No users found.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {tip && (
        <div className="ao-tip"
          style={{ left: Math.min(window.innerWidth - 270, tip.x + 14), top: tip.y + 14 }}>
          <b>{tip.title}</b>{tip.text}
        </div>
      )}
    </>
  );
};

export default AdminOverview;