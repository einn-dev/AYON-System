import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import './Reports.css';
import { FaBoxArchive, FaChartColumn, FaDownload, FaFileLines, FaHandHoldingDollar, FaTableList } from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, TYPE_LABEL } from '../../utils/terms';

/* ─────────────────────────────────────────────────────────────
   Reports: pick the filters, see the numbers, download the same
   filtered data as a PDF or a CSV (opens in Excel).
   ───────────────────────────────────────────────────────────── */

const REPORT_TYPES = [
  { key: 'proposals',  icon: <FaFileLines />,         label: 'Proposals Report',
    desc: 'Every proposal in the filters: researcher, college, type, status and where it is waiting.', csv: true },
  { key: 'grants',     icon: <FaHandHoldingDollar />, label: 'Grants and Incentives Report',
    desc: 'Grant and incentive applications in the period and college, with their status.', csv: true },
  { key: 'repository', icon: <FaBoxArchive />,        label: 'Research Repository Report',
    desc: 'Research stored in the repository in the period and college.', csv: true },
  { key: 'summary',    icon: <FaChartColumn />,       label: 'Summary Report',
    desc: 'The numbers on this page (status, waiting stages, colleges) on one printable page.', csv: false },
];

const PERIODS = [
  { value: 'all',    label: 'All Time' },
  { value: 'year',   label: 'This Year' },
  { value: '90',     label: 'Last 90 Days' },
  { value: '30',     label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Dates…' },
];

const STATUSES = STATUS_ORDER.map(value => ({ value, label: STATUS_LABEL[value] }));

const TYPES = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

const EMPTY = { period: 'all', from: '', to: '', college: '', status: '', type: '' };

/* only the filters that are set go to the server */
const toParams = (f) => {
  const p = { period: f.period };
  if (f.period === 'custom') { if (f.from) p.from = f.from; if (f.to) p.to = f.to; }
  if (f.college) p.college = f.college;
  if (f.status)  p.status  = f.status;
  if (f.type)    p.type    = f.type;
  return p;
};

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`);

const Bars = ({ rows }) => {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div className="rp-bars">
      {rows.map(r => (
        <div className="rp-bar" key={r.label}>
          <span>{r.label}</span>
          <span className="rp-track"><i style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <b>{r.count}</b>
        </div>
      ))}
    </div>
  );
};

/* a download error comes back as a Blob: read the server's message out of it */
const blobMessage = async (err, fallback) => {
  try {
    const data = err.response?.data;
    if (data instanceof Blob) {
      const json = JSON.parse(await data.text());
      return json.message || fallback;
    }
    return err.response?.data?.message || fallback;
  } catch {
    return fallback;
  }
};

const ReportsPage = () => {
  const [filters,     setFilters]     = useState(EMPTY);
  const [summary,     setSummary]     = useState(null);
  const [colleges,    setColleges]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState('');
  const [history,     setHistory]     = useState([]);
  const [downloading, setDownloading] = useState(null);   // "proposals-pdf"
  const [alert,       setAlert]       = useState(null);

  const set = (key) => (e) => setFilters(prev => ({ ...prev, [key]: e.target.value }));

  const fetchHistory = useCallback(async () => {
    try {
      const res = await API.get('/reports');
      setHistory(res.data.reports || []);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* reload the numbers when a filter changes (a short pause while dates are typed) */
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await API.get('/reports/stats', { params: toParams(filters) });
        if (!alive) return;
        setSummary(res.data);
        setColleges(res.data.colleges || []);
        setLoadError('');
      } catch (err) {
        if (alive) setLoadError(err.response?.data?.message || 'Could not load the report numbers.');
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [filters]);

  const download = async (type, format) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    setAlert(null);
    try {
      const res = await API.get(`/reports/${type}`, {
        params: { ...toParams(filters), format },
        responseType: 'blob',
      });
      const name = (res.headers?.['content-disposition'] || '').match(/filename=([^;]+)/)?.[1]
        || `ayon-${type}-report.${format}`;
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', name.replace(/"/g, ''));
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setAlert({ type: 'success', msg: `${REPORT_TYPES.find(r => r.key === type)?.label} downloaded (${format.toUpperCase()}).` });
      fetchHistory();
    } catch (err) {
      setAlert({ type: 'error', msg: await blobMessage(err, 'Failed to generate the report. Please try again.') });
    } finally {
      setDownloading(null);
    }
  };

  const t = summary?.totals;
  const chips = [
    filters.period === 'custom'
      ? `${filters.from || 'start'} to ${filters.to || 'today'}`
      : PERIODS.find(p => p.value === filters.period)?.label,
    filters.college || 'All Colleges',
    filters.status ? STATUSES.find(s => s.value === filters.status)?.label : 'All Statuses',
    filters.type ? TYPES.find(x => x.value === filters.type)?.label : 'All Types',
  ];
  const isDefault = JSON.stringify(filters) === JSON.stringify(EMPTY);

  return (
    <>
      <div className="page-header">
        <h1>Reports</h1>
        <p>See the numbers for any period, college or status, then download them as PDF or CSV.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`} role="status">{alert.msg}</div>}

      {/* Filters */}
      <div className="rp-filters">
        <div className="rp-f">
          <label htmlFor="rp-period">Period</label>
          <select id="rp-period" value={filters.period} onChange={set('period')}>
            {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        {filters.period === 'custom' && (
          <div className="rp-f">
            <label htmlFor="rp-from">From – To</label>
            <div className="rp-dates">
              <input id="rp-from" type="date" value={filters.from} max={filters.to || undefined} onChange={set('from')} />
              <input aria-label="To" type="date" value={filters.to} min={filters.from || undefined} onChange={set('to')} />
            </div>
          </div>
        )}
        <div className="rp-f">
          <label htmlFor="rp-college">College</label>
          <select id="rp-college" value={filters.college} onChange={set('college')}>
            <option value="">All Colleges</option>
            {colleges.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="rp-f">
          <label htmlFor="rp-status">Status</label>
          <select id="rp-status" value={filters.status} onChange={set('status')}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="rp-f">
          <label htmlFor="rp-type">Proposal type</label>
          <select id="rp-type" value={filters.type} onChange={set('type')}>
            <option value="">All Types</option>
            {TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        </div>
        <button type="button" className="btn btn-outline" disabled={isDefault} onClick={() => setFilters(EMPTY)}>
          Reset
        </button>
      </div>
      <div className="rp-chips">
        {chips.map(c => <span key={c} className="rp-chip">{c}</span>)}
        {loading && <span className="rp-loading">Updating…</span>}
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}

      {/* Totals */}
      <div className="rp-tiles">
        {[
          ['Total Proposals',  t?.total,      'in the filters'],
          ['At the College',   t?.at_college, 'Coordinator, Chair or Dean'],
          ['In Office Review', t?.in_office,  'SA, Director or OVCRED'],
          ['Returned for Revision', t?.returned,   'waiting on the researcher'],
          ['Approved',         t?.approved,   ''],
          ['Approval Rate',    t ? pct(t.approval_rate) : undefined, t ? `${t.decided} decided` : ''],
        ].map(([label, value, sub]) => (
          <div className="rp-tile" key={label}>
            <div className="rp-tile-l">{label}</div>
            <div className="rp-tile-v">{value ?? '—'}</div>
            {sub && <div className="rp-tile-s">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="rp-grid2">
        <div className="panel rp-panel">
          <div className="panel-header"><h2>Proposals by Status</h2><small>within the filters</small></div>
          {summary ? <Bars rows={summary.by_status} /> : <div className="empty-state"><p>Loading…</p></div>}
        </div>
        <div className="panel rp-panel">
          <div className="panel-header"><h2>Where Open Proposals Are Waiting</h2><small>right now</small></div>
          {summary ? <Bars rows={summary.waiting} /> : <div className="empty-state"><p>Loading…</p></div>}
        </div>
      </div>

      <div className="panel rp-panel">
        <div className="panel-header"><h2>Proposals by College</h2><small>approval rate = approved ÷ decided</small></div>
        <div className="rp-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>College</th><th className="rp-n">Total</th><th className="rp-n">At College</th>
                <th className="rp-n">In Office Review</th><th className="rp-n">Approved</th>
                <th className="rp-n">Rejected</th><th className="rp-n">Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_college || []).map(c => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="rp-n">{c.total}</td>
                  <td className="rp-n">{c.at_college}</td>
                  <td className="rp-n">{c.in_office}</td>
                  <td className="rp-n">{c.approved}</td>
                  <td className="rp-n">{c.rejected}</td>
                  <td className="rp-n">{pct(c.approval_rate)}</td>
                </tr>
              ))}
              {summary && summary.by_college.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><p>No proposals match these filters.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Downloads */}
      <div className="rp-cards">
        {REPORT_TYPES.map(r => (
          <div key={r.key} className="rp-card">
            <div className="rp-card-ic">{r.icon}</div>
            <h3>{r.label}</h3>
            <p>{r.desc}</p>
            <div className="rp-card-btns">
              <button className="btn btn-primary btn-sm" disabled={!!downloading}
                onClick={() => download(r.key, 'pdf')}>
                {downloading === `${r.key}-pdf` ? 'Generating…' : <><FaDownload className="ic" />Download PDF</>}
              </button>
              {r.csv && (
                <button className="btn btn-outline btn-sm" disabled={!!downloading}
                  onClick={() => download(r.key, 'csv')}>
                  {downloading === `${r.key}-csv` ? 'Generating…' : <><FaTableList className="ic" />Download CSV</>}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="rp-note">
        Every download uses the filters above, and the PDF lists them at the top.
        The Grants and Repository reports use the period and college only.
      </p>

      {/* History */}
      <div className="panel rp-panel">
        <div className="panel-header"><h2>Recently Generated Reports</h2></div>
        <div className="rp-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Report</th><th>Filters</th><th>Generated By</th><th>Date</th></tr>
            </thead>
            <tbody>
              {history.map(r => (
                <tr key={r.report_id}>
                  <td><strong>{r.report_title}</strong></td>
                  <td className="rp-hist-f">{r.filters?.text || '—'}</td>
                  <td>{r.users ? `${r.users.first_name} ${r.users.last_name}` : '—'}</td>
                  <td style={{ color: '#718096' }}>
                    {r.generated_at ? new Date(r.generated_at).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4}>
                  <div className="empty-state"><p>No reports generated yet.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ReportsPage;