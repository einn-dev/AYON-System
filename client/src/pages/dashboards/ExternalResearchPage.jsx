import React, { useState, useEffect, useCallback, useRef } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import '../../components/ProposalFiles.css';
import './External.css';
import { FaCheck, FaMagnifyingGlass, FaUpload, FaXmark } from '../../utils/icons';
import { useLiveRefresh } from '../../utils/liveRefresh';
import { useAuth } from '../../context/AuthContext';
import { personName } from '../../utils/names';
import { DocumentsEditor, MAX_SUPPORTING, OTHER } from '../../components/ProposalFiles';
import { SDGS } from '../../utils/sdgs';
import InfoNotice from '../../components/InfoNotice';
import { ExternalDetails, SdgChips, peso, period } from './ExternalShared';
import MessageToast from '../../components/MessageToast';
import { dateText } from '../../utils/dates';
import { usePaged } from '../../components/Pager';

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
  if (!form.sdgs.length)            return 'Add at least one Sustainable Development Goal.';
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

const Req = () => <span className="req" style={{ color: '#b3261e', fontWeight: 800 }} aria-hidden="true"> *</span>;

/* ── The SDGs field: search and add ──
   The chosen goals show as tags (× removes one). Type a word or a number ("climate", "13")
   and pick from the list; a goal already chosen shows a tick and can be clicked off again. */
const SdgPicker = ({ value, onToggle }) => {
  const [open,   setOpen]   = useState(false);
  const [q,      setQ]      = useState('');
  const [active, setActive] = useState(-1);
  const inputRef = useRef(null);
  const needle = q.trim().toLowerCase();
  const list = SDGS.filter(([n, name]) => !needle || `sdg ${n} ${name}`.toLowerCase().includes(needle) || String(n) === needle);
  const pick = (n) => { onToggle(n); setQ(''); setActive(-1); inputRef.current?.focus(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (open && list[active]) { e.preventDefault(); pick(list[active][0]); } }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Backspace' && !q && value.length) onToggle(value[value.length - 1]);
  };
  return (
    <div className="ext-pick">
      <div className="ext-pick-tags">
        {value.length ? value.map((n) => (
          <span key={n} className="ext-pick-tag">
            <b>SDG {n}</b> {SDGS[n - 1][1]}
            <button type="button" aria-label={`Remove SDG ${n}`} onClick={() => onToggle(n)}><FaXmark /></button>
          </span>
        )) : <span className="ext-pick-none">No goals chosen yet</span>}
      </div>
      <div className="ext-pick-box">
        <FaMagnifyingGlass className="ext-pick-ic" aria-hidden="true" />
        <input ref={inputRef} type="text" role="combobox" autoComplete="off" value={q}
          aria-expanded={open} aria-controls="ext-sdg-list" aria-autocomplete="list" aria-label="Search and add a Sustainable Development Goal"
          placeholder="Search and add a goal (e.g. climate, 13)"
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={onKey} />
      </div>
      {open && (
        <div className="ext-pick-list" id="ext-sdg-list" role="listbox" aria-multiselectable="true">
          {list.length ? list.map(([n, name], i) => {
            const on = value.includes(n);
            return (
              <div key={n} role="option" aria-selected={on}
                className={`ext-pick-opt${on ? ' on' : ''}${i === active ? ' active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); pick(n); }} onMouseEnter={() => setActive(i)}>
                <span className="ext-sdg-tick" aria-hidden="true">{on && <FaCheck />}</span>
                <b>SDG {n}</b><span>{name}</span>
              </div>
            );
          }) : <div className="ext-pick-empty">No goal matches "{q.trim()}".</div>}
        </div>
      )}
    </div>
  );
};

const ExternalResearchPage = () => {
  const { user } = useAuth() || {};
  const [items,  setItems]  = useState([]);
  const [loaded, setLoaded] = useState(false);      // the list has been fetched once
  const pager = usePaged(items);   // 10 rows a page, Previous / Next under the table
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
    setLoaded(true);
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

      {loaded && items.length === 0 && (
        <InfoNotice>
          You have no external research in AYON yet. Fill in the form to upload research funded outside MSU.
          It is stored in the Research Repository as <b>Private</b> right away, with no office endorsement.
          For questions, please contact the Mamitua Saber Institute of Research and Creation (MSIRC).
        </InfoNotice>
      )}
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
                <legend>Sustainable Development Goals (SDGs) hit<Req /> <span className="ext-hint">you may add more than one</span></legend>
                <SdgPicker value={form.sdgs} onToggle={toggleSdg} />
                {form.sdgs.length > 0 && <small className="ext-count on">{form.sdgs.length} chosen</small>}
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
                  <tr>
                    <th style={{ minWidth: 200 }}>Title of Project</th><th>Funder</th><th>Amount</th>
                    <th>SDGs</th><th>Period</th><th>Access</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.rows.map(x => (
                    <tr key={x.external_id}>
                      <td><strong>{x.title}</strong><br />
                        <small style={{ color: '#718096' }}>
                          {x.project_leader || '—'} · Uploaded {x.uploaded_at ? dateText(x.uploaded_at) : '—'}
                        </small></td>
                      <td>{x.external_agency || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{peso(x.funding_amount)}</td>
                      <td style={{ minWidth: 140 }}><SdgChips value={x.sdgs} small /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>{period(x.start_date, x.end_date)}</td>
                      <td>
                        <span className={`badge ${x.access_type === 'public' ? 'badge-green' : 'badge-gray'}`}>
                          {x.access_type === 'public' ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(x)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pager.bar}
            </div>
          )}
        </div>
      </div>
      <ExternalDetails item={open} onClose={() => setOpen(null)} />
    </>
  );
};

export default ExternalResearchPage;