import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Resubmit.css';

export const REASON_MIN = 10;
export const REASON_MAX = 500;

/* Asks the reviewer WHY a proposal is being returned.
   The researcher reads this word for word, so it has to say what to fix.
   onConfirm(reason) must return a promise; it should throw to keep the box open. */
const ReturnReasonModal = ({ title, researcher, onConfirm, onClose }) => {
  const [reason, setReason] = useState('');
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const areaRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    areaRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  const clean = reason.trim();
  const short = clean.length > 0 && clean.length < REASON_MIN;
  const canSend = clean.length >= REASON_MIN && clean.length <= REASON_MAX && !saving;

  const send = async () => {
    if (!canSend) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(clean);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not return this submission. Please try again.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal" style={{ maxWidth: 520 }} role="dialog" aria-modal="true" aria-labelledby="rr-title">
        <h3 id="rr-title" style={{ marginBottom: 6 }}>Return to researcher</h3>
        <p style={{ margin: '0 0 16px', color: '#8a7a7d', fontSize: '0.86rem' }}>
          "{title}"{researcher ? <> by <b>{researcher}</b></> : null}
        </p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="rs-field">
          <label className="rs-label" htmlFor="rr-reason">
            Reason for returning <span style={{ color: '#b3261e' }}>*</span>
            <span className="rs-count" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
              {clean.length}/{REASON_MAX}
            </span>
          </label>
          <textarea id="rr-reason" ref={areaRef} value={reason} maxLength={REASON_MAX + 50}
            onChange={e => setReason(e.target.value)}
            placeholder="Tell the researcher exactly what to fix, e.g. the ethics clearance is missing." />
          <div className={`rs-hint${short || clean.length > REASON_MAX ? ' err' : ''}`}>
            {short
              ? `Add ${REASON_MIN - clean.length} more character(s).`
              : clean.length > REASON_MAX
                ? `Please shorten it by ${clean.length - REASON_MAX} character(s).`
                : `At least ${REASON_MIN} characters. The researcher sees this word for word.`}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={send} disabled={!canSend}>
            {saving ? 'Returning...' : 'Return to researcher'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReturnReasonModal;