import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';

const NAV_ITEMS = [
  { path: '/coordinator/dashboard',     label: 'Dashboard',        icon: '⊞' },
  { path: '/coordinator/for-endorsement', label: 'For Endorsement', icon: '📋' },
  { path: '/coordinator/endorsed',      label: 'Endorsed',          icon: '✅' },
  { path: '/coordinator/notifications', label: 'Notifications',     icon: '🔔' },
];

const PROPOSAL_TYPES = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel / Oral Presentation',
  externally_funded:     'Externally Funded',
};

const STATUS_BADGE = {
  submitted:    'badge-blue',
  under_review: 'badge-amber',
  returned:     'badge-red',
  endorsed:     'badge-purple',
  approved:     'badge-green',
  rejected:     'badge-red',
};

/* ── Shared Endorsement Panel ── */
const EndorsementPanel = ({ proposals, endorserRole, onRefresh }) => {
  const [selected, setSelected] = useState(null);
  const [remarks,  setRemarks]  = useState('');
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);

  const pending = proposals.filter(p =>
    ['submitted', 'under_review'].includes(p.status)
  );

  const handleEndorse = async (decision) => {
    if (decision === 'rejected' && !remarks.trim()) {
      return setAlert({ type: 'error', msg: 'Please provide remarks before rejecting.' });
    }
    setSaving(true);
    try {
      await API.post(`/proposals/${selected.proposal_id}/endorse`, {
        endorser_role:  endorserRole,
        endorse_status: decision,
        remarks:        remarks || '',
      });
      setAlert({
        type: 'success',
        msg:  decision === 'endorsed'
          ? 'Proposal endorsed successfully!'
          : 'Proposal returned to researcher.',
      });
      setSelected(null);
      setRemarks('');
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Action failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {alert && !selected && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      {!selected ? (
        <div className="panel">
          <div className="panel-header">
            <h2>Proposals for Endorsement</h2>
            <span className="badge badge-blue">{pending.length}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Researcher</th><th>Title</th>
                <th>Type</th><th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p, i) => (
                <tr key={p.proposal_id}>
                  <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.college || '—'}</div>
                  </td>
                  <td style={{ maxWidth: 200 }}>{p.title}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                      {p.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => { setSelected(p); setRemarks(''); setAlert(null); }}>
                      View & Endorse
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state"><p>No proposals for endorsement.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <button className="btn btn-outline btn-sm"
            style={{ marginBottom: 16 }}
            onClick={() => { setSelected(null); setAlert(null); }}>
            ← Back to list
          </button>

          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            {/* Proposal Detail */}
            <div className="panel">
              <div className="panel-header">
                <h2>Proposal Details</h2>
                <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-gray'}`}>
                  {selected.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '12px 28px', marginBottom: 20 }}>
                  {[
                    { label: 'Researcher',    value: `${selected.first_name} ${selected.last_name}` },
                    { label: 'Email',         value: selected.email },
                    { label: 'College',       value: selected.college || '—' },
                    { label: 'Department',    value: selected.department || '—' },
                    { label: 'Proposal Type', value: PROPOSAL_TYPES[selected.proposal_type] },
                    { label: 'Date Submitted',value: selected.submitted_at
                      ? new Date(selected.submitted_at).toLocaleDateString() : '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '0.72rem', color: '#718096',
                        textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>
                        {item.label}
                      </p>
                      <p style={{ fontWeight: 600, color: '#1a3a5c',
                        margin: 0, fontSize: '0.875rem' }}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: '0.72rem', color: '#718096',
                    textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                    Research Title
                  </p>
                  <p style={{ fontWeight: 700, color: '#1a3a5c',
                    fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>
                    {selected.title}
                  </p>
                </div>

                {selected.description && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: '0.72rem', color: '#718096',
                      textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                      Abstract
                    </p>
                    <p style={{
                      color: '#2d3748', lineHeight: 1.7, margin: 0, fontSize: '0.9rem',
                      background: '#f8fafc', padding: 14,
                      borderRadius: 8, border: '1px solid #e8edf2',
                    }}>
                      {selected.description}
                    </p>
                  </div>
                )}

                {selected.file_path && (
                  <a className="btn btn-outline"
                    style={{ display: 'inline-block', textDecoration: 'none' }}
                    href={`http://localhost:5000/${selected.file_path}`}
                    target="_blank" rel="noreferrer">
                    📄 View Document
                  </a>
                )}
              </div>
            </div>

            {/* Endorsement Actions */}
            <div className="panel">
              <div className="panel-header"><h2>Endorsement</h2></div>
              <div className="panel-body">
                <div className="form-group">
                  <label>Remarks</label>
                  <textarea rows={5} value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Add your remarks or comments..."
                    style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-success" disabled={saving}
                    onClick={() => handleEndorse('endorsed')}>
                    {saving ? 'Processing...' : '✓ Endorse Proposal'}
                  </button>
                  <button className="btn btn-danger" disabled={saving}
                    onClick={() => handleEndorse('rejected')}>
                    {saving ? 'Processing...' : '✗ Reject / Return'}
                  </button>
                </div>
                <div style={{
                  marginTop: 12, padding: 10, background: '#f0f6ff',
                  borderRadius: 8, border: '1px solid #bee3f8',
                  fontSize: '0.78rem', color: '#2c5282',
                }}>
                  Endorsing forwards this proposal to the next level for review.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ── Endorsed History ── */
const EndorsedHistory = ({ proposals }) => {
  const endorsed = proposals.filter(p =>
    ['endorsed', 'approved', 'rejected'].includes(p.status)
  );
  return (
    <>
      <div className="page-header">
        <h1>Endorsed Proposals</h1>
        <p>Proposals you have previously endorsed.</p>
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th><th>Title</th><th>Type</th><th>Status</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {endorsed.map(p => (
              <tr key={p.proposal_id}>
                <td><strong>{p.first_name} {p.last_name}</strong></td>
                <td>{p.title}</td>
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
              </tr>
            ))}
            {endorsed.length === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No endorsed proposals yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ── Notifications ── */
const Notifications = () => {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/notifications')
      .then(res => setNotifs(res.data.notifications || []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.notif_id === id ? { ...n, is_read: 1 } : n));
    } catch {}
  };

  return (
    <>
      <div className="page-header"><h1>Notifications</h1></div>
      <div className="panel">
        {loading ? <div className="empty-state"><p>Loading...</p></div>
          : notifs.length === 0 ? <div className="empty-state"><p>No notifications.</p></div>
          : notifs.map(n => (
            <div key={n.notif_id}
              onClick={() => !n.is_read && markRead(n.notif_id)}
              style={{
                padding: '14px 20px', borderBottom: '1px solid #f0f4f8',
                background: n.is_read ? '#fff' : '#f0f6ff',
                display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer',
              }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                flexShrink: 0, marginTop: 5,
                background: n.is_read ? '#e8edf2' : '#2e6da4',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 3px', fontSize: '0.9rem' }}>{n.title}</p>
                <p style={{ color: '#718096', margin: '0 0 4px', fontSize: '0.85rem' }}>{n.message}</p>
                <p style={{ color: '#a0aec0', margin: 0, fontSize: '0.75rem' }}>
                  {new Date(n.date_sent).toLocaleString()}
                </p>
              </div>
              {!n.is_read && <span className="badge badge-blue" style={{ flexShrink: 0 }}>New</span>}
            </div>
          ))}
      </div>
    </>
  );
};

/* ── Overview ── */
const Overview = ({ proposals }) => {
  const pending  = proposals.filter(p => ['submitted','under_review'].includes(p.status)).length;
  const endorsed = proposals.filter(p => ['endorsed','approved'].includes(p.status)).length;

  return (
    <>
      <div className="page-header">
        <h1>Research Coordinator Dashboard</h1>
        <p>Review and endorse research proposals from your college.</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">Total Proposals</span>
          <span className="stat-value">{proposals.length}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Pending Endorsement</span>
          <span className="stat-value">{pending}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Endorsed</span>
          <span className="stat-value">{endorsed}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Rejected</span>
          <span className="stat-value">{proposals.filter(p => p.status === 'rejected').length}</span>
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2>Latest Proposals</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Researcher</th><th>Title</th><th>Type</th><th>Status</th></tr>
          </thead>
          <tbody>
            {proposals.slice(0, 6).map(p => (
              <tr key={p.proposal_id}>
                <td><strong>{p.first_name} {p.last_name}</strong></td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                    {p.status?.replace(/_/g, ' ')}
                  </span>
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty-state"><p>No proposals yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ── Main ── */
const CoordinatorDashboard = () => {
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await API.get('/proposals');
      setProposals(res.data.proposals || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="Research Coordinator">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Overview proposals={proposals} />} />
        <Route path="for-endorsement" element={
          <>
            <div className="page-header">
              <h1>For Endorsement</h1>
              <p>Review and endorse proposals from researchers in your college.</p>
            </div>
            <EndorsementPanel
              proposals={proposals}
              endorserRole="research_coordinator"
              onRefresh={fetchProposals}
            />
          </>
        } />
        <Route path="endorsed"      element={<EndorsedHistory proposals={proposals} />} />
        <Route path="notifications" element={<Notifications />} />
      </Routes>
    </Layout>
  );
};

export default CoordinatorDashboard;