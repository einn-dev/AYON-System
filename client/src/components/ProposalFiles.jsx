import React, { useRef, useState } from 'react';
import { FaCirclePlus, FaFileLines, FaArrowUpRightFromSquare, FaDownload } from '../utils/icons';
import './ProposalFiles.css';
import API from '../services/authService';
import { GrantFormView, mainDocLabel } from './GrantForms';

/* ─────────────────────────────────────────────────────────────
   The documents of a proposal.
     <ProposalFiles proposal={p} />       read-only list (every page that opens a proposal)
     <DocumentsEditor value onChange />   choose / replace / remove documents (researcher)
   A proposal has one Main Proposal Document (required to submit) and up to
   MAX_SUPPORTING supporting documents, each with a label.
   ───────────────────────────────────────────────────────────── */

export const MAX_MB         = 10;
export const MAX_SUPPORTING = 4;
export const MAIN_LABEL     = 'Main Proposal Document';
export const OTHER          = 'Other';
export const LABELS = [
  'Line-Item Budget', 'Endorsement Letter', 'Curriculum Vitae',
  'Ethics Clearance', 'Certificate of Acceptance', OTHER,
];
const LABEL_MAX = 60;
const ALLOWED   = ['pdf', 'doc', 'docx'];

/* Files are stored as full web addresses; older records may hold a server path */
const rawHref = (fp) => (/^https?:\/\//i.test(fp || '') ? fp : `http://localhost:5000/${fp}`);
const isWord  = (fp) => /\.docx?$/i.test(String(fp || '').split('?')[0]);

/* The link behind every "View" button: it opens in a new tab.
   A PDF opens as it is. A browser cannot show a Word file (it downloads it), so a
   Word file opens in Microsoft's online viewer, which reads it from its public link. */
export const fileHref = (fp) => {
  const url = rawHref(fp);
  return isWord(fp) && /^https:\/\//i.test(url)
    ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
    : url;
};

/* The link behind "Download": saves the file itself (Supabase sends it as a download with ?download=) */
export const downloadHref = (fp, name) => {
  const url = rawHref(fp);
  if (!/supabase\.co\/storage\//i.test(url)) return url;
  const file = name || decodeURIComponent(url.split('?')[0].split('/').pop() || 'document');
  return `${url}${url.includes('?') ? '&' : '?'}download=${encodeURIComponent(file)}`;
};

/* Files are private: the server checks who is asking and gives a link that works for a few minutes.
   Returns that link, or the stored one when it is not in our storage. */
const isStorage = (fp) => /\/storage\/v1\/object\//i.test(String(fp || ''));
export const fileLink = async (fp, download) => {
  if (!isStorage(fp)) return download ? downloadHref(fp, download) : rawHref(fp);
  const res = await API.get('/files/link', { params: { path: fp, ...(download ? { download } : {}) } });
  return res.data.url;
};
const linkError = (err) => (err?.response?.status === 401 ? 'Please sign in to open this file.'
  : err?.response?.status === 403 ? 'You cannot open this file.'
  : 'Could not open the file. Please try again.');

/* View + Download, side by side */
export const FileButtons = ({ path, name, label = 'document', small = true }) => {
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  if (!path) return null;
  const fileName = name || decodeURIComponent(String(path).split('?')[0].split('/').pop() || 'document');

  /* the new tab opens right away (so the browser does not block it), then gets the link */
  const view = async () => {
    setErr(''); setBusy('view');
    const tab = window.open('', '_blank');
    try {
      const url = await fileLink(path);
      const href = isWord(path) && /^https:\/\//i.test(url)
        ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
        : url;
      if (tab) { tab.opener = null; tab.location.href = href; } else window.location.href = href;
    } catch (e) {
      if (tab) tab.close();
      setErr(linkError(e));
    } finally { setBusy(''); }
  };
  const download = async () => {
    setErr(''); setBusy('download');
    try {
      const url = await fileLink(path, fileName);
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.rel = 'noreferrer';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      setErr(linkError(e));
    } finally { setBusy(''); }
  };

  return (
    <span className="pf-btns">
      <button type="button" className={`btn btn-outline ${small ? 'btn-sm' : ''}`} onClick={view} disabled={!!busy} aria-label={`View ${label} in a new tab`}>
        {busy === 'view' ? 'Opening…' : <>View <FaArrowUpRightFromSquare className="ic-r" /></>}
      </button>
      <button type="button" className={`btn btn-outline ${small ? 'btn-sm' : ''}`} onClick={download} disabled={!!busy} aria-label={`Download ${label}`}>
        <FaDownload className="ic" />{busy === 'download' ? 'Preparing…' : 'Download'}
      </button>
      {err && <span role="alert" style={{ flexBasis: '100%', color: '#c53030', fontSize: '0.78rem' }}>{err}</span>}
    </span>
  );
};

const extOf  = (name) => String(name || '').split('?')[0].split('.').pop().toLowerCase();
const nameOf = (f) => f.file_name || decodeURIComponent(String(f.file_path || '').split('?')[0].split('/').pop() || 'Document');
export const sizeText = (n) => {
  const b = Number(n);
  if (!b) return '';
  return b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
};

/* The list to show: proposal.files (from the server), or the older single file_path */
export const filesOf = (p) => {
  if (Array.isArray(p?.files) && p.files.length) return p.files;
  return p?.file_path ? [{ file_id: null, kind: 'main', label: MAIN_LABEL, file_path: p.file_path }] : [];
};

/* ── Read-only list ── */
export const ProposalFiles = ({ proposal, files, title = 'Documents', compact = false }) => {
  const list = files || filesOf(proposal);
  const mainLabel = mainDocLabel(proposal) || MAIN_LABEL;      // an MSIRC form names its own main document
  return (
    <div className={`pf ${compact ? 'pf-compact' : ''}`}>
      <GrantFormView proposal={proposal} />
      {/* Travel Subsidy and Oral Presentation: the approved Research Spotlight it is for */}
      {proposal?.spotlight_title && (
        <p className="pf-spotlight"><b>For Research Spotlight:</b> {proposal.spotlight_title}</p>
      )}
      {title && <p className="pf-title">{title}{list.length > 0 && <span> ({list.length})</span>}</p>}
      {list.length === 0 ? (
        <p className="pf-none">No documents attached.</p>
      ) : (
        <ul className="pf-list">
          {list.map((f, i) => (
            <li key={f.file_id || `${f.kind}-${i}`}>
              <FaFileLines className="pf-ic" aria-hidden="true" />
              <div className="pf-text">
                <b>{f.kind === 'main' ? mainLabel : f.label}</b>
                <small>{nameOf(f)}{sizeText(f.file_size) ? ` · ${sizeText(f.file_size)}` : ''}</small>
              </div>
              <FileButtons path={f.file_path} name={f.file_name} label={f.kind === 'main' ? mainLabel : f.label} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ── Editor state ──
   { main: { existing, file }, rows: [{ key, existing, file, choice, custom }], removed: [file_id] } */
let seq = 0;
const key = () => `r${++seq}`;

export const docsFromFiles = (files) => {
  const list = files || [];
  const main = list.find(f => f.kind === 'main') || null;
  return {
    main:    { existing: main, file: null },
    rows:    list.filter(f => f.kind !== 'main' && f.file_id)
                 .map(f => ({ key: key(), existing: f, file: null, choice: f.label, custom: '' })),
    removed: [],
  };
};

const labelOf = (r) => (r.existing ? r.existing.label : (r.choice === OTHER ? r.custom.trim() : r.choice));

/* A reason the documents cannot be sent yet, or '' */
export const docsProblem = (v, { needMain }) => {
  if (needMain && !v.main.existing && !v.main.file) return 'Please attach the Main Proposal Document.';
  if (v.rows.length > MAX_SUPPORTING) return `You can attach at most ${MAX_SUPPORTING} supporting documents.`;
  for (const r of v.rows) {
    if (!r.existing && !r.file) return 'Choose a file for each supporting document, or remove the empty row.';
    if (!r.existing && r.choice === OTHER && !r.custom.trim()) return 'Type a label for the supporting document marked "Other".';
    if (labelOf(r).length > LABEL_MAX) return `A document label must be ${LABEL_MAX} characters or fewer.`;
  }
  return '';
};

/* Puts the document changes into the FormData sent to the server */
export const appendDocs = (data, v) => {
  if (v.main.file) data.append('file', v.main.file);
  const labels = [];
  const remove = [...v.removed];
  v.rows.forEach(r => {
    if (!r.file) return;
    data.append('supporting', r.file);
    labels.push(labelOf(r));
    if (r.existing?.file_id) remove.push(r.existing.file_id);     // replaced: the old one goes
  });
  if (labels.length) data.append('supporting_labels', JSON.stringify(labels));
  if (remove.length) data.append('remove_files', JSON.stringify(remove));
};

/* "Main Proposal Document replaced", "Line-Item Budget added", ... */
export const docsChanges = (v) => {
  const out = [];
  if (v.main.file) out.push(v.main.existing ? 'Main Proposal Document replaced' : 'Main Proposal Document attached');
  v.rows.forEach(r => {
    if (r.file && r.existing) out.push(`${r.existing.label} replaced`);
    else if (r.file) out.push(`${labelOf(r) || 'Supporting document'} added`);
  });
  if (v.removed.length) out.push(`${v.removed.length} supporting document${v.removed.length === 1 ? '' : 's'} removed`);
  return out;
};

/* Labels of the documents that will be there after saving (for the review box) */
export const docsSummary = (v) => [
  ...(v.main.existing || v.main.file ? [MAIN_LABEL] : []),
  ...v.rows.filter(r => r.existing || r.file).map(r => labelOf(r) || 'Supporting document'),
];

/* ── Editor ── */
/* mainLabel and labels let other pages (External Research) name their own documents */
export const DocumentsEditor = ({ value, onChange, onError, disabled = false, mainLabel = MAIN_LABEL, labels = LABELS }) => {
  const mainRef = useRef(null);
  const rowRefs = useRef({});

  const check = (f) => {
    if (!f) return false;
    if (!ALLOWED.includes(extOf(f.name))) { onError?.('Only PDF, DOC or DOCX files are allowed.'); return false; }
    if (f.size > MAX_MB * 1024 * 1024)    { onError?.(`"${f.name}" is too large. The limit is ${MAX_MB} MB per file.`); return false; }
    onError?.('');
    return true;
  };
  const pick = (e, apply) => {
    const f = e.target.files?.[0];
    e.target.value = '';                       // lets the same file be chosen again
    if (check(f)) apply(f);
  };
  const setRow = (k, patch) => onChange({ ...value, rows: value.rows.map(r => (r.key === k ? { ...r, ...patch } : r)) });
  const removeRow = (r) => onChange({
    ...value,
    rows: value.rows.filter(x => x.key !== r.key),
    removed: r.existing?.file_id ? [...value.removed, r.existing.file_id] : value.removed,
  });
  const addRow = () => onChange({ ...value, rows: [...value.rows, { key: key(), existing: null, file: null, choice: labels[0], custom: '' }] });

  const full = value.rows.length >= MAX_SUPPORTING;
  const m = value.main;

  return (
    <div className="pf-edit">
      <div className="pf-rows">
        {/* the main document */}
        <div className="pf-row">
          <div className="pf-cell-label"><span><b>{mainLabel}</b> <span className="pf-req" title="Required to submit">*</span></span></div>
          <div className="pf-cell-file">
            {m.file ? <><FaFileLines className="pf-ic" /> {m.file.name} <small>· {sizeText(m.file.size)}{m.existing ? ' · replaces the saved file' : ''}</small></>
              : m.existing ? <><FaFileLines className="pf-ic" /> <a href={fileHref(m.existing.file_path)} target="_blank" rel="noreferrer">{nameOf(m.existing)}</a> <small>· saved</small></>
              : <span className="pf-empty">No file chosen</span>}
          </div>
          <div className="pf-cell-acts">
            {m.file && m.existing && (
              <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
                onClick={() => onChange({ ...value, main: { ...m, file: null } })}>Undo</button>
            )}
            <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
              onClick={() => mainRef.current?.click()}>{m.file || m.existing ? 'Replace' : 'Choose File'}</button>
            <input ref={mainRef} type="file" accept=".pdf,.doc,.docx" hidden
              onChange={e => pick(e, f => onChange({ ...value, main: { ...m, file: f } }))} />
          </div>
        </div>

        {/* Supporting documents */}
        {value.rows.map((r, i) => (
          <div className="pf-row" key={r.key}>
            <div className="pf-cell-label">
              {r.existing ? (
                <b>{r.existing.label}</b>
              ) : (
                <>
                  <select className="search-input pf-select" value={r.choice} disabled={disabled}
                    aria-label={`Label of supporting document ${i + 1}`}
                    onChange={e => setRow(r.key, { choice: e.target.value })}>
                    {labels.map(l => <option key={l} value={l}>{l === OTHER ? 'Other (type your own)' : l}</option>)}
                  </select>
                  {r.choice === OTHER && (
                    <input className="search-input pf-select" placeholder="Label, e.g. Letter of Intent" maxLength={LABEL_MAX}
                      value={r.custom} disabled={disabled} aria-label={`Own label of supporting document ${i + 1}`}
                      onChange={e => setRow(r.key, { custom: e.target.value })} />
                  )}
                </>
              )}
            </div>
            <div className="pf-cell-file">
              {r.file ? <><FaFileLines className="pf-ic" /> {r.file.name} <small>· {sizeText(r.file.size)}{r.existing ? ' · replaces the saved file' : ''}</small></>
                : r.existing ? <><FaFileLines className="pf-ic" /> <a href={fileHref(r.existing.file_path)} target="_blank" rel="noreferrer">{nameOf(r.existing)}</a> <small>· saved</small></>
                : <span className="pf-empty">No file chosen</span>}
            </div>
            <div className="pf-cell-acts">
              <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
                onClick={() => rowRefs.current[r.key]?.click()}>{r.file || r.existing ? 'Replace' : 'Choose File'}</button>
              <button type="button" className="btn btn-sm pf-remove" disabled={disabled}
                onClick={() => removeRow(r)}>Remove</button>
              <input ref={el => { rowRefs.current[r.key] = el; }} type="file" accept=".pdf,.doc,.docx" hidden
                onChange={e => pick(e, f => setRow(r.key, { file: f }))} />
            </div>
          </div>
        ))}
      </div>

      <div className="pf-foot">
        <button type="button" className="btn btn-outline btn-sm" onClick={addRow} disabled={disabled || full}>
          <FaCirclePlus className="ic" />Add Supporting Document
        </button>
        <span>
          PDF, DOC or DOCX, up to {MAX_MB} MB each. {full
            ? `That is the most (${MAX_SUPPORTING} supporting documents).`
            : `Up to ${MAX_SUPPORTING} supporting documents.`}
        </span>
      </div>
    </div>
  );
};

export default ProposalFiles;