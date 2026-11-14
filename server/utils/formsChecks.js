const supabase = require('../config/supabase');
const { GRANT_TYPES } = require('./terms');
const { roundOf } = require('./endorsementChain');
const { fullName } = require('./roleNotify');
const {
  GRANT_FORMS, FORMS_OF_TYPE, formOf, stepOf, fieldsProblem, stepProblem, cleanFields, cleanStep,
} = require('./grantForms');

/* ─────────────────────────────────────────────────────────────
   Grants and Incentives applications follow an MSIRC form (see grantForms.js).
     research_proposals.form_no    which form: '001', '008', '003', '002', '004'
     research_proposals.form_data  what the applicant filled in
     proposal_form_checks          what each office ticked and filled in on its step,
                                   saved when that office signs
   See add_grant_forms.sql.
   ───────────────────────────────────────────────────────────── */

const parse = (raw) => {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}') || {}; } catch { return {}; }
};

/* The form chosen and its fields, from a submit or draft request.
   current = the saved draft (when editing one).
   Returns { form_no, form_data, form } or { fail: [status, body] }               */
const readForm = ({ body, type, submit, current }) => {
  if (!GRANT_TYPES.includes(type)) return { form_no: null, form_data: {}, form: null };
  const no = body.form_no !== undefined ? String(body.form_no || '').trim() : String((current && current.form_no) || '');
  const allowed = FORMS_OF_TYPE[type] || [];
  if (!no) {
    return submit
      ? { fail: [400, { message: 'Please choose which form applies to your application.', code: 'FORM_REQUIRED' }] }
      : { form_no: null, form_data: {}, form: null };
  }
  if (!allowed.includes(no)) return { fail: [400, { message: 'That form does not belong to this type of application.', code: 'FORM_INVALID' }] };
  const form = GRANT_FORMS[no];
  const data = cleanFields(form, body.form_data !== undefined ? parse(body.form_data) : ((current && current.form_data) || {}));
  if (submit) {
    const problem = fieldsProblem(form, data);
    if (problem) return { fail: [400, { message: problem, code: 'FORM_INCOMPLETE' }] };
  }
  return { form_no: no, form_data: data, form };
};

/* The checklist an office sends when it signs.
   Returns { value: null } when this form has nothing for that office,
           { value }      when it is complete,
        or { fail: [status, body] }                                               */
const readStep = (proposal, role, raw) => {
  const step = stepOf(proposal, role);
  if (!step) return { value: null };
  const value = cleanStep(step, parse(raw));
  const problem = stepProblem(step, value);
  if (problem) return { fail: [400, { message: problem, code: 'FORM_CHECK_REQUIRED' }] };
  return { value };
};

const saveStep = async (proposal, role, user, value) => {
  if (!value) return;
  const round = roundOf(proposal);
  try {
    await supabase.from('proposal_form_checks').delete()
      .eq('proposal_id', proposal.proposal_id).eq('round', round).eq('role', role);
    const { error } = await supabase.from('proposal_form_checks').insert({
      proposal_id: proposal.proposal_id, round, role,
      user_id: user.user_id, signer_name: fullName(user) || null,
      ticks: value.ticks, answers: value.answers,
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (err) {
    console.error('saveStep error:', err);   // the signing itself is already saved
  }
};

/* adds form_checks (this round's) to each row that follows a form */
const attachFormChecks = async (rows) => {
  const list = (rows || []).filter((r) => r && formOf(r));
  if (!list.length) return rows;
  try {
    const { data } = await supabase.from('proposal_form_checks')
      .select('proposal_id, round, role, signer_name, ticks, answers, created_at')
      .in('proposal_id', list.map((r) => r.proposal_id));
    list.forEach((r) => {
      r.form_checks = (data || []).filter((c) => Number(c.proposal_id) === Number(r.proposal_id) && Number(c.round) === roundOf(r));
    });
  } catch (err) {
    console.error('attachFormChecks error:', err);
  }
  return rows;
};

module.exports = { readForm, readStep, saveStep, attachFormChecks };