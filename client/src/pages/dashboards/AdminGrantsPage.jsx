import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import './AdminCatalog.css';
import { errText, Pager, ROLE_LABELS, fmtWhen } from './adminShared';
import { ConfirmBox, cap, fmtDate } from './AdminCatalogShared';

const PAGE_SIZE = 25;

const GRANT_TYPES = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded Research',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel Subsidy / Oral Presentation',
};

const STATUS_BADGE = { pending: 'badge-amber', approved: 'badge-green', rejected: 'badge-red' };

const money = (v) => (v === null || v === undefined || v === ''
  ? '—'
  : `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/* What the researcher filled in, as label / value pairs, for each kind of grant */
const detailRows = (type, d) => {
  if (!d) return [];
  const t = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
  switch (type) {
    case 'internally_funded':
      return [['Funding amount', money(d.funding_amount)], ['Funding source', t(d.funding_source)],
              ['Start date', fmtDate(d.start_date)], ['End date', fmtDate(d.end_date)]];
    case 'publication_incentive':
      return [['Journal', t(d.journal_name)], ['Volume / issue', t(d.volume_issue)],
              ['Publication date', fmtDate(d.publication_date)], ['Index', t(d.index_type)]];
    case 'travel_oral':
      return [['Event', t(d.event_name)], ['Location', t(d.location)],
              ['Event date', fmtDate(d.event_date)], ['Conference type', cap(t(d.conference_type))]];
    case 'research_spotlight':
      return [['Spotlight title', t(d.spotlight_title)], ['Description', t(d.spotlight_description)],
              ['Spotlight date', fmtDate(d.spotlight_date)]];
    default:
      return [];
  }
};

const historyLine = (h) => {
  const who  = [h.actor_name, h.actor_role && `(${ROLE_LABELS[h.actor_role] || h.actor_role})`].filter(Boolean).join(' ') || 'Someone';
  const d    = h.details || {};
  const what = d.to === 'pending' ? 'reopened it' : (d.to ? `${d.to} it` : 'changed it');
  return `${fmtWhen(h.created_at)}: ${who} ${what}${d.reason ? `. Reason: ${d.reason}` : ''}`;
};

/* ─────────── Details pop-up ─────────── */
const GrantModal = ({ grantId, onDecide, onClose }) => {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    API.get(`/admin/grants/${grantId}`)
      .then(res => { if (alive) setData(res.data); })
      .catch(err => { if (alive) setError(errText(err, 'Could not load this application.')); });
    return () => { alive = false; };
  }, [grantId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const g    = data?.grant;
  const rows = g ? detailRows(g.grant_type, data.details) : [];

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ac-wide" role="dialog" aria-modal="true" aria-label="Grant application"
        onClick={(e) => e.stopPropagation()}>
        <h3>{g ? GRANT_TYPES[g.grant_type] || g.grant_type : 'Grant application'}</h3>
        <p className="am-modal-sub">Application #{grantId}</p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {!g && !error && <div className="empty-state"><p>Loading...</p></div>}

        {g && (
          <>
            <dl className="ac-dl">
              <dt>Researcher</dt><dd>{[g.first_name, g.last_name].filter(Boolean).join(' ') || '—'}{g.college ? ` · ${g.college}` : ''}</dd>
              <dt>Research Title</dt><dd>{g.proposal_title || '—'}</dd>
              <dt>Date Applied</dt><dd>{fmtDate(g.date_applied)}</dd>
              <dt>Status</dt><dd><span className={`badge ${STATUS_BADGE[g.status] || 'badge-gray'}`}>{cap(g.status)}</span></dd>
            </dl>

            <div className="ac-box">
              <h4>Application Details</h4>
              {rows.length
                ? <dl className="ac-dl">{rows.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>))}</dl>
                : <span className="am-muted">No extra details were saved with this application.</span>}
            </div>

            <div className="ac-box">
              <h4>History</h4>
              <ul className="ac-hist">
                <li>{fmtWhen(g.date_applied)}: the researcher applied</li>
                {(data.history || []).map(h => <li key={h.audit_id}>{historyLine(h)}</li>)}
              </ul>
            </div>
          </>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
          {g && (g.status === 'pending' ? (
            <div className="ac-modal-actions">
              <button type="button" className="btn btn-success" onClick={() => onDecide(g, 'approved')}>Approve</button>
              <button type="button" className="btn btn-danger"  onClick={() => onDecide(g, 'rejected')}>Reject</button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => onDecide(g, 'pending')}>Reopen</button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ─────────── The page ─────────── */
const AdminGrantsPage = () => {
  const [grants,  setGrants]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [message, setMessage] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type,   setType]   = useState('all');
  const [page,   setPage]   = useState(1);

  const [openId,  setOpenId]  = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await API.get('/admin/grants');
      setGrants(res.data.grants || []);
    } catch (err) {
      setError(errText(err, 'Could not load the grant applications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grants.filter(g =>
      (status === 'all' || g.status === status) &&
      (type   === 'all' || g.grant_type === type) &&
      (!q || `${g.first_name || ''} ${g.last_name || ''} ${g.proposal_title || ''}`.toLowerCase().includes(q)));
  }, [grants, search, status, type]);

  useEffect(() => { setPage(1); }, [search, status, type]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const n = (k) => grants.filter(g => g.status === k).length;

  const decide = (g, to) => {
    setOpenId(null);
    const verb = { approved: 'Approve', rejected: 'Reject', pending: 'Reopen' }[to];
    const text = {
      approved: 'The researcher will be told it was approved.',
      rejected: 'The researcher will be told it was rejected, with your reason.',
      pending:  'The application goes back to the MSIRC Director and OVCRED list as pending. The researcher is not notified.',
    }[to];
    setConfirm({
      title: `${verb} this application?`,
      text: `${GRANT_TYPES[g.grant_type] || g.grant_type} for "${g.proposal_title}". ${text}`,
      reason: true,
      confirmLabel: verb,
      danger: to === 'rejected',
      run: async (reason) => {
        const res = await API.post(`/admin/grants/${g.grant_id}/decision`, { status: to, reason });
        setConfirm(null);
        setMessage(res.data.message);
        await load();
      },
    });
  };

  const filtersOn = !!(search.trim() || status !== 'all' || type !== 'all');

  return (
    <>
      <div className="page-header">
        <h1>Grants and Incentives</h1>
        <p>All grant and incentive applications, with the details the researcher filled in. The Administrator can step in when the MSIRC Director or OVCRED is unavailable.</p>
      </div>

      {error   && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}

      <div className="stats-grid">
        <div className="stat-card blue"><span className="stat-label">Total Applications</span><span className="stat-value">{grants.length}</span></div>
        <div className="stat-card amber"><span className="stat-label">Pending</span><span className="stat-value">{n('pending')}</span></div>
        <div className="stat-card green"><span className="stat-label">Approved</span><span className="stat-value">{n('approved')}</span></div>
        <div className="stat-card red"><span className="stat-label">Rejected</span><span className="stat-value">{n('rejected')}</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><strong style={{ color: '#5e1420' }}>Applications by Type</strong></div>
        <div className="ac-bars">
          {Object.entries(GRANT_TYPES).map(([k, label]) => {
            const c = grants.filter(g => g.grant_type === k).length;
            return (
              <div className="ac-bar" key={k}>
                <span>{label}</span>
                <span className="ac-bar-track"><span className="ac-bar-fill" style={{ width: `${grants.length ? (c / grants.length) * 100 : 0}%` }} /></span>
                <b>{c}</b>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search researcher or proposal..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="search-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="search-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Grant type">
              <option value="all">All Grant Types</option>
              {Object.entries(GRANT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {filtersOn && (
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { setSearch(''); setStatus('all'); setType('all'); }}>Clear Filters</button>
            )}
          </div>
          <span className="badge badge-blue">{filtered.length} shown</span>
        </div>

        <div className="am-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Researcher</th><th>Research Title</th><th>Grant Type</th><th>Date Applied</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pageRows.map(g => (
                <tr key={g.grant_id}>
                  <td>
                    <div className="ac-title">{[g.first_name, g.last_name].filter(Boolean).join(' ') || '—'}</div>
                    <span className="ac-sub">{g.college || '—'}</span>
                  </td>
                  <td style={{ maxWidth: 260 }}>{g.proposal_title || '—'}</td>
                  <td className="am-muted">{GRANT_TYPES[g.grant_type] || g.grant_type}</td>
                  <td className="am-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(g.date_applied)}</td>
                  <td><span className={`badge ${STATUS_BADGE[g.status] || 'badge-gray'}`}>{cap(g.status)}</span></td>
                  <td>
                    <div className="am-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenId(g.grant_id)}>View Details</button>
                      {g.status === 'pending' ? (
                        <>
                          <button type="button" className="btn btn-success btn-sm" onClick={() => decide(g, 'approved')}>Approve</button>
                          <button type="button" className="btn btn-danger btn-sm"  onClick={() => decide(g, 'rejected')}>Reject</button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => decide(g, 'pending')}>Reopen</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <p>{grants.length === 0 ? 'No grant applications yet.' : 'No applications match your filters.'}</p>
                  </div>
                </td></tr>
              )}
              {loading && (
                <tr><td colSpan={6}><div className="empty-state"><p>Loading grant applications...</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />

        <div className="am-legend">
          Every decision made here is written to the Audit Log with your name and the reason you typed.
        </div>
      </div>

      {openId && <GrantModal grantId={openId} onDecide={decide} onClose={() => setOpenId(null)} />}
      {confirm && <ConfirmBox {...confirm} onClose={() => setConfirm(null)} onConfirm={confirm.run} />}
    </>
  );
};

export default AdminGrantsPage;