import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminOverview.css';
import { ROLE_LABELS, roleBadge, userStatus, STATUS_META, errText } from './adminShared';
import { FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';
import { STATUS_LABEL, statusBadge, TYPE_LABEL } from '../../utils/terms';
import { StageOverview, stagesOf, HBars, Columns, useTip, TYPE_COLOR, OLD_TYPE_COLOR, OFFERED } from '../../components/ProposalStats';
import '../../components/ProposalStats.css';
import { personName } from '../../utils/names';
import StatCard from '../../components/StatCard';
import WelcomeBanner from '../../components/WelcomeBanner';

const RANGES = [
  { value: 'all',  label: 'All Time'     },
  { value: 'year', label: 'This Year'    },
  { value: '90',   label: 'Last 90 Days' },
  { value: '30',   label: 'Last 30 Days' },
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


/* green when nothing is wrong, otherwise the warning color */
const tone = (value, whenPositive) => {
  if (value === null || value === undefined) return '';
  return value === 0 ? 'green' : whenPositive;
};

/* ─────────── the page ─────────── */
const AdminOverview = ({ users }) => {
  const [range,   setRange]   = useState('all');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [waitMin, setWaitMin] = useState(7);
  const [bind, tipNode] = useTip();

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

  const kpis   = data?.kpis;
  const total  = kpis?.total || 0;

  const stages = useMemo(() => stagesOf(data?.by_status || {}), [data]);
  const monthCols = (data?.months || []).map(m => ({
    key: m.month, label: monthLabel(m.month), long: monthLabel(m.month, true), count: m.count,
  }));

  const collegeRows = useMemo(() => {
    const all  = data?.by_college || [];
    const top  = all.slice(0, 6).map(c => ({ name: shortCollege(c.name), full: c.name, count: c.count }));
    const rest = all.slice(6).reduce((sum, c) => sum + c.count, 0);
    if (rest > 0) top.push({ name: 'Other colleges', count: rest });
    return top;
  }, [data]);

  /* each type in its own color, in a fixed order; an older type only if records still use it */
  const typeRows = useMemo(
    () => Object.entries(TYPE_LABELS)
      .filter(([key]) => OFFERED.includes(key) || (data?.by_type?.[key] || 0) > 0)
      .map(([key, label]) => ({ name: label, color: TYPE_COLOR[key] || OLD_TYPE_COLOR, count: data?.by_type?.[key] || 0 })),
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
      <WelcomeBanner
        text="How research proposals and applications are moving through AYON, and what needs attention."
        aside={(
          <label className="ao-field">
            Period
            <select value={range} onChange={e => setRange(e.target.value)}>
              {RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        )} />

      {error && (
        <div className="alert alert-error">
          {error}{' '}
          <button className="btn btn-outline btn-sm" onClick={load}>Try Again</button>
        </div>
      )}

      <div className={loading && data ? 'ao-loading' : undefined}>
        <StageOverview total={total} stages={stages} bind={bind}
          totalLabel={`submitted, ${(RANGES.find(r => r.value === range) || RANGES[0]).label.toLowerCase()}`}
          extra={(
            <>
              <span className="ps-ov-num small">{kpis && kpis.avg_decision_days !== null ? kpis.avg_decision_days : '—'}</span>
              <span className="ps-ov-label strong">Average days to a decision</span>
              <span className="ps-ov-label">from submission to approved or rejected</span>
            </>
          )} />

        <div className="ps-grid">
          <div className="ps-card">
            <h3>Submissions per Month</h3>
            <div className="ps-card-sub">The last 6 months</div>
            {data ? <Columns cols={monthCols} bind={bind} caption="Submissions per month, last 6 months" />
              : <div className="ps-empty">Loading…</div>}
          </div>
          <div className="ps-card">
            <h3>By Type</h3>
            <div className="ps-card-sub">Research, grants and incentives</div>
            <HBars rows={typeRows} total={total} bind={bind} />
          </div>
        </div>

        <div className="ps-card ps-solo">
          <h3>By College</h3>
          <div className="ps-card-sub">The top 6 colleges, the rest grouped together</div>
          <HBars rows={collegeRows} total={total} bind={bind} color="#1baf7a" />
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
                  <tr><td colSpan={6}><div className="empty-state loading-state" role="status"><p>Loading…</p></div></td></tr>
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

        <div className="stats-grid ao-health">
          <StatCard color={tone(health.failed_emails_7d, 'red')} label="Failed Emails (7 Days)" value={show(health.failed_emails_7d)} to="/admin/emails">
            <span className="ao-h-link">Open Email Log →</span>
          </StatCard>
          <StatCard color={tone(health.failed_logins_7d, 'amber')} label="Failed Logins (7 Days)" value={show(health.failed_logins_7d)} to="/admin/audit">
            <span className="ao-h-link">Open Audit Log →</span>
          </StatCard>
          <StatCard color={tone(health.pending_verification, 'amber')} label="Pending Verification" value={show(health.pending_verification)} to="/admin/users">
            <span className="ao-h-link">Open User Accounts →</span>
          </StatCard>
          <StatCard color={'purple'} label="Active Accounts" value={show(health.active_accounts)} to="/admin/users">
            <span className="ao-h-link">Open User Accounts →</span>
          </StatCard>
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
                    <td><strong>{personName(u)}</strong></td>
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

      {tipNode}
    </>
  );
};

export default AdminOverview;