import React from 'react';
import './ProposalTracker.css';
import { ROLE_LABEL, statusLabel } from '../utils/terms';
import { FaCheck, FaCircle, FaExclamation, FaMinus, FaXmark } from '../utils/icons';
import { dateText } from '../utils/dates';

/* ─────────────────────────────────────────────────────────────
   Shows where a proposal is in the workflow:
     College:  College Chairperson → College Coordinator → College Dean
     Office:   MSIRC Special Assistant → MSIRC Director → VCRED → Decision
   and the endorsement history (every round), with the notes.

   The proposal needs (the server adds these):
     status, endorsement_stage, round, endorsements[], returned_by_role,
     return_reason, returned_at
   ───────────────────────────────────────────────────────────── */

export const COLLEGE_CHAIN = ['chairperson', 'research_coordinator', 'college_dean'];
const OFFICE_CHAIN = ['special_assistant', 'msric_director', 'ovcred'];

export { ROLE_LABEL };

const SHORT = {
  research_coordinator: 'College Coordinator',
  chairperson:          'College Chairperson',
  college_dean:         'College Dean',
  special_assistant:    'MSIRC Special Assistant',
  msric_director:       'MSIRC Director',
  ovcred:               'VCRED',
};

/* where the proposal is in the office stage */
const OFFICE_AT = { submitted: 0, under_review: 1, endorsed: 2 };

export const roundOf = (p) => Number(p?.round) || (Number(p?.revision_count) || 0) + 1;

/* "With the College Chairperson", "Returned to you", ... */
export const whereNow = (p) => {
  if (!p) return '';
  switch (p.status) {
    case 'draft':           return 'Not submitted yet';
    case 'for_endorsement': return `Waiting for the ${ROLE_LABEL[p.endorsement_stage] || 'college'}`;
    case 'submitted':       return 'With the MSIRC Special Assistant';
    case 'under_review':    return 'With the MSIRC Director';
    case 'endorsed':        return 'With VCRED for final approval';
    case 'returned':        return `Returned for revision${p.returned_by_role ? ` by the ${ROLE_LABEL[p.returned_by_role] || 'office'}` : ''}`;
    default:                return statusLabel(p.status);
  }
};

/* Short "who has it" label for tables */
export const stageLabel = (p) => {
  if (!p) return '—';
  if (p.status === 'for_endorsement') return SHORT[p.endorsement_stage] || 'College';
  if (p.status === 'returned') return 'Researcher';
  if (p.status in OFFICE_AT) return SHORT[OFFICE_CHAIN[OFFICE_AT[p.status]]];
  if (p.status === 'approved' || p.status === 'rejected') return 'Done';
  return '—';
};

/* state of every step: done | now | todo | skip | returned | rejected | unreached */
const buildSteps = (p) => {
  const round   = roundOf(p);
  const rows    = (p.endorsements || []).filter(e => Number(e.round || 1) === round);
  const endorsedBy = (role) => rows.find(e => e.endorser_role === role && e.endorse_status === 'endorsed');
  const returnRow  = rows.find(e => e.endorse_status === 'returned');
  const stageIdx   = COLLEGE_CHAIN.indexOf(p.endorsement_stage);
  const retCollege = p.status === 'returned' && returnRow ? COLLEGE_CHAIN.indexOf(returnRow.endorser_role) : -1;
  const retOffice  = p.status === 'returned' && retCollege < 0 ? OFFICE_CHAIN.indexOf(p.returned_by_role) : -1;
  const atCollege  = p.status === 'for_endorsement' || p.status === 'draft' || retCollege >= 0;

  const college = COLLEGE_CHAIN.map((role, i) => {
    let state;
    if (endorsedBy(role))                                   state = 'done';
    else if (p.status === 'draft')                          state = 'todo';
    else if (p.status === 'for_endorsement')                state = i === stageIdx ? 'now' : (i < stageIdx ? 'skip' : 'todo');
    else if (retCollege >= 0)                               state = i === retCollege ? 'returned' : (i < retCollege ? 'skip' : 'todo');
    else                                                    state = 'skip';
    return { key: role, label: SHORT[role], state };
  });

  const officeAt = OFFICE_AT[p.status];
  const decided  = p.status === 'approved' || p.status === 'rejected';
  const decider  = decided ? OFFICE_CHAIN.indexOf(p.decided_by_role) : -1;   // the office that decided, if known
  const office = OFFICE_CHAIN.map((role, i) => {
    let state = 'todo';
    if (atCollege)                                          state = 'todo';
    else if (decided && decider >= 0) {
      if (i < decider)                                      state = 'done';
      else if (i === decider)                               state = p.status === 'rejected' ? 'rejected' : 'done';
      else                                                  state = p.status === 'rejected' ? 'unreached' : 'skip';
    }
    else if (decided)                                       state = 'done';    // decided before decision details were saved
    else if (officeAt !== undefined)                        state = i < officeAt ? 'done' : (i === officeAt ? 'now' : 'todo');
    else if (p.status === 'returned')                       state = retOffice < 0 ? 'todo' : (i < retOffice ? 'done' : (i === retOffice ? 'returned' : 'todo'));
    return { key: role, label: SHORT[role], state };
  });

  const decision = {
    key: 'decision',
    label: p.status === 'approved' ? 'Approved' : p.status === 'rejected' ? 'Rejected' : 'Decision',
    state: p.status === 'approved' ? 'done' : p.status === 'rejected' ? 'rejected' : 'todo',
  };

  return [...college, ...office, decision];
};

const MARK = { done: <FaCheck />, now: <FaCircle style={{ fontSize: '0.45rem' }} />, skip: <FaMinus />, returned: <FaExclamation />, rejected: <FaXmark />, unreached: <FaMinus /> };
const NOTE = { skip: 'Not Needed', returned: 'Returned', now: 'Current', unreached: 'Not Reached' };

const fmt = (d) => (d ? dateText(d) : '');

const ProposalTracker = ({ proposal, showHistory = true, showReturn = true, compact = false }) => {
  if (!proposal) return null;
  const steps   = buildSteps(proposal);
  const round   = roundOf(proposal);
  const history = [...(proposal.endorsements || [])].sort(
    (a, b) => (Number(a.round || 1) - Number(b.round || 1)) || String(a.date || '').localeCompare(String(b.date || ''))
  );

  return (
    <div className={`pt ${compact ? 'pt-compact' : ''}`}>
      <div className="pt-head">
        <span className="pt-where">{whereNow(proposal)}</span>
        {round > 1 && <span className="pt-round">Round {round}</span>}
      </div>

      <ol className="pt-steps" aria-label="Proposal progress">
        {steps.map((s, i) => (
          <li key={s.key} className={`pt-step pt-${s.state} ${i === 3 ? 'pt-office-start' : ''}`}
            title={`${s.label}: ${s.state === 'skip' ? 'not needed (no account or already past)' : s.state}`}>
            <span className="pt-dot">{MARK[s.state] || i + 1}</span>
            <span className="pt-label">{s.label}</span>
            {NOTE[s.state] && <span className="pt-note">{NOTE[s.state]}</span>}
            {s.state === 'rejected' && s.key !== 'decision' && <span className="pt-note">Rejected</span>}
          </li>
        ))}
      </ol>
      <div className="pt-legend"><span>College</span><span>Office</span></div>

      {showReturn && proposal.status === 'returned' && proposal.return_reason && (
        <div className="pt-return">
          <b>Returned for Revision{proposal.returned_by_role ? ` by the ${ROLE_LABEL[proposal.returned_by_role] || 'office'}` : ''}</b>
          {proposal.returned_at && <small> · {fmt(proposal.returned_at)}</small>}
          <p>{proposal.return_reason}</p>
          <small>After the researcher edits and resubmits, it starts again from the College Chairperson.</small>
        </div>
      )}

      {showReturn && proposal.status === 'rejected' && (
        <div className="pt-return pt-reject-box">
          <b>Rejected{proposal.decided_by_role ? ` by the ${ROLE_LABEL[proposal.decided_by_role] || 'office'}` : ''}</b>
          {proposal.decided_at && <small> · {fmt(proposal.decided_at)}</small>}
          <p>{proposal.decision_reason || 'No written reason was saved for this rejection.'}</p>
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="pt-history">
          <h4>Endorsement History</h4>
          <ul>
            {history.map((e, i) => (
              <li key={e.endorsement_id || i}>
                <span className="pt-hround">Round {Number(e.round || 1)}</span>
                <span className={`pt-hact ${e.endorse_status === 'endorsed' ? 'ok' : 'back'}`}>
                  {e.endorse_status === 'endorsed' ? 'Endorsed' : e.endorse_status === 'returned' ? 'Returned' : 'Rejected'}
                </span>
                {' '}by {e.endorser_name ? `${e.endorser_name} ` : ''}({ROLE_LABEL[e.endorser_role] || e.endorser_role})
                {e.date && <span className="pt-hdate"> · {fmt(e.date)}</span>}
                {e.remarks && <div className="pt-hnote">“{e.remarks}”</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProposalTracker;