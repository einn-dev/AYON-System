import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import './Reports.css';
import {
  FaBoxArchive, FaChartColumn, FaDownload, FaFileLines, FaHandHoldingDollar, FaTableList,
  FaRotateLeft, FaFilePdf, FaFileCsv, FaUserPen,
} from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, TYPE_LABEL } from '../../utils/terms';
import { personName } from '../../utils/names';
import { HBars, Columns, Ring, useTip, TYPE_COLOR, OLD_TYPE_COLOR } from '../../components/ProposalStats';

/* ─────────────────────────────────────────────────────────────
   Reports: pick the filters, see the numbers, download the same
   filtered data as a PDF or a CSV (opens in Excel).
     - the colored cards double as a quick Status filter
     - "Who has them now" follows the endorsement path step by step
     - by type and over time use the same colors as the dashboards
   ───────────────────────────────────────────────────────────── */

const REPORT_TYPES = [
  { key: 'proposals',  icon: <FaFileLines />,         color: 'blue',   label: 'Proposals',
    desc: 'Every proposal: researcher, college, type, status and who has it now.', csv: true },
  { key: 'grants',     icon: <FaHandHoldingDollar />, color: 'teal',   label: 'Grants and Incentives',
    desc: 'Travel, oral presentation and publication applications with their amounts.', csv: true },
  { key: 'repository', icon: <FaBoxArchive />,        color: 'purple', label: 'Research Repository',
    desc: 'Research stored in the repository.', csv: true },
  { key: 'summary',    icon: <FaChartColumn />,       color: 'maroon', label: 'Summary',
    desc: 'The numbers on this page on one printable page.', csv: false },
];

const PERIODS = [
  { value: 'all',    label: 'All Time' },
  { value: 'year',   label: 'This Year' },
  { value: '90',     label: 'Last 90 Days' },
  { value: '30',     label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Dates…' },
];

const STATUSES = STATUS_ORDER.map(value => ({ value, label: STATUS_LABEL[value] }));

/* the old combined type is not offered: add_grant_types.sql converts those records */
const TYPES = Object.entries(TYPE_LABEL).filter(([value]) => value !== 'travel_oral').map(([value, label]) => ({ value, label }));

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
const plural = (n, w = 'proposal') => `${n} ${w}${n === 1 ? '' : 's'}`;

/* stage colors (same as the dashboards) */
const STAGE = {
  college:  '#2a78d6',
  msirc:    '#6250d6',
  returned: '#eda100',
  approved: '#0ca30c',
  rejected: '#d03b3b',
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

/* a number card; with "status" it also works as the Status filter */
const FilterCard = ({ label, value, sub, color, status, active, onPick }) => {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? '—'}</span>
      {sub && <span className="rp-card-sub">{sub}</span>}
    </>
  );
  if (status === undefined) return <div className={`stat-card ${color}`}>{body}</div>;
  return (
    <button type="button" className={`stat-card stat-link rp-fcard ${color}${active ? ' on' : ''}`}
      aria-pressed={active} onClick={() => onPick(active ? '' : status)}
      title={active ? 'Click to show all statuses' : `Show only: ${label}`}>
      {body}
    </button>
  );
};

/* the endorsement path, step by step, with how many are waiting at each step */
const Path = ({ waiting, bind }) => {
  if (!waiting?.length) return null;
  const shortName = (l) => l.replace(/^College /, '').replace(/^MSIRC /, '');
  const college  = waiting.slice(0, -4);
  const msirc    = waiting.slice(-4, -1);
  const returned = waiting[waiting.length - 1];
  const Group = ({ title, steps, color }) => (
    <div className="rp-path-group">
      <h4 style={{ color }}>{title}</h4>
      <ol className="rp-path">
        {steps.map(s => (
          <li key={s.label} className={s.count ? 'has' : ''} style={{ '--pc': color }} tabIndex={0}
            aria-label={`${s.label}: ${s.count ? `${plural(s.count)} waiting` : 'nothing waiting'}`}
            {...bind(s.label, s.count ? `${plural(s.count)} waiting here` : 'nothing waiting here')}>
            <span className="rp-node">{s.count}</span>
            <span className="rp-node-l">{shortName(s.label)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="rp-path-wrap">
      <Group title="At the college" steps={college} color={STAGE.college} />
      <Group title="At MSIRC" steps={msirc} color={STAGE.msirc} />
      <div className={`rp-back${returned.count ? ' has' : ''}`} tabIndex={0}
        aria-label={`Returned for revision: ${plural(returned.count)} back with the researcher`}
        {...bind('Returned for revision', returned.count ? `${plural(returned.count)} back with the researcher` : 'none')}>
        <FaUserPen aria-hidden="true" />
        <div><b>{returned.count}</b><span>back with the researcher</span></div>
      </div>
    </div>
  );
};

/* the stage split of one college as a thin bar */
const MiniStack = ({ c, bind }) => {
  const parts = [
    ['At the college', c.at_college, STAGE.college],
    ['At MSIRC', c.in_office, STAGE.msirc],
    ['Returned', c.returned, STAGE.returned],
    ['Approved', c.approved, STAGE.approved],
    ['Rejected', c.rejected, STAGE.rejected],
  ].filter(p => p[1] > 0);
  return (
    <div className="rp-mini" role="img" aria-label={parts.map(p => `${p[0]} ${p[1]}`).join(', ')}>
      {parts.map(([l, n, col]) => (
        <span key={l} style={{ flexGrow: n, background: col }} {...bind(`${c.name}`, `${l}: ${n}`)} />
      ))}
    </div>
  );
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
  const [bind, tipNode] = useTip();

  const set = (key) => (e) => setFilters(prev => ({ ...prev, [key]: e.target.value }));
  const pickStatus = (status) => setFilters(prev => ({ ...prev, status }));

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
      setAlert({ type: 'success', msg: `${REPORT_TYPES.find(r => r.key === type)?.label} report downloaded (${format.toUpperCase()}).` });
      fetchHistory();
    } catch (err) {
      setAlert({ type: 'error', msg: await blobMessage(err, 'Failed to generate the report. Please try again.') });
    } finally {
      setDownloading(null);
    }
  };

  const t = summary?.totals;
  const isDefault = JSON.stringify(filters) === JSON.stringify(EMPTY);
  const typeRows = (summary?.by_type || []).map(x => ({ name: x.label, count: x.count, color: TYPE_COLOR[x.type] || OLD_TYPE_COLOR }));
  const timeline = summary?.timeline || { unit: 'month', points: [] };
  /* many months: label every other month (January always, with its year) so the labels fit */
  const dense = timeline.points.length > 12;
  const cols = timeline.points.map((p, i, all) => {
    if (timeline.unit !== 'month') return p;
    const isJan = p.label === 'Jan';
    const show = !dense || isJan || (i % 2 === (all.length - 1) % 2);
    return { ...p, label: !show ? '' : isJan && i > 0 ? `’${String(p.year).slice(2)}` : p.label };
  });
  const yearsInTimeline = [...new Set(timeline.points.map(p => p.year))];

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
        <div className="rp-f-end">
          {loading && <span className="rp-loading" role="status"><i aria-hidden="true" />Updating…</span>}
          <button type="button" className="btn btn-outline" disabled={isDefault} onClick={() => setFilters(EMPTY)}>
            <FaRotateLeft className="ic" />Reset
          </button>
        </div>
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}

      {/* Totals: click a card to filter by that status */}
      <div className="rp-cardrow">
        <FilterCard label="Total" value={t?.total} sub="in the filters" color="" />
        <FilterCard label="At the College" value={t?.at_college} sub="Chairperson, Coordinator, Dean" color="blue"
          status="for_endorsement" active={filters.status === 'for_endorsement'} onPick={pickStatus} />
        <FilterCard label="At MSIRC" value={t?.in_office} sub="Special Assistant, Director, VCRED" color="purple" />
        <FilterCard label="Returned" value={t?.returned} sub="waiting on the researcher" color="amber"
          status="returned" active={filters.status === 'returned'} onPick={pickStatus} />
        <FilterCard label="Approved" value={t?.approved} color="green"
          status="approved" active={filters.status === 'approved'} onPick={pickStatus} />
        <FilterCard label="Rejected" value={t?.rejected} color="red"
          status="rejected" active={filters.status === 'rejected'} onPick={pickStatus} />
      </div>
      <p className="rp-hint">Tip: click a card to show only that status. Click it again to show all.</p>

      {/* Who has them now + approval rate */}
      <div className="rp-row rp-row-path">
        <div className="panel rp-panel">
          <div className="panel-header"><h2>Who Has Them Now</h2><small>open proposals, by step</small></div>
          {summary ? <Path waiting={summary.waiting} bind={bind} /> : <div className="empty-state"><p>Loading…</p></div>}
        </div>
        <div className="panel rp-panel rp-rate">
          <div className="panel-header"><h2>Approval Rate</h2><small>approved ÷ decided</small></div>
          <div className="rp-rate-body">
            <Ring value={t?.approval_rate || 0} label={t?.decided ? `${t.approval_rate}% approved` : 'none'} />
            <ul className="rp-rate-list">
              <li><i style={{ background: STAGE.approved }} />Approved <b>{t?.approved ?? '—'}</b></li>
              <li><i style={{ background: STAGE.rejected }} />Rejected <b>{t?.rejected ?? '—'}</b></li>
              <li className="rp-rate-total">Decided <b>{t?.decided ?? '—'}</b></li>
            </ul>
          </div>
        </div>
      </div>

      {/* By type + over time */}
      <div className="rp-row">
        <div className="panel rp-panel">
          <div className="panel-header"><h2>By Type</h2><small>{t ? plural(t.total, 'submission') : ''}</small></div>
          <div className="rp-pad">
            {summary ? <HBars rows={typeRows} total={t?.total} bind={bind} /> : <div className="empty-state"><p>Loading…</p></div>}
          </div>
        </div>
        <div className="panel rp-panel">
          <div className="panel-header">
            <h2>Submissions Over Time</h2>
            <small>{timeline.unit === 'year' ? 'per year' : `per month${yearsInTimeline.length ? `, ${yearsInTimeline.join('–')}` : ''}`}</small>
          </div>
          <div className="rp-pad">
            {cols.length
              ? <Columns cols={cols} bind={bind} caption={`Submissions per ${timeline.unit}`} />
              : <div className="ps-empty">Nothing submitted in this period.</div>}
          </div>
        </div>
      </div>

      {/* By college */}
      <div className="panel rp-panel">
        <div className="panel-header"><h2>By College</h2><small>approval rate = approved ÷ decided</small></div>
        <div className="rp-scroll">
          <table className="data-table rp-college">
            <thead>
              <tr>
                <th>College</th><th className="rp-n">Total</th><th className="rp-stack-h">Where they stand</th>
                <th className="rp-n">Approved</th><th className="rp-n">Rejected</th><th className="rp-n">Approval Rate</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.by_college || []).map(c => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className="rp-n"><b>{c.total}</b></td>
                  <td><MiniStack c={c} bind={bind} /></td>
                  <td className="rp-n">{c.approved}</td>
                  <td className="rp-n">{c.rejected}</td>
                  <td className="rp-n"><span className="rp-rate-pill">{pct(c.approval_rate)}</span></td>
                </tr>
              ))}
              {summary && summary.by_college.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><p>No proposals match these filters.</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <ul className="ps-legend rp-legend">
          {[['At the college', STAGE.college], ['At MSIRC', STAGE.msirc], ['Returned', STAGE.returned], ['Approved', STAGE.approved], ['Rejected', STAGE.rejected]]
            .map(([l, col]) => <li key={l}><i style={{ background: col }} aria-hidden="true" /><span>{l}</span></li>)}
        </ul>
      </div>

      {/* Downloads */}
      <div className="rp-section-h">
        <h2>Download a Report</h2>
        <span>Every download uses the filters above. Grants and Repository use the period and college only.</span>
      </div>
      <div className="rp-dl">
        {REPORT_TYPES.map(r => (
          <div key={r.key} className={`rp-dl-card ${r.color}`}>
            <div className="rp-dl-top">
              <span className="rp-dl-ic" aria-hidden="true">{r.icon}</span>
              <h3>{r.label}</h3>
            </div>
            <p>{r.desc}</p>
            <div className="rp-dl-btns">
              <button className="btn btn-primary btn-sm" disabled={!!downloading}
                onClick={() => download(r.key, 'pdf')}>
                {downloading === `${r.key}-pdf` ? 'Generating…' : <><FaDownload className="ic" />PDF</>}
              </button>
              {r.csv && (
                <button className="btn btn-outline btn-sm" disabled={!!downloading}
                  onClick={() => download(r.key, 'csv')}>
                  {downloading === `${r.key}-csv` ? 'Generating…' : <><FaTableList className="ic" />CSV</>}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* History */}
      <div className="panel rp-panel">
        <div className="panel-header"><h2>Recently Generated</h2><small>{history.length ? `last ${history.length}` : ''}</small></div>
        {history.length === 0 ? (
          <div className="empty-state"><p>No reports generated yet.</p></div>
        ) : (
          <ul className="rp-hist">
            {history.map(r => {
              const csv = /csv/i.test(r.report_title || '') || r.filters?.format === 'csv';
              return (
                <li key={r.report_id}>
                  <span className={`rp-hist-ic ${csv ? 'csv' : 'pdf'}`} aria-hidden="true">{csv ? <FaFileCsv /> : <FaFilePdf />}</span>
                  <div className="rp-hist-main">
                    <strong>{r.report_title}</strong>
                    <span>{r.filters?.text || '—'}</span>
                  </div>
                  <div className="rp-hist-meta">
                    <span>{r.users ? personName(r.users) : '—'}</span>
                    <span>{r.generated_at ? new Date(r.generated_at).toLocaleString() : '—'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {tipNode}
    </>
  );
};

export default ReportsPage;