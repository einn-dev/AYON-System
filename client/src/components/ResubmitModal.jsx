import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/authService';
import './Resubmit.css';
import { DocumentsEditor, docsFromFiles, docsProblem, docsChanges, appendDocs, filesOf } from './ProposalFiles';

const TITLE_MAX = 255;
const DESC_MAX  = 10000;

/* The researcher fixes what the office asked for, then sends the proposal back.
   Nothing is sent until "Resubmit Proposal". Documents that are not touched are kept. */
const ResubmitModal = ({ proposal, onClose, onDone }) => {
  const [title,  setTitle]  = useState(proposal.title || '');
  const [desc,   setDesc]   = useState(proposal.description || '');
  const [docs,   setDocs]   = useState(() => docsFromFiles(filesOf(proposal)));
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
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
  changes.push(...docsChanges(docs));

  const titleProblem =
    !cleanTitle ? 'Title cannot be empty.'
    : cleanTitle.length > TITLE_MAX ? `Title must be ${TITLE_MAX} characters or fewer.`
    : '';
  const descProblem = cleanDesc.length > DESC_MAX ? `Description must be ${DESC_MAX} characters or fewer.` : '';
  const docsIssue = docsProblem(docs, { needMain: true });
  const canSend = changes.length > 0 && !titleProblem && !descProblem && !docsIssue && !saving;

  const send = async () => {
    if (!canSend) return;
    setSaving(true);
    setError('');
    try {
      const data = new FormData();
      data.append('title', cleanTitle);
      data.append('description', cleanDesc);
      appendDocs(data, docs);
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

  return createPortal(
    <div className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal rs-modal" ref={dialogRef} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="rs-title">
        <div className="rs-head">
          <div>
            <h3 id="rs-title">Edit and Resubmit</h3>
            <p>Fix what the office asked for, then send it back.</p>
          </div>
          <button type="button" className="rs-x" onClick={onClose} disabled={saving} aria-label="Close">✕</button>
        </div>

        <div className="rs-returned">
          <strong>Reason for Return</strong>
          <p>{proposal.return_reason || 'The office did not leave a written reason. Please check your Notifications, or contact MSIRC.'}</p>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="rs-field">
          <label className="rs-label" htmlFor="rs-title-in">Research Title</label>
          <input id="rs-title-in" type="text" value={title} maxLength={TITLE_MAX + 50}
            onChange={e => setTitle(e.target.value)} autoComplete="off" />
          {titleProblem && <div className="rs-hint err">{titleProblem}</div>}
        </div>

        <div className="rs-field">
          <label className="rs-label" htmlFor="rs-desc-in">Abstract</label>
          <textarea id="rs-desc-in" value={desc} onChange={e => setDesc(e.target.value)} />
          <div className={`rs-hint${descProblem ? ' err' : ''}`}>
            {descProblem || 'Tip: answer the points in the reason above.'}
          </div>
        </div>

        <div className="rs-field">
          <span className="rs-label">Documents</span>
          <DocumentsEditor value={docs} onChange={setDocs} disabled={saving} onError={setError} />
          <div className="rs-hint">Documents you leave alone are kept. Replace the Main Proposal Document, or add or remove supporting documents.</div>
        </div>

        <div className="rs-changes">
          {changes.length ? (
            <>
              <b>You changed:</b>
              <ul>{changes.map(c => <li key={c}>{c}</li>)}</ul>
            </>
          ) : (
            <><b>No changes yet.</b> Edit something, or change the documents, before you can resubmit.</>
          )}
          {changes.length > 0 && docsIssue && <div className="rs-hint err" style={{ marginTop: 6 }}>{docsIssue}</div>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-success" onClick={send} disabled={!canSend}>
            {saving ? 'Resubmitting...' : 'Resubmit Proposal'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ResubmitModal;