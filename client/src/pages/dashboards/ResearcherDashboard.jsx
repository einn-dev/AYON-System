import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout.css';
import GrantsPage from './GrantsPage';
import ExternalResearchPage from './ExternalResearchPage';

const NAV_ITEMS = [
  { path: '/researcher/dashboard',   label: 'Dashboard',         icon: '⊞' },
  { path: '/researcher/proposals',   label: 'My Proposals',      icon: '📄' },
  { path: '/researcher/submit',      label: 'Submit Proposal',   icon: '✚' },
  { path: '/researcher/grants',      label: 'Grant & Incentives',icon: '🎓' },
  { path: '/researcher/repository',  label: 'Repository',        icon: '🗄' },
  { path: '/researcher/profile',     label: 'My Profile',        icon: '👤' },
  { path: '/researcher/external',    label: 'External Research', icon: '🌐' },
  
];

const PROPOSAL_TYPES = [
  { value: 'research_spotlight',    label: 'Research Spotlight' },
  { value: 'internally_funded',     label: 'Internally Funded Research' },
  { value: 'publication_incentive', label: 'Publication Incentive' },
  { value: 'travel_oral',           label: 'Travel Subsidy / Oral Presentation' },
  { value: 'externally_funded',     label: 'Externally Funded Research' },
];

const STATUS_BADGE = {
  draft:        'badge-gray',
  submitted:    'badge-blue',
  under_review: 'badge-amber',
  returned:     'badge-red',
  endorsed:     'badge-purple',
  approved:     'badge-green',
  rejected:     'badge-red',
};

const statusLabel = (s) => s?.replace(/_/g, ' ');

/* ─────────── Overview ─────────── */
const Overview = ({ proposals, user }) => {
  const counts = {
    total:       proposals.length,
    submitted:   proposals.filter(p => p.status === 'submitted').length,
    approved:    proposals.filter(p => p.status === 'approved').length,
    under_review:proposals.filter(p => p.status === 'under_review').length,
  };

  return (
    <>
      <div className="page-header">
        <h1>Welcome, {user?.first_name}! 👋</h1>
        <p>Here's an overview of your research activities in AYON.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Proposals</span>
          <span className="stat-value">{counts.total}</span>
        </div>
        <div className="stat-card blue">
          <span className="stat-label">Submitted</span>
          <span className="stat-value">{counts.submitted}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Under Review</span>
          <span className="stat-value">{counts.under_review}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Approved</span>
          <span className="stat-value">{counts.approved}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Recent Proposals</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {proposals.slice(0, 5).map(p => (
              <tr key={p.proposal_id}>
                <td><strong>{p.title}</strong></td>
                <td style={{ color: '#718096' }}>
                  {PROPOSAL_TYPES.find(t => t.value === p.proposal_type)?.label || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at
                    ? new Date(p.submitted_at).toLocaleDateString()
                    : '—'}
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty-state">
                  <p>No proposals yet. Click "Submit Proposal" to get started.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Guide */}
      <div className="panel">
        <div className="panel-header"><h2>How to Submit a Proposal</h2></div>
        <div className="panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { step: '1', title: 'Fill the Form',    desc: 'Go to Submit Proposal and fill in all required fields.' },
              { step: '2', title: 'Upload Documents', desc: 'Attach your proposal file and required documents.' },
              { step: '3', title: 'Track Status',     desc: 'Monitor your proposal status in My Proposals.' },
              { step: '4', title: 'Get Notified',     desc: 'Receive in-app notifications on every status update.' },
            ].map(s => (
              <div key={s.step} style={{
                background: '#f8fafc', borderRadius: 10,
                padding: '16px', border: '1px solid #e8edf2'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#1a3a5c', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem', marginBottom: 10
                }}>{s.step}</div>
                <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 4px', fontSize: '0.9rem' }}>{s.title}</p>
                <p style={{ color: '#718096', margin: 0, fontSize: '0.82rem', lineHeight: 1.5 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

/* ─────────── My Proposals ─────────── */
const MyProposals = ({ proposals, onRefresh }) => {
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = proposals.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <>
      <div className="page-header">
        <h1>My Proposals</h1>
        <p>Track the status of all your submitted proposals.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search proposals..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 160 }}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
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
                <td><strong>{p.title}</strong></td>
                <td style={{ color: '#718096', fontSize: '0.82rem' }}>
                  {PROPOSAL_TYPES.find(t => t.value === p.proposal_type)?.label || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => setSelected(p)}>
                    View Details
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

      {/* Proposal Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3>{selected.title}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 16 }}>
              {[
                { label: 'Type',        value: PROPOSAL_TYPES.find(t => t.value === selected.proposal_type)?.label },
                { label: 'Status',      value: statusLabel(selected.status) },
                { label: 'Submitted',   value: selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString() : 'Not yet submitted' },
                { label: 'Proposal ID', value: `#${selected.proposal_id}` },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>
            {selected.description && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Description</p>
                <p style={{ color: '#2d3748', lineHeight: 1.6, margin: 0, fontSize: '0.9rem' }}>{selected.description}</p>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge ${STATUS_BADGE[selected.status] || 'badge-gray'}`} style={{ fontSize: '0.85rem', padding: '5px 14px' }}>
                {statusLabel(selected.status)}
              </span>
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

/* ─────────── Submit Proposal ─────────── */
const SubmitProposal = ({ onRefresh }) => {
  const [step,    setStep]    = useState(1);
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [form,    setForm]    = useState({
    proposal_type: '',
    title:         '',
    description:   '',
  });
  const [file, setFile] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.proposal_type) return setAlert({ type: 'error', msg: 'Please select a proposal type.' });
    if (!form.title.trim())  return setAlert({ type: 'error', msg: 'Please enter a title.' });

    setLoading(true);
    try {
      const data = new FormData();
      data.append('proposal_type', form.proposal_type);
      data.append('title',         form.title);
      data.append('description',   form.description);
      if (file) data.append('file', file);

      await API.post('/proposals', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setAlert({ type: 'success', msg: 'Proposal submitted successfully!' });
      setForm({ proposal_type: '', title: '', description: '' });
      setFile(null);
      setStep(1);
      onRefresh();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Submission failed.' });
    } finally {
      setLoading(false);
    }
  };

  const steps = ['Proposal Type', 'Details', 'Upload & Submit'];

  return (
    <>
      <div className="page-header">
        <h1>Submit Proposal</h1>
        <p>Fill in the form below to submit your research proposal to MSIRC.</p>
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: step > i + 1 ? '#276749' : step === i + 1 ? '#1a3a5c' : '#e8edf2',
                color: step >= i + 1 ? '#fff' : '#a0aec0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.82rem', flexShrink: 0,
                transition: 'background 0.2s'
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize: '0.82rem', fontWeight: step === i + 1 ? 600 : 400,
                color: step === i + 1 ? '#1a3a5c' : '#a0aec0'
              }}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: step > i + 1 ? '#276749' : '#e8edf2', margin: '0 12px', transition: 'background 0.2s' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="panel">
        <div className="panel-body">
          <form onSubmit={handleSubmit}>

            {/* Step 1 — Proposal Type */}
            {step === 1 && (
              <>
                <p style={{ fontWeight: 600, color: '#1a3a5c', marginBottom: 16 }}>
                  Select the type of proposal you want to submit:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {PROPOSAL_TYPES.map(t => (
                    <div key={t.value}
                      onClick={() => { setForm({ ...form, proposal_type: t.value }); setAlert(null); }}
                      style={{
                        border: `2px solid ${form.proposal_type === t.value ? '#1a3a5c' : '#e8edf2'}`,
                        borderRadius: 10, padding: '16px',
                        cursor: 'pointer', transition: 'border-color 0.2s',
                        background: form.proposal_type === t.value ? '#f0f6ff' : '#fff',
                      }}>
                      <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 4px', fontSize: '0.9rem' }}>{t.label}</p>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-primary"
                    onClick={() => { if (!form.proposal_type) return setAlert({ type: 'error', msg: 'Please select a type.' }); setAlert(null); setStep(2); }}>
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* Step 2 — Details */}
            {step === 2 && (
              <>
                <div className="form-group">
                  <label>Proposal Title</label>
                  <input name="title" value={form.title} onChange={handleChange}
                    placeholder="Enter your research title" required />
                </div>
                <div className="form-group">
                  <label>Description / Abstract</label>
                  <textarea name="description" value={form.description} onChange={handleChange}
                    rows={5} placeholder="Briefly describe your research proposal..."
                    style={{ resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
                  <button type="button" className="btn btn-primary"
                    onClick={() => { if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Title is required.' }); setAlert(null); setStep(3); }}>
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* Step 3 — Upload & Submit */}
            {step === 3 && (
              <>
                <div className="form-group">
                  <label>Attach Proposal File (PDF)</label>
                  <input type="file" accept=".pdf,.doc,.docx"
                    onChange={e => setFile(e.target.files[0])}
                    style={{ background: '#fff', padding: '8px' }} />
                  <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>
                    Accepted formats: PDF, DOC, DOCX
                  </span>
                </div>

                {/* Review Summary */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e8edf2', marginBottom: 20 }}>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 10px' }}>Review your submission:</p>
                  {[
                    { label: 'Type',  value: PROPOSAL_TYPES.find(t => t.value === form.proposal_type)?.label },
                    { label: 'Title', value: form.title },
                    { label: 'File',  value: file ? file.name : 'No file attached' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.8rem', color: '#718096', minWidth: 50 }}>{item.label}:</span>
                      <span style={{ fontSize: '0.87rem', color: '#2d3748', fontWeight: 500 }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setStep(2)}>← Back</button>
                  <button type="submit" className="btn btn-success" disabled={loading}>
                    {loading ? 'Submitting...' : '✓ Submit Proposal'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
};

/* ─────────── Grant & Incentives ─────────── */
const Grants = ({ proposals }) => {
  const eligible = proposals.filter(p => p.status === 'approved');

  return (
    <>
      <div className="page-header">
        <h1>Grant &amp; Incentives</h1>
        <p>Apply for grants and incentives for your approved research.</p>
      </div>

      {eligible.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              <p style={{ fontSize: '1rem' }}>No approved proposals yet.</p>
              <p>You can apply for grants once your proposal has been approved by MSIRC.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header"><h2>Approved Proposals — Eligible for Grants</h2></div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Approved On</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {eligible.map(p => (
                <tr key={p.proposal_id}>
                  <td><strong>{p.title}</strong></td>
                  <td>
                    {PROPOSAL_TYPES.find(t => t.value === p.proposal_type)?.label}
                  </td>
                  <td>{p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="btn btn-primary btn-sm">Apply for Grant</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

/* ─────────── Repository ─────────── */
const Repository = () => {
  const [items,   setItems]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepo = async () => {
      try {
        const res = await API.get('/repository?access=public');
        setItems(res.data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRepo();
  }, []);

  const filtered = items.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>Research Repository</h1>
        <p>Browse and search completed and approved research outputs.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <input className="search-input" placeholder="Search by title or author..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading repository...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No research outputs found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>College</th>
                <th>Access</th>
                <th>Date Stored</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.repo_id}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.author || '—'}</td>
                  <td>{r.college || '—'}</td>
                  <td>
                    <span className={`badge ${r.access_type === 'public' ? 'badge-green' : 'badge-amber'}`}>
                      {r.access_type}
                    </span>
                  </td>
                  <td>{r.store_date ? new Date(r.store_date).toLocaleDateString() : '—'}</td>
                  <td>
                    {r.file_path ? (
                      <a href={`http://localhost:5000/${r.file_path}`}
                        target="_blank" rel="noreferrer"
                        className="btn btn-outline btn-sm">
                        View
                      </a>
                    ) : <span style={{ color: '#a0aec0', fontSize: '0.82rem' }}>No file</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

/* ─────────── Profile ─────────── */
const Profile = ({ user }) => {
  const [form,    setForm]    = useState({ ...user, password: '', confirm_password: '' });
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirm_password) {
      return setAlert({ type: 'error', msg: 'Passwords do not match.' });
    }
    setLoading(true);
    try {
      await API.patch('/auth/profile', form);
      setAlert({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Update failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Update your personal information and password.</p>
      </div>
      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-body">
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input value={form.first_name || ''}
                  onChange={e => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input value={form.last_name || ''}
                  onChange={e => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Email</label>
              <input value={form.email || ''} disabled
                style={{ background: '#f0f4f8', color: '#a0aec0' }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Department</label>
                <input value={form.department || ''}
                  onChange={e => setForm({ ...form, department: e.target.value })} />
              </div>
              <div className="form-group">
                <label>College</label>
                <input value={form.college || ''}
                  onChange={e => setForm({ ...form, college: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input value={form.contact_number || ''}
                onChange={e => setForm({ ...form, contact_number: e.target.value })} />
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e8edf2', margin: '16px 0' }} />
            <p style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.85rem', marginBottom: 12 }}>
              Change Password (leave blank to keep current)
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>New Password</label>
                <input type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 8 characters" />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input type="password" value={form.confirm_password}
                  onChange={e => setForm({ ...form, confirm_password: e.target.value })}
                  placeholder="Repeat password" />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

/* ─────────── Main Researcher Dashboard ─────────── */
const ResearcherDashboard = () => {
  const { user }              = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await API.get('/proposals/my');
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
    <Layout navItems={NAV_ITEMS} role="Researcher">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"  element={<Overview proposals={proposals} user={user} />} />
        <Route path="proposals"  element={<MyProposals proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="submit"     element={<SubmitProposal onRefresh={fetchProposals} />} />
        <Route path="grants"     element={<GrantsPage proposals={proposals} />} />
        <Route path="external"   element={<ExternalResearchPage />} />
        <Route path="repository" element={<Repository />} />
        <Route path="profile"    element={<Profile user={user} />} />
      </Routes>
    </Layout>
  );
};

export default ResearcherDashboard;