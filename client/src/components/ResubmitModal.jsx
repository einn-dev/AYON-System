import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/authService';
import './Resubmit.css';

const MAX_MB    = 10;
const ALLOWED   = ['pdf', 'doc', 'docx'];
const TITLE_MAX = 255;
const DESC_MAX  = 10000;

const extOf = (name) => String(name || '').split('?')[0].split('.').pop().toLowerCase();

/* The researcher fixes what the office asked for, then sends the proposal back.
   Nothing is sent until "Resubmit to MSIRC". Without a new file the old one is kept. */
const ResubmitModal = ({ proposal, onClose, onDone }) => {
  const [title,  setTitle]  = useState(proposal.title || '');
  const [desc,   setDesc]   = useState(proposal.description || '');
  const [file,   setFile]   = useState(null);
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef   = useRef(null);
  const dialogRef = useRef(null);

  /* Esc closes (unless it is sending), the page behind does not scroll */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  const cleanTitle = title.trim();
  const cleanDesc  = desc.trim();
  const titleChanged = cleanTitle !== (proposal.title || '');
  const descChanged  = cleanDesc  !== (proposal.description || '').trim();
  const changes = [];
  if (titleChanged) changes.push('Title changed');
  if (descChanged)  changes.push('Description changed');
  if (file)         changes.push('New file attached');

  const titleProblem =
    !cleanTitle ? 'Title cannot be empty.'
    : cleanTitle.length > TITLE_MAX ? `Title must be ${TITLE_MAX} characters or fewer.`
    : '';
  const descProblem = cleanDesc.length > DESC_MAX ? `Description must be ${DESC_MAX} characters or fewer.` : '';
  const canSend = changes.length > 0 && !titleProblem && !descProblem && !saving;

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';                       // lets the same file be chosen again
    if (!f) return;
    if (!ALLOWED.includes(extOf(f.name))) return setError('Only PDF, DOC or DOCX files are allowed.');
    if (f.size > MAX_MB * 1024 * 1024)    return setError(`That file is too large. The limit is ${MAX_MB} MB.`);
    setError('');
    setFile(f);
  };

  const send = async () => {
    if (!canSend) return;
    setSaving(true);
    setError('');
    try {
      const data = new FormData();
      data.append('title', cleanTitle);
      data.append('description', cleanDesc);
      if (file) data.append('file', file);
      const res = await API.post(`/proposals/${proposal.proposal_id}/resubmit`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onDone({ ok: true, message: res.data?.message || 'Proposal resubmitted.' });
      return;
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not resubmit. Please check your connection and try again.';
      /* it is no longer "returned" (for example it was already resubmitted in another tab):
         close the box and let the page reload and explain */
      if (err.response?.data?.code === 'NOT_RETURNED') {
        onDone({ ok: false, message: msg });
        return;
      }
      setError(msg);
    }
    setSaving(false);
  };

  const hasOldFile = !!proposal.file_path;

  return createPortal(
    <div className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal rs-modal" ref={dialogRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="rs-title">
        <div className="rs-head">
          <div>
            <h3 id="rs-title">Edit and resubmit</h3>
            <p>Fix what the office asked for, then send it back.</p>
          </div>
          <button type="button" className="rs-x" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
        </div>

        <div className="rs-returned">
          <strong>Why it was returned</strong>
          <p>{proposal.return_reason || 'The office did not leave a written reason. Please check your Notifications, or contact MSIRC.'}</p>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="rs-field">
          <label className="rs-label" htmlFor="rs-title-in">Proposal title</label>
          <input id="rs-title-in" type="text" value={title} maxLength={TITLE_MAX + 50}
            onChange={e => setTitle(e.target.value)} autoComplete="off" />
          {titleProblem && <div className="rs-hint err">{titleProblem}</div>}
        </div>

        <div className="rs-field">
          <label className="rs-label" htmlFor="rs-desc-in">Description / abstract</label>
          <textarea id="rs-desc-in" value={desc} onChange={e => setDesc(e.target.value)} />
          <div className={`rs-hint${descProblem ? ' err' : ''}`}>
            {descProblem || 'Tip: answer the points in the reason above.'}
          </div>
        </div>

        <div className="rs-field">
          <span className="rs-label">Proposal file</span>
          <div className="rs-file">
            <div className="rs-file-main">
              {file ? (
                <>
                  <b title={file.name}>{file.name}</b>
                  <small>New file · {(file.size / 1024 / 1024).toFixed(2)} MB · replaces the old one</small>
                </>
              ) : hasOldFile ? (
                <>
                  <b>Current file ({extOf(proposal.file_path).toUpperCase().slice(0, 5)})</b>
                  <small>
                    Kept unless you replace it ·{' '}
                    <a href={proposal.file_path} target="_blank" rel="noreferrer">Open</a>
                  </small>
                </>
              ) : (
                <>
                  <b>No file attached</b>
                  <small>You can attach one now</small>
                </>
              )}
            </div>
            {file ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setFile(null)}>Undo</button>
            ) : (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                {hasOldFile ? 'Replace file' : 'Attach file'}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={pickFile} hidden />
          </div>
          <div className="rs-hint">PDF, DOC or DOCX, up to {MAX_MB} MB. Leave it alone to keep the file you already sent.</div>
        </div>

        <div className="rs-changes">
          {changes.length ? (
            <>
              <b>You changed:</b>
              <ul>{changes.map(c => <li key={c}>{c}</li>)}</ul>
            </>
          ) : (
            <><b>No changes yet.</b> Edit something, or replace the file, before you can resubmit.</>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-success" onClick={send} disabled={!canSend}>
            {saving ? 'Resubmitting...' : 'Resubmit to MSIRC'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ResubmitModal;