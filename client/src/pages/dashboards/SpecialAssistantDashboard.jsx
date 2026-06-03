import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout.css';

const NAV_ITEMS = [
  { path: '/special-assistant/dashboard',   label: 'Dashboard',          icon: '⊞' },
  { path: '/special-assistant/submissions', label: 'Submissions',         icon: '📥' },
  { path: '/special-assistant/validate',    label: 'Validate Documents',  icon: '✅' },
  { path: '/special-assistant/forwarded',   label: 'Forwarded',           icon: '📤' },
  { path: '/special-assistant/notifications',label: 'Notifications',      icon: '🔔' },
];

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

const REQUIREMENTS = [
  'Accomplished Proposal Form',
  'Research Proposal Document',
  'Curriculum Vitae of Researcher',
  'Endorsement Letter from Department',
  'Ethics Clearance (if applicable)',
  'Budget Proposal',
  'Institutional Approval',
];

/* ─────────── Overview ─────────── */
const Overview = ({ proposals }) => {
  const pending   = proposals.filter(p => p.status === 'submitted').length;
  const reviewing = proposals.filter(p => p.status === 'under_review').length;
  const forwarded = proposals.filter(p =>
    ['endorsed','approved','rejected'].includes(p.status)).length;
  const returned  = proposals.filter(p => p.status === 'returned').length;

  return (
    <>
      <div className="page-header">
        <h1>Special Assistant Dashboard</h1>
        <p>Validate submitted proposals and forward complete documents to the Director.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">Pending Validation</span>
          <span className="stat-value">{pending}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Under Review</span>
          <span className="stat-value">{reviewing}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Forwarded</span>
          <span className="stat-value">{forwarded}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Returned</span>
          <span className="stat-value">{returned}</span>
        </div>
      </div>

      {/* Pending Submissions */}
      <div className="panel">
        <div className="panel-header">
          <h2>Pending Submissions</h2>
          <span className="badge badge-blue">{pending} new</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Title</th>
              <th>Type</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {proposals
              .filter(p => p.status === 'submitted')
              .slice(0, 6)
              .map(p => (
                <tr key={p.proposal_id}>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <div style={{ fontSize: '0.78rem', color: '#718096' }}>{p.email}</div>
                  </td>
                  <td>{p.title}</td>
                  <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td style={{ color: '#718096' }}>
                    {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>
                      {p.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            {pending === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No pending submissions.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─────────── All Submissions ─────────── */
const Submissions = ({ proposals, onRefresh }) => {
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('submitted');
  const [alert,   setAlert]   = useState(null);

  const filtered = proposals.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch =
      `${p.first_name} ${p.last_name} ${p.title}`
        .toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleReturn = async (proposalId, title, researcherName) => {
    if (!window.confirm(`Return this submission to ${researcherName}?`)) return;
    try {
      await API.patch(`/proposals/${proposalId}/status`, { status: 'returned' });
      setAlert({ type: 'success', msg: 'Submission returned to researcher.' });
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Failed to return submission.' });
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>All Submissions</h1>
        <p>View and manage all research proposal submissions.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input"
              placeholder="Search by name or title..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 160 }}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="returned">Returned</option>
              <option value="endorsed">Endorsed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Researcher</th>
              <th>Title</th>
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
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.college || '—'}</div>
                </td>
                <td style={{ maxWidth: 200 }}>{p.title}</td>
                <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[p.status]}`}>
                    {p.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.status === 'submitted' && (
                      <button className="btn btn-danger btn-sm"
                        onClick={() => handleReturn(p.proposal_id, p.title,
                          `${p.first_name} ${p.last_name}`)}>
                        Return
                      </button>
                    )}
                    {p.file_path && (
                      <a className="btn btn-outline btn-sm"
                        href={`http://localhost:5000/${p.file_path}`}
                        target="_blank" rel="noreferrer">
                        File
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state"><p>No submissions found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─────────── Validate Documents ─────────── */
const ValidateDocuments = ({ proposals, onRefresh }) => {
  const [selected,   setSelected]   = useState(null);
  const [checklist,  setChecklist]  = useState({});
  const [remarks,    setRemarks]    = useState('');
  const [alert,      setAlert]      = useState(null);
  const [saving,     setSaving]     = useState(false);

  const pending = proposals.filter(p => p.status === 'submitted');

  const openValidation = (proposal) => {
    setSelected(proposal);
    setRemarks('');
    const initial = {};
    REQUIREMENTS.forEach(r => { initial[r] = 'missing'; });
    setChecklist(initial);
    setAlert(null);
  };

  const toggleCheck = (req) => {
    setChecklist(prev => ({
      ...prev,
      [req]: prev[req] === 'complete' ? 'missing' : 'complete',
    }));
  };

  const allComplete = Object.values(checklist).every(v => v === 'complete');

  const handleForward = async () => {
    if (!allComplete) {
      return setAlert({ type: 'error', msg: 'Please mark all requirements as complete before forwarding.' });
    }
    setSaving(true);
    try {
      await API.patch(`/proposals/${selected.proposal_id}/status`, {
        status: 'under_review',
      });
      await API.post(`/proposals/${selected.proposal_id}/checklist`, {
        requirements: checklist,
        remarks,
      });
      setAlert({ type: 'success', msg: 'Documents validated and forwarded to the Director!' });
      setSelected(null);
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Failed to forward submission.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    if (!remarks.trim()) {
      return setAlert({ type: 'error', msg: 'Please provide remarks before returning.' });
    }
    setSaving(true);
    try {
      await API.patch(`/proposals/${selected.proposal_id}/status`, { status: 'returned' });
      setAlert({ type: 'success', msg: 'Submission returned to researcher.' });
      setSelected(null);
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Failed to return submission.' });
    } finally {
      setSaving(false);
    }
  };

  const complete  = Object.values(checklist).filter(v => v === 'complete').length;
  const total     = REQUIREMENTS.length;
  const pct       = Math.round((complete / total) * 100);

  return (
    <>
      <div className="page-header">
        <h1>Validate Documents</h1>
        <p>Check document completeness before forwarding to the MSRIC Director.</p>
      </div>

      {alert && !selected && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      {!selected ? (
        <div className="panel">
          <div className="panel-header">
            <h2>Submissions Awaiting Validation</h2>
            <span className="badge badge-blue">{pending.length}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Title</th>
                <th>Type</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <tr key={p.proposal_id}>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.department || '—'}</div>
                  </td>
                  <td>{p.title}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td style={{ color: '#718096' }}>
                    {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => openValidation(p)}>
                      Validate
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><p>No submissions awaiting validation.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Validation Panel */
        <div>
          <button className="btn btn-outline btn-sm"
            style={{ marginBottom: 16 }}
            onClick={() => setSelected(null)}>
            ← Back to list
          </button>

          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

            {/* Left — Checklist */}
            <div className="panel">
              <div className="panel-header">
                <h2>Document Checklist</h2>
                <span className="badge badge-blue">{complete}/{total} complete</span>
              </div>
              <div className="panel-body">

                {/* Progress bar */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem', color: '#718096' }}>
                    <span>Completeness</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ background: '#e8edf2', borderRadius: 4, height: 8 }}>
                    <div style={{
                      width: `${pct}%`, height: '100%', borderRadius: 4,
                      background: pct === 100 ? '#276749' : '#2e6da4',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>

                {REQUIREMENTS.map(req => (
                  <div key={req}
                    onClick={() => toggleCheck(req)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                      marginBottom: 6, border: '1px solid',
                      borderColor: checklist[req] === 'complete' ? '#9ae6b4' : '#e8edf2',
                      background: checklist[req] === 'complete' ? '#f0fff4' : '#fff',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${checklist[req] === 'complete' ? '#276749' : '#d1d9e0'}`,
                      background: checklist[req] === 'complete' ? '#276749' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                      transition: 'all 0.15s',
                    }}>
                      {checklist[req] === 'complete' ? '✓' : ''}
                    </div>
                    <span style={{
                      fontSize: '0.875rem',
                      color: checklist[req] === 'complete' ? '#276749' : '#2d3748',
                      fontWeight: checklist[req] === 'complete' ? 600 : 400,
                    }}>{req}</span>
                  </div>
                ))}

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Remarks / Notes</label>
                  <textarea rows={3} value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Add remarks or notes for this submission..."
                    style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Right — Submission Info + Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="panel">
                <div className="panel-header"><h2>Submission Info</h2></div>
                <div className="panel-body">
                  {[
                    { label: 'Researcher', value: `${selected.first_name} ${selected.last_name}` },
                    { label: 'Email',      value: selected.email },
                    { label: 'College',    value: selected.college || '—' },
                    { label: 'Department', value: selected.department || '—' },
                    { label: 'Type',       value: PROPOSAL_TYPES[selected.proposal_type] },
                    { label: 'Submitted',  value: selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString() : '—' },
                  ].map(item => (
                    <div key={item.label} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, fontSize: '0.875rem' }}>{item.value}</p>
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>Title</p>
                    <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{selected.title}</p>
                  </div>
                  {selected.file_path && (
                    <a className="btn btn-outline btn-sm"
                      style={{ display: 'block', textAlign: 'center', marginTop: 14, textDecoration: 'none' }}
                      href={`http://localhost:5000/${selected.file_path}`}
                      target="_blank" rel="noreferrer">
                      View Attached File
                    </a>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Actions</h2></div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    className="btn btn-success"
                    onClick={handleForward}
                    disabled={saving || !allComplete}
                    style={{ opacity: allComplete ? 1 : 0.5 }}>
                    {saving ? 'Forwarding...' : '📤 Forward to Director'}
                  </button>
                  {!allComplete && (
                    <p style={{ fontSize: '0.75rem', color: '#718096', textAlign: 'center', margin: 0 }}>
                      Check all requirements to enable forwarding.
                    </p>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={handleReturn}
                    disabled={saving}>
                    ↩ Return to Researcher
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────── Forwarded Submissions ─────────── */
const Forwarded = ({ proposals }) => {
  const forwarded = proposals.filter(p =>
    ['under_review','endorsed','approved','rejected'].includes(p.status)
  );

  return (
    <>
      <div className="page-header">
        <h1>Forwarded Submissions</h1>
        <p>Proposals that have been validated and forwarded to the Director.</p>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Title</th>
              <th>Type</th>
              <th>Current Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {forwarded.map(p => (
              <tr key={p.proposal_id}>
                <td>
                  <strong>{p.first_name} {p.last_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.college || '—'}</div>
                </td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[p.status]}`}>
                    {p.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {forwarded.length === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No forwarded submissions yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─────────── Notifications ─────────── */
const Notifications = () => {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get('/notifications');
        setNotifs(res.data.notifications || []);
      } catch {
        setNotifs([]);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n =>
        n.notif_id === id ? { ...n, is_read: 1 } : n
      ));
    } catch {}
  };

  return (
    <>
      <div className="page-header">
        <h1>Notifications</h1>
        <p>Stay updated on proposal submissions and system alerts.</p>
      </div>
      <div className="panel">
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : notifs.length === 0 ? (
          <div className="empty-state"><p>No notifications yet.</p></div>
        ) : (
          <div>
            {notifs.map(n => (
              <div key={n.notif_id}
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #f0f4f8',
                  background: n.is_read ? '#fff' : '#f0f6ff',
                  display: 'flex', alignItems: 'flex-start',
                  gap: 14, cursor: 'pointer',
                }}
                onClick={() => !n.is_read && markRead(n.notif_id)}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: n.is_read ? '#e8edf2' : '#2e6da4',
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 3px', fontSize: '0.9rem' }}>{n.title}</p>
                  <p style={{ color: '#718096', margin: '0 0 4px', fontSize: '0.85rem' }}>{n.message}</p>
                  <p style={{ color: '#a0aec0', margin: 0, fontSize: '0.75rem' }}>
                    {new Date(n.date_sent).toLocaleString()}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="badge badge-blue" style={{ flexShrink: 0 }}>New</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

/* ─────────── Main Special Assistant Dashboard ─────────── */
const SpecialAssistantDashboard = () => {
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await API.get('/proposals');
      setProposals(res.data.proposals || []);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="Special Assistant">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"    element={<Overview proposals={proposals} />} />
        <Route path="submissions"  element={<Submissions proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="validate"     element={<ValidateDocuments proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="forwarded"    element={<Forwarded proposals={proposals} />} />
        <Route path="notifications" element={<Notifications />} />
      </Routes>
    </Layout>
  );
};

export default SpecialAssistantDashboard;