/* ── Helpers for the office tables ──
   waitingSince(p)  when the proposal reached the office that has it now
   waitDays(p)      whole days since then
   decisionAt(p)    when it was approved, rejected or endorsed to VCRED
   actedOn(p, role) when this office last signed or rejected it
   amountOf(p)      the money involved: the budget of an Internally Funded Research,
                    or the amount the Special Assistant or Director set on an application */
import { budgetTotals, awardOf } from './grantForms';

const DAY = 24 * 60 * 60 * 1000;
const t = (v) => { const n = Date.parse(v); return Number.isFinite(n) ? n : 0; };
const roundOf = (p) => Number(p?.round) || (Number(p?.revision_count) || 0) + 1;

/* the forward steps of the current round: college endorsements and office signatures */
const stepsNow = (p) => (p?.endorsements || [])
  .filter((e) => Number(e.round || 1) === roundOf(p) && e.endorse_status === 'endorsed' && e.date);

export const waitingSince = (p) => {
  const times = [t(p?.submitted_at || p?.created_at), ...stepsNow(p).map((e) => t(e.date))].filter(Boolean);
  return times.length ? new Date(Math.max(...times)) : null;
};

export const waitDays = (p) => {
  const since = waitingSince(p);
  return since ? Math.max(0, Math.floor((Date.now() - since.getTime()) / DAY)) : null;
};

/* when the decision behind the current status was made, or null when it is not recorded:
     rejected  the rejection
     approved  the final approval (VCRED) or the Director's approval
     endorsed  the Director's endorsement to VCRED
   (never the submission date, which would look like the decision date) */
export const decisionAt = (p) => {
  if (!p) return null;
  const office = (p.endorsements || []).filter((e) => e.office && e.date);
  const latest = (list) => { const ts = list.map((e) => t(e.date)).filter(Boolean); return ts.length ? new Date(Math.max(...ts)) : null; };
  if (p.status === 'rejected') return (t(p.decided_at) && new Date(t(p.decided_at))) || latest(office.filter((e) => e.endorse_status === 'rejected'));
  if (p.status === 'approved') return latest(office.filter((e) => e.endorse_status === 'endorsed' && ['ovcred', 'msric_director'].includes(e.endorser_role)))
    || (t(p.decided_at) && new Date(t(p.decided_at))) || null;
  if (p.status === 'endorsed') return latest(office.filter((e) => e.endorse_status === 'endorsed' && e.endorser_role === 'msric_director'));
  return null;
};

export const actedOn = (p, role) => {
  const times = (p?.endorsements || []).filter((e) => e.endorser_role === role && e.endorse_status !== 'returned' && e.date)
    .map((e) => t(e.date)).filter(Boolean);
  return times.length ? new Date(Math.max(...times)) : null;
};

export const amountOf = (p) => {
  if (!p) return null;
  if (p.proposal_type === 'internally_funded') {
    const total = budgetTotals((p.form_data || {}).budget || {}).total;
    return total > 0 ? total : null;
  }
  return awardOf(p).amount;
};

/* "5 days", "Today", "1 day" (late from 7 days) */
export const WAIT_LATE = 7;
export const waitText = (d) => (d === null ? '—' : d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'}`);