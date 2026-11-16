import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import './AdminCatalog.css';
import { errText, Pager } from './adminShared';
import { fmtDate } from './AdminCatalogShared';
import { STATUS_LABEL, STATUS_ORDER, statusBadge, TYPE_LABEL, GRANT_TYPES as APP_TYPES } from '../../utils/terms';
import { GRANT_FORMS, FORMS_OF_TYPE, awardOf } from '../../utils/grantForms';
import { whereNow } from '../../components/ProposalTracker';

const PAGE_SIZE = 25;

const money = (v) => (v === null || v === undefined || v === ''
  ? '—'
  : `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

/* ─────────── Applications on the MSIRC forms (the current system) ───────────
   They are submissions, so they come from the same list as All Proposals;
   "Open" shows the full details, tracker and Admin tools there. */
const isApp = (p) => APP_TYPES.includes(p.proposal_type) || p.proposal_type === 'travel_oral';
const DONE  = ['approved', 'rejected'];
const yearOf = (d) => (d ? new Date(d).getFullYear() : null);

const Applications = () => {
  const navigate = useNavigate();
  const [apps,    setApps]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type,   setType]   = useState('all');
  const [year,   setYear]   = useState('all');
  const [page,   setPage]   = useState(1);

  useEffect(() => {
    let alive = true;
    API.get('/admin/proposals')
      .then(res => { if (alive) setApps((res.data.proposals || []).filter(isApp)
        .sort((x, y) => String(y.submitted_at || '').localeCompare(String(x.submitted_at || '')))); })   // newest first
      .catch(err => { if (alive) setError(errText(err, 'Could not load the applications.')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const years = useMemo(() => [...new Set(apps.map(a => yearOf(a.submitted_at)).filter(Boolean))].sort((a, b) => b - a), [apps]);
  const typesShown = useMemo(() => [...APP_TYPES, ...(apps.some(a => a.proposal_type === 'travel_oral') ? ['travel_oral'] : [])], [apps]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter(a =>
      (status === 'all' || (status === 'open' ? !DONE.includes(a.status) : a.status === status)) &&
      (type   === 'all' || a.proposal_type === type) &&
      (year   === 'all' || yearOf(a.submitted_at) === Number(year)) &&
      (!q || `${a.researcher} ${a.title} ${a.college || ''}`.toLowerCase().includes(q)));
  }, [apps, search, status, type, year]);
  useEffect(() => { setPage(1); }, [search, status, type, year]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const awarded  = apps.filter(a => a.status === 'approved').reduce((t, a) => t + (awardOf(a).amount || 0), 0);
  const filtersOn = !!(search.trim() || status !== 'all' || type !== 'all' || year !== 'all');
  const formText = (a) => {
    const f = GRANT_FORMS[a.form_no];
    if (!f) return '';
    return (FORMS_OF_TYPE[a.proposal_type] || []).length > 1 ? `Form ${f.no}: ${f.short}` : `Form ${f.no}`;
  };

  return (
    <>
      {error && <div className="alert alert-error" role="alert">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card blue"><span className="stat-label">Total Applications</span><span className="stat-value">{apps.length}</span></div>
        <div className="stat-card amber"><span className="stat-label">In Progress</span><span className="stat-value">{apps.filter(a => !DONE.includes(a.status)).length}</span></div>
        <div className="stat-card green"><span className="stat-label">Approved</span><span className="stat-value">{apps.filter(a => a.status === 'approved').length}</span></div>
        <div className="stat-card red"><span className="stat-label">Rejected</span><span className="stat-value">{apps.filter(a => a.status === 'rejected').length}</span></div>
        <div className="stat-card purple"><span className="stat-label">Incentives Approved</span><span className="stat-value" style={{ fontSize: '1.35rem' }}>{money(awarded)}</span></div>
      </div>

      <div className="panel">
        <div className="panel-header"><strong style={{ color: '#5e1420' }}>Applications by Type</strong></div>
        <div className="ac-bars">
          {typesShown.map(k => {
            const c = apps.filter(a => a.proposal_type === k).length;
            return (
              <div className="ac-bar" key={k}>
                <span>{TYPE_LABEL[k] || k}</span>
                <span className="ac-bar-track"><span className="ac-bar-fill" style={{ width: `${apps.length ? (c / apps.length) * 100 : 0}%` }} /></span>
                <b>{c}</b>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search title, researcher or college..." aria-label="Search applications"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="search-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
              <option value="all">All Types</option>
              {typesShown.map(k => <option key={k} value={k}>{TYPE_LABEL[k] || k}</option>)}
            </select>
            <select className="search-input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All Statuses</option>
              <option value="open">In Progress (any)</option>
              {STATUS_ORDER.filter(k => k !== 'draft').map(k => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
            </select>
            <select className="search-input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
              <option value="all">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {filtersOn && (
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { setSearch(''); setStatus('all'); setType('all'); setYear('all'); }}>Clear Filters</button>
            )}
          </div>
          <span className="badge badge-blue">{filtered.length} shown</span>
        </div>

        <div className="am-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Title</th><th>Researcher</th><th>Type and Form</th><th>Status</th><th>Amount</th><th>Submitted</th><th>Action</th></tr>
            </thead>
            <tbody>
              {pageRows.map(a => {
                const award = awardOf(a);
                return (
                  <tr key={a.proposal_id}>
                    <td style={{ maxWidth: 260 }}>
                      <div className="ac-title">{a.title}</div>
                      {a.spotlight_title && <span className="ac-sub">For Research Spotlight: {a.spotlight_title}</span>}
                    </td>
                    <td>
                      <div>{a.researcher}</div>
                      <span className="ac-sub">{a.college || '—'}</span>
                    </td>
                    <td className="am-muted">
                      {TYPE_LABEL[a.proposal_type] || a.proposal_type}
                      {formText(a) && <div className="ac-sub">{formText(a)}</div>}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(a.status)}`}>{STATUS_LABEL[a.status] || a.status}</span>
                      {!DONE.includes(a.status) && <div className="ac-sub">{whereNow(a)}</div>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {award.amount !== null ? money(award.amount) : <span className="am-muted">{award.recommendation || '—'}</span>}
                    </td>
                    <td className="am-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.submitted_at)}</td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm"
                        onClick={() => navigate(`/admin/proposals?open=${a.proposal_id}`)}>Open</button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <p>{apps.length === 0 ? 'No grant or incentive applications yet.' : 'No applications match your filters.'}</p>
                  </div>
                </td></tr>
              )}
              {loading && (
                <tr><td colSpan={7}><div className="empty-state"><p>Loading applications...</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        <div className="am-legend">
          Amount is the incentive the Special Assistant entered, or the financial assistance the Director entered (Form 008).
          Open shows the whole form, documents, tracker and the Administrator's tools.
        </div>
      </div>
    </>
  );
};

/* ─────────── The page ─────────── */
const AdminGrantsPage = () => (
  <>
    <div className="page-header">
      <h1>Grants and Incentives</h1>
      <p>Travel Subsidy, Oral Presentation and Publication Incentive applications, on their MSIRC forms.</p>
    </div>
    <Applications />
  </>
);

export default AdminGrantsPage;