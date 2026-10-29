import React, { useState, useEffect } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import { FaUpload } from 'react-icons/fa6';

const ExternalResearchPage = () => {
  const [items,  setItems]  = useState([]);
  const [alert,  setAlert]  = useState(null);
  const [saving, setSaving] = useState(false);
  const [file,   setFile]   = useState(null);
  const [form,   setForm]   = useState({
    title: '', external_agency: '', description: '',
    funding_amount: '', start_date: '', end_date: '',
  });

  const fetchItems = async () => {
    try {
      const res = await API.get('/external/my');
      setItems(res.data.items || []);
    } catch { setItems([]); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setAlert({ type: 'error', msg: 'Research title is required.' });
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      if (file) data.append('file', file);

      await API.post('/external', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAlert({ type: 'success', msg: 'External research uploaded and stored in the Research Repository.' });
      setForm({ title:'',external_agency:'',description:'',funding_amount:'',start_date:'',end_date:'' });
      setFile(null);
      fetchItems();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The upload failed. Please try again.' });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <h1>External Research</h1>
        <p>Upload completed externally funded research to store it in the Research Repository.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Upload Form */}
        <div className="panel">
          <div className="panel-header"><h2>Upload Research</h2></div>
          <div className="panel-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Research Title</label>
                <input value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Enter research title" required />
              </div>
              <div className="form-group">
                <label>External Funding Agency</label>
                <input value={form.external_agency}
                  onChange={e => setForm({ ...form, external_agency: e.target.value })}
                  placeholder="e.g. DOST, CHED, USAID" />
              </div>
              <div className="form-group">
                <label>Abstract</label>
                <textarea rows={4} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of the research..."
                  style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label>Funding Amount (₱)</label>
                <input type="number" step="0.01" value={form.funding_amount}
                  onChange={e => setForm({ ...form, funding_amount: e.target.value })}
                  placeholder="e.g. 250000" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm({ ...form, end_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Research Document (PDF)</label>
                <input type="file" accept=".pdf,.doc,.docx"
                  onChange={e => setFile(e.target.files[0])}
                  style={{ background: '#fff', padding: 8 }} />
              </div>
              <div style={{
                padding: 10, background: '#f0f6ff', borderRadius: 8,
                border: '1px solid #bee3f8', fontSize: '0.78rem',
                color: '#2c5282', marginBottom: 14,
              }}>
                Externally funded research is stored directly in the Research Repository.
                It does not go through the review workflow.
              </div>
              <button type="submit" className="btn btn-success" disabled={saving}>
                {saving ? 'Uploading...' : <><FaUpload className="ic" />Upload and Archive</>}
              </button>
            </form>
          </div>
        </div>

        {/* My Uploads */}
        <div className="panel">
          <div className="panel-header">
            <h2>My External Research</h2>
            <span className="badge badge-blue">{items.length}</span>
          </div>
          {items.length === 0 ? (
            <div className="empty-state"><p>No external research uploaded yet.</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Research Title</th><th>Funding Agency</th><th>Date Uploaded</th></tr>
              </thead>
              <tbody>
                {items.map(x => (
                  <tr key={x.external_id}>
                    <td><strong>{x.title}</strong></td>
                    <td style={{ color: '#718096' }}>{x.external_agency || '—'}</td>
                    <td style={{ color: '#718096' }}>
                      {x.uploaded_at ? new Date(x.uploaded_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

export default ExternalResearchPage;