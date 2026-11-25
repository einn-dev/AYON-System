import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API from '../services/authService';
import { FileButtons } from './ProposalFiles';
import { repoTypeLabel } from '../utils/terms';

/* ─────────────────────────────────────────────────────────────
   The Research Repository list, the same on every office page:
   VCRED, MSIRC Staff, and the College Chairperson, Coordinator and Dean.
     endpoint  '/repository' (MSIRC offices: everything)
               '/repository/college' (college offices: public + their college's private)
   Storing is automatic: every approved submission is stored as Private, and
   only its owner or the Administrator can make it Public.
   ───────────────────────────────────────────────────────────── */
const ACCESS_BADGE = { public: 'badge-green', private: 'badge-amber' };
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const RepositoryBrowser = ({ endpoint = '/repository', intro, note }) => {
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [access, setAccess] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await API.get(endpoint);
      setItems(res.data.items || []);
      setFailed('');
    } catch (err) {
      setItems([]);
      setFailed(err.response?.data?.message || 'Could not load the repository.');
    }
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const types = useMemo(() => [...new Set((items || []).map(repoTypeLabel))].sort(), [items]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((r) =>
      (type === 'all' || repoTypeLabel(r) === type) &&
      (access === 'all' || r.access_type === access) &&
      (!q || `${r.title} ${r.author || ''} ${r.college || ''} ${r.keywords || ''}`.toLowerCase().includes(q)));
  }, [items, search, type, access]);
  const filtersOn = !!(search.trim() || type !== 'all' || access !== 'all');

  return (
    <>
      <div className="page-header">
        <h1>Research Repository</h1>
        <p>{intro || 'Every approved research and application, stored automatically.'}</p>
      </div>

      {failed && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>{failed}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={load}>Try Again</button>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search title, author or college…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="search-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Submission Type">
              <option value="all">All Submission Types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="search-input" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Access">
              <option value="all">All Access</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            {filtersOn && (
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { setSearch(''); setType('all'); setAccess('all'); }}>Clear</button>
            )}
          </div>
          <span className="badge badge-blue">{shown.length} shown</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Research Title</th><th>Submission Type</th><th>Access</th><th>Date Stored</th><th>File</th></tr>
          </thead>
          <tbody>
            {items && shown.map((r) => (
              <tr key={r.repo_id}>
                <td>
                  <div style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{r.title}</div>
                  <span style={{ fontSize: '0.78rem', color: '#8a7a7d' }}>{[r.author, r.college].filter(Boolean).join(' · ') || '—'}</span>
                </td>
                <td style={{ fontSize: '0.82rem', color: '#5e5155' }}>{repoTypeLabel(r)}</td>
                <td><span className={`badge ${ACCESS_BADGE[r.access_type] || 'badge-gray'}`}>{r.access_type === 'public' ? 'Public' : 'Private'}</span></td>
                <td style={{ color: '#718096', whiteSpace: 'nowrap' }}>{fmt(r.store_date)}</td>
                <td>
                  {r.file_path ? <FileButtons path={r.file_path} label={r.title} />
                    : <span style={{ color: '#a0aec0', fontSize: '0.82rem' }}>No file</span>}
                </td>
              </tr>
            ))}
            {items && shown.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state">
                <p>{items.length ? 'Nothing matches these filters.' : 'Nothing has been stored in the repository yet.'}</p>
              </div></td></tr>
            )}
            {!items && <tr><td colSpan={5}><div className="empty-state loading-state" role="status"><p>Loading…</p></div></td></tr>}
          </tbody>
        </table>
        <div className="am-legend" style={{ padding: '10px 20px', borderTop: '1px solid #efe5e6', fontSize: '0.8rem', color: '#8a7a7d' }}>
          {note || 'Approved submissions are stored automatically as Private. Only the researcher who owns it, or the Administrator, can make it Public.'}
        </div>
      </div>
    </>
  );
};

export default RepositoryBrowser;