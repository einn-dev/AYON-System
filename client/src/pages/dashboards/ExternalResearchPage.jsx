import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import { FaUpload } from 'react-icons/fa6';
import { useLiveRefresh } from '../../utils/liveRefresh';
import { ExternalDetails, peso } from './ExternalShared';

/* ─────────────────────────────────────────────────────────────
   External Research (Researcher): externally funded research, for the
   Repository only. No office endorsement: once every required field is filled
   in, it is stored in the Research Repository as PRIVATE (only the researcher,
   their college and the MSIRC offices can see it). Keywords are optional.
   ───────────────────────────────────────────────────────────── */

const MAX_MB = 10;
const ABSTRACT_WORDS = 300;
const EMPTY = {
  title: '', external_agency: '', researchers: '', description: '', keywords: '',
  funding_amount: '', start_date: '', end_date: '',
};
const wordsIn = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
const extOk = (f) => /\.(pdf|docx?)$/i.test(f?.name || '');

/* What is still missing or wrong, or '' (the same rules as the server) */
const problemOf = (form, file) => {
  if (!form.title.trim())           return 'Research title is required.';
  if (!form.external_agency.trim()) return 'External funding agency is required.';
  if (!form.researchers.trim())     return 'Researchers / co-authors are required.';
  if (!form.description.trim())     return 'Abstract is required.';
  if (wordsIn(form.description) > ABSTRACT_WORDS) return `The abstract must be ${ABSTRACT_WORDS} words or fewer.`;
  if (!(Number(form.funding_amount) > 0)) return 'Funding amount is required (more than ₱0).';
  if (!form.start_date) return 'Start date is required.';
  if (!form.end_date)   return 'End date is required.';
  if (form.end_date < form.start_date) return 'The end date must be on or after the start date.';
  if (!file)           return 'The research document is required (PDF or Word).';
  if (!extOk(file))    return 'The document must be a PDF or Word file.';
  if (file.size > MAX_MB * 1024 * 1024) return `The document must be ${MAX_MB} MB or smaller.`;
  return '';
};

const Req = () => <span style={{ color: '#c53030' }} aria-hidden="true"> *</span>;

const ExternalResearchPage = () => {
  const [items,  setItems]  = useState([]);
  const [alert,  setAlert]  = useState(null);
  const [saving, setSaving] = useState(false);
  const [file,   setFile]   = useState(null);
  const [fileKey, setFileKey] = useState(0);        // resets the file box after an upload
  const [form,   setForm]   = useState(EMPTY);
  const [open,   setOpen]   = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await API.get('/external/my');
      setItems(res.data.items || []);
    } catch { setItems([]); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useLiveRefresh(fetchItems);

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setAlert(null); };
  const problem = problemOf(form, file);
  const words = wordsIn(form.description);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (problem) return setAlert({ type: 'error', msg: problem });
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, String(v).trim()));
      data.append('file', file);
      await API.post('/external', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAlert({ type: 'success', msg: 'Stored in the Research Repository as private. Only you, your college and the MSIRC offices can see it.' });
      setForm(EMPTY);
      setFile(null);
      setFileKey((k) => k + 1);
      fetchItems();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The upload failed. Please try again.' });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <h1>External Research</h1>
        <p>For finished research funded outside MSU. It is stored in the Research Repository as soon as every required field is filled in. No office endorsement.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`} role={alert.type === 'error' ? 'alert' : 'status'}>{alert.msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
        {/* Upload Form */}
        <div className="panel">
          <div className="panel-header"><h2>Upload Externally Funded Research</h2></div>
          <div className="panel-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="ext-title">Research Title<Req /></label>
                <input id="ext-title" value={form.title} maxLength={255} onChange={set('title')}
                  placeholder="Enter the research title" required />
              </div>
              <div className="form-group">
                <label htmlFor="ext-agency">External Funding Agency<Req /></label>
                <input id="ext-agency" value={form.external_agency} maxLength={255} onChange={set('external_agency')}
                  placeholder="e.g. DOST-PCAARRD, CHED" required />
              </div>
              <div className="form-group">
                <label htmlFor="ext-people">Researchers / Co-authors<Req /></label>
                <input id="ext-people" value={form.researchers} maxLength={1000} onChange={set('researchers')}
                  placeholder="e.g. Nur Ain Lucman; Jamal Macapado" required />
                <small style={{ color: '#718096' }}>Everyone who worked on it, including you, separated by semicolons.</small>
              </div>
              <div className="form-group">
                <label htmlFor="ext-abstract">Abstract<Req /></label>
                <textarea id="ext-abstract" rows={5} value={form.description} onChange={set('description')}
                  placeholder="Not more than 300 words" style={{ resize: 'vertical' }} required />
                <small style={{ color: words > ABSTRACT_WORDS ? '#c53030' : '#718096' }}>{words}/{ABSTRACT_WORDS} words</small>
              </div>
              <div className="form-group">
                <label htmlFor="ext-kw">Keywords <span style={{ color: '#718096', fontWeight: 400 }}>(optional)</span></label>
                <input id="ext-kw" value={form.keywords} maxLength={500} onChange={set('keywords')}
                  placeholder="3 to 5 keywords, separated by commas" />
              </div>
              <div className="form-group">
                <label htmlFor="ext-amount">Funding Amount (₱)<Req /></label>
                <input id="ext-amount" type="number" min="0" step="0.01" value={form.funding_amount}
                  onChange={set('funding_amount')} placeholder="e.g. 250000" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ext-start">Start Date<Req /></label>
                  <input id="ext-start" type="date" value={form.start_date} onChange={set('start_date')} required />
                </div>
                <div className="form-group">
                  <label htmlFor="ext-end">End Date<Req /></label>
                  <input id="ext-end" type="date" value={form.end_date} min={form.start_date || undefined}
                    onChange={set('end_date')} required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="ext-file">Research Document (PDF or Word, up to {MAX_MB} MB)<Req /></label>
                <input id="ext-file" key={fileKey} type="file" accept=".pdf,.doc,.docx"
                  onChange={(e) => { setFile(e.target.files[0] || null); setAlert(null); }}
                  style={{ background: '#fff', padding: 8 }} required />
              </div>
              <div style={{
                padding: 10, background: '#f0f6ff', borderRadius: 8,
                border: '1px solid #bee3f8', fontSize: '0.78rem',
                color: '#2c5282', marginBottom: 14,
              }}>
                It is stored in the Research Repository as <b>private</b>: only you, your college (College Chairperson,
                College Coordinator, College Dean) and the MSIRC offices can see it. Other researchers cannot see or search it.
              </div>
              {problem && !saving && (
                <p style={{ fontSize: '0.8rem', color: '#718096', margin: '0 0 8px' }}>Still needed: {problem}</p>
              )}
              <button type="submit" className="btn btn-success" disabled={saving || !!problem}>
                {saving ? 'Uploading...' : <><FaUpload className="ic" />Upload and Store to Repository</>}
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
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th style={{ minWidth: 200 }}>Research Title</th><th>Amount</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {items.map(x => (
                    <tr key={x.external_id}>
                      <td><strong>{x.title}</strong><br /><small style={{ color: '#718096' }}>
                        {x.external_agency || '—'} · Private · Uploaded {x.uploaded_at ? new Date(x.uploaded_at).toLocaleDateString() : '—'}</small></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{peso(x.funding_amount)}</td>
                      <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(x)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <ExternalDetails item={open} onClose={() => setOpen(null)} />
    </>
  );
};

export default ExternalResearchPage;