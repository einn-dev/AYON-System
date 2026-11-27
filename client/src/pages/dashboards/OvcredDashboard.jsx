import React, { useState, useEffect, useCallback } from 'react';
import { OfficeExternalPage } from './ExternalShared';
import { Routes, Route, Navigate } from 'react-router-dom';
import NotFoundPanel from '../../components/NotFoundPanel';
import Layout from '../../components/Layout';
import { useLiveRefresh } from '../../utils/liveRefresh';
import ProposalStats from '../../components/ProposalStats';
import API    from '../../services/authService';
import '../../components/Layout.css';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useOpenHighlight, OpenNotice } from '../../components/OpenHighlight';
import ReturnReasonModal from '../../components/ReturnReasonModal';
import ProposalTracker from '../../components/ProposalTracker';
import { SignConfirm, ProposalSignatures } from '../../components/Signature';
import { ProposalFiles } from '../../components/ProposalFiles';
import RecordDetails from '../../components/RecordDetails';
import ReportsPage from './ReportsPage';
import { FaArrowLeft, FaBell, FaBoxArchive, FaChartColumn, FaCheck, FaCircleCheck, FaCircleXmark, FaClipboardList, FaGlobe, FaRotateLeft, FaTableCellsLarge, FaXmark } from '../../utils/icons';
import { statusLabel, statusBadge, TYPE_LABEL, wordFor } from '../../utils/terms';
import { personName } from '../../utils/names';
import StatCard from '../../components/StatCard';
import WelcomeBanner from '../../components/WelcomeBanner';
import MessageToast from '../../components/MessageToast';
import RepositoryBrowser from '../../components/RepositoryBrowser';
import { dateText } from '../../utils/dates';
import { usePaged } from '../../components/Pager';


const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/ovcred/dashboard',       label: 'Dashboard',           icon: <FaTableCellsLarge /> },
  { path: '/ovcred/for-endorsement', label: 'For Final Approval',  icon: <FaClipboardList />, section: 'Review' },
  { path: '/ovcred/approved',        label: 'Approved',  icon: <FaCircleCheck />, section: 'Review' },
  { path: '/ovcred/rejected',        label: 'Rejected',  icon: <FaCircleXmark />, section: 'Review' },
  { path: '/ovcred/external',   label: 'External Research', icon: <FaGlobe />, section: 'Library' },
  { path: '/ovcred/repository',      label: 'Research Repository', icon: <FaBoxArchive />, section: 'Library' },
  { path: '/ovcred/reports',         label: 'Reports',             icon: <FaChartColumn />, section: 'Monitoring' },
  { path: '/ovcred/notifications',   label: 'Notifications',       icon: <FaBell />, section: 'Account' },
];

/* ─────────── Overview ─────────── */
const Overview = ({ proposals }) => {
  const forApproval = proposals.filter(p => p.status === 'endorsed').length;
  const approved    = proposals.filter(p => p.status === 'approved').length;
  const rejected    = proposals.filter(p => p.status === 'rejected').length;
  const total       = proposals.length;

  return (
    <>
      <WelcomeBanner text="Office of the Vice Chancellor for Research, Extension and Development. Give the final approval to proposals and applications endorsed by the MSIRC Director." />

      <div className="stats-grid">
        <StatCard color="amber" label="For Final Approval" value={forApproval} to="/ovcred/for-endorsement" />
        <StatCard color="green" label="Approved" value={approved} to="/ovcred/approved" />
        <StatCard color="red" label="Rejected" value={rejected} to="/ovcred/rejected" />
        <StatCard color="blue" label="Total Received" value={total} />
      </div>

      {/* Endorsed proposals awaiting final approval */}
      <div className="panel">
        <div className="panel-header">
          <h2>Proposals Waiting for Final Approval</h2>
          <span className="badge badge-amber">{forApproval} pending</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Title</th>
              <th>Type</th>
              <th>Date Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {proposals
              .filter(p => p.status === 'endorsed')
              .slice(0, 6)
              .map(p => (
                <tr key={p.proposal_id}>
                  <td>
                    <strong>{personName(p)}</strong>
                    <div style={{ fontSize: '0.78rem', color: '#718096' }}>{p.college || '—'}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>{p.title}</td>
                  <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td style={{ color: '#718096' }}>
                    {p.submitted_at ? dateText(p.submitted_at) : '—'}
                  </td>
                  <td>
                    <span className={`badge ${statusBadge(p.status)}`}>
                      {statusLabel(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            {forApproval === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No proposals are waiting for final approval.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ProposalStats proposals={proposals} groupBy="college" externalFrom="/external" />
    </>
  );
};

/* ─────────── For Final Approval ─────────── */
const ForApproval = ({ proposals, onRefresh }) => {
  const [selected, setSelected] = useState(null);
  const [remarks,  setRemarks]  = useState('');
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [returning, setReturning] = useState(null);   // the proposal being returned to the researcher
  const [signReady, setSignReady] = useState(false);  // signature saved and the box ticked
  const endorsed = proposals.filter(p => p.status === 'endorsed');
  const pager = usePaged(endorsed);   // 10 rows a page, Previous / Next under the table
  /* opened from a notification: its approval screen when it waits for you, otherwise read-only */
  const [viewId, setViewId] = useState(null);
  const hl = useOpenHighlight(proposals.length > 0, {
    open: (id) => {
      const p = endorsed.find(x => String(x.proposal_id) === String(id));
      if (!p) return false;
      setSelected(p); setRemarks(''); setAlert(null);
      return true;
    },
    fallback: (id) => setViewId(Number(id)),
  });

  /* send it back to the researcher; after they resubmit it starts again from the college */
  const handleReturn = async (reason) => {
    const w = wordFor(returning);
    await API.patch(`/proposals/${returning.proposal_id}/status`, { status: 'returned', reason });
    try {
      await API.post(`/proposals/${returning.proposal_id}/review`, { decision: 'return', remarks: reason });
    } catch { /* the return itself went through; the review record is extra */ }
    setReturning(null);
    setSelected(null);
    setRemarks('');
    setAlert({ type: 'success', msg: `${w.P} returned to the researcher. After they resubmit, it starts again from the College Chairperson.` });
    onRefresh();
  };

  const handleDecision = async (decision) => {
    if (decision === 'rejected' && remarks.trim().length < 10) {
      return setAlert({ type: 'error', msg: 'Please write why it is rejected (at least 10 characters). The researcher will see it.' });
    }
    if (decision === 'approve' && !signReady) {
      return setAlert({ type: 'error', msg: 'Please tick the box to confirm your signature first.' });
    }
    setSaving(true);
    try {
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      /* final approval signs; rejecting never signs */
      await API.patch(`/proposals/${selected.proposal_id}/status`,
        decision === 'approve' ? { status: newStatus, attest: true } : { status: newStatus, reason: remarks.trim() });

      await API.post(`/proposals/${selected.proposal_id}/review`, {
        decision: decision === 'approve' ? 'approve' : 'reject',
        remarks:  remarks || `${wordFor(selected).P} ${newStatus} by VCRED.`,
      });

      setAlert({
        type: 'success',
        msg: `${wordFor(selected).P} ${newStatus === 'approved' ? 'signed and approved. It is now in the Research Repository as Private.' : 'rejected.'}`,
      });
      setSelected(null);
      setRemarks('');
      onRefresh();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The decision could not be saved. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <OpenNotice state={hl} where="your endorsement queue" />
      <RecordDetails proposalId={viewId} onClose={() => setViewId(null)} />
      <div className="page-header">
        <h1>For Final Approval</h1>
        <p>Review proposals and applications endorsed by the MSIRC Director and give the final VCRED decision.</p>
      </div>

      <MessageToast message={alert} onClose={() => setAlert(null)} />

      {!selected ? (
        <div className="panel">
          <div className="panel-header">
            <h2>Proposals for Final Approval</h2>
            <span className="badge badge-purple">{endorsed.length}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Researcher</th>
                <th>Title</th>
                <th>Type</th>
                <th>College</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map((p, i) => (
                <tr key={p.proposal_id} data-pid={p.proposal_id}>
                  <td style={{ color: '#a0aec0' }}>{pager.offset + i + 1}</td>
                  <td>
                    <strong>{personName(p)}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.department || '—'}</div>
                  </td>
                  <td style={{ maxWidth: 200 }}>{p.title}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <td>{p.college || '—'}</td>
                  <td>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => { setSelected(p); setRemarks(''); setAlert(null); }}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {endorsed.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <p>No endorsed proposals awaiting final approval.</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
          {pager.bar}
        </div>
      ) : (
        <div>
          <button className="btn btn-outline btn-sm"
            style={{ marginBottom: 16 }}
            onClick={() => { setSelected(null); setAlert(null); }}>
            <FaArrowLeft className="ic" />Back to List
          </button>

          <div className="detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 20, alignItems: 'start' }}>

            {/* Left — Proposal Details */}
            <div className="panel">
              <div className="panel-header">
                <h2>{wordFor(selected).P} Details</h2>
                <span className="badge badge-purple">Endorsed by MSIRC Director</span>
              </div>
              <div className="panel-body">
                <ProposalTracker proposal={selected} />
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: '0.72rem', color: '#718096',
                    textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                    Title
                  </p>
                  <p style={{ fontWeight: 700, color: '#1a3a5c',
                    fontSize: '1.05rem', lineHeight: 1.5, margin: 0 }}>
                    {selected.title}
                  </p>
                </div>

                {selected.description && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: '0.72rem', color: '#718096',
                      textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                      Abstract
                    </p>
                    <p style={{
                      color: '#2d3748', lineHeight: 1.7, margin: 0,
                      fontSize: '0.9rem', background: '#f8fafc',
                      padding: 14, borderRadius: 8, border: '1px solid #e8edf2',
                    }}>
                      {selected.description}
                    </p>
                  </div>
                )}

                <ProposalFiles proposal={selected} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '12px 28px', marginBottom: 20 }}>
                  {[
                    { label: 'Researcher',    value: personName(selected) },
                    { label: 'Email',         value: selected.email },
                    { label: 'College',       value: selected.college || '—' },
                    { label: 'Department',    value: selected.department || '—' },
                    { label: 'Type', value: PROPOSAL_TYPES[selected.proposal_type] },
                    { label: 'Date Submitted',value: selected.submitted_at
                      ? dateText(selected.submitted_at) : '—' },
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

                <ProposalSignatures proposal={selected} />
              </div>
            </div>

            {/* Right — VCRED Decision */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="panel">
                <div className="panel-header"><h2>VCRED Decision</h2></div>
                <div className="panel-body">
                  <div className="form-group">
                    <label>Remarks / Reason for Rejecting</label>
                    <textarea rows={4} value={remarks} maxLength={500}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Add your remarks. To reject, tell the researcher why."
                      style={{ resize: 'vertical' }} />
                    <p className="field-hint" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#718096', margin: '4px 0 0' }}>
                      <span>Required to reject, at least 10 characters. If you reject, the researcher sees this as the reason.</span>
                      <span>{remarks.trim().length}/500</span>
                    </p>
                  </div>


                  <SignConfirm key={selected.proposal_id} onReady={setSignReady} verb="grant final approval to" noun={wordFor(selected).p} disabled={saving} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button className="btn btn-success"
                      disabled={saving || !signReady}
                      onClick={() => handleDecision('approve')}>
                      {saving ? 'Processing…' : <><FaCheck className="ic" />Grant Final Approval</>}
                    </button>
                    <button className="btn btn-outline"
                      disabled={saving}
                      onClick={() => setReturning(selected)}>
                      <FaRotateLeft className="ic" />Return to Researcher
                    </button>
                    <button className="btn btn-danger"
                      disabled={saving}
                      onClick={() => handleDecision('rejected')}>
                      {saving ? 'Processing…' : <><FaXmark className="ic" />Reject</>}
                    </button>
                  </div>

                  <div style={{
                    marginTop: 12, padding: 12, background: '#f0fff4',
                    borderRadius: 8, border: '1px solid #9ae6b4',
                    fontSize: '0.78rem', color: '#276749',
                  }}>
                    <strong>Final approval</strong> places your signature on the {wordFor(selected).p} and notifies the researcher and the MSIRC Director.
                    {' '}It is then stored in the Research Repository automatically, as Private; the researcher decides whether to make it Public.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {returning && (
        <ReturnReasonModal
          title={returning.title}
          researcher={personName(returning)}
          onConfirm={handleReturn}
          onClose={() => setReturning(null)} />
      )}
    </>
  );
};

/* ─────────── Approved / Rejected (shared view) ─────────── */
const FilteredList = ({ proposals, statusFilter }) => {
  const [openId, setOpenId] = useState(null);         // the record opened in the read-only window
  const filtered = proposals.filter(p => p.status === statusFilter);
  const pager = usePaged(filtered);   // 10 rows a page, Previous / Next under the table
  const title    = statusFilter === 'approved' ? 'Approved' : 'Rejected';

  return (
    <>
      <div className="page-header">
        <h1>{title}</h1>
        <p>
          {statusFilter === 'approved'
            ? 'Research proposals and applications that received final VCRED approval.'
            : 'Proposals and applications that were rejected.'}
        </p>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2>{title}</h2>
          <span className={`badge ${statusFilter === 'approved' ? 'badge-green' : 'badge-red'}`}>
            {filtered.length}
          </span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Researcher</th>
              <th>Title</th>
              <th>Type</th>
              <th>College</th>
              <th>Date Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {pager.rows.map((p, i) => (
              <tr key={p.proposal_id}>
                <td style={{ color: '#a0aec0' }}>{pager.offset + i + 1}</td>
                <td>
                  <strong>{personName(p)}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.department || '—'}</div>
                </td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>{p.college || '—'}</td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? dateText(p.submitted_at) : '—'}
                </td>
                <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenId(p.proposal_id)}>View Details</button></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7}>
                <div className="empty-state"><p>Nothing found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
        {pager.bar}
      </div>
      <RecordDetails proposalId={openId} onClose={() => setOpenId(null)} />
    </>
  );
};

/* ─────────── Store to Repository ─────────── */
/* ─────────── Main VCRED Dashboard ─────────── */
const OvcredDashboard = () => {
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
  useLiveRefresh(fetchProposals);          // reloads by itself when something new happens

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="VCRED">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"
          element={<Overview proposals={proposals} />} />
        <Route path="for-endorsement"
          element={<ForApproval proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="approved"
          element={<FilteredList proposals={proposals} statusFilter="approved" />} />
        <Route path="rejected"
          element={<FilteredList proposals={proposals} statusFilter="rejected" />} />
        <Route path="repository"
          element={<RepositoryBrowser endpoint="/repository" />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="external" element={<OfficeExternalPage />} />
        <Route path="notifications"
          element={<OfficeNotifications queuePath="/ovcred/for-endorsement"
            intro="Proposals the MSIRC Director endorsed to you, and reminders from the MSIRC Administrator." />} />
        <Route path="*" element={<NotFoundPanel base="/ovcred" />} />
      </Routes>
    </Layout>
  );
};

export default OvcredDashboard;