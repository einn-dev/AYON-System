import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import ReturnReasonModal, { REASON_MIN } from '../../components/ReturnReasonModal';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useOpenHighlight, OpenNotice } from '../../components/OpenHighlight';
import { FaArrowLeft, FaBell, FaCheck, FaClipboardCheck, FaFileLines, FaInbox, FaPaperPlane, FaRotateLeft, FaTableCellsLarge } from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, statusLabel, statusBadge, TYPE_LABEL } from '../../utils/terms';
import { SignConfirm, ProposalSignatures } from '../../components/Signature';

/* Files are stored as full web addresses; older records may hold a server path */
const fileHref = (fp) => (/^https?:\/\//i.test(fp) ? fp : `http://localhost:5000/${fp}`);

const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/special-assistant/dashboard',     label: 'Dashboard',           icon: <FaTableCellsLarge /> },
  { path: '/special-assistant/validate',      label: 'For Validation',      icon: <FaClipboardCheck /> },
  { path: '/special-assistant/forwarded',     label: 'Validated Proposals', icon: <FaPaperPlane /> },
  { path: '/special-assistant/submissions',   label: 'All Proposals',       icon: <FaInbox /> },
  { path: '/special-assistant/notifications', label: 'Notifications',       icon: <FaBell /> },
];

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
        <p>Validate proposals and forward complete documents to the MSIRC Director.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">{STATUS_LABEL.submitted}</span>
          <span className="stat-value">{pending}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">{STATUS_LABEL.under_review}</span>
          <span className="stat-value">{reviewing}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Validated</span>
          <span className="stat-value">{forwarded}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">{STATUS_LABEL.returned}</span>
          <span className="stat-value">{returned}</span>
        </div>
      </div>

      {/* Pending Submissions */}
      <div className="panel">
        <div className="panel-header">
          <h2>Waiting for Validation</h2>
          <span className="badge badge-blue">{pending} new</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Research Title</th>
              <th>Proposal Type</th>
              <th>Date Submitted</th>
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
                    <span className={`badge ${statusBadge(p.status)}`}>
                      {statusLabel(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            {pending === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No proposals are waiting for validation.</p></div>
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
  const [returning, setReturning] = useState(null);   // { id, title, name } while the reason box is open

  const filtered = proposals.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch =
      `${p.first_name} ${p.last_name} ${p.title}`
        .toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  /* the reason box calls this; it throws on failure so the box stays open with the message */
  const confirmReturn = async (reason) => {
    await API.patch(`/proposals/${returning.id}/status`, { status: 'returned', reason });
    setReturning(null);
    setAlert({ type: 'success', msg: 'The proposal was returned to the researcher with your reason.' });
    onRefresh();
  };

  return (
    <>
      <div className="page-header">
        <h1>All Proposals</h1>
        <p>Every research proposal submitted to MSIRC.</p>
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
              <option value="all">All Statuses</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Researcher</th>
              <th>Research Title</th>
              <th>Proposal Type</th>
              <th>Status</th>
              <th>Date Submitted</th>
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
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.status === 'submitted' && (
                      <button className="btn btn-danger btn-sm"
                        onClick={() => setReturning({
                          id: p.proposal_id, title: p.title,
                          name: `${p.first_name} ${p.last_name}`,
                        })}>
                        Return to Researcher
                      </button>
                    )}
                    {p.file_path && (
                      <a className="btn btn-outline btn-sm"
                        href={fileHref(p.file_path)}
                        target="_blank" rel="noreferrer">
                        View Document
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state"><p>No proposals found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {returning && (
        <ReturnReasonModal title={returning.title} researcher={returning.name}
          onConfirm={confirmReturn} onClose={() => setReturning(null)} />
      )}
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
  const [signReady,  setSignReady]  = useState(false);   // signature saved and the box ticked

  const pending = proposals.filter(p => p.status === 'submitted');
  const hl = useOpenHighlight(proposals.length > 0 && !selected);

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
    if (!signReady) {
      return setAlert({ type: 'error', msg: 'Please tick the box to confirm your signature before forwarding.' });
    }
    setSaving(true);
    try {
      await API.patch(`/proposals/${selected.proposal_id}/status`, {
        status: 'under_review',
        attest: true,
      });
      await API.post(`/proposals/${selected.proposal_id}/checklist`, {
        requirements: checklist,
        remarks,
      });
      setAlert({ type: 'success', msg: 'Documents validated, signed and forwarded to the MSIRC Director.' });
      setSelected(null);
      onRefresh();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The proposal could not be forwarded. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    if (remarks.trim().length < REASON_MIN) {
      return setAlert({
        type: 'error',
        msg: `Write what the researcher must fix in the Remarks box first (at least ${REASON_MIN} characters). They will read it word for word.`,
      });
    }
    setSaving(true);
    try {
      await API.patch(`/proposals/${selected.proposal_id}/status`, {
        status: 'returned',
        reason: remarks.trim(),
      });
      setAlert({ type: 'success', msg: 'The proposal was returned to the researcher with your remarks as the reason.' });
      setSelected(null);
      onRefresh();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The proposal could not be returned. Please try again.' });
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
        <h1>For Validation</h1>
        <p>Check document completeness before forwarding to the MSIRC Director.</p>
      </div>

      {!selected && <OpenNotice state={hl} where="the validation queue" />}

      {alert && !selected && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      {!selected ? (
        <div className="panel">
          <div className="panel-header">
            <h2>Proposals Waiting for Validation</h2>
            <span className="badge badge-blue">{pending.length}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Research Title</th>
                <th>Proposal Type</th>
                <th>Date Submitted</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(p => (
                <tr key={p.proposal_id} data-pid={p.proposal_id}>
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
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><p>No proposals are waiting for validation.</p></div>
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
            <FaArrowLeft className="ic" />Back to List
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
                      {checklist[req] === 'complete' ? <FaCheck /> : ''}
                    </div>
                    <span style={{
                      fontSize: '0.875rem',
                      color: checklist[req] === 'complete' ? '#276749' : '#2d3748',
                      fontWeight: checklist[req] === 'complete' ? 600 : 400,
                    }}>{req}</span>
                  </div>
                ))}

                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Remarks</label>
                  <textarea rows={3} value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Add remarks for this proposal..."
                    style={{ resize: 'vertical' }} />
                  <span style={{ fontSize: '0.78rem', color: '#8a7a7d' }}>
                    If you return this proposal, these remarks are sent to the researcher as the reason.
                  </span>
                </div>

                <ProposalSignatures proposal={selected} />
              </div>
            </div>

            {/* Right — Submission Info + Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="panel">
                <div className="panel-header"><h2>Proposal Details</h2></div>
                <div className="panel-body">
                  {[
                    { label: 'Researcher', value: `${selected.first_name} ${selected.last_name}` },
                    { label: 'Email',      value: selected.email },
                    { label: 'College',    value: selected.college || '—' },
                    { label: 'Department', value: selected.department || '—' },
                    { label: 'Proposal Type', value: PROPOSAL_TYPES[selected.proposal_type] },
                    { label: 'Date Submitted', value: selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString() : '—' },
                  ].map(item => (
                    <div key={item.label} style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>{item.label}</p>
                      <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, fontSize: '0.875rem' }}>{item.value}</p>
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>Research Title</p>
                    <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{selected.title}</p>
                  </div>
                  {selected.file_path && (
                    <a className="btn btn-outline btn-sm"
                      style={{ display: 'block', textAlign: 'center', marginTop: 14, textDecoration: 'none' }}
                      href={fileHref(selected.file_path)}
                      target="_blank" rel="noreferrer">
                      <FaFileLines className="ic" />View Document
                    </a>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header"><h2>Actions</h2></div>
                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SignConfirm key={selected.proposal_id} onReady={setSignReady} verb="validate and forward" disabled={saving} />
                  <button
                    className="btn btn-success"
                    onClick={handleForward}
                    disabled={saving || !allComplete || !signReady}
                    style={{ opacity: allComplete && signReady ? 1 : 0.5 }}>
                    {saving ? 'Forwarding...' : <><FaPaperPlane className="ic" />Validate and Forward</>}
                  </button>
                  {(!allComplete || !signReady) && (
                    <p style={{ fontSize: '0.75rem', color: '#718096', textAlign: 'center', margin: 0 }}>
                      {!allComplete ? 'Check all requirements' : 'Tick the box under your signature'} to enable forwarding.
                    </p>
                  )}
                  <button
                    className="btn btn-danger"
                    onClick={handleReturn}
                    disabled={saving}>
                    <FaRotateLeft className="ic" />Return to Researcher
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
        <h1>Validated Proposals</h1>
        <p>Proposals you validated and forwarded to the MSIRC Director.</p>
      </div>

      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Research Title</th>
              <th>Proposal Type</th>
              <th>Current Status</th>
              <th>Date Submitted</th>
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
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {forwarded.length === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No validated proposals yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
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
        <Route path="notifications" element={
          <OfficeNotifications queuePath="/special-assistant/validate"
            intro="New and resubmitted proposals waiting for you to validate, and reminders from the MSIRC Administrator." />} />
      </Routes>
    </Layout>
  );
};

export default SpecialAssistantDashboard;