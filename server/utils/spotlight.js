const supabase = require('../config/supabase');

/* ─────────────────────────────────────────────────────────────
   Form 001 (travel to present a paper) and Form 003 (presentation incentive)
   must be for a Research Spotlight of the same researcher that is already
   Approved. Form 008 (attending a conference) and the publication forms do not.
   research_proposals.spotlight_id keeps which one. See add_grant_types.sql.
   ───────────────────────────────────────────────────────────── */

/* Works out the spotlight_id to save.
   needs = the chosen form asks for a Research Spotlight (grantForms.js)
   Returns { id }  (id is null when the form does not need one)
        or { fail: [httpStatus, body] }                                      */
const checkSpotlight = async ({ needs, raw, userId, required }) => {
  if (!needs) return { id: null };
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) {
    return required
      ? { fail: [400, { message: 'Please choose the approved Research Spotlight this application is for.', code: 'SPOTLIGHT_REQUIRED' }] }
      : { id: null };
  }
  const { data, error } = await supabase.from('research_proposals')
    .select('proposal_id, user_id, proposal_type, status')
    .eq('proposal_id', id).maybeSingle();
  if (error) throw error;
  const ok = data && Number(data.user_id) === Number(userId)
    && data.proposal_type === 'research_spotlight' && data.status === 'approved';
  if (!ok) {
    return { fail: [400, { message: 'That research is not one of your approved Research Spotlight entries. Please choose again.', code: 'SPOTLIGHT_INVALID' }] };
  }
  return { id };
};

/* adds spotlight_title to each row that has a spotlight_id */
const attachSpotlight = async (rows) => {
  const ids = [...new Set((rows || []).map(r => r && r.spotlight_id).filter(Boolean))];
  if (!ids.length) return rows;
  try {
    const { data } = await supabase.from('research_proposals').select('proposal_id, title').in('proposal_id', ids);
    const title = Object.fromEntries((data || []).map(p => [String(p.proposal_id), p.title]));
    rows.forEach(r => { if (r && r.spotlight_id) r.spotlight_title = title[String(r.spotlight_id)] || null; });
  } catch (err) {
    console.error('attachSpotlight error:', err);   // the list still loads without the titles
  }
  return rows;
};

module.exports = { checkSpotlight, attachSpotlight };