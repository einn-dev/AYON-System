const supabase = require('../config/supabase');
const { activeHolders } = require('./roleNotify');

/* ─────────────────────────────────────────────────────────────
   College endorsement chain.
   A submitted (or resubmitted) proposal goes through these college roles,
   in this order, before it reaches the Special Assistant.

   To change the order later, only change CHAIN below.
   SCOPE says how each role is matched to the researcher:
     college    → same college as the researcher
     department → same department as the researcher
   A role with no active account for that college/department is skipped.
   ───────────────────────────────────────────────────────────── */
const CHAIN = ['research_coordinator', 'chairperson', 'college_dean'];

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
    .from('users').select('user_id, first_name, last_name, college, department')
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
   Returns { role, ids } or null when every remaining step is skipped. */
const nextStage = async (owner, from = 0) => {
  for (let i = from; i < CHAIN.length; i += 1) {
    const ids = await endorsersFor(CHAIN[i], owner);
    if (ids.length) return { role: CHAIN[i], ids };
  }
  return null;
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

/* Adds to each proposal (best effort, never throws):
     endorsements     : [{ endorser_role, endorse_status, remarks, date, round, endorser_name }]
     returned_by_role : role of the person who returned it (when returned)
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
    list.forEach(p => { if (p.returned_by) people.add(p.returned_by); });

    let names = {};
    let roles = {};
    if (people.size) {
      const pid = [...people];
      const [{ data: us }, { data: rs }] = await Promise.all([
        supabase.from('users').select('user_id, first_name, last_name').in('user_id', pid),
        supabase.from('user_roles').select('user_id, role_type').in('user_id', pid),
      ]);
      (us || []).forEach(u => { names[u.user_id] = [u.first_name, u.last_name].filter(Boolean).join(' '); });
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

    list.forEach(p => {
      p.endorsements = byProposal[p.proposal_id] || [];
      if (p.returned_by) p.returned_by_role = roles[p.returned_by] || null;
    });
  } catch (err) {
    console.error('attachTrail failed:', err.message || err);
  }
  return list;
};

module.exports = {
  CHAIN, SCOPE, ROLE_LABEL, NOTE_MIN, NOTE_MAX,
  ownerOf, endorsersFor, nextStage, inScope, notifyIds, roundOf, attachTrail,
};