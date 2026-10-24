import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import GrantReviewPage from './GrantReviewPage';

const NAV_ITEMS = [
  { path: '/ovcred/dashboard',       label: 'Dashboard',          icon: '⊞' },
  { path: '/ovcred/for-endorsement', label: 'For Final Approval',  icon: '📋' },
  { path: '/ovcred/approved',        label: 'Final Approved',      icon: '✅' },
  { path: '/ovcred/rejected',        label: 'Rejected',            icon: '✗'  },
  { path: '/ovcred/repository',      label: 'Store to Repository', icon: '🗄' },
  { path: '/ovcred/grants',          label: 'Grant Applications',  icon: '🎓' },
  { path: '/ovcred/notifications',   label: 'Notifications',       icon: '🔔' },
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
          <span className="stat-label">Finally Approved</span>
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
          <h2>Endorsed Proposals Awaiting Final Approval</h2>
          <span className="badge badge-amber">{forApproval} pending</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Title</th>
              <th>Type</th>
              <th>Endorsed Date</th>
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
                    <span className={`badge ${STATUS_BADGE[p.status]}`}>
                      {p.status?.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            {forApproval === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No proposals awaiting final approval.</p></div>
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

  const endorsed = proposals.filter(p => p.status === 'endorsed');

  const handleDecision = async (decision) => {
    if (decision === 'rejected' && !remarks.trim()) {
      return setAlert({ type: 'error', msg: 'Please provide remarks before rejecting.' });
    }
    setSaving(true);
    try {
      const newStatus = decision === 'approve' ? 'approved' : 'rejected';
      await API.patch(`/proposals/${selected.proposal_id}/status`, { status: newStatus });

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
        msg: `Proposal ${newStatus} successfully!${decision === 'approve' && storeToRepo ? ' Stored to repository.' : ''}`,
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
      <div className="page-header">
        <h1>For Final Approval</h1>
        <p>Review proposals endorsed by the MSRIC Director and give final OVCRED approval.</p>
      </div>

      {alert && !selected && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      {!selected ? (
        <div className="panel">
          <div className="panel-header">
            <h2>Endorsed Proposals</h2>
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
              {endorsed.map((p, i) => (
                <tr key={p.proposal_id}>
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
            ← Back to list
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
                      Abstract / Description
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
                    href={`http://localhost:5000/${selected.file_path}`}
                    target="_blank" rel="noreferrer">
                    📄 View Attached Document
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
                    <label>Remarks / Comments</label>
                    <textarea rows={4} value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Add your official remarks..."
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
                      {storeToRepo ? '✓' : ''}
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button className="btn btn-success"
                      disabled={saving}
                      onClick={() => handleDecision('approve')}>
                      {saving ? 'Processing...' : '✓ Grant Final Approval'}
                    </button>
                    <button className="btn btn-danger"
                      disabled={saving}
                      onClick={() => handleDecision('rejected')}>
                      {saving ? 'Processing...' : '✗ Reject Endorsement'}
                    </button>
                  </div>

                  <div style={{
                    marginTop: 12, padding: 12, background: '#f0fff4',
                    borderRadius: 8, border: '1px solid #9ae6b4',
                    fontSize: '0.78rem', color: '#276749',
                  }}>
                    <strong>Final approval</strong> will notify the researcher and MSRIC Director.
                    If "Store to Repository" is checked, the research will be archived automatically.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────── Approved / Rejected (shared view) ─────────── */
const FilteredList = ({ proposals, statusFilter }) => {
  const filtered = proposals.filter(p => p.status === statusFilter);
  const title    = statusFilter === 'approved' ? 'Finally Approved' : 'Rejected Proposals';

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
              <th>Title</th>
              <th>Type</th>
              <th>College</th>
              <th>Date</th>
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
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Title is required.' });
    setSaving(true);
    try {
      await API.post('/repository', form);
      setAlert({ type: 'success', msg: 'Research stored in repository successfully!' });
      setForm({ title:'',abstract:'',author:'',college:'',department:'',
        keywords:'',access_type:'private',source_type:'proposal',proposal_id:'' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Failed to store.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Store to Repository</h1>
        <p>Archive approved research outputs in the MSIRC digital repository.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '2px solid #e8edf2' }}>
        {[
          { key: 'store',  label: 'Store Research' },
          { key: 'list',   label: 'View Repository' },
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
                {saving ? 'Storing...' : '🗄 Store to Repository'}
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
                <th>Title</th>
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
                      {r.access_type}
                    </span>
                  </td>
                  <td style={{ color: '#718096' }}>
                    {r.store_date ? new Date(r.store_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {repoList.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><p>Repository is empty.</p></div>
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
                <th>Title</th>
                <th>Researcher</th>
                <th>Type</th>
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

/* ─────────── Notifications ─────────── */
const Notifications = () => {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await API.get('/notifications');
        setNotifs(res.data.notifications || []);
      } catch { setNotifs([]); }
      finally  { setLoading(false); }
    };
    fetch();
  }, []);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.notif_id === id ? { ...n, is_read: 1 } : n));
    } catch {}
  };

  return (
    <>
      <div className="page-header">
        <h1>Notifications</h1>
        <p>Stay updated on endorsed proposals and system alerts.</p>
      </div>
      <div className="panel">
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : notifs.length === 0 ? (
          <div className="empty-state"><p>No notifications yet.</p></div>
        ) : notifs.map(n => (
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
        <Route path="grants" 
          element={<GrantReviewPage />} />
        <Route path="notifications"
          element={<Notifications />} />
      </Routes>
    </Layout>
  );
};

export default OvcredDashboard;