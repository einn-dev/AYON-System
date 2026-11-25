import React, { useState, useEffect, useCallback } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import '../../components/ProposalFiles.css';
import './External.css';
import { FaUpload } from 'react-icons/fa6';
import { useLiveRefresh } from '../../utils/liveRefresh';
import { useAuth } from '../../context/AuthContext';
import { personName } from '../../utils/names';
import { DocumentsEditor, MAX_SUPPORTING, OTHER } from '../../components/ProposalFiles';
import { SDGS } from '../../utils/sdgs';
import { ExternalDetails, SdgChips, peso } from './ExternalShared';
import MessageToast from '../../components/MessageToast';

/* ─────────────────────────────────────────────────────────────
   External Research (Researcher): externally funded research, for the
   Repository only. The fields follow OVCRED's "Externally Funded Projects"
   report: title, project leader, members, funder, amount and the SDGs hit,
   plus the abstract, the project dates and the documents. No office endorsement: once every
   required field is filled in, it is stored in the Research Repository as
   PRIVATE (only the researcher, their college and the MSIRC offices see it).
   ───────────────────────────────────────────────────────────── */

export const EXT_MAIN = 'Research Document';
export const EXT_LABELS = ['Memorandum of Agreement', 'Notice of Award', 'Terminal Report', 'Certificate of Completion', 'Financial Report', OTHER];
const EMPTY = {
  title: '', project_leader: '', researchers: '', external_agency: '',
  funding_amount: '', sdgs: [], description: '', start_date: '', end_date: '',
};
const ABSTRACT_WORDS = 300;
const wordsIn = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
const EMPTY_DOCS = () => ({ main: { existing: null, file: null }, rows: [], removed: [] });

/* What is still missing or wrong, or '' (the same rules as the server) */
const problemOf = (form, docs) => {
  if (!form.title.trim())           return 'Title of the project is required.';
  if (!form.project_leader.trim())  return 'Project leader is required.';
  if (!form.researchers.trim())     return 'Project members are required (write "None" if you worked alone).';
  if (!form.external_agency.trim()) return 'Funder is required.';
  if (!(Number(form.funding_amount) > 0)) return 'Funding amount is required (more than ₱0).';
  if (!form.sdgs.length)            return 'Check at least one Sustainable Development Goal.';
  if (!form.description.trim())     return 'Abstract is required.';
  if (wordsIn(form.description) > ABSTRACT_WORDS) return `The abstract must be ${ABSTRACT_WORDS} words or fewer.`;
  if (!form.start_date) return 'Start date is required.';
  if (!form.end_date)   return 'End date is required.';
  if (form.end_date < form.start_date) return 'The end date must be on or after the start date.';
  if (!docs.main.file) return `The ${EXT_MAIN.toLowerCase()} is required (PDF or Word).`;
  if (docs.rows.length > MAX_SUPPORTING) return `You can attach at most ${MAX_SUPPORTING} supporting documents.`;
  for (const r of docs.rows) {
    if (!r.file) return 'Choose a file for each supporting document, or remove the empty row.';
    if (r.choice === OTHER && !r.custom.trim()) return 'Type a label for the supporting document marked "Other".';
  }
  return '';
};

const Req = () => <span style={{ color: '#c53030' }} aria-hidden="true"> *</span>;

const ExternalResearchPage = () => {
  const { user } = useAuth() || {};
  const [items,  setItems]  = useState([]);
  const [alert,  setAlert]  = useState(null);
  const [saving, setSaving] = useState(false);
  const [docs,   setDocs]   = useState(EMPTY_DOCS);
  const [form,   setForm]   = useState(() => ({ ...EMPTY, project_leader: personName(user) || '' }));
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
  const toggleSdg = (n) => {
    setForm((f) => ({ ...f, sdgs: f.sdgs.includes(n) ? f.sdgs.filter((x) => x !== n) : [...f.sdgs, n].sort((a, b) => a - b) }));
    setAlert(null);
  };
  const problem = problemOf(form, docs);
  const words = wordsIn(form.description);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (problem) return setAlert({ type: 'error', msg: problem });
    setSaving(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, k === 'sdgs' ? v.join(',') : String(v).trim()));
      data.append('file', docs.main.file);
      const labels = [];
      docs.rows.forEach((r) => { data.append('supporting', r.file); labels.push(r.choice === OTHER ? r.custom.trim() : r.choice); });
      if (labels.length) data.append('supporting_labels', JSON.stringify(labels));
      await API.post('/external', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAlert({ type: 'success', msg: 'Stored in the Research Repository as private. Only you, your college and the MSIRC offices can see it.' });
      setForm({ ...EMPTY, project_leader: personName(user) || '' });
      setDocs(EMPTY_DOCS());
      fetchItems();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'The upload failed. Please try again.' });
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <h1>External Research</h1>
        <p>For research funded outside MSU. It is stored in the Research Repository as soon as every required field is filled in. No office endorsement.</p>
      </div>

      <MessageToast message={alert} onClose={() => setAlert(null)} />

      <div className="ext-grid">
        {/* Upload Form */}
        <div className="panel">
          <div className="panel-header"><h2>Upload Externally Funded Research</h2></div>
          <div className="panel-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="ext-title">Title of Project<Req /></label>
                <input id="ext-title" value={form.title} maxLength={255} onChange={set('title')} placeholder="Enter the project title" />
              </div>
              <div className="form-group">
                <label htmlFor="ext-leader">Project Leader<Req /></label>
                <input id="ext-leader" value={form.project_leader} maxLength={255} onChange={set('project_leader')} placeholder="Full name" />
              </div>
              <div className="form-group">
                <label htmlFor="ext-people">Project Members<Req /></label>
                <input id="ext-people" value={form.researchers} maxLength={1000} onChange={set('researchers')}
                  placeholder="e.g. Nur Ain Lucman; Jamal Macapado" />
                <small style={{ color: '#718096' }}>Separate names with semicolons. Write “None” if you worked alone.</small>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ext-agency">Funder<Req /></label>
                  <input id="ext-agency" value={form.external_agency} maxLength={255} onChange={set('external_agency')} placeholder="e.g. DOST-PCAARRD, CHED" />
                </div>
                <div className="form-group">
                  <label htmlFor="ext-amount">Funding Amount (in pesos)<Req /></label>
                  <input id="ext-amount" type="number" min="0" step="0.01" value={form.funding_amount} onChange={set('funding_amount')} placeholder="e.g. 250000" />
                </div>
              </div>

              <fieldset className="form-group ext-sdg-box">
                <legend>Sustainable Development Goals (SDGs) hit<Req /> <span className="ext-hint">you may check more than one</span></legend>
                <div className="ext-sdgs">
                  {SDGS.map(([n, name, color]) => {
                    const on = form.sdgs.includes(n);
                    return (
                      <label key={n} className={`ext-sdg${on ? ' on' : ''}`} style={{ '--sdg': color }}>
                        <input type="checkbox" checked={on} onChange={() => toggleSdg(n)} />
                        <span className="ext-sdg-no" aria-hidden="true">{n}</span>
                        <span className="ext-sdg-name">SDG {n}: {name}</span>
                      </label>
                    );
                  })}
                </div>
                <small className={form.sdgs.length ? 'ext-count on' : 'ext-count'}>{form.sdgs.length ? `${form.sdgs.length} checked` : 'None checked yet'}</small>
              </fieldset>

              <div className="form-group">
                <label htmlFor="ext-abstract">Abstract<Req /></label>
                <textarea id="ext-abstract" rows={5} value={form.description} onChange={set('description')}
                  placeholder={`Not more than ${ABSTRACT_WORDS} words`} style={{ resize: 'vertical' }} />
                <small style={{ color: words > ABSTRACT_WORDS ? '#c53030' : '#718096' }}>{words}/{ABSTRACT_WORDS} words</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ext-start">Start Date<Req /></label>
                  <input id="ext-start" type="date" value={form.start_date} max={form.end_date || undefined} onChange={set('start_date')} />
                </div>
                <div className="form-group">
                  <label htmlFor="ext-end">End Date<Req /></label>
                  <input id="ext-end" type="date" value={form.end_date} min={form.start_date || undefined} onChange={set('end_date')} />
                </div>
              </div>

              <div className="form-group">
                <label>Documents</label>
                <DocumentsEditor value={docs} onChange={(v) => { setDocs(v); setAlert(null); }}
                  onError={(m) => m && setAlert({ type: 'error', msg: m })} disabled={saving}
                  mainLabel={EXT_MAIN} labels={EXT_LABELS} />
              </div>

              <div className="ext-private">
                It is stored in the Research Repository as <b>private</b>: only you, your college (College Chairperson,
                College Coordinator, College Dean) and the MSIRC offices can see it. Other researchers cannot see or search it.
              </div>
              {problem && !saving && <p className="ext-still">Still needed: {problem}</p>}
              <button type="submit" className="btn btn-success" disabled={saving || !!problem}>
                {saving ? 'Uploading…' : <><FaUpload className="ic" />Upload and Store to Repository</>}
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
                  <tr><th style={{ minWidth: 200 }}>Title of Project</th><th>Amount</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {items.map(x => (
                    <tr key={x.external_id}>
                      <td><strong>{x.title}</strong><br /><small style={{ color: '#718096' }}>
                        {x.external_agency || '—'} · Private · Uploaded {x.uploaded_at ? new Date(x.uploaded_at).toLocaleDateString() : '—'}</small>
                        <SdgChips value={x.sdgs} small /></td>
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