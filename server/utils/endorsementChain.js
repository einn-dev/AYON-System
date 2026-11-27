const { personName } = require('./names');
const supabase = require('../config/supabase');
const { activeHolders } = require('./roleNotify');

/* ─────────────────────────────────────────────────────────────
   College endorsement chain.
   A submitted (or resubmitted) proposal goes through these college roles,
   in this order, before it reaches the Special Assistant.
   The order follows the MSIRC forms: Step 1. Department (Chairperson),
   Step 2. College/Unit (Research Coordinator, then Dean).

   To change the order later, only change CHAIN below.
   SCOPE says how each role is matched to the researcher:
     college    → same college as the researcher
     department → same department as the researcher
   A role with no active account for that college/department is skipped.
   ───────────────────────────────────────────────────────────── */
const CHAIN = ['chairperson', 'research_coordinator', 'college_dean'];

const SCOPE = {
  research_coordinator: 'college',
  chairperson:          'department',
  college_dean:         'college',
};

const { ROLE_LABEL } = require('./terms');

const NOTE_MIN = 10;
const NOTE_MAX = 500;

const clean = (v) => String(v ?? '').trim();

/* The researcher's college and department */
const ownerOf = async (userId) => {
  const { data, error } = await supabase
    .from('users').select('user_id, first_name, middle_name, last_name, college, department')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data || null;
};

/* Active accounts holding `role` in the researcher's college/department */
const endorsersFor = async (role, owner) => {
  const field = SCOPE[role];
  const value = clean(owner?.[field]);
  if (!field || !value) return [];

  const ids = await activeHolders(role);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('users').select('user_id').in('user_id', ids).eq(field, value);
  if (error) throw error;
  return (data || []).map(u => u.user_id);
};

/* The first college step, starting at position `from`, that has somebody to act.
   Roles in `skip` (for example, the ones that already endorsed this round) are passed over.
   Returns { role, ids } or null when every remaining step is skipped. */
const nextStage = async (owner, from = 0, skip = []) => {
  for (let i = from; i < CHAIN.length; i += 1) {
    if (skip.includes(CHAIN[i])) continue;
    const ids = await endorsersFor(CHAIN[i], owner);
    if (ids.length) return { role: CHAIN[i], ids };
  }
  return null;
};

/* College roles that already endorsed this proposal in this round */
const endorsedRoles = async (proposalId, round) => {
  const { data, error } = await supabase
    .from('endorsements').select('endorser_role, endorse_status, round')
    .eq('proposal_id', proposalId);
  if (error) throw error;
  return [...new Set((data || [])
    .filter(r => r.endorse_status === 'endorsed' && (Number(r.round) || 1) === Number(round))
    .map(r => r.endorser_role))];
};

/* Is this endorser in the same college/department as the researcher? */
const inScope = (role, me, owner) => {
  const field = SCOPE[role];
  return !!field && !!clean(me?.[field]) && clean(me?.[field]) === clean(owner?.[field]);
};

/* In-app notification to a list of people. Never throws. */
const notifyIds = async (ids, { proposal_id = null, notif_type, title, message }) => {
  try {
    const list = [...new Set((ids || []).map(Number))].filter(Boolean);
    if (!list.length) return 0;
    const { error } = await supabase.from('notifications').insert(
      list.map(user_id => ({ user_id, proposal_id, notif_type, title, message }))
    );
    if (error) throw error;
    return list.length;
  } catch (err) {
    console.error('notifyIds failed:', err.message || err);
    return 0;
  }
};

/* Current round: 1 for the first submission, +1 for every resubmission */
const roundOf = (proposal) => (Number(proposal?.revision_count) || 0) + 1;

/* ── The office part of the history ──
   The MSIRC Special Assistant, MSIRC Director and VCRED are not in the endorsements table:
     signed (validated, endorsed to VCRED, approved, final approval) -> proposal_signatures
     returned by an office (in any round)                           -> the Audit Log
     rejected (it ends the proposal, so there is only one)          -> the proposal itself
   Each item: { endorser_role, endorse_status, action_label, remarks, date, round, endorser_name, office: true }
   A return belongs to the round it happened in: 1 + the resubmissions before it. */
const OFFICE_ROLES = ['special_assistant', 'msric_director', 'ovcred'];
const ACTION_TEXT = {
  validate: 'Validated and forwarded', endorse_to_ovcred: 'Endorsed to VCRED',
  approve: 'Approved', final_approval: 'Granted final approval',
};
const officeTrail = async (list, ids, names, roles) => {
  const out = {};
  const add = (pid, item) => { (out[pid] = out[pid] || []).push({ office: true, ...item }); };

  try {
    const { data: sigs, error } = await supabase
      .from('proposal_signatures')
      .select('signature_id, proposal_id, signer_role, signer_name, action, round, signed_at')
      .in('proposal_id', ids)
      .in('signer_role', OFFICE_ROLES);
    if (error) throw error;
    (sigs || []).forEach(g => add(g.proposal_id, {
      endorsement_id: `s${g.signature_id}`, endorser_role: g.signer_role, endorse_status: 'endorsed',
      action_label: ACTION_TEXT[g.action] || 'Signed', remarks: null, date: g.signed_at,
      round: Number(g.round) || 1, endorser_name: g.signer_name || null,
    }));
  } catch (err) {
    if (!/proposal_signatures|does not exist|schema cache/i.test(String(err?.message || ''))) {
      console.error('officeTrail signatures failed:', err.message || err);
    }
  }

  const returnTimes = {};                                  // proposal_id -> times already listed
  try {
    const { data: logs, error } = await supabase
      .from('audit_logs')
      .select('audit_id, actor_name, actor_role, action, target_id, details, created_at')
      .eq('target_type', 'proposal')
      .in('target_id', ids.map(String))
      .in('action', ['proposal_returned', 'proposal_resubmitted'])
      .order('audit_id', { ascending: true });
    if (error) throw error;
    const resubmits = {};
    (logs || []).forEach(r => {
      if (r.action === 'proposal_resubmitted') (resubmits[r.target_id] = resubmits[r.target_id] || []).push(r.created_at);
    });
    (logs || []).forEach(r => {
      const d = r.details || {};
      if (r.action !== 'proposal_returned' || !OFFICE_ROLES.includes(r.actor_role)) return;
      if (d.stage || d.from === 'for_endorsement') return;          // a college return: already in the endorsements
      (returnTimes[r.target_id] = returnTimes[r.target_id] || []).push(Date.parse(r.created_at));
      add(r.target_id, {
        endorsement_id: `a${r.audit_id}`, endorser_role: r.actor_role, endorse_status: 'returned',
        action_label: null, remarks: d.reason || null, date: r.created_at,
        round: 1 + (resubmits[r.target_id] || []).filter(t => t < r.created_at).length,
        endorser_name: r.actor_name || null,
      });
    });
  } catch (err) {
    console.error('officeTrail returns failed:', err.message || err);
  }

  list.forEach(p => {
    /* a return still waiting for the researcher that is older than the Audit Log */
    const retRole = roles[p.returned_by];
    if (p.status === 'returned' && OFFICE_ROLES.includes(retRole) && p.returned_at) {
      const t = Date.parse(p.returned_at);
      if (!(returnTimes[p.proposal_id] || []).some(x => Math.abs(x - t) < 60000)) {
        add(p.proposal_id, {
          endorsement_id: `r${p.proposal_id}`, endorser_role: retRole, endorse_status: 'returned',
          action_label: null, remarks: p.return_reason || null, date: p.returned_at,
          round: p.round, endorser_name: names[p.returned_by] || null,
        });
      }
    }
    /* the rejection */
    const decRole = roles[p.decided_by];
    if (p.status === 'rejected' && OFFICE_ROLES.includes(decRole)) {
      add(p.proposal_id, {
        endorsement_id: `d${p.proposal_id}`, endorser_role: decRole, endorse_status: 'rejected',
        action_label: null, remarks: p.decision_reason || null, date: p.decided_at || null,
        round: p.round, endorser_name: names[p.decided_by] || null,
      });
    }
  });
  return out;
};

/* Adds to each proposal (best effort, never throws):
     endorsements     : [{ endorser_role, endorse_status, remarks, date, round, endorser_name }]
     returned_by_role : role of the person who returned it (when returned)
     decided_by_role  : role of the person who approved or rejected it
     round            : current round                                          */
const attachTrail = async (proposals) => {
  const list = proposals || [];
  list.forEach(p => { p.round = roundOf(p); p.endorsements = []; });
  if (!list.length) return list;

  try {
    const ids = list.map(p => p.proposal_id);
    const { data: rows, error } = await supabase
      .from('endorsements')
      .select('*')
      .in('proposal_id', ids)
      .order('endorsement_id', { ascending: true });
    if (error) throw error;

    const people = new Set((rows || []).map(r => r.endorser_id));
    list.forEach(p => { if (p.returned_by) people.add(p.returned_by); if (p.decided_by) people.add(p.decided_by); });

    let names = {};
    let roles = {};
    if (people.size) {
      const pid = [...people];
      const [{ data: us }, { data: rs }] = await Promise.all([
        supabase.from('users').select('user_id, first_name, middle_name, last_name').in('user_id', pid),
        supabase.from('user_roles').select('user_id, role_type').in('user_id', pid),
      ]);
      (us || []).forEach(u => { names[u.user_id] = personName(u); });
      (rs || []).forEach(r => { roles[r.user_id] = r.role_type; });
    }

    const byProposal = {};
    (rows || []).forEach(r => {
      (byProposal[r.proposal_id] = byProposal[r.proposal_id] || []).push({
        endorsement_id: r.endorsement_id,
        endorser_role:  r.endorser_role,
        endorse_status: r.endorse_status,
        remarks:        r.remarks,
        date:           r.date_endorsed || r.date_rejected || null,
        round:          Number(r.round) || 1,
        endorser_name:  names[r.endorser_id] || null,
      });
    });

    /* the office level (MSIRC Special Assistant, MSIRC Director, VCRED) is not in the endorsements
       table: its steps are signatures, returns and rejections, all written to the Audit Log */
    const office = await officeTrail(list, ids, names, roles);
    Object.entries(office).forEach(([pid, items]) => {
      (byProposal[pid] = byProposal[pid] || []).push(...items);
    });

    list.forEach(p => {
      p.endorsements = byProposal[p.proposal_id] || [];
      if (p.returned_by) p.returned_by_role = roles[p.returned_by] || null;
      if (p.decided_by) p.decided_by_role = roles[p.decided_by] || null;
    });
  } catch (err) {
    console.error('attachTrail failed:', err.message || err);
  }
  return list;
};

module.exports = {
  CHAIN, SCOPE, ROLE_LABEL, NOTE_MIN, NOTE_MAX,
  ownerOf, endorsersFor, nextStage, endorsedRoles, inScope, notifyIds, roundOf, attachTrail,
};