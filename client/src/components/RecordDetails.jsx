import React, { useEffect, useState } from 'react';
import { FaLock } from '../utils/icons';
import API from '../services/authService';
import ProposalTracker from './ProposalTracker';
import { ProposalSignatures } from './Signature';
import { ProposalFiles } from './ProposalFiles';
import { personName } from '../utils/names';
import { TYPE_LABEL, statusLabel, statusBadge, wordFor } from '../utils/terms';
import { dateText } from '../utils/dates';

/* ─────────────────────────────────────────────────────────────
   <RecordDetails proposalId={id} onClose={fn} />
   A read-only window for a record an office already acted on (endorsed,
   validated, approved, rejected or returned): the tracker, the signatures,
   the filled-in form and the documents. It has no action buttons, so nothing
   can be changed from here. The server decides who may open a record
   (MSIRC Staff cannot; a college role only sees its own college or department).
   ───────────────────────────────────────────────────────────── */
const RecordDetails = ({ proposalId, onClose }) => {
  const [p, setP]         = useState(null);
  const [failed, setFailed] = useState('');

  useEffect(() => {
    if (!proposalId) return undefined;
    let alive = true;
    setP(null); setFailed('');
    API.get(`/proposals/${proposalId}`)
      .then((res) => { if (alive) setP(res.data?.proposal || null); })
      .catch((err) => { if (alive) setFailed(err.response?.data?.message || 'Could not open this record. Please try again.'); });
    return () => { alive = false; };
  }, [proposalId]);

  useEffect(() => {
    if (!proposalId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [proposalId, onClose]);

  if (!proposalId) return null;
  const w = wordFor(p);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 820, width: '100%' }} onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={p ? p.title : 'Record details'}>
        {failed ? (
          <div className="alert alert-error" role="alert">{failed}</div>
        ) : !p ? (
          <div className="empty-state loading-state" role="status"><p>Loading…</p></div>
        ) : (
          <>
            <div className="alert alert-info" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <FaLock style={{ marginTop: 3, flexShrink: 0 }} />
              <span>View only. You can follow this {w.p} here, but nothing can be changed from this window.</span>
            </div>
            <h3 style={{ marginBottom: 8 }}>{p.title}</h3>
            <p style={{ margin: '0 0 12px' }}>
              <span className={`badge ${statusBadge(p.status)}`}>{statusLabel(p.status)}</span>
            </p>
            <ProposalTracker proposal={p} />
            <ProposalFiles proposal={p} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 24px', margin: '4px 0 18px' }}>
              {[
                { label: 'Researcher', value: personName(p) || '—' },
                { label: 'Email', value: p.email || '—' },
                { label: 'College', value: p.college || '—' },
                { label: 'Department', value: p.department || '—' },
                { label: 'Type', value: TYPE_LABEL[p.proposal_type] || p.proposal_type },
                { label: 'Date Submitted', value: p.submitted_at ? dateText(p.submitted_at) : '—' },
              ].map((r) => (
                <div key={r.label}>
                  <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>{r.label}</p>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, overflowWrap: 'anywhere' }}>{r.value}</p>
                </div>
              ))}
            </div>

            <ProposalSignatures proposal={p} />
          </>
        )}
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default RecordDetails;