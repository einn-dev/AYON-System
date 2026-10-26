import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../../components/Layout.css';
import './AdminModule.css';
import './AdminCatalog.css';
import { errText } from './adminShared';

/* Small things shared by the Admin Repository and Grants pages */

export const REASON_MIN = 10;
export const REASON_MAX = 500;

/* Files are stored as full web addresses; older records may hold a server path */
export const fileHref = (fp) => (/^https?:\/\//i.test(fp) ? fp : `http://localhost:5000/${fp}`);

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/* "2026-10-24" or a full timestamp -> "Oct 24, 2026" */
export const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* A yes / cancel box. When `reason` is true the Admin has to type why (saved in the Audit Log).
   onConfirm(reason) must return a promise; it should throw to keep the box open. */
export const ConfirmBox = ({ title, text, reason = false, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) => {
  const [why,    setWhy]    = useState('');
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const areaRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    if (reason) areaRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving, reason]);

  const clean   = why.trim();
  const canSend = !saving && (!reason || (clean.length >= REASON_MIN && clean.length <= REASON_MAX));

  const go = async () => {
    if (!canSend) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(clean);
    } catch (err) {
      setError(errText(err, 'That did not work. Please try again.'));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}
        style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {text && <p className="ac-note" style={{ fontSize: '0.86rem', lineHeight: 1.5, marginBottom: 16 }}>{text}</p>}

        {reason && (
          <div className="form-group">
            <label htmlFor="ac-reason">
              Reason <span className="am-muted">(saved in the Audit Log, at least {REASON_MIN} characters)</span>
            </label>
            <textarea id="ac-reason" ref={areaRef} className="ac-textarea" maxLength={REASON_MAX}
              value={why} onChange={(e) => setWhy(e.target.value)} disabled={saving} />
            <span className="ac-count">{clean.length}/{REASON_MAX}</span>
          </div>
        )}

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={go} disabled={!canSend}>
            {saving ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};