import React, { useState, useEffect, useCallback } from 'react';
import API from '../services/authService';
import ProposalTracker, { COLLEGE_CHAIN, roundOf, whereNow } from './ProposalTracker';
import { FaArrowLeft, FaCheck, FaRotateLeft } from '../utils/icons';
import { STATUS_BADGE, statusLabel, TYPE_LABEL, ROLE_LABEL, wordFor } from '../utils/terms';
import { SignConfirm, ProposalSignatures } from './Signature';
import { ProposalFiles } from './ProposalFiles';
import { WaitCell } from './QueueCells';
import RecordDetails from './RecordDetails';
import { useOpenHighlight } from './OpenHighlight';
import { personName } from '../utils/names';
import { FormChecklist, EMPTY_CHECK } from './GrantForms';
import { formOf, stepOf, stepProblem } from '../utils/grantForms';
import StatCard from './StatCard';
import { ROLE_REDIRECTS } from '../utils/roleRoutes';
import MessageToast from './MessageToast';
import { dateText } from '../utils/dates';
import { usePaged } from './Pager';

/* ─────────────────────────────────────────────────────────────
   Shared pages for the college endorsers
   (College Chairperson, College Coordinator, College Dean):
     EndorsementQueue : proposals waiting for THIS role, endorse or return
     EndorsedHistory  : what THIS person endorsed or returned
     EndorserStats    : the four numbers on the dashboard
   A note of at least 10 characters is required to endorse or to return.
   ───────────────────────────────────────────────────────────── */

export const NOTE_MIN = 10;
export const NOTE_MAX = 500;

const PROPOSAL_TYPES = TYPE_LABEL;
export const ENDORSER_BADGE = STATUS_BADGE;


const statusText = statusLabel;

/* Is it this role's turn on this proposal? */
export const isMyTurn = (p, role) => p.status === 'for_endorsement' && p.endorsement_stage === role;

/* The next college role for the "Endorsing sends it to …" note: the first one in the order
   that has not endorsed yet in this round (a role with no account is skipped by the server) */
const nextLabel = (role, p) => {
  const round = roundOf(p);
  const done = (p?.endorsements || [])
    .filter(e => e.endorse_status === 'endorsed' && Number(e.round || 1) === round)
    .map(e => e.endorser_role);
  const next = COLLEGE_CHAIN.find(r => r !== role && !done.includes(r));
  return next ? ROLE_LABEL[next] : 'MSIRC Special Assistant';
};

const fmt = (d) => (d ? dateText(d) : '—');

/* My own endorsements (endorsed and returned), newest first */
const useMyEndorsements = () => {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get('/proposals/endorsements/mine');
      setItems(res.data.endorsements || []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { items, loading, failed, reload: load };
};

/* ── Dashboard numbers ── */
export const EndorserStats = ({ proposals, role }) => {
  const { items } = useMyEndorsements();
  const waiting  = proposals.filter(p => isMyTurn(p, role)).length;
  const endorsed = items.filter(e => e.endorse_status === 'endorsed').length;
  const returned = items.filter(e => e.endorse_status === 'returned' || e.endorse_status === 'rejected').length;
  const base = ROLE_REDIRECTS[role] || '';

  return (
    <div className="stats-grid">
      <StatCard color="blue" label="Submissions in Your Scope" value={proposals.length} />
      <StatCard color="amber" label="Waiting for You" value={waiting} to={`${base}/for-endorsement`} />
      <StatCard color="green" label="Endorsed by You" value={endorsed} to={`${base}/endorsed?show=endorsed`} />
      <StatCard color="red" label="Returned by You" value={returned} to={`${base}/endorsed?show=returned`} />
    </div>
  );
};

/* ── Queue: endorse or return ── */
export const EndorsementQueue = ({ proposals, role, onRefresh }) => {
  const [selected,   setSelected]   = useState(null);
  const [note,       setNote]       = useState('');
  const [alert,      setAlert]      = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [confirming, setConfirming] = useState(false);   // asking "return it?" before sending
  const [signReady,  setSignReady]  = useState(false);   // signature saved and the box ticked
  const [formCheck,  setFormCheck]  = useState(EMPTY_CHECK);   // this step of the MSIRC form (Grants and Incentives)

  const queue = proposals.filter(p => isMyTurn(p, role));
  const pager = usePaged(queue);   // 10 rows a page, Previous / Next under the table
  const clean = note.trim();
  const noteOk = clean.length >= NOTE_MIN && clean.length <= NOTE_MAX;

  const open = (p) => { setSelected(p); setFormCheck(EMPTY_CHECK); setNote(''); setAlert(null); setConfirming(false); };
  const back = () => { setSelected(null); setAlert(null); setConfirming(false); };

  /* opened from a notification (?open=<id>): its review screen when it is waiting for you,
     otherwise the record read-only (someone already acted on it) */
  const [viewId, setViewId] = useState(null);
  useOpenHighlight(proposals.length > 0, {
    open: (id) => { const p = queue.find(x => String(x.proposal_id) === String(id)); if (!p) return false; open(p); return true; },
    fallback: (id) => setViewId(Number(id)),
  });

  const send = async (decision) => {
    if (!noteOk) {
      return setAlert({
        type: 'error',
        msg: decision === 'endorsed'
          ? `Please write your remarks (at least ${NOTE_MIN} characters) before endorsing.`
          : `Please write what the researcher needs to fix (at least ${NOTE_MIN} characters).`,
      });
    }
    if (decision === 'endorsed') {
      const problem = stepProblem(stepOf(selected, role), formCheck);
      if (problem) return setAlert({ type: 'error', msg: problem });
    }
    if (decision === 'endorsed' && !signReady) {
      return setAlert({ type: 'error', msg: 'Please tick the box to confirm your signature before endorsing.' });
    }
    setSaving(true);
    setAlert(null);
    try {
      const res = await API.post(`/proposals/${selected.proposal_id}/endorse`, {
        decision,
        remarks: clean,
        ...(decision === 'endorsed' ? { attest: true, ...(formOf(selected) ? { form_check: formCheck } : {}) } : {}),
      });
      setSelected(null);
      setNote('');
      setConfirming(false);
      setAlert({ type: 'success', msg: res.data?.message || (decision === 'endorsed' ? 'Proposal endorsed.' : 'Proposal returned to the researcher.') });
      if (onRefresh) await onRefresh();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Action failed. Please try again.' });
      setConfirming(false);
      /* it may have been handled already (another tab, or another endorser): refresh the list */
      if (err.response?.status === 409 && onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  if (!selected) {
    return (
      <>
        <RecordDetails proposalId={viewId} onClose={() => setViewId(null)} />
        <MessageToast message={alert} onClose={() => setAlert(null)} />
        <div className="panel">
          <div className="panel-header">
            <h2>Proposals for Endorsement</h2>
            <span className="badge badge-blue">{queue.length}</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th><th>Researcher</th><th>Title</th>
                <th>Type</th><th>Waiting</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pager.rows.map((p, i) => (
                <tr key={p.proposal_id}>
                  <td style={{ color: '#a0aec0' }}>{pager.offset + i + 1}</td>
                  <td>
                    <strong>{personName(p)}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                      {[p.college, p.department].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 240 }}>
                    {p.title}
                    {roundOf(p) > 1 && (
                      <div style={{ fontSize: '0.72rem', color: '#8a7413' }}>Resubmitted (round {roundOf(p)})</div>
                    )}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                    {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                  </td>
                  <WaitCell p={p} />
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => open(p)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {queue.length === 0 && (
                <tr><td colSpan={6}>
                  <div className="empty-state"><p>No proposals are waiting for your endorsement.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
          {pager.bar}
        </div>
      </>
    );
  }

  return (
    <div>
      <button className="btn btn-outline btn-sm" style={{ marginBottom: 16 }} onClick={back}>
        <FaArrowLeft className="ic" />Back to List
      </button>

      <MessageToast message={alert} onClose={() => setAlert(null)} />

      <div className="endorse-grid detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 20 }}>
        <div className="panel">
          <div className="panel-header">
            <h2>{wordFor(selected).P} Details</h2>
            <span className={`badge ${ENDORSER_BADGE[selected.status] || 'badge-gray'}`}>
              {statusText(selected.status)}
            </span>
          </div>
          <div className="panel-body">
            <ProposalTracker proposal={selected} />
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                Title
              </p>
              <p style={{ fontWeight: 700, color: '#1a3a5c', fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>
                {selected.title}
              </p>
            </div>

            {selected.description && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
                  Abstract
                </p>
                <p style={{
                  color: '#2d3748', lineHeight: 1.7, margin: 0, fontSize: '0.9rem',
                  background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e8edf2',
                  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                }}>
                  {selected.description}
                </p>
              </div>
            )}

            <ProposalFiles proposal={selected} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 28px', marginBottom: 20 }}>
              {[
                { label: 'Researcher',     value: personName(selected) },
                { label: 'Email',          value: selected.email || '—' },
                { label: 'College',        value: selected.college || '—' },
                { label: 'Department',     value: selected.department || '—' },
                { label: 'Type',  value: PROPOSAL_TYPES[selected.proposal_type] || selected.proposal_type },
                { label: 'Date Submitted', value: fmt(selected.submitted_at) },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 3px' }}>
                    {item.label}
                  </p>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <ProposalSignatures proposal={selected} />
          </div>
        </div>

        <div className="panel" style={{ alignSelf: 'start' }}>
          <div className="panel-header"><h2>Your Endorsement</h2></div>
          <div className="panel-body">
            <FormChecklist proposal={selected} role={role} value={formCheck} disabled={saving}
              onChange={(v) => { setFormCheck(v); setAlert(null); }} />
            <div className="form-group">
              <label htmlFor="endorse-note">
                Remarks <span className="req">*</span>
              </label>
              <textarea id="endorse-note" rows={6} value={note} maxLength={NOTE_MAX}
                onChange={e => { setNote(e.target.value); setAlert(null); }}
                placeholder="A note for the next level, or what the researcher needs to fix if you return it."
                style={{ resize: 'vertical' }} disabled={saving} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#8a7a7d', marginTop: 4 }}>
                <span>Required, at least {NOTE_MIN} characters.</span>
                <span>{clean.length}/{NOTE_MAX}</span>
              </div>
            </div>

            <SignConfirm key={selected.proposal_id} onReady={setSignReady} verb="endorse" noun={wordFor(selected).p} disabled={saving} />

            {!confirming ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <button className="btn btn-success" disabled={saving || !signReady} onClick={() => send('endorsed')}
                  title={signReady ? undefined : 'Tick the box under your signature first'}>
                  {saving ? 'Processing…' : <><FaCheck className="ic" />Endorse and Sign</>}
                </button>
                <button className="btn btn-warning" disabled={saving}
                  onClick={() => (noteOk ? setConfirming(true) : send('returned'))}>
                  <FaRotateLeft className="ic" />Return to Researcher
                </button>
              </div>
            ) : (
              <div style={{ background: '#fff8e6', border: '1px solid #e9d98a', borderRadius: 8, padding: 12, fontSize: '0.84rem', color: '#6e5c0e' }}>
                <p style={{ margin: '0 0 10px' }}>
                  Return this {wordFor(selected).p} to the researcher? Your note will be shown as the reason.
                  After they resubmit, it starts again from the College Chairperson.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-warning btn-sm" disabled={saving} onClick={() => send('returned')}>
                    {saving ? 'Returning…' : 'Yes, Return It'}
                  </button>
                  <button className="btn btn-outline btn-sm" disabled={saving} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, padding: 10, background: '#f0f6ff', borderRadius: 8, border: '1px solid #bee3f8', fontSize: '0.78rem', color: '#2c5282' }}>
              Endorsing sends it to the <b>{nextLabel(role, selected)}</b>
              {nextLabel(role, selected) !== 'MSIRC Special Assistant' ? ' (or the next available level if that office has no account)' : ''}.
              Returning sends it back to the researcher and does not sign.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── History: what I endorsed or returned ── */
export const EndorsedHistory = () => {
  const { items, loading, failed } = useMyEndorsements();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);     // the record opened in the read-only window

  /* a dashboard card can open this list showing only what you endorsed or only what you returned */
  const [show, setShow] = useState(() => new URLSearchParams(window.location.search).get('show') || 'all');
  const shown = items.filter(e =>
    `${e.title || ''} ${e.researcher || ''}`.toLowerCase().includes(search.toLowerCase())
    && (show === 'all' || (show === 'endorsed' ? e.endorse_status === 'endorsed' : e.endorse_status !== 'endorsed'))
  );
  const pager = usePaged(shown);   // 10 rows a page, Previous / Next under the table

  return (
    <>
      <div className="page-header">
        <h1>Endorsed</h1>
        <p>Proposals and applications you endorsed or returned, with your note and where each one is now.</p>
      </div>
      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search by title or researcher…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" aria-label="Your action" value={show} onChange={e => setShow(e.target.value)}>
              <option value="all">Endorsed and returned</option>
              <option value="endorsed">Endorsed only</option>
              <option value="returned">Returned only</option>
            </select>
          </div>
        </div>
        {loading ? (
          <div className="empty-state loading-state" role="status"><p>Loading…</p></div>
        ) : failed ? (
          <div className="empty-state error-state" role="alert"><p>Could not load your endorsements. Please refresh the page.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Researcher</th><th>Title</th><th>Your Action</th><th>Your Remarks</th><th>Current Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {pager.rows.map(e => (
                <tr key={e.endorsement_id}>
                  <td><strong>{e.researcher || '—'}</strong></td>
                  <td style={{ maxWidth: 220 }}>
                    {e.title}
                    {Number(e.round) > 1 && <div style={{ fontSize: '0.72rem', color: '#718096' }}>Round {e.round}</div>}
                  </td>
                  <td>
                    <span className={`badge ${e.endorse_status === 'endorsed' ? 'badge-green' : 'badge-red'}`}>
                      {e.endorse_status === 'endorsed' ? 'Endorsed' : 'Returned'}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>{fmt(e.date)}</div>
                  </td>
                  <td style={{ maxWidth: 260, fontSize: '0.82rem', color: '#4a4044', overflowWrap: 'anywhere' }}>
                    {e.remarks || '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    <span className={`badge ${ENDORSER_BADGE[e.proposal_status] || 'badge-gray'}`}>
                      {statusText(e.proposal_status)}
                    </span>
                    <div style={{ fontSize: '0.74rem', color: '#718096', marginTop: 2 }}>
                      {whereNow({ status: e.proposal_status, endorsement_stage: e.endorsement_stage, returned_by_role: e.returned_by_role })}
                    </div>
                  </td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenId(e.proposal_id)}>View Details</button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state"><p>You have not endorsed or returned anything yet.</p></div></td></tr>
              )}
            </tbody>
          </table>
        )}
        {pager.bar}
      </div>
      <RecordDetails proposalId={openId} onClose={() => setOpenId(null)} />
    </>
  );
};