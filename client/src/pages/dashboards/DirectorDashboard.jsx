import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useOpenHighlight, OpenNotice } from '../../components/OpenHighlight';
import ReturnReasonModal from '../../components/ReturnReasonModal';
import ProposalTracker from '../../components/ProposalTracker';

/* Files are stored as full web addresses; older records may hold a server path */
const fileHref = (fp) => (/^https?:\/\//i.test(fp) ? fp : `http://localhost:5000/${fp}`);

const NAV_ITEMS = [
  { path: '/director/dashboard',    label: 'Dashboard',         icon: '⊞' },
  { path: '/director/for-review',   label: 'For Review',        icon: '📋' },
  { path: '/director/approved',     label: 'Approved',          icon: '✅' },
  { path: '/director/rejected',     label: 'Rejected',          icon: '✗'  },
  { path: '/director/endorsed',     label: 'Endorsed to OVCRED',icon: '📤' },
  { path: '/director/notifications',label: 'Notifications',     icon: '🔔' },
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

/* ─────────── Overview ─────────── */
const Overview = ({ proposals }) => {
  const forReview = proposals.filter(p => p.status === 'under_review').length;
  const approved  = proposals.filter(p => p.status === 'approved').length;
  const rejected  = proposals.filter(p => p.status === 'rejected').length;
  const endorsed  = proposals.filter(p => p.status === 'endorsed').length;

  return (
    <>
      <div className="page-header">
        <h1>Director Dashboard</h1>
        <p>Review validated proposals and make approval decisions for MSIRC.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card amber">
          <span className="stat-label">For Review</span>
          <span className="stat-value">{forReview}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Approved</span>
          <span className="stat-value">{approved}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Rejected</span>
          <span className="stat-value">{rejected}</span>
        </div>
        <div className="stat-card blue">
          <span className="stat-label">Endorsed to OVCRED</span>
          <span className="stat-value">{endorsed}</span>
        </div>
      </div>

      {/* Proposals needing action */}
      <div className="panel">
        <div className="panel-header">
          <h2>Proposals Awaiting Your Decision</h2>
          <span className="badge badge-amber">{forReview} pending</span>
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
              .filter(p => p.status === 'under_review')
              .slice(0, 6)
              .map(p => (
                <tr key={p.proposal_id}>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <div style={{ fontSize: '0.78rem', color: '#718096' }}>{p.college || '—'}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>{p.title}</td>
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
            {forReview === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No proposals awaiting review.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary by type */}
      <div className="panel">
        <div className="panel-header"><h2>Proposals by Type</h2></div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
            {Object.entries(PROPOSAL_TYPES).map(([key, label]) => {
              const count = proposals.filter(p => p.proposal_type === key).length;
              return (
                <div key={key} style={{
                  background: '#f8fafc', borderRadius: 10, padding: '14px 16px',
                  border: '1px solid #e8edf2',
                }}>
                  <p style={{ fontSize: '0.75rem', color: '#718096', margin: '0 0 6px',
                    textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a3a5c', margin: 0 }}>{count}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

/* ─────────── Review Panel (shared for review/approved/rejected/endorsed) ─────────── */
const ProposalTable = ({ proposals, statusFilter, onRefresh }) => {
  const [selected, setSelected] = useState(null);
  const [remarks,  setRemarks]  = useState('');
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [returning, setReturning] = useState(null);   // the proposal being returned to the researcher
  const hl = useOpenHighlight(proposals.length > 0);

  const filtered = proposals.filter(p => p.status === statusFilter);

  /* send it back to the researcher; after they resubmit it starts again from the college */
  const handleReturn = async (reason) => {
    await API.patch(`/proposals/${returning.proposal_id}/status`, { status: 'returned', reason });
    try {
      await API.post(`/proposals/${returning.proposal_id}/review`, { decision: 'return', remarks: reason });
    } catch { /* the return itself went through; the review record is extra */ }
    setReturning(null);
    setSelected(null);
    setRemarks('');
    setAlert({ type: 'success', msg: 'Proposal returned to the researcher. After they resubmit, it starts again from the Research Coordinator.' });
    onRefresh();
  };

  const handleDecision = async (proposalId, decision) => {
    if (!remarks.trim() && decision === 'rejected') {
      return setAlert({ type: 'error', msg: 'Please provide remarks before rejecting.' });
    }
    setSaving(true);
    try {
      await API.patch(`/proposals/${proposalId}/status`, { status: decision });

      if (decision === 'approved' || decision === 'endorsed') {
        /* the review record only knows approve / reject / return: endorsing to OVCRED is an approval */
        await API.post(`/proposals/${proposalId}/review`, {
          decision: 'approve',
          remarks: remarks || (decision === 'endorsed'
            ? 'Approved and endorsed to OVCRED by the MSRIC Director.'
            : 'Proposal approved by MSRIC Director.'),
        });
      } else if (decision === 'rejected') {
        await API.post(`/proposals/${proposalId}/review`, {
          decision: 'reject',
          remarks,
        });
      }

      setAlert({ type: 'success', msg: `Proposal ${decision} successfully!` });
      setSelected(null);
      setRemarks('');
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Action failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = {
    under_review: 'For Review',
    approved:     'Approved Proposals',
    rejected:     'Rejected Proposals',
    endorsed:     'Endorsed to OVCRED',
  }[statusFilter] || 'Proposals';

  return (
    <>
      <OpenNotice state={hl} where="your review queue" />
      <div className="page-header">
        <h1>{pageTitle}</h1>
        <p>
          {statusFilter === 'under_review'
            ? 'Review validated proposals forwarded by the Special Assistant.'
            : `All proposals with status: ${statusFilter.replace(/_/g, ' ')}.`}
        </p>
      </div>

      {alert && !selected && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      {!selected ? (
        <div className="panel">
          <div className="panel-header">
            <h2>{pageTitle}</h2>
            <span className="badge badge-amber">{filtered.length}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Researcher</th>
                <th>Title</th>
                <th>Type</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.proposal_id} data-pid={p.proposal_id}>
                  <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.college || '—'}</div>
                  </td>
                  <td style={{ maxWidth: 200 }}>{p.title}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td style={{ color: '#718096' }}>
                    {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => { setSelected(p); setRemarks(''); setAlert(null); }}>
                      {statusFilter === 'under_review' ? 'Review' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state"><p>No proposals found.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Detail / Decision Panel ── */
        <div>
          <button className="btn btn-outline btn-sm"
            style={{ marginBottom: 16 }}
            onClick={() => { setSelected(null); setAlert(null); }}>
            ← Back to list
          </button>

          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

            {/* Left — Proposal Details */}
            <div className="panel">
              <div className="panel-header">
                <h2>Proposal Details</h2>
                <span className={`badge ${STATUS_BADGE[selected.status]}`}>
                  {selected.status?.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="panel-body">
                <ProposalTracker proposal={selected} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px', marginBottom: 20 }}>
                  {[
                    { label: 'Researcher',   value: `${selected.first_name} ${selected.last_name}` },
                    { label: 'Email',        value: selected.email },
                    { label: 'College',      value: selected.college || '—' },
                    { label: 'Department',   value: selected.department || '—' },
                    { label: 'Proposal Type',value: PROPOSAL_TYPES[selected.proposal_type] || selected.proposal_type },
                    { label: 'Date Submitted',value: selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString() : '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <p style={{ fontSize: '0.72rem', color: '#718096',
                        textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>
                        {item.label}
                      </p>
                      <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, fontSize: '0.875rem' }}>
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
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: '0.72rem', color: '#718096',
                      textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                      Abstract / Description
                    </p>
                    <p style={{ color: '#2d3748', lineHeight: 1.7,
                      margin: 0, fontSize: '0.9rem',
                      background: '#f8fafc', padding: 14,
                      borderRadius: 8, border: '1px solid #e8edf2' }}>
                      {selected.description}
                    </p>
                  </div>
                )}

                {selected.file_path && (
                  <a className="btn btn-outline"
                    style={{ display: 'inline-block', textDecoration: 'none' }}
                    href={fileHref(selected.file_path)}
                    target="_blank" rel="noreferrer">
                    📄 View Attached Document
                  </a>
                )}
              </div>
            </div>

            {/* Right — Decision Panel */}
            {statusFilter === 'under_review' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="panel">
                  <div className="panel-header"><h2>Director's Decision</h2></div>
                  <div className="panel-body">
                    <div className="form-group">
                      <label>Remarks / Comments</label>
                      <textarea rows={5} value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Add your remarks or comments about this proposal..."
                        style={{ resize: 'vertical' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                      {/* Approve + Endorse to OVCRED */}
                      <button className="btn btn-success"
                        disabled={saving}
                        onClick={() => handleDecision(selected.proposal_id, 'endorsed')}>
                        {saving ? 'Processing...' : '📤 Approve & Endorse to OVCRED'}
                      </button>

                      {/* Approve only */}
                      <button className="btn btn-primary"
                        disabled={saving}
                        onClick={() => handleDecision(selected.proposal_id, 'approved')}>
                        {saving ? 'Processing...' : '✓ Approve Only'}
                      </button>

                      {/* Return to the researcher (a reason is required) */}
                      <button className="btn btn-outline"
                        disabled={saving}
                        onClick={() => setReturning(selected)}>
                        ↩ Return to Researcher
                      </button>

                      {/* Reject */}
                      <button className="btn btn-danger"
                        disabled={saving}
                        onClick={() => handleDecision(selected.proposal_id, 'rejected')}>
                        {saving ? 'Processing...' : '✗ Reject'}
                      </button>
                    </div>

                    <div style={{ marginTop: 12, padding: 12,
                      background: '#fffbeb', borderRadius: 8,
                      border: '1px solid #fcd34d', fontSize: '0.8rem', color: '#92400e' }}>
                      <strong>Note:</strong> "Approve & Endorse" forwards the proposal to OVCRED
                      for final approval. "Approve Only" keeps it within MSIRC.
                      "Return to Researcher" sends it back for changes; after resubmission it
                      starts again from the Research Coordinator.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View-only right panel for non-review statuses */}
            {statusFilter !== 'under_review' && (
              <div className="panel">
                <div className="panel-header"><h2>Decision Info</h2></div>
                <div className="panel-body">
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: '0.72rem', color: '#718096',
                      textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>
                      Final Status
                    </p>
                    <span className={`badge ${STATUS_BADGE[selected.status]}`}
                      style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                      {selected.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {returning && (
        <ReturnReasonModal
          title={returning.title}
          researcher={`${returning.first_name || ''} ${returning.last_name || ''}`.trim()}
          onConfirm={handleReturn}
          onClose={() => setReturning(null)} />
      )}
    </>
  );
};

/* ─────────── Main Director Dashboard ─────────── */
const DirectorDashboard = () => {
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
    <Layout navItems={NAV_ITEMS} role="MSRIC Director">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"
          element={<Overview proposals={proposals} />} />
        <Route path="for-review"
          element={<ProposalTable proposals={proposals} statusFilter="under_review" onRefresh={fetchProposals} />} />
        <Route path="approved"
          element={<ProposalTable proposals={proposals} statusFilter="approved" onRefresh={fetchProposals} />} />
        <Route path="rejected"
          element={<ProposalTable proposals={proposals} statusFilter="rejected" onRefresh={fetchProposals} />} />
        <Route path="endorsed"
          element={<ProposalTable proposals={proposals} statusFilter="endorsed" onRefresh={fetchProposals} />} />
        <Route path="notifications"
          element={<OfficeNotifications queuePath="/director/for-review"
            intro="Proposals the Special Assistant forwarded to you, and reminders from the MSRIC administrator." />} />
      </Routes>
    </Layout>
  );
};

export default DirectorDashboard;