import React, { useCallback, useEffect, useState } from 'react';
import { FaDownload, FaLock } from '../../utils/icons';
import API from '../../services/authService';
import { FileButtons } from '../../components/ProposalFiles';
import { personName } from '../../utils/names';
import { useLiveRefresh } from '../../utils/liveRefresh';
import { SDGS, sdgList } from '../../utils/sdgs';
import './External.css';
import { dateText } from '../../utils/dates';
import { usePaged } from '../../components/Pager';

/* ─────────────────────────────────────────────────────────────
   External Research (externally funded research, Repository only)
     ExternalDetails      the details of one item, in a window   (everyone who can see it)
     CollegeExternalPage  read-only list of one college's items  (College Chairperson, College Coordinator, College Dean)
     OfficeExternalPage   read-only list of every college's items, with totals, filters and a CSV
                          download in the order of VCRED's "Externally Funded Projects" report
                          (Admin, VCRED, MSIRC Director, MSIRC Special Assistant, MSIRC Staff)
   Always private: only the researcher, their college and the MSIRC offices see it.
   ───────────────────────────────────────────────────────────── */

export const peso   = (v) => (v === null || v === undefined || v === '' ? '—'
  : `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const day    = (v) => (v ? dateText(v) : '—');
const month = (v) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '');
export const period = (a, b) => (a || b ? `${month(a) || '?'} – ${month(b) || '?'}` : '—');

export const PrivateBadge = () => (
  <span className="badge badge-gray" title="Only the researcher, their college and the MSIRC offices can see it">
    <FaLock className="ic" style={{ fontSize: '0.7em' }} />Private
  </span>
);

/* the SDGs as small coloured chips */
export const SdgChips = ({ value, small = false }) => {
  const list = sdgList(value);
  if (!list.length) return null;
  return (
    <span className={`ext-chips${small ? ' sm' : ''}`}>
      {list.map((n) => {
        const [, name, color] = SDGS[n - 1];
        return <span key={n} className="ext-chip" style={{ '--sdg': color }} title={`SDG ${n}: ${name}`}><b>{n}</b>{small ? '' : name}</span>;
      })}
    </span>
  );
};

export const ExternalDetails = ({ item, onClose }) => {
  if (!item) return null;
  const owner = personName(item);
  const rows = [
    { label: 'Project Leader',  value: item.project_leader || owner || '—' },
    { label: 'Project Members', value: item.researchers || '—' },
    { label: 'Funder',          value: item.external_agency || '—' },
    { label: 'Funding Amount',  value: peso(item.funding_amount) },
    { label: 'Project Period',  value: item.start_date || item.end_date ? `${day(item.start_date)} to ${day(item.end_date)}` : '—' },
    ...(owner ? [{ label: 'Uploaded By', value: owner }] : []),
    ...(item.college ? [{ label: 'College', value: item.college }] : []),
    ...(item.department ? [{ label: 'Department', value: item.department }] : []),
    { label: 'Date Uploaded', value: day(item.uploaded_at) },
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={item.title}>
        <h3 style={{ marginBottom: 6 }}>{item.title}</h3>
        <p style={{ margin: '0 0 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="badge badge-blue">Externally Funded</span><PrivateBadge />
          <small style={{ color: '#718096' }}>Stored in the Research Repository. Only the researcher, their college and the MSIRC offices can see it.</small>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 24px', marginBottom: 16 }}>
          {rows.map((r) => (
            <div key={r.label}>
              <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>{r.label}</p>
              <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, overflowWrap: 'anywhere' }}>{r.value}</p>
            </div>
          ))}
        </div>
        {sdgList(item.sdgs).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p className="ext-cap">Sustainable Development Goals hit</p>
            <SdgChips value={item.sdgs} />
          </div>
        )}
        {item.description && (
          <>
            <p className="ext-cap">Abstract</p>
            <p style={{ margin: '0 0 14px', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{item.description}</p>
          </>
        )}
        {item.keywords && <p style={{ margin: '0 0 14px' }}><b>Keywords:</b> {item.keywords}</p>}
        {(item.files || []).length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p className="ext-cap">Supporting documents</p>
            <ul className="ext-files">
              {item.files.map((f) => (
                <li key={f.file_id || f.file_path}><span><b>{f.label}</b><small>{f.file_name}</small></span>
                  <FileButtons path={f.file_path} name={f.file_name} label={f.label} /></li>
              ))}
            </ul>
          </div>
        )}
        <div className="modal-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <FileButtons path={item.file_path} label="the research document" small={false} />
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

/* ── College Chairperson, College Coordinator and College Dean: their college's External Research (read only) ── */
export const CollegeExternalPage = () => {
  const [items, setItems]   = useState([]);
  const [college, setCollege] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [open, setOpen]     = useState(null);
  const [dept, setDept]     = useState('');
  const [q, setQ]           = useState('');

  const load = useCallback(() => {
    API.get('/external/college')
      .then((res) => { setItems(res.data?.items || []); setCollege(res.data?.college || ''); setFailed(''); })
      .catch((err) => setFailed(err.response?.data?.message || 'Could not load External Research.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const depts = [...new Set(items.map((x) => x.department).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  const shown = items.filter((x) => (!dept || x.department === dept)
    && (!needle || [x.title, x.project_leader, x.researchers, x.external_agency, personName(x), x.keywords].some((v) => String(v || '').toLowerCase().includes(needle))));
  const pager = usePaged(shown);   // 10 rows a page, Previous / Next under the table

  return (
    <>
      <div className="page-header">
        <h1>External Research</h1>
        <p>Externally funded research by researchers of {college || 'your college'}. Read only: these do not need your endorsement.</p>
      </div>
      <div className="alert alert-info" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <FaLock style={{ marginTop: 3, flexShrink: 0 }} />
        <span>These are <b>private</b> in the Research Repository: only the researcher, their college (College Chairperson, College Coordinator, College Dean) and the MSIRC offices can see them. Other researchers cannot see or search them.</span>
      </div>
      {failed && <div className="alert alert-error" role="alert">{failed}</div>}
      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Externally Funded Research</h2>
          <span className="badge badge-blue">{shown.length}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' }}>
            <input type="search" className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, leader, funder…"
              aria-label="Search external research" style={{ minWidth: 220 }} />
            <select className="search-input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filter by department">
              <option value="">All departments</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="empty-state loading-state" role="status"><p>Loading…</p></div>
        ) : shown.length === 0 ? (
          <div className="empty-state"><p>{items.length ? 'Nothing matches your search.' : 'No externally funded research from your college yet.'}</p></div>
        ) : (
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th style={{ minWidth: 220 }}>Title</th><th>Researcher</th><th style={{ minWidth: 150 }}>Department</th><th>Funder</th><th>Amount</th><th>Period</th><th>Action</th></tr>
              </thead>
              <tbody>
                {pager.rows.map((x) => (
                  <tr key={x.external_id}>
                    <td><strong>{x.title}</strong></td>
                    <td>{personName(x) || '—'}</td>
                    <td style={{ color: '#4a5568' }}>{x.department || '—'}</td>
                    <td style={{ color: '#718096' }}>{x.external_agency || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{peso(x.funding_amount)}</td>
                    <td style={{ color: '#718096', minWidth: 110 }}>{period(x.start_date, x.end_date)}</td>
                    <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(x)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pager.bar}
          </div>
        )}
      </div>
      <ExternalDetails item={open} onClose={() => setOpen(null)} />
    </>
  );
};

/* ── Admin and the MSIRC offices: External Research of every college (read only) ── */
const yearOf = (x) => { const d = x.start_date || x.uploaded_at; return d ? String(new Date(d).getFullYear()) : ''; };
const csvCell = (v) => { const t = String(v ?? ''); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
/* a cell that starts like a formula is written as text, so a spreadsheet does not run it */
const safeCell = (v) => { const t = String(v ?? ''); return /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; };

export const OfficeExternalPage = () => {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState('');
  const [open, setOpen]     = useState(null);
  const [college, setCollege] = useState('');
  const [year, setYear]     = useState('');
  const [sdg, setSdg]       = useState('');
  const [q, setQ]           = useState('');

  const load = useCallback(() => {
    API.get('/external')
      .then((res) => { setItems(res.data?.items || []); setFailed(''); })
      .catch((err) => setFailed(err.response?.data?.message || 'Could not load External Research.'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const colleges = [...new Set(items.map((x) => x.college).filter(Boolean))].sort();
  const years    = [...new Set(items.map(yearOf).filter(Boolean))].sort().reverse();
  const needle = q.trim().toLowerCase();
  const shown = items.filter((x) => (!college || x.college === college)
    && (!year || yearOf(x) === year)
    && (!sdg || sdgList(x.sdgs).includes(Number(sdg)))
    && (!needle || [x.title, x.project_leader, x.researchers, x.external_agency, personName(x), x.keywords, x.department]
      .some((v) => String(v || '').toLowerCase().includes(needle))));
  const pager = usePaged(shown);   // 10 rows a page, Previous / Next under the table

  const total = shown.reduce((sum, x) => sum + (Number(x.funding_amount) || 0), 0);
  const collegeCount = new Set(shown.map((x) => x.college).filter(Boolean)).size;

  /* the list as shown, in the order of VCRED's "Externally Funded Projects" report */
  const download = () => {
    const head = ['Title', 'Project Leader', 'Project Members', 'Funder', 'Funding Amount (PHP)', 'SDGs', 'Start Date', 'End Date', 'College', 'Department', 'Keywords', 'Date Uploaded'];
    const rows = shown.map((x) => [
      x.title, x.project_leader || personName(x), x.researchers, x.external_agency,
      x.funding_amount ?? '', sdgList(x.sdgs).map((n) => `SDG ${n}`).join('; '),
      x.start_date || '', x.end_date || '', x.college, x.department, x.keywords,
      x.uploaded_at ? String(x.uploaded_at).slice(0, 10) : '',
    ]);
    const text = [head, ...rows].map((r) => r.map((v) => csvCell(safeCell(v))).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `AYON-External-Research-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <>
      <div className="page-header">
        <h1>External Research</h1>
        <p>Externally funded research of every college, in the Research Repository. Read only: these do not go through the approval offices.</p>
      </div>
      <div className="alert alert-info" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <FaLock style={{ marginTop: 3, flexShrink: 0 }} />
        <span>These are <b>private</b>: only the researcher, their college and the MSIRC offices can see them. Other researchers cannot see or search them.</span>
      </div>
      {failed && <div className="alert alert-error" role="alert">{failed}</div>}

      <div className="stats-grid">
        <div className="stat-card blue"><span className="stat-label">Projects</span><span className="stat-value">{shown.length}</span></div>
        <div className="stat-card green"><span className="stat-label">Total Funding</span><span className="stat-value" style={{ fontSize: '1.35rem' }}>{peso(total)}</span></div>
        <div className="stat-card amber"><span className="stat-label">Colleges</span><span className="stat-value">{collegeCount}</span></div>
      </div>

      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 10 }}>
          <h2>Externally Funded Research</h2>
          <span className="badge badge-blue">{shown.length}</span>
          <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={download} disabled={!shown.length}
            title="The list as shown, in the order of VCRED's Externally Funded Projects report">
            <FaDownload className="ic" />Download list (CSV)
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 20px 14px' }}>
          <input type="search" className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, leader, funder…"
            aria-label="Search external research" style={{ minWidth: 220, flex: '1 1 220px' }} />
          <select className="search-input" value={college} onChange={(e) => setCollege(e.target.value)} aria-label="Filter by college">
            <option value="">All colleges</option>
            {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="search-input" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="search-input" value={sdg} onChange={(e) => setSdg(e.target.value)} aria-label="Filter by SDG">
            <option value="">All SDGs</option>
            {SDGS.map(([n, name]) => <option key={n} value={n}>{`SDG ${n}: ${name}`}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="empty-state loading-state" role="status"><p>Loading…</p></div>
        ) : shown.length === 0 ? (
          <div className="empty-state"><p>{items.length ? 'Nothing matches your filters.' : 'No externally funded research yet.'}</p></div>
        ) : (
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th style={{ minWidth: 220 }}>Title</th><th>Project Leader</th><th style={{ minWidth: 150 }}>College</th><th>Funder</th><th>Amount</th><th>SDGs</th><th>Period</th><th>Action</th></tr>
              </thead>
              <tbody>
                {pager.rows.map((x) => (
                  <tr key={x.external_id}>
                    <td><strong>{x.title}</strong></td>
                    <td>{x.project_leader || personName(x) || '—'}</td>
                    <td style={{ color: '#4a5568' }}>{x.college || '—'}{x.department && <small style={{ display: 'block', color: '#8a7a7d' }}>{x.department}</small>}</td>
                    <td style={{ color: '#718096' }}>{x.external_agency || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{peso(x.funding_amount)}</td>
                    <td><SdgChips value={x.sdgs} small /></td>
                    <td style={{ color: '#718096', minWidth: 110 }}>{period(x.start_date, x.end_date)}</td>
                    <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(x)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pager.bar}
          </div>
        )}
      </div>
      <ExternalDetails item={open} onClose={() => setOpen(null)} />
    </>
  );
};