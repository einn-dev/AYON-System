import React, { useState, useEffect } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';

const GRANT_TYPES = [
  { value: 'research_spotlight',    label: 'Research Spotlight' },
  { value: 'internally_funded',     label: 'Internally Funded Research' },
  { value: 'publication_incentive', label: 'Publication Incentive' },
  { value: 'travel_oral',           label: 'Travel Subsidy / Oral Presentation' },
];

const GRANT_BADGE = {
  pending:  'badge-amber',
  approved: 'badge-green',
  rejected: 'badge-red',
};

const GrantsPage = ({ proposals }) => {
  const eligible = proposals.filter(p => p.status === 'approved');

  const [myGrants,  setMyGrants]  = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [alert,     setAlert]     = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({
    proposal_id: '', grant_type: '', details: {},
  });

  const fetchGrants = async () => {
    try {
      const res = await API.get('/grants/my');
      setMyGrants(res.data.grants || []);
    } catch { setMyGrants([]); }
  };

  useEffect(() => { fetchGrants(); }, []);

  const setDetail = (key, value) =>
    setForm(f => ({ ...f, details: { ...f.details, [key]: value } }));

  const openApply = (proposal) => {
    setForm({ proposal_id: proposal.proposal_id, grant_type: '', details: {} });
    setAlert(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.grant_type) return setAlert({ type: 'error', msg: 'Please select a grant type.' });
    setSaving(true);
    try {
      await API.post('/grants', form);
      setAlert({ type: 'success', msg: 'Grant application submitted!' });
      setShowModal(false);
      fetchGrants();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Application failed.' });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <h1>Grant &amp; Incentives</h1>
        <p>Apply for grants and incentives for your approved research.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Eligible proposals */}
      <div className="panel">
        <div className="panel-header">
          <h2>Approved Proposals — Eligible for Grants</h2>
          <span className="badge badge-green">{eligible.length}</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Action</th></tr>
          </thead>
          <tbody>
            {eligible.map(p => (
              <tr key={p.proposal_id}>
                <td><strong>{p.title}</strong></td>
                <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                  {p.proposal_type?.replace(/_/g,' ')}
                </td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => openApply(p)}>
                    Apply for Grant
                  </button>
                </td>
              </tr>
            ))}
            {eligible.length === 0 && (
              <tr><td colSpan={3}>
                <div className="empty-state">
                  <p>No approved proposals yet. Grants become available once your proposal is approved.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* My grant applications */}
      <div className="panel">
        <div className="panel-header"><h2>My Grant Applications</h2></div>
        <table className="data-table">
          <thead>
            <tr><th>Proposal</th><th>Grant Type</th><th>Status</th><th>Date Applied</th></tr>
          </thead>
          <tbody>
            {myGrants.map(g => (
              <tr key={g.grant_id}>
                <td><strong>{g.proposal_title}</strong></td>
                <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                  {g.grant_type?.replace(/_/g,' ')}
                </td>
                <td>
                  <span className={`badge ${GRANT_BADGE[g.status] || 'badge-gray'}`}>
                    {g.status}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {g.date_applied ? new Date(g.date_applied).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {myGrants.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty-state"><p>No grant applications yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Application Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h3>Apply for Grant / Incentive</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Grant Type</label>
                <select value={form.grant_type}
                  onChange={e => setForm({ ...form, grant_type: e.target.value, details: {} })}>
                  <option value="">— Select grant type —</option>
                  {GRANT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Travel / Oral fields */}
              {form.grant_type === 'travel_oral' && (
                <>
                  <div className="form-group">
                    <label>Event / Conference Name</label>
                    <input onChange={e => setDetail('event_name', e.target.value)}
                      placeholder="e.g. National Research Conference 2026" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Location</label>
                      <input onChange={e => setDetail('location', e.target.value)}
                        placeholder="City, Country" />
                    </div>
                    <div className="form-group">
                      <label>Event Date</label>
                      <input type="date" onChange={e => setDetail('event_date', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Conference Type</label>
                    <select onChange={e => setDetail('conference_type', e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="local">Local</option>
                      <option value="national">National</option>
                      <option value="international">International</option>
                    </select>
                  </div>
                </>
              )}

              {/* Publication fields */}
              {form.grant_type === 'publication_incentive' && (
                <>
                  <div className="form-group">
                    <label>Journal Name</label>
                    <input onChange={e => setDetail('journal_name', e.target.value)}
                      placeholder="e.g. Mindanao Journal" />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Volume / Issue</label>
                      <input onChange={e => setDetail('volume_issue', e.target.value)}
                        placeholder="e.g. Vol. 12, Issue 3" />
                    </div>
                    <div className="form-group">
                      <label>Publication Date</label>
                      <input type="date" onChange={e => setDetail('publication_date', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Index Type</label>
                    <input onChange={e => setDetail('index_type', e.target.value)}
                      placeholder="e.g. Scopus, Web of Science" />
                  </div>
                </>
              )}

              {/* Internally funded fields */}
              {form.grant_type === 'internally_funded' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Funding Amount (₱)</label>
                      <input type="number" step="0.01"
                        onChange={e => setDetail('funding_amount', e.target.value)}
                        placeholder="e.g. 50000" />
                    </div>
                    <div className="form-group">
                      <label>Funding Source</label>
                      <input onChange={e => setDetail('funding_source', e.target.value)}
                        placeholder="e.g. MSU Research Fund" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input type="date" onChange={e => setDetail('start_date', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input type="date" onChange={e => setDetail('end_date', e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {/* Spotlight fields */}
              {form.grant_type === 'research_spotlight' && (
                <>
                  <div className="form-group">
                    <label>Spotlight Title</label>
                    <input onChange={e => setDetail('spotlight_title', e.target.value)}
                      placeholder="Title for the research spotlight" />
                  </div>
                  <div className="form-group">
                    <label>Brief Description</label>
                    <textarea rows={3}
                      onChange={e => setDetail('spotlight_description', e.target.value)}
                      placeholder="Short description of your research highlight..."
                      style={{ resize: 'vertical' }} />
                  </div>
                </>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-outline"
                  onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default GrantsPage;