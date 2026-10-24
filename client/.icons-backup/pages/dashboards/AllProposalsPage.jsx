import React, { useState, useEffect } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';

const PROPOSAL_TYPES = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel / Oral Presentation',
  externally_funded:     'Externally Funded',
};

const STATUS_BADGE = {
  draft:        'badge-gray',
  submitted:    'badge-blue',
  under_review: 'badge-amber',
  returned:     'badge-red',
  endorsed:     'badge-purple',
  approved:     'badge-green',
  rejected:     'badge-red',
};

const AllProposalsPage = () => {
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('all');
  const [type,      setType]      = useState('all');
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    API.get('/proposals')
      .then(res => setProposals(res.data.proposals || []))
      .catch(() => setProposals([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = proposals.filter(p => {
    const matchStatus = status === 'all' || p.status === status;
    const matchType   = type   === 'all' || p.proposal_type === type;
    const matchSearch = `${p.first_name} ${p.last_name} ${p.title} ${p.college}`
      .toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  /* Status counts for the summary strip */
  const counts = Object.keys(STATUS_BADGE).reduce((acc, s) => {
    acc[s] = proposals.filter(p => p.status === s).length;
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <h1>All Proposals</h1>
        <p>System-wide view of every research proposal in AYON.</p>
      </div>

      {/* Status summary strip */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <div className="stat-card blue">
          <span className="stat-label">Total</span>
          <span className="stat-value">{proposals.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Submitted</span>
          <span className="stat-value">{counts.submitted || 0}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Under Review</span>
          <span className="stat-value">{counts.under_review || 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Endorsed</span>
          <span className="stat-value">{counts.endorsed || 0}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Approved</span>
          <span className="stat-value">{counts.approved || 0}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Rejected</span>
          <span className="stat-value">{counts.rejected || 0}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input"
              placeholder="Search by name, title, or college..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 150 }}
              value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">All Status</option>
              {Object.keys(STATUS_BADGE).map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select className="search-input" style={{ minWidth: 180 }}
              value={type} onChange={e => setType(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(PROPOSAL_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <span className="badge badge-blue">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading proposals...</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Researcher</th>
                <th>Title</th>
                <th>College</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.proposal_id}>
                  <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.email}</div>
                  </td>
                  <td style={{ maxWidth: 200 }}>{p.title}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>{p.college || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                      {p.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ color: '#718096' }}>
                    {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-outline btn-sm"
                      onClick={() => setSelected(p)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state">
                    <p>{proposals.length === 0
                      ? 'No proposals in the system yet.'
                      : 'No proposals match your filters.'}</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>{selected.title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '12px 24px', marginBottom: 16 }}>
              {[
                { label: 'Researcher', value: `${selected.first_name} ${selected.last_name}` },
                { label: 'Email',      value: selected.email },
                { label: 'College',    value: selected.college || '—' },
                { label: 'Department', value: selected.department || '—' },
                { label: 'Type',       value: PROPOSAL_TYPES[selected.proposal_type] },
                { label: 'Submitted',  value: selected.submitted_at
                  ? new Date(selected.submitted_at).toLocaleDateString() : '—' },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: '0.72rem', color: '#718096',
                    textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>
                    {item.label}
                  </p>
                  <p style={{ fontWeight: 600, color: '#1a3a5c',
                    margin: 0, fontSize: '0.875rem' }}>{item.value}</p>
                </div>
              ))}
            </div>

            {selected.description && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '0.72rem', color: '#718096',
                  textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>
                  Description
                </p>
                <p style={{ color: '#2d3748', lineHeight: 1.6, margin: 0,
                  fontSize: '0.9rem', background: '#f8fafc', padding: 12,
                  borderRadius: 8, border: '1px solid #e8edf2' }}>
                  {selected.description}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center',
              justifyContent: 'space-between' }}>
              <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-gray'}`}
                style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
                {selected.status?.replace(/_/g, ' ')}
              </span>
              {selected.file_path && (
                <a className="btn btn-outline btn-sm"
                  href={selected.file_path}
                  target="_blank" rel="noreferrer"
                  style={{ textDecoration: 'none' }}>
                  📄 View File
                </a>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AllProposalsPage;