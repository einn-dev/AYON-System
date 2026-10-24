import React, { useState, useEffect } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';

const GRANT_TYPES = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded Research',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel Subsidy / Oral Presentation',
};

const GRANT_BADGE = {
  pending:  'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
};

const GrantReviewPage = () => {
  const [grants,   setGrants]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search,   setSearch]   = useState('');
  const [alert,    setAlert]    = useState(null);
  const [actingOn, setActingOn] = useState(null);

  const fetchGrants = async () => {
    try {
      const res = await API.get('/grants');
      setGrants(res.data.grants || []);
    } catch { setGrants([]); }
    finally  { setLoading(false); }
  };

  useEffect(() => { fetchGrants(); }, []);

  const filtered = grants.filter(g => {
    const matchStatus = filter === 'all' || g.status === filter;
    const matchType   = typeFilter === 'all' || g.grant_type === typeFilter;
    const matchSearch = `${g.first_name} ${g.last_name} ${g.proposal_title}`
      .toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  const counts = {
    pending:  grants.filter(g => g.status === 'pending').length,
    approved: grants.filter(g => g.status === 'approved').length,
    rejected: grants.filter(g => g.status === 'rejected').length,
  };

  const handleDecision = async (grantId, status, proposalTitle) => {
    const label = status === 'approved' ? 'Approve' : 'Reject';
    if (!window.confirm(`${label} the grant application for "${proposalTitle}"?`)) return;

    setActingOn(grantId);
    setAlert(null);
    try {
      await API.patch(`/grants/${grantId}/status`, { status });
      setAlert({
        type: 'success',
        msg:  `Grant application ${status}! The researcher has been notified via email and in-app.`,
      });
      fetchGrants();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Action failed.' });
    } finally {
      setActingOn(null);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Grant Applications</h1>
        <p>Review and decide on grant and incentive applications from researchers.</p>
      </div>

      {/* Summary strip */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card blue">
          <span className="stat-label">Total Applications</span>
          <span className="stat-value">{grants.length}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Pending Decision</span>
          <span className="stat-value">{counts.pending}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Approved</span>
          <span className="stat-value">{counts.approved}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Rejected</span>
          <span className="stat-value">{counts.rejected}</span>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input"
              placeholder="Search by researcher or proposal..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 140 }}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Status</option>
            </select>
            <select className="search-input" style={{ minWidth: 190 }}
              value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="all">All Grant Types</option>
              {Object.entries(GRANT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <span className="badge badge-blue">{filtered.length} shown</span>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading grant applications...</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Researcher</th>
                <th>Proposal</th>
                <th>Grant Type</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => (
                <tr key={g.grant_id}>
                  <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                  <td>
                    <strong>{g.first_name} {g.last_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{g.college || '—'}</div>
                  </td>
                  <td style={{ maxWidth: 200 }}>{g.proposal_title}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {GRANT_TYPES[g.grant_type] || g.grant_type}
                  </td>
                  <td style={{ color: '#718096' }}>
                    {g.date_applied ? new Date(g.date_applied).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <span className={`badge ${GRANT_BADGE[g.status] || 'badge-gray'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td>
                    {g.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm"
                          disabled={actingOn === g.grant_id}
                          onClick={() => handleDecision(g.grant_id, 'approved', g.proposal_title)}>
                          {actingOn === g.grant_id ? '...' : '✓ Approve'}
                        </button>
                        <button className="btn btn-danger btn-sm"
                          disabled={actingOn === g.grant_id}
                          onClick={() => handleDecision(g.grant_id, 'rejected', g.proposal_title)}>
                          ✗ Reject
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>Decided</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <p>{grants.length === 0
                      ? 'No grant applications yet.'
                      : 'No applications match your filters.'}</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

export default GrantReviewPage;