const supabase = require('../config/supabase');
const { ROLE_LABEL } = require('./terms');

/* ─────────────────────────────────────────────────────────────
   Electronic signatures (Option A: a saved signature image + a ticked
   confirmation box, recorded with the time and the person's account).

   Who signs, and when:
     Research Coordinator, Chairperson, College Dean → Endorse and Sign
     Special Assistant                               → Validate and Forward
     MSIRC Director                                  → Endorse to OVCRED / Approve
     OVCRED                                          → Grant Final Approval
   Returning or rejecting never signs.
   ───────────────────────────────────────────────────────────── */

const SIGNER_ROLES = [
  'research_coordinator', 'chairperson', 'college_dean',
  'special_assistant', 'msric_director', 'ovcred',
];

const ACTION_LABEL = {
  endorse:           'Endorsed',
  validate:          'Validated and forwarded',
  endorse_to_ovcred: 'Endorsed to OVCRED',
  approve:           'Approved',
  final_approval:    'Granted final approval',
};

const MAX_BYTES = 1024 * 1024;                       // 1 MB image
const DATA_URL  = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/;

/* The office status change that signs, for this role (null = no signature) */
const officeAction = (role, toStatus) => {
  if (role === 'special_assistant' && toStatus === 'under_review') return 'validate';
  if (role === 'msric_director'    && toStatus === 'endorsed')     return 'endorse_to_ovcred';
  if (role === 'msric_director'    && toStatus === 'approved')     return 'approve';
  if (role === 'ovcred'            && toStatus === 'approved')     return 'final_approval';
  return null;
};

/* The table is missing until add_signatures.sql is run */
const tableMissing = (err) => /user_signatures|proposal_signatures|does not exist|schema cache/i
  .test(String(err?.message || err?.details || ''));

/* Checks a data URL: PNG or JPG, really an image, 1 MB or smaller.
   Returns { ok, image } or { ok:false, message }. */
const checkImage = (value) => {
  const raw = String(value || '').trim();
  const m = raw.match(DATA_URL);
  if (!m) return { ok: false, message: 'The signature must be a PNG or JPG image.' };

  const b64 = m[2].replace(/\s/g, '');
  let buf;
  try { buf = Buffer.from(b64, 'base64'); } catch { buf = null; }
  if (!buf || buf.length < 50) return { ok: false, message: 'The signature image is empty or damaged.' };
  if (buf.length > MAX_BYTES)  return { ok: false, message: 'The signature image is too large. The limit is 1 MB.' };

  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (!isPng && !isJpg) return { ok: false, message: 'The signature must be a PNG or JPG image.' };

  return { ok: true, image: `data:image/${isPng ? 'png' : 'jpeg'};base64,${b64}` };
};

/* The saved signature of a person, or null */
const getSignature = async (userId) => {
  const { data, error } = await supabase
    .from('user_signatures').select('image_data, updated_at')
    .eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data || null;
};

/* Before a signing action: a saved signature and the ticked box are both needed.
   Returns { ok, signature } or { ok:false, status, body } to send back. */
const requireSignature = async (req) => {
  if ((req.body || {}).attest !== true) {
    return { ok: false, status: 400, body: {
      message: 'Please tick the box to confirm that you are signing this proposal.',
      code: 'ATTEST_REQUIRED',
    } };
  }
  let sig;
  try {
    sig = await getSignature(req.user.user_id);
  } catch (err) {
    if (tableMissing(err)) {
      return { ok: false, status: 503, body: {
        message: 'Signatures are not set up in the database yet. Please ask the Administrator to run add_signatures.sql.',
        code: 'SIGNATURES_NOT_READY',
      } };
    }
    throw err;
  }
  if (!sig) {
    return { ok: false, status: 400, body: {
      message: 'You have no saved signature yet. Add one in your profile under "My Signature" first.',
      code: 'SIGNATURE_REQUIRED',
    } };
  }
  return { ok: true, signature: sig };
};

/* Places the signature on the proposal (a copy of the image, so a later change
   of signature never changes this one). Never throws. */
const recordSignature = async ({ proposalId, user, role, action, round, image }) => {
  try {
    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()
      || user?.email || ROLE_LABEL[role] || 'Signer';
    const { error } = await supabase.from('proposal_signatures').insert({
      proposal_id: Number(proposalId),
      signer_id:   user?.user_id ?? null,
      signer_role: role,
      signer_name: name.slice(0, 120),
      action,
      round:       Number(round) || 1,
      image_data:  image,
      signed_at:   new Date().toISOString(),
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('recordSignature failed:', err.message || err);
    return false;
  }
};

/* All signatures on a proposal, oldest first */
const signaturesOf = async (proposalId) => {
  const { data, error } = await supabase
    .from('proposal_signatures')
    .select('signature_id, signer_role, signer_name, action, round, image_data, signed_at')
    .eq('proposal_id', proposalId)
    .order('signed_at', { ascending: true });
  if (error) {
    if (tableMissing(error)) return [];
    throw error;
  }
  return (data || []).map(s => ({
    ...s,
    role_label:   ROLE_LABEL[s.signer_role] || s.signer_role,
    action_label: ACTION_LABEL[s.action] || s.action,
  }));
};

module.exports = {
  SIGNER_ROLES, ACTION_LABEL, MAX_BYTES,
  officeAction, checkImage, getSignature, requireSignature, recordSignature, signaturesOf, tableMissing,
};