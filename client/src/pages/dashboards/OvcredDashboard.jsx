import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useOpenHighlight, OpenNotice } from '../../components/OpenHighlight';
import ReturnReasonModal from '../../components/ReturnReasonModal';
import ProposalTracker from '../../components/ProposalTracker';
import { SignConfirm, ProposalSignatures } from '../../components/Signature';
import { FaArrowLeft, FaBell, FaBoxArchive, FaCheck, FaCircleCheck, FaCircleXmark, FaClipboardList, FaFileLines, FaRotateLeft, FaTableCellsLarge, FaXmark } from 'react-icons/fa6';
import { statusLabel, statusBadge, TYPE_LABEL } from '../../utils/terms';

/* Files are stored as full web addresses; older records may hold a server path */
const fileHref = (fp) => (/^https?:\/\//i.test(fp) ? fp : `http://localhost:5000/${fp}`);

const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/ovcred/dashboard',       label: 'Dashboard',           icon: <FaTableCellsLarge /> },
  { path: '/ovcred/for-endorsement', label: 'For Final Approval',  icon: <FaClipboardList /> },
  { path: '/ovcred/approved',        label: 'Approved Proposals',  icon: <FaCircleCheck /> },
  { path: '/ovcred/rejected',        label: 'Rejected Proposals',  icon: <FaCircleXmark /> },
  { path: '/ovcred/repository',      label: 'Research Repository', icon: <FaBoxArchive /> },
  { path: '/ovcred/notifications',   label: 'Notifications',       icon: <FaBell /> },
];

/* ─────────── Overview ─────────── */
const Overview = ({ proposals }) => {
  const forApproval = proposals.filter(p => p.status === 'endorsed').length;
  const approved    = proposals.filter(p => p.status === 'approved').length;
  const rejected    = proposals.filter(p => p.status === 'rejected').length;
  const total       = proposals.length;

  return (
    <>
      <div className="page-header">
        <h1>OVCRED Dashboard</h1>
        <p>Office of the Vice Chancellor for Research, Extension, and Development.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card amber">
          <span className="stat-label">For Final Approval</span>
          <span className="stat-value">{forApproval}</span>
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
          <span className="stat-label">Total Received</span>
          <span className="stat-value">{total}</span>
        </div>
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
              <th>Research Title</th>
              <th>Proposal Type</th>
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

      {/* Approval rate summary */}
      {total > 0 && (
        <div className="panel">
          <div className="panel-header"><h2>Approval Summary</h2></div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12 }}>
              {[
                { label: 'Approval Rate',  value: `${Math.round((approved / total) * 100)}%`, color: '#276749' },
                { label: 'Rejection Rate', value: `${Math.round((rejected / total) * 100)}%`, color: '#c53030' },
                { label: 'Pending Rate',   value: `${Math.round((forApproval / total) * 100)}%`, color: '#b7791f' },
              ].map(s => (
                <div key={s.label} style={{
                  background: '#f8fafc', borderRadius: 10,
                  padding: '16px', border: '1px solid #e8edf2', textAlign: 'center',
                }}>
                  <p style={{ fontSize: '2rem', fontWeight: 700, color: s.color, margin: '0 0 4px' }}>{s.value}</p>
                  <p style={{ fontSize: '0.78rem', color: '#718096', margin: 0,
                    textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────── For Final Approval ─────────── */
const ForApproval = ({ proposals, onRefresh }) => {
  const [selected, setSelected] = useState(null);
  const [remarks,  setRemarks]  = useState('');
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [storeToRepo, setStoreToRepo] = useState(true);
  const [returning, setReturning] = useState(null);   // the proposal being returned to the researcher
  const [signReady, setSignReady] = useState(false);  // signature saved and the box ticked
  const hl = useOpenHighlight(proposals.length > 0);

  const endorsed = proposals.filter(p => p.status === 'endorsed');

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

  const handleDecision = async (decision) => {
    if (decision === 'rejected' && !remarks.trim()) {
      return setAlert({ type: 'error', msg: 'Please provide remarks before rejecting.' });
    }
    if (decision === 'approve' && !signReady) {
      return setAlert({ type: 'error', msg: 'Please tick the box to confirm your signature first.' });
    }
    setSaving(true);
    try {
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      /* final approval signs; rejecting never signs */
      await API.patch(`/proposals/${selected.proposal_id}/status`,
        decision === 'approve' ? { status: newStatus, attest: true } : { status: newStatus });

      await API.post(`/proposals/${selected.proposal_id}/review`, {
        decision: decision === 'approve' ? 'approve' : 'reject',
        remarks:  remarks || `Proposal ${newStatus} by OVCRED.`,
      });

      if (decision === 'approve' && storeToRepo) {
        await API.post('/repository', {
          proposal_id: selected.proposal_id,
          title:       selected.title,
          abstract:    selected.description || '',
          author:      `${selected.first_name} ${selected.last_name}`,
          college:     selected.college || '',
          department:  selected.department || '',
          file_path:   selected.file_path || '',
          access_type: 'private',
          source_type: 'proposal',
        });
      }

      setAlert({
        type: 'success',
        msg: `Proposal ${newStatus === 'approved' ? 'signed and approved' : 'rejected'}.${decision === 'approve' && storeToRepo ? ' It was stored in the Research Repository.' : ''}`,
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
      <div className="page-header">
        <h1>For Final Approval</h1>
        <p>Review proposals endorsed by the MSIRC Director and give the final OVCRED decision.</p>
      </div>

      {alert && !selected && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

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
                <th>Research Title</th>
                <th>Proposal Type</th>
                <th>College</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {endorsed.map((p, i) => (
                <tr key={p.proposal_id} data-pid={p.proposal_id}>
                  <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                  <td>
                    <strong>{p.first_name} {p.last_name}</strong>
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
        </div>
      ) : (
        <div>
          <button className="btn btn-outline btn-sm"
            style={{ marginBottom: 16 }}
            onClick={() => { setSelected(null); setAlert(null); }}>
            <FaArrowLeft className="ic" />Back to List
          </button>

          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

            {/* Left — Proposal Details */}
            <div className="panel">
              <div className="panel-header">
                <h2>Proposal Details</h2>
                <span className="badge badge-purple">Endorsed by Director</span>
              </div>
              <div className="panel-body">
                <ProposalTracker proposal={selected} />
                <ProposalSignatures proposal={selected} />
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

                {selected.file_path && (
                  <a className="btn btn-outline"
                    style={{ display: 'inline-block', textDecoration: 'none' }}
                    href={fileHref(selected.file_path)}
                    target="_blank" rel="noreferrer">
                    <FaFileLines className="ic" />View Document
                  </a>
                )}
              </div>
            </div>

            {/* Right — OVCRED Decision */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="panel">
                <div className="panel-header"><h2>OVCRED Decision</h2></div>
                <div className="panel-body">
                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea rows={4} value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Add your remarks..."
                      style={{ resize: 'vertical' }} />
                  </div>

                  {/* Store to repository toggle */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px', background: '#f8fafc',
                    borderRadius: 8, border: '1px solid #e8edf2',
                    marginBottom: 14, cursor: 'pointer',
                  }} onClick={() => setStoreToRepo(!storeToRepo)}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${storeToRepo ? '#276749' : '#d1d9e0'}`,
                      background: storeToRepo ? '#276749' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                    }}>
                      {storeToRepo ? <FaCheck /> : ''}
                    </div>
                    <div>
                      <p style={{ fontWeight: 600, color: '#1a3a5c',
                        margin: '0 0 2px', fontSize: '0.85rem' }}>
                        Store to Repository
                      </p>
                      <p style={{ color: '#718096', margin: 0, fontSize: '0.75rem' }}>
                        Automatically archive this research upon approval
                      </p>
                    </div>
                  </div>

                  <SignConfirm key={selected.proposal_id} onReady={setSignReady} verb="grant final approval to" disabled={saving} />

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button className="btn btn-success"
                      disabled={saving || !signReady}
                      onClick={() => handleDecision('approve')}>
                      {saving ? 'Processing...' : <><FaCheck className="ic" />Grant Final Approval</>}
                    </button>
                    <button className="btn btn-outline"
                      disabled={saving}
                      onClick={() => setReturning(selected)}>
                      <FaRotateLeft className="ic" />Return to Researcher
                    </button>
                    <button className="btn btn-danger"
                      disabled={saving}
                      onClick={() => handleDecision('rejected')}>
                      {saving ? 'Processing...' : <><FaXmark className="ic" />Reject</>}
                    </button>
                  </div>

                  <div style={{
                    marginTop: 12, padding: 12, background: '#f0fff4',
                    borderRadius: 8, border: '1px solid #9ae6b4',
                    fontSize: '0.78rem', color: '#276749',
                  }}>
                    <strong>Final approval</strong> places your signature on the proposal and notifies the researcher and the MSIRC Director.
                    If "Store to Repository" is checked, the research will be archived automatically.
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
          researcher={`${returning.first_name || ''} ${returning.last_name || ''}`.trim()}
          onConfirm={handleReturn}
          onClose={() => setReturning(null)} />
      )}
    </>
  );
};

/* ─────────── Approved / Rejected (shared view) ─────────── */
const FilteredList = ({ proposals, statusFilter }) => {
  const filtered = proposals.filter(p => p.status === statusFilter);
  const title    = statusFilter === 'approved' ? 'Approved Proposals' : 'Rejected Proposals';

  return (
    <>
      <div className="page-header">
        <h1>{title}</h1>
        <p>
          {statusFilter === 'approved'
            ? 'Research proposals that received final OVCRED approval.'
            : 'Proposals that were rejected by OVCRED.'}
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
              <th>Research Title</th>
              <th>Proposal Type</th>
              <th>College</th>
              <th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.proposal_id}>
                <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                <td>
                  <strong>{p.first_name} {p.last_name}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.department || '—'}</div>
                </td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>{p.college || '—'}</td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
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
    </>
  );
};

/* ─────────── Store to Repository ─────────── */
const StoreToRepository = ({ proposals }) => {
  const [form,    setForm]    = useState({
    title: '', abstract: '', author: '', college: '',
    department: '', keywords: '', access_type: 'private',
    source_type: 'proposal', proposal_id: '',
  });
  const [alert,   setAlert]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [repoList, setRepoList] = useState([]);
  const [tab,     setTab]     = useState('store');

  const approved = proposals.filter(p => p.status === 'approved');

  useEffect(() => {
    const fetchRepo = async () => {
      try {
        const res = await API.get('/repository');
        setRepoList(res.data.items || []);
      } catch { setRepoList([]); }
    };
    fetchRepo();
  }, [tab]);

  const prefill = (proposal) => {
    setForm({
      title:       proposal.title,
      abstract:    proposal.description || '',
      author:      `${proposal.first_name} ${proposal.last_name}`,
      college:     proposal.college || '',
      department:  proposal.department || '',
      keywords:    '',
      access_type: 'private',
      source_type: 'proposal',
      proposal_id: proposal.proposal_id,
      file_path:   proposal.file_path || '',
    });
    setTab('store');
  };

  const handleStore = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Research title is required.' });
    setSaving(true);
    try {
      await API.post('/repository', form);
      setAlert({ type: 'success', msg: 'Research stored in the Research Repository.' });
      setForm({ title:'',abstract:'',author:'',college:'',department:'',
        keywords:'',access_type:'private',source_type:'proposal',proposal_id:'' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The research could not be stored. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Research Repository</h1>
        <p>Archive approved research outputs in the MSIRC digital repository.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '2px solid #e8edf2' }}>
        {[
          { key: 'store',  label: 'Store Research' },
          { key: 'list',   label: 'Repository Items' },
          { key: 'select', label: 'From Approved Proposals' },
        ].map(t => (
          <button key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#1a3a5c' : '#718096',
              borderBottom: tab === t.key ? '2px solid #1a3a5c' : '2px solid transparent',
              marginBottom: -2, fontSize: '0.9rem',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Store Form */}
      {tab === 'store' && (
        <div className="panel" style={{ maxWidth: 620 }}>
          <div className="panel-header"><h2>Add to Repository</h2></div>
          <div className="panel-body">
            <form onSubmit={handleStore}>
              <div className="form-group">
                <label>Research Title</label>
                <input value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter research title" required />
              </div>
              <div className="form-group">
                <label>Abstract</label>
                <textarea rows={4} value={form.abstract}
                  onChange={e => setForm({ ...form, abstract: e.target.value })}
                  placeholder="Enter abstract or description..."
                  style={{ resize: 'vertical' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Author</label>
                  <input value={form.author}
                    onChange={e => setForm({ ...form, author: e.target.value })}
                    placeholder="Full name of researcher" />
                </div>
                <div className="form-group">
                  <label>College</label>
                  <input value={form.college}
                    onChange={e => setForm({ ...form, college: e.target.value })}
                    placeholder="e.g. CICS" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    placeholder="e.g. IT Department" />
                </div>
                <div className="form-group">
                  <label>Keywords</label>
                  <input value={form.keywords}
                    onChange={e => setForm({ ...form, keywords: e.target.value })}
                    placeholder="e.g. AI, Machine Learning" />
                </div>
              </div>
              <div className="form-group">
                <label>Access Type</label>
                <select value={form.access_type}
                  onChange={e => setForm({ ...form, access_type: e.target.value })}>
                  <option value="private">Private (logged-in users only)</option>
                  <option value="public">Public (anyone can search)</option>
                </select>
              </div>
              <button type="submit" className="btn btn-success" disabled={saving}>
                {saving ? 'Storing...' : <><FaBoxArchive className="ic" />Store to Repository</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Repository List */}
      {tab === 'list' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Repository Items</h2>
            <span className="badge badge-blue">{repoList.length} total</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Research Title</th>
                <th>Author</th>
                <th>College</th>
                <th>Access</th>
                <th>Date Stored</th>
              </tr>
            </thead>
            <tbody>
              {repoList.map(r => (
                <tr key={r.repo_id}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.author || '—'}</td>
                  <td>{r.college || '—'}</td>
                  <td>
                    <span className={`badge ${r.access_type === 'public' ? 'badge-green' : 'badge-amber'}`}>
                      {r.access_type === 'public' ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td style={{ color: '#718096' }}>
                    {r.store_date ? new Date(r.store_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {repoList.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><p>The repository is empty.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Select from approved proposals */}
      {tab === 'select' && (
        <div className="panel">
          <div className="panel-header">
            <h2>Approved Proposals</h2>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096' }}>
              Click "Pre-fill" to auto-fill the store form
            </p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Research Title</th>
                <th>Researcher</th>
                <th>Proposal Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {approved.map(p => (
                <tr key={p.proposal_id}>
                  <td>{p.title}</td>
                  <td>{p.first_name} {p.last_name}</td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type]}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm"
                      onClick={() => prefill(p)}>
                      Pre-fill Form
                    </button>
                  </td>
                </tr>
              ))}
              {approved.length === 0 && (
                <tr><td colSpan={4}>
                  <div className="empty-state"><p>No approved proposals available.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

/* ─────────── Main OVCRED Dashboard ─────────── */
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="OVCRED">
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
          element={<StoreToRepository proposals={proposals} />} />
        <Route path="notifications"
          element={<OfficeNotifications queuePath="/ovcred/for-endorsement"
            intro="Proposals the MSIRC Director endorsed to you, and reminders from the MSIRC Administrator." />} />
      </Routes>
    </Layout>
  );
};

export default OvcredDashboard;