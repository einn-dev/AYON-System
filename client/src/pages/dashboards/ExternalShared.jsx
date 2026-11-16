import React, { useCallback, useEffect, useState } from 'react';
import { FaLock } from 'react-icons/fa6';
import API from '../../services/authService';
import { FileButtons } from '../../components/ProposalFiles';
import { personName } from '../../utils/names';
import { useLiveRefresh } from '../../utils/liveRefresh';

/* ─────────────────────────────────────────────────────────────
   External Research (externally funded research, Repository only)
     ExternalDetails      the details of one item, in a window   (everyone who can see it)
     CollegeExternalPage  read-only list of one college's items  (College Chairperson, College Coordinator, College Dean)
   Always private: only the researcher, their college and the MSIRC offices see it.
   ───────────────────────────────────────────────────────────── */

export const peso   = (v) => (v === null || v === undefined || v === '' ? '—'
  : `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
export const day    = (v) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const month = (v) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '');
export const period = (a, b) => (a || b ? `${month(a) || '?'} – ${month(b) || '?'}` : '—');

export const PrivateBadge = () => (
  <span className="badge badge-gray" title="Only the researcher, their college and the MSIRC offices can see it">
    <FaLock className="ic" style={{ fontSize: '0.7em' }} />Private
  </span>
);

export const ExternalDetails = ({ item, onClose }) => {
  if (!item) return null;
  const owner = personName(item);
  const rows = [
    { label: 'Researchers / Co-authors', value: item.researchers || owner || '—' },
    { label: 'External Funding Agency',  value: item.external_agency || '—' },
    { label: 'Funding Amount',           value: peso(item.funding_amount) },
    { label: 'Research Period',          value: item.start_date || item.end_date ? `${day(item.start_date)} to ${day(item.end_date)}` : '—' },
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
        <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Abstract</p>
        <p style={{ margin: '0 0 14px', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{item.description || '—'}</p>
        {item.keywords && (
          <p style={{ margin: '0 0 14px' }}><b>Keywords:</b> {item.keywords}</p>
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
    && (!needle || [x.title, x.researchers, x.external_agency, personName(x), x.keywords].some((v) => String(v || '').toLowerCase().includes(needle))));

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
            <input type="search" className="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, researcher, agency..."
              aria-label="Search external research" style={{ minWidth: 220 }} />
            <select className="search-input" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Filter by department">
              <option value="">All departments</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : shown.length === 0 ? (
          <div className="empty-state"><p>{items.length ? 'Nothing matches your search.' : 'No externally funded research from your college yet.'}</p></div>
        ) : (
          <div className="table-scroll" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th style={{ minWidth: 220 }}>Title</th><th>Researcher</th><th style={{ minWidth: 150 }}>Department</th><th>Funding Agency</th><th>Amount</th><th>Period</th><th>Action</th></tr>
              </thead>
              <tbody>
                {shown.map((x) => (
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
          </div>
        )}
      </div>
      <ExternalDetails item={open} onClose={() => setOpen(null)} />
    </>
  );
};