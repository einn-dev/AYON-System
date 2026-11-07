const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');
const { withOptionalColumns } = require('../utils/optionalColumns');
const { notifyRole, fullName, notifyStaff, nameAndCollege } = require('../utils/roleNotify');
const { notifyUser } = require('../utils/notify');
const { statusLabel, TYPE_LABEL } = require('../utils/terms');
const {
  CHAIN, ROLE_LABEL, NOTE_MIN, NOTE_MAX,
  ownerOf, nextStage, endorsedRoles, inScope, notifyIds, roundOf, attachTrail,
} = require('../utils/endorsementChain');
const {
  readUpload, readIds, uploadAll, listFiles, attachFiles, planChange, applyChange, removeKeys, keyFromPath,
} = require('../utils/proposalFiles');
const {
  officeAction, requireSignature, recordSignature, signaturesOf, ACTION_LABEL,
} = require('../utils/signatures');

/* One audit line per signature: who signed, as what, for which round */
const auditSignature = (req, proposalId, title, role, action, round) => logAudit(req, {
  action:     'proposal_signed',
  targetType: 'proposal',
  targetId:   proposalId,
  targetName: title,
  details:    { role, signed_as: ROLE_LABEL[role] || role, step: ACTION_LABEL[action] || action, round },
});

const REASON_MIN = 10;
const REASON_MAX = 500;
const TITLE_MAX  = 255;
const DESC_MAX   = 10000;

/* ── GET my proposals ── */
const getMyProposals = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('research_proposals')
      .select('*')
      .eq('user_id', req.user.user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    await attachTrail(data || []);
    await attachFiles(data || []);
    return res.status(200).json({ proposals: data || [] });
  } catch (err) {
    console.error('getMyProposals error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST submit proposal, or save it as a draft ──
   multipart body:
     proposal_type, title, description
     save_as            'draft' | 'submit' (default 'submit')
     file               the Main Proposal Document (required to submit, optional for a draft)
     supporting[]       up to 4 supporting documents
     supporting_labels  JSON array, one label per supporting document, in the same order
   A draft is seen only by the researcher: nobody is notified and nothing is signed. */
const submitProposal = async (req, res) => {
  const body    = req.body || {};
  const asDraft = String(body.save_as || '').trim().toLowerCase() === 'draft';
  const type    = String(body.proposal_type || '').trim();
  const title   = String(body.title ?? '').trim();
  const desc    = String(body.description ?? '').trim();

  if (!TYPE_LABEL[type]) return res.status(400).json({ message: 'Please choose a proposal type.' });
  const textProblem = checkText({ title, desc, needTitle: !asDraft });
  if (textProblem) return res.status(400).json(textProblem);

  const up = readUpload(req);
  if (up.error) return res.status(400).json({ message: up.error });
  if (!asDraft && !up.main) {
    return res.status(400).json({ message: 'Please attach the Main Proposal Document before you submit.', code: 'MAIN_REQUIRED' });
  }

  let rows;
  try {
    rows = await uploadAll(up, req.user.user_id);
  } catch (err) {
    console.error('Supabase upload error:', err);
    return res.status(500).json({ message: 'File upload failed. Please try again.' });
  }
  const main = rows.find(r => r.kind === 'main');

  try {
    /* saved as a draft first; submitting then moves it on (so a failed step never loses the work) */
    const now = new Date().toISOString();
    const { data: proposal, error: propError } = await supabase.from('research_proposals')
      .insert({
        user_id: req.user.user_id,
        proposal_type: type,
        title,
        description: desc || null,
        file_path:   main ? main.file_path : null,
        status:      'draft',
        created_at:  now,
        updated_at:  now,
      })
      .select('proposal_id').single();
    if (propError) throw propError;

    if (rows.length) {
      const { error: fErr } = await supabase.from('proposal_files')
        .insert(rows.map(r => ({ ...r, proposal_id: proposal.proposal_id })));
      if (fErr) {
        await supabase.from('research_proposals').delete().eq('proposal_id', proposal.proposal_id);
        throw fErr;
      }
    }

    if (asDraft) {
      return res.status(201).json({
        message:     'Draft saved. You can finish it later from My Proposals.',
        proposal_id: proposal.proposal_id,
        status:      'draft',
      });
    }

    const started = await startReview(req, { proposal_id: proposal.proposal_id, user_id: req.user.user_id, title });
    return res.status(201).json({ ...started, proposal_id: proposal.proposal_id });
  } catch (err) {
    await removeKeys(rows.map(r => r.storage_key));
    console.error('submitProposal error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* Title and abstract limits. Returns an error body, or null. */
const checkText = ({ title, desc, needTitle }) => {
  if (needTitle && !title) return { message: 'Please enter the research title.', code: 'TITLE_REQUIRED' };
  if (title && title.length > TITLE_MAX) return { message: `Title must be ${TITLE_MAX} characters or fewer.` };
  if (desc && desc.length > DESC_MAX) return { message: `Description must be ${DESC_MAX} characters or fewer.` };
  return null;
};

/* Moves a draft into the review: to the first college endorser who has an account,
   or straight to the Special Assistant. Tells the researcher and whoever has it now. */
const startReview = async (req, proposal) => {
  const owner = await ownerOf(proposal.user_id);
  const stage = await nextStage(owner);
  const now   = new Date().toISOString();
  const patch = { status: stage ? 'for_endorsement' : 'submitted', submitted_at: now, updated_at: now };
  if (stage) patch.endorsement_stage = stage.role;

  /* only if it is still a draft: a double click submits once */
  const { data: changed, error } = await supabase.from('research_proposals')
    .update(patch)
    .eq('proposal_id', proposal.proposal_id)
    .eq('status', 'draft')
    .select('proposal_id');
  if (error) throw error;
  if (!changed || !changed.length) {
    return { message: 'This proposal was already submitted.', status: null, already: true };
  }

  const { data: sub } = await supabase.from('submissions')
    .select('submission_id').eq('proposal_id', proposal.proposal_id).maybeSingle();
  if (!sub) {
    await supabase.from('submissions').insert({ proposal_id: proposal.proposal_id, submission_status: 'pending' });
  }

  const title = proposal.title;
  await supabase.from('notifications').insert({
    user_id:     proposal.user_id,
    proposal_id: proposal.proposal_id,
    notif_type:  'submission',
    title:       'Proposal Submitted',
    message:     stage
      ? `Your proposal "${title}" has been submitted. It is now waiting for endorsement by the ${ROLE_LABEL[stage.role]}.`
      : `Your proposal "${title}" has been submitted successfully.`,
  });

  const by = fullName(owner) || fullName(req.user) || 'a researcher';
  if (stage) {
    /* the first college endorser has it */
    await notifyIds(stage.ids.filter(id => Number(id) !== Number(proposal.user_id)), {
      proposal_id: proposal.proposal_id,
      notif_type:  'endorsement',
      title:       'Proposal waiting for your endorsement',
      message:     `"${title}" by ${by} is waiting for your endorsement.`,
    });
  } else {
    /* no college endorsers for this researcher: the Special Assistants have it */
    await notifyRole('special_assistant', {
      proposal_id: proposal.proposal_id,
      notif_type:  'submission',
      title:       'New submission to validate',
      message:     `"${title}" was submitted by ${by}.`,
    }, { exclude: [proposal.user_id] });
    await notifyStaff({
      proposal_id: proposal.proposal_id,
      notif_type:  'submission',
      title:       'New proposal at MSIRC',
      message:     `"${title}" by ${nameAndCollege(owner, by)} was submitted. It is now with the Special Assistant.`,
    });
  }

  return {
    message: stage
      ? `Proposal submitted. It is now with the ${ROLE_LABEL[stage.role]} for endorsement.`
      : 'Proposal submitted successfully.',
    status: stage ? 'for_endorsement' : 'submitted',
  };
};

/* The researcher's own draft, or an error to send */
const ownDraft = async (req) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) return { fail: [400, { message: 'Invalid proposal.' }] };
  const { data: proposal, error } = await supabase
    .from('research_proposals').select('*').eq('proposal_id', id).maybeSingle();
  if (error) throw error;
  /* somebody else's proposal looks the same as one that does not exist */
  if (!proposal || Number(proposal.user_id) !== Number(req.user.user_id)) {
    return { fail: [404, { message: 'Proposal not found.' }] };
  }
  if (proposal.status !== 'draft') {
    return { fail: [409, { message: 'This proposal was already submitted, so it is no longer a draft.', code: 'NOT_DRAFT' }] };
  }
  return { proposal };
};

/* ── PUT edit a draft, and save it again or submit it ──
   Same multipart body as submitting, plus:
     remove_files   JSON array of file_id values to remove (supporting documents only)
   Fields that are not sent keep their saved value.                              */
const updateDraft = async (req, res) => {
  const body    = req.body || {};
  const submit  = String(body.save_as || '').trim().toLowerCase() === 'submit';
  try {
    const found = await ownDraft(req);
    if (found.fail) return res.status(found.fail[0]).json(found.fail[1]);
    const draft = found.proposal;

    const type  = body.proposal_type !== undefined ? String(body.proposal_type).trim() : draft.proposal_type;
    const title = body.title !== undefined ? String(body.title).trim() : String(draft.title || '').trim();
    const desc  = body.description !== undefined ? String(body.description).trim() : String(draft.description || '').trim();
    if (!TYPE_LABEL[type]) return res.status(400).json({ message: 'Please choose a proposal type.' });
    const textProblem = checkText({ title, desc, needTitle: submit });
    if (textProblem) return res.status(400).json(textProblem);

    const up = readUpload(req);
    if (up.error) return res.status(400).json({ message: up.error });
    const removeIds = readIds(body.remove_files);
    const current   = await listFiles(draft.proposal_id);
    const kinds     = [...(up.main ? [{ kind: 'main' }] : []), ...up.supporting.map(() => ({ kind: 'supporting' }))];
    const plan      = planChange(withLegacy(current, draft), { add: kinds, removeIds });
    if (!plan.ok) return res.status(400).json({ message: plan.error });
    if (submit && !plan.hasMain) {
      return res.status(400).json({ message: 'Please attach the Main Proposal Document before you submit.', code: 'MAIN_REQUIRED' });
    }

    let rows;
    try {
      rows = await uploadAll(up, req.user.user_id);
    } catch (err) {
      console.error('Supabase upload error:', err);
      return res.status(500).json({ message: 'File upload failed. Please try again.' });
    }

    const newMain = rows.find(r => r.kind === 'main');
    const keptMain = plan.keep.find(f => f.kind === 'main');
    const { data: changed, error: updErr } = await supabase.from('research_proposals')
      .update({
        proposal_type: type,
        title,
        description: desc || null,
        file_path:   newMain ? newMain.file_path : (keptMain ? keptMain.file_path : null),
        updated_at:  new Date().toISOString(),
      })
      .eq('proposal_id', draft.proposal_id)
      .eq('status', 'draft')
      .select('proposal_id');
    if (updErr) { await removeKeys(rows.map(r => r.storage_key)); throw updErr; }
    if (!changed || !changed.length) {
      await removeKeys(rows.map(r => r.storage_key));
      return res.status(409).json({ message: 'This proposal was already submitted, so it is no longer a draft.', code: 'NOT_DRAFT' });
    }
    await applyChange(draft.proposal_id, { ...plan, removed: plan.removed.filter(f => f.file_id) }, rows);

    if (!submit) {
      return res.status(200).json({ message: 'Draft saved.', proposal_id: draft.proposal_id, status: 'draft' });
    }
    const started = await startReview(req, { proposal_id: draft.proposal_id, user_id: draft.user_id, title });
    return res.status(200).json({ ...started, proposal_id: draft.proposal_id });
  } catch (err) {
    console.error('updateDraft error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* an older proposal whose single file (file_path) has no proposal_files row yet:
   that file counts as its Main Proposal Document */
const withLegacy = (current, p) => (current.some(f => f.kind === 'main') || !p.file_path
  ? current
  : [{ file_id: null, kind: 'main', label: 'Main Proposal Document', file_path: p.file_path }, ...current]);

/* ── DELETE a draft (owner only) ── */
const deleteDraft = async (req, res) => {
  try {
    const found = await ownDraft(req);
    if (found.fail) return res.status(found.fail[0]).json(found.fail[1]);
    const draft = found.proposal;

    const files = await listFiles(draft.proposal_id).catch(() => []);
    const { data: gone, error } = await supabase.from('research_proposals')
      .delete()
      .eq('proposal_id', draft.proposal_id)
      .eq('status', 'draft')
      .select('proposal_id');
    if (error) throw error;
    if (gone && !gone.length) {
      return res.status(409).json({ message: 'This proposal was already submitted, so it is no longer a draft.', code: 'NOT_DRAFT' });
    }
    await supabase.from('proposal_files').delete().eq('proposal_id', draft.proposal_id);
    await removeKeys([
      ...files.map(f => f.storage_key || keyFromPath(f.file_path)),
      ...(files.length ? [] : [keyFromPath(draft.file_path)]),
    ]);
    return res.status(200).json({ message: 'Draft deleted.' });
  } catch (err) {
    console.error('deleteDraft error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET all proposals — WITH COLLEGE-BASED FILTERING ──
   - Coordinator & Dean   → only proposals from THEIR college
   - Chairperson          → only proposals from THEIR department
   - Staff/SA/Director/OVCRED/Admin → see everything (institution-wide)   */
const COLLEGE_SCOPED_ROLES    = ['research_coordinator', 'college_dean'];
const DEPARTMENT_SCOPED_ROLES = ['chairperson'];

/* ── What MSIRC Staff may see ──
   Only proposals that finished the college endorsements and reached the Special Assistant.
   A returned proposal stays visible only if the office (Special Assistant, Director or
   OVCRED) returned it, because then it had already reached the Special Assistant.
   Staff get the list fields only: no abstract, no file, no notes.                    */
const STAFF_STATUSES = ['submitted', 'under_review', 'endorsed', 'approved', 'rejected'];
const OFFICE_ROLES   = ['special_assistant', 'msric_director', 'ovcred'];

const staffCanSee = (p) => {
  if (STAFF_STATUSES.includes(p.status)) return true;
  if (p.status !== 'returned') return false;
  if (p.returned_by_role) return OFFICE_ROLES.includes(p.returned_by_role);
  /* older returns saved no "returned by": show them unless the college returned it */
  return !p.returned_by && !(p.endorsements || []).some(e => e.endorse_status === 'returned' && Number(e.round || 1) === roundOf(p));
};

const staffFields = (p) => ({
  proposal_id:   p.proposal_id,
  title:         p.title,
  proposal_type: p.proposal_type,
  status:        p.status,
  submitted_at:  p.submitted_at,
  first_name:    p.first_name,
  last_name:     p.last_name,
  college:       p.college,
});

const getAllProposals = async (req, res) => {
  try {
    const role = req.user.role;

    /* Base query with researcher info joined */
    let query = supabase
      .from('research_proposals')
      .select(`
        *,
        users!inner (
          first_name, last_name, email,
          college, department
        )
      `)
      .order('created_at', { ascending: false });

    /* Apply scoping for college-level endorsers */
    if (COLLEGE_SCOPED_ROLES.includes(role) || DEPARTMENT_SCOPED_ROLES.includes(role)) {
      // Look up the endorser's own college/department
      const { data: me } = await supabase
        .from('users')
        .select('college, department')
        .eq('user_id', req.user.user_id)
        .single();

      if (COLLEGE_SCOPED_ROLES.includes(role)) {
        if (!me?.college) {
          return res.status(200).json({
            proposals: [],
            notice: 'Your account has no college assigned. Ask the admin to set your college so you can see proposals from your college.',
          });
        }
        query = query.eq('users.college', me.college);
      }

      if (DEPARTMENT_SCOPED_ROLES.includes(role)) {
        if (!me?.department) {
          return res.status(200).json({
            proposals: [],
            notice: 'Your account has no department assigned. Ask the admin to set your department so you can see proposals from your department.',
          });
        }
        query = query.eq('users.department', me.department);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    /* drafts belong to the researcher only */
    const proposals = data.filter(p => p.status !== 'draft').map(p => ({
      ...p,
      first_name: p.users?.first_name,
      last_name:  p.users?.last_name,
      email:      p.users?.email,
      college:    p.users?.college,
      department: p.users?.department,
    }));

    await attachTrail(proposals);

    /* MSIRC Staff: only proposals that reached the Special Assistant, and only the list fields */
    if (role === 'msric_staff') {
      return res.status(200).json({ proposals: proposals.filter(staffCanSee).map(staffFields) });
    }

    await attachFiles(proposals);
    return res.status(200).json({ proposals });
  } catch (err) {
    console.error('getAllProposals error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET single proposal ── */
const getProposalById = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('research_proposals')
      .select(`*, users ( first_name, last_name, email, college, department )`)
      .eq('proposal_id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ message: 'Proposal not found.' });

    /* College/department scoping also applies to single-proposal view */
    const role = req.user.role;
    if (role === 'msric_staff') {
      return res.status(403).json({ message: 'MSIRC Staff can see the list of proposals but not their contents.' });
    }
    /* a researcher may only open their own proposals */
    if (role === 'researcher' && Number(data.user_id) !== Number(req.user.user_id)) {
      return res.status(403).json({ message: 'This is not your proposal.' });
    }
    /* a draft is seen only by the researcher who is writing it */
    if (data.status === 'draft' && Number(data.user_id) !== Number(req.user.user_id)) {
      return res.status(404).json({ message: 'Proposal not found.' });
    }
    if (COLLEGE_SCOPED_ROLES.includes(role) || DEPARTMENT_SCOPED_ROLES.includes(role)) {
      const { data: me } = await supabase
        .from('users')
        .select('college, department')
        .eq('user_id', req.user.user_id)
        .single();

      if (COLLEGE_SCOPED_ROLES.includes(role) && data.users?.college !== me?.college) {
        return res.status(403).json({ message: 'This proposal is outside your college.' });
      }
      if (DEPARTMENT_SCOPED_ROLES.includes(role) && data.users?.department !== me?.department) {
        return res.status(403).json({ message: 'This proposal is outside your department.' });
      }
    }

    await attachTrail([data]);
    await attachFiles([data]);
    return res.status(200).json({
      proposal: {
        ...data,
        first_name: data.users?.first_name,
        last_name:  data.users?.last_name,
        email:      data.users?.email,
        college:    data.users?.college,
        department: data.users?.department,
      },
    });
  } catch (err) {
    console.error('getProposalById error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PATCH update proposal status ──
   Returning a proposal needs a reason: the researcher has to know what to fix. */
const updateProposalStatus = async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body || {};
  const reason     = String((req.body || {}).reason || '').trim();

  const validStatuses = [
    'submitted','under_review','returned','endorsed','approved','rejected',
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  if (status === 'returned') {
    if (reason.length < REASON_MIN) {
      return res.status(400).json({
        message: `Please tell the researcher what to fix (at least ${REASON_MIN} characters).`,
        code: 'REASON_REQUIRED',
      });
    }
    if (reason.length > REASON_MAX) {
      return res.status(400).json({ message: `The reason must be ${REASON_MAX} characters or fewer.` });
    }
  }

  try {
    const { data: proposal } = await supabase
      .from('research_proposals')
      .select('*')
      .eq('proposal_id', id)
      .single();

    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    if (proposal.status === 'draft') {
      return res.status(400).json({ message: 'This proposal is still a draft. The researcher has not submitted it yet.' });
    }

    /* the college has it: the office acts only after the last college endorsement */
    if (proposal.status === 'for_endorsement') {
      return res.status(409).json({
        message: 'This proposal is still at the college endorsement stage.',
        code: 'AT_COLLEGE',
      });
    }

    if (status === 'returned') {
      if (proposal.status === 'returned') {
        return res.status(400).json({ message: 'This proposal was already returned to the researcher.' });
      }
      if (proposal.status === 'draft') {
        return res.status(400).json({ message: 'This proposal is still a draft. The researcher has not submitted it yet.' });
      }

      const now = new Date().toISOString();
      const { error } = await withOptionalColumns(
        (payload) => supabase.from('research_proposals').update(payload).eq('proposal_id', id),
        { status, updated_at: now },
        { return_reason: reason, returned_at: now, returned_by: req.user.user_id, endorsement_stage: null },
      );
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id:     proposal.user_id,
        proposal_id: parseInt(id),
        notif_type:  'review',
        title:       'Proposal Returned: Changes Needed',
        message:     `Your proposal "${proposal.title}" was returned by the ${ROLE_LABEL[req.user.role] || 'office'}. Reason: ${reason}`,
      });

      await logAudit(req, {
        action:     'proposal_returned',
        targetType: 'proposal',
        targetId:   id,
        targetName: proposal.title,
        details:    { from: proposal.status, reason },
      });

      return res.status(200).json({ message: 'Proposal returned to the researcher.' });
    }

    /* Validate and Forward, Endorse to OVCRED, Approve and Grant Final Approval are signed */
    const signAs  = officeAction(req.user.role, status);
    let signature = null;
    if (signAs) {
      const FROM = { validate: 'submitted', endorse_to_ovcred: 'under_review', approve: 'under_review', final_approval: 'endorsed' };
      if (proposal.status !== FROM[signAs]) {
        return res.status(409).json({
          message: `This proposal is not at your stage. It is now: ${statusLabel(proposal.status)}.`,
          code: 'NOT_YOUR_STAGE',
        });
      }
      const sign = await requireSignature(req);
      if (!sign.ok) return res.status(sign.status).json(sign.body);
      signature = sign.signature;
    }

    /* only if nobody changed it in the meantime (a double click signs once) */
    const { data: changed, error } = await supabase
      .from('research_proposals')
      .update({ status })
      .eq('proposal_id', id)
      .eq('status', proposal.status)
      .select('proposal_id');

    if (error) throw error;
    if (!changed || !changed.length) {
      return res.status(409).json({ message: 'This proposal was just handled. Please reload the page.', code: 'ALREADY_HANDLED' });
    }

    if (signAs) {
      const round = roundOf(proposal);
      await recordSignature({
        proposalId: id, user: req.user, role: req.user.role, action: signAs, round, image: signature.image_data,
      });
      await auditSignature(req, id, proposal.title, req.user.role, signAs, round);
    }

    await supabase.from('notifications').insert({
      user_id:     proposal.user_id,
      proposal_id: parseInt(id),
      notif_type:  'review',
      title:       'Proposal Status Updated',
      message:     `The status of your proposal "${proposal.title}" is now: ${statusLabel(status)}.`,
    });

    /* tell the office that now has it on its desk (only when the stage really changed) */
    if (proposal.status !== status && ['submitted', 'under_review', 'endorsed'].includes(status)) {
      const { data: owner } = await supabase
        .from('users').select('first_name, last_name').eq('user_id', proposal.user_id).maybeSingle();
      const by   = fullName(owner) || 'the researcher';
      const next = {
        submitted:    ['special_assistant', 'submission',  'New submission to validate',
                       `"${proposal.title}" by ${by} is back in the Special Assistant queue.`],
        under_review: ['msric_director',    'review',      'Proposal ready for your review',
                       `"${proposal.title}" by ${by} was validated and forwarded for your review.`],
        endorsed:     ['ovcred',            'endorsement', 'Proposal awaiting your decision',
                       `"${proposal.title}" by ${by} was endorsed and is waiting for your decision.`],
      }[status];
      await notifyRole(next[0], {
        proposal_id: parseInt(id), notif_type: next[1], title: next[2], message: next[3],
      }, { exclude: [req.user.user_id] });
    }

    /* MSIRC Staff hear about final decisions (not each step inside the office) */
    if (proposal.status !== status && ['approved', 'rejected'].includes(status)) {
      const { data: owner } = await supabase
        .from('users').select('first_name, last_name, college').eq('user_id', proposal.user_id).maybeSingle();
      const decidedBy = ROLE_LABEL[req.user.role] || 'the office';
      await notifyStaff({
        proposal_id: id,
        notif_type:  status === 'approved' ? 'approval' : 'rejection',
        title:       status === 'approved' ? 'Proposal approved' : 'Proposal rejected',
        message:     status === 'approved'
          ? `"${proposal.title}" by ${nameAndCollege(owner)} was ${req.user.role === 'ovcred' ? 'given final approval by OVCRED' : `approved by the ${decidedBy}`}.`
          : `"${proposal.title}" by ${nameAndCollege(owner)} was rejected by the ${decidedBy}.`,
      });
    }

    return res.status(200).json({ message: signAs ? 'Status updated and signed.' : 'Status updated.', signed: !!signAs });
  } catch (err) {
    console.error('updateProposalStatus error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST edit and resubmit a returned proposal (owner only) ──
   Title / description / documents are optional, but something has to change.
     file               a new Main Proposal Document (replaces the old one)
     supporting[]       new supporting documents, with supporting_labels
     remove_files       JSON array of supporting file_id values to remove
   Documents that are not touched are kept.                                  */
const resubmitProposal = async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid proposal.' });

  const body       = req.body || {};
  const hasTitle   = body.title !== undefined;
  const hasDesc    = body.description !== undefined;
  const up         = readUpload(req);
  if (up.error) return res.status(400).json({ message: up.error });
  const removeIds  = readIds(body.remove_files);

  const titleIn = hasTitle ? String(body.title).trim() : null;
  const descIn  = hasDesc  ? (String(body.description).trim() || null) : undefined;

  if (hasTitle && !titleIn) return res.status(400).json({ message: 'Title cannot be empty.' });
  if (titleIn && titleIn.length > TITLE_MAX) {
    return res.status(400).json({ message: `Title must be ${TITLE_MAX} characters or fewer.` });
  }
  if (descIn && descIn.length > DESC_MAX) {
    return res.status(400).json({ message: `Description must be ${DESC_MAX} characters or fewer.` });
  }

  try {
    const { data: proposal, error: findErr } = await supabase
      .from('research_proposals')
      .select('*')
      .eq('proposal_id', id)
      .maybeSingle();
    if (findErr) throw findErr;

    /* somebody else's proposal looks the same as one that does not exist */
    if (!proposal || proposal.user_id !== req.user.user_id) {
      return res.status(404).json({ message: 'Proposal not found.' });
    }
    if (proposal.status !== 'returned') {
      return res.status(409).json({
        message: 'Only a returned proposal can be edited and resubmitted.',
        code: 'NOT_RETURNED',
      });
    }

    const titleChanged = hasTitle && titleIn !== proposal.title;
    const descChanged  = hasDesc  && descIn !== (proposal.description || null);
    const filesChanged = !!up.main || up.supporting.length > 0 || removeIds.length > 0;
    if (!titleChanged && !descChanged && !filesChanged) {
      return res.status(400).json({
        message: 'Nothing has changed yet. Edit the title or description, or change the documents.',
        code: 'NO_CHANGES',
      });
    }

    /* the document limits, checked before anything is uploaded */
    const current = await listFiles(proposal.proposal_id).catch(() => []);
    const kinds   = [...(up.main ? [{ kind: 'main' }] : []), ...up.supporting.map(() => ({ kind: 'supporting' }))];
    const plan    = planChange(withLegacy(current, proposal), { add: kinds, removeIds });
    if (!plan.ok) return res.status(400).json({ message: plan.error });
    if (!plan.hasMain) {
      return res.status(400).json({ message: 'Please attach the Main Proposal Document before you resubmit.', code: 'MAIN_REQUIRED' });
    }

    let rows = [];
    if (up.main || up.supporting.length) {
      try {
        rows = await uploadAll(up, req.user.user_id);
      } catch (err) {
        console.error('Supabase upload error:', err);
        return res.status(500).json({ message: 'File upload failed. Please try again.' });
      }
    }
    const newFile = (rows.find(r => r.kind === 'main') || {}).file_path || null;

    const now      = new Date().toISOString();
    const revision = (Number(proposal.revision_count) || 0) + 1;

    /* a resubmission starts again from the first college step (a new round) */
    const owner = await ownerOf(proposal.user_id);
    const stage = await nextStage(owner);
    const base  = { status: stage ? 'for_endorsement' : 'submitted', updated_at: now };
    if (titleChanged) base.title       = titleIn;
    if (descChanged)  base.description = descIn;
    if (newFile)      base.file_path   = newFile;

    /* only if it is still returned: a double click or a second tab changes nothing twice */
    const { data: changed, error: updErr } = await withOptionalColumns(
      (payload) => supabase.from('research_proposals')
        .update(payload)
        .eq('proposal_id', id)
        .eq('status', 'returned')
        .select('proposal_id'),
      base,
      { revision_count: revision, endorsement_stage: stage ? stage.role : null },
    );
    if (updErr) { await removeKeys(rows.map(r => r.storage_key)); throw updErr; }
    if (!changed || !changed.length) {
      await removeKeys(rows.map(r => r.storage_key));
      return res.status(409).json({
        message: 'This proposal was just changed. Please reload the page.',
        code: 'NOT_RETURNED',
      });
    }

    /* the documents (an old single file without a row is simply replaced by file_path above) */
    if (filesChanged) {
      await applyChange(proposal.proposal_id, { ...plan, removed: plan.removed.filter(f => f.file_id) }, rows);
    }

    const finalTitle = titleChanged ? titleIn : proposal.title;

    /* the office validates it again from scratch (best effort) */
    const { error: subErr } = await supabase
      .from('submissions').update({ submission_status: 'pending' }).eq('proposal_id', id);
    if (subErr) console.error('resubmit submissions reset failed:', subErr.message || subErr);

    /* tell the researcher, and whoever now has it in their queue */
    const notes = [{
      user_id:     proposal.user_id,
      proposal_id: proposal.proposal_id,
      notif_type:  'submission',
      title:       'Proposal Resubmitted',
      message:     stage
        ? `Your revised proposal "${finalTitle}" starts again from the college level. It is now with the ${ROLE_LABEL[stage.role]} for endorsement.`
        : `Your revised proposal "${finalTitle}" is back with MSIRC for validation.`,
    }];
    const { error: nErr } = await supabase.from('notifications').insert(notes);
    if (nErr) console.error('resubmit notification failed:', nErr.message || nErr);
    if (stage) {
      await notifyIds(stage.ids.filter(uid => Number(uid) !== Number(proposal.user_id)), {
        proposal_id: proposal.proposal_id,
        notif_type:  'endorsement',
        title:       'Resubmitted proposal waiting for your endorsement',
        message:     `"${finalTitle}" was edited and resubmitted by ${fullName(owner) || 'the researcher'} (round ${revision + 1}). It is waiting for your endorsement.`,
      });
    } else {
      await notifyRole('special_assistant', {
        proposal_id: proposal.proposal_id,
        notif_type:  'submission',
        title:       'Returned proposal resubmitted',
        message:     `"${finalTitle}" was edited and resubmitted by the researcher (revision ${revision}). It is in your queue again.`,
      });
      await notifyStaff({
        proposal_id: proposal.proposal_id,
        notif_type:  'submission',
        title:       'Resubmitted proposal at MSIRC',
        message:     `"${finalTitle}" by ${nameAndCollege(owner, 'the researcher')} was resubmitted and is with the Special Assistant again.`,
      });
    }

    await logAudit(req, {
      action:     'proposal_resubmitted',
      targetType: 'proposal',
      targetId:   proposal.proposal_id,
      targetName: finalTitle,
      details:    {
        revision, title_changed: !!titleChanged, description_changed: !!descChanged,
        file_replaced: !!newFile, files_added: up.supporting.length, files_removed: removeIds.length,
        next: stage ? stage.role : 'special_assistant',
      },
    });

    return res.status(200).json({
      message:        stage
        ? `Proposal resubmitted. It starts again from the college level and is now with the ${ROLE_LABEL[stage.role]}.`
        : 'Proposal resubmitted. It is back in the Special Assistant\'s queue.',
      status:         stage ? 'for_endorsement' : 'submitted',
      endorsement_stage: stage ? stage.role : null,
      revision_count: revision,
    });
  } catch (err) {
    console.error('resubmitProposal error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST endorse or return at the college level ──
   Chairperson → Research Coordinator → Dean, in that order. Only the role whose turn it is
   can act, and only for a researcher in their own college/department.
   A note (10–500 characters) is required both to endorse and to return.
   body: { decision: 'endorsed' | 'returned', remarks }
   (the older body { endorse_status: 'endorsed' | 'rejected' } still works;
    'rejected' now means "return to the researcher")                          */
const endorseProposal = async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid proposal.' });

  const body = req.body || {};
  let decision = String(body.decision || body.endorse_status || '').trim();
  if (decision === 'rejected' || decision === 'return') decision = 'returned';
  if (!['endorsed', 'returned'].includes(decision)) {
    return res.status(400).json({ message: 'Choose to endorse or to return the proposal.' });
  }

  const role = req.user.role;
  if (!CHAIN.includes(role)) {
    return res.status(403).json({ message: 'Only the college endorsers can do this.' });
  }

  const note = String(body.remarks ?? '').trim();
  if (note.length < NOTE_MIN) {
    return res.status(400).json({
      message: decision === 'endorsed'
        ? `Please write a note (at least ${NOTE_MIN} characters) before endorsing.`
        : `Please write what the researcher needs to fix (at least ${NOTE_MIN} characters).`,
      code: 'NOTE_REQUIRED',
    });
  }
  if (note.length > NOTE_MAX) {
    return res.status(400).json({ message: `The note must be ${NOTE_MAX} characters or fewer.` });
  }

  try {
    const { data: proposal, error: findErr } = await supabase
      .from('research_proposals').select('*').eq('proposal_id', id).maybeSingle();
    if (findErr) throw findErr;
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    const [owner, me] = await Promise.all([ownerOf(proposal.user_id), ownerOf(req.user.user_id)]);
    if (!inScope(role, me, owner)) {
      return res.status(403).json({ message: 'This proposal is outside your college or department.' });
    }

    if (proposal.status !== 'for_endorsement') {
      return res.status(409).json({
        message: 'This proposal is no longer waiting for college endorsement.',
        code: 'NOT_FOR_ENDORSEMENT',
      });
    }
    if (proposal.endorsement_stage !== role) {
      return res.status(409).json({
        message: `It is not your turn yet. This proposal is waiting for the ${ROLE_LABEL[proposal.endorsement_stage] || 'another endorser'}.`,
        code: 'NOT_YOUR_TURN',
      });
    }

    /* endorsing is signing: a saved signature and the ticked box are needed (returning never signs) */
    let signature = null;
    if (decision === 'endorsed') {
      const sign = await requireSignature(req);
      if (!sign.ok) return res.status(sign.status).json(sign.body);
      signature = sign.signature;
    }

    const now   = new Date().toISOString();
    const round = roundOf(proposal);
    const by    = fullName(owner) || 'the researcher';
    const actor = fullName(me) || ROLE_LABEL[role];

    /* only if it is still this role's turn: a double click or a second tab changes nothing twice */
    const guarded = (payload) => supabase.from('research_proposals')
      .update(payload)
      .eq('proposal_id', id)
      .eq('status', 'for_endorsement')
      .eq('endorsement_stage', role)
      .select('proposal_id');

    if (decision === 'endorsed') {
      /* the next college role that has not endorsed yet in this round
         (so a proposal that was mid-way when the order changed is not asked twice) */
      const done = await endorsedRoles(id, round);
      const next = await nextStage(owner, 0, [...done, role]);
      const { data: changed, error: updErr } = await guarded(
        next
          ? { endorsement_stage: next.role, updated_at: now }
          : { status: 'submitted', endorsement_stage: null, updated_at: now }
      );
      if (updErr) throw updErr;
      if (!changed || !changed.length) {
        return res.status(409).json({ message: 'This proposal was just handled. Please reload the page.', code: 'ALREADY_HANDLED' });
      }

      const { error: insErr } = await supabase.from('endorsements').insert({
        proposal_id:    Number(id),
        endorser_id:    req.user.user_id,
        endorser_role:  role,
        endorse_status: 'endorsed',
        remarks:        note,
        date_endorsed:  now,
        round,
      });
      if (insErr) console.error('endorsement row failed:', insErr.message || insErr);

      await recordSignature({
        proposalId: id, user: req.user, role, action: 'endorse', round, image: signature.image_data,
      });

      const whereTo = next ? `the ${ROLE_LABEL[next.role]}` : 'the Special Assistant for document validation';
      await notifyUser({
        user_id:     proposal.user_id,
        proposal_id: Number(id),
        notif_type:  'endorsement',
        title:       'Proposal Endorsed',
        message:     `Your proposal "${proposal.title}" was endorsed by the ${ROLE_LABEL[role]}. It is now with ${whereTo}. Note: ${note}`,
      });

      if (next) {
        await notifyIds(next.ids, {
          proposal_id: Number(id),
          notif_type:  'endorsement',
          title:       'Proposal waiting for your endorsement',
          message:     `"${proposal.title}" by ${by} was endorsed by the ${ROLE_LABEL[role]} and is waiting for your endorsement.`,
        });
      } else {
        await notifyRole('special_assistant', {
          proposal_id: Number(id),
          notif_type:  'submission',
          title:       'New submission to validate',
          message:     `"${proposal.title}" by ${by} completed the college endorsements and is ready for validation.`,
        });
        await notifyStaff({
          proposal_id: Number(id),
          notif_type:  'submission',
          title:       'New proposal at MSIRC',
          message:     `"${proposal.title}" by ${nameAndCollege(owner, by)} completed the college endorsements. It is now with the Special Assistant.`,
        });
      }

      await logAudit(req, {
        action:     'proposal_endorsed',
        targetType: 'proposal',
        targetId:   id,
        targetName: proposal.title,
        details:    { role, round, note, signed: true, next: next ? next.role : 'special_assistant' },
      });
      await auditSignature(req, id, proposal.title, role, 'endorse', round);

      return res.status(200).json({
        message: next
          ? `Proposal endorsed and signed. It is now with the ${ROLE_LABEL[next.role]}.`
          : 'Proposal endorsed and signed. It completed the college endorsements and is now with the Special Assistant.',
        status:            next ? 'for_endorsement' : 'submitted',
        endorsement_stage: next ? next.role : null,
        by:                actor,
      });
    }

    /* return to the researcher */
    const { data: changed, error: updErr } = await guarded({
      status:            'returned',
      endorsement_stage: null,
      updated_at:        now,
      return_reason:     note,
      returned_at:       now,
      returned_by:       req.user.user_id,
    });
    if (updErr) throw updErr;
    if (!changed || !changed.length) {
      return res.status(409).json({ message: 'This proposal was just handled. Please reload the page.', code: 'ALREADY_HANDLED' });
    }

    const { error: insErr } = await supabase.from('endorsements').insert({
      proposal_id:    Number(id),
      endorser_id:    req.user.user_id,
      endorser_role:  role,
      endorse_status: 'returned',
      remarks:        note,
      date_rejected:  now,
      round,
    });
    if (insErr) console.error('endorsement row failed:', insErr.message || insErr);

    await notifyUser({
      user_id:     proposal.user_id,
      proposal_id: Number(id),
      notif_type:  'endorsement',
      title:       'Proposal Returned: Changes Needed',
      message:     `Your proposal "${proposal.title}" was returned by the ${ROLE_LABEL[role]}. Reason: ${note}`,
    });

    await logAudit(req, {
      action:     'proposal_returned',
      targetType: 'proposal',
      targetId:   id,
      targetName: proposal.title,
      details:    { from: 'for_endorsement', stage: role, round, reason: note },
    });

    return res.status(200).json({
      message: 'Proposal returned to the researcher.',
      status:  'returned',
    });
  } catch (err) {
    console.error('endorseProposal error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET the signatures on a proposal ──
   The researcher who owns it, the college endorsers in scope, and the office.
   MSIRC Staff see the list of proposals only, not their contents.          */
const getProposalSignatures = async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid proposal.' });
  try {
    const { data: proposal, error } = await supabase
      .from('research_proposals')
      .select('proposal_id, user_id, title, status, revision_count, users ( college, department )')
      .eq('proposal_id', id)
      .maybeSingle();
    if (error) throw error;
    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

    const role = req.user.role;
    if (role === 'msric_staff') {
      return res.status(403).json({ message: 'MSIRC Staff can see the list of proposals but not their contents.' });
    }
    if (role === 'researcher' && Number(proposal.user_id) !== Number(req.user.user_id)) {
      return res.status(403).json({ message: 'This is not your proposal.' });
    }
    if (COLLEGE_SCOPED_ROLES.includes(role) || DEPARTMENT_SCOPED_ROLES.includes(role)) {
      const me = await ownerOf(req.user.user_id);
      const field = COLLEGE_SCOPED_ROLES.includes(role) ? 'college' : 'department';
      if (!me?.[field] || me[field] !== proposal.users?.[field]) {
        return res.status(403).json({ message: `This proposal is outside your ${field}.` });
      }
    }

    const signatures = await signaturesOf(id);
    return res.status(200).json({ signatures, round: roundOf(proposal) });
  } catch (err) {
    console.error('getProposalSignatures error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET my endorsements (college endorsers): what I endorsed or returned ── */
const getMyEndorsements = async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('endorsements')
      .select('*')
      .eq('endorser_id', req.user.user_id)
      .order('endorsement_id', { ascending: false });
    if (error) throw error;

    const ids = [...new Set((rows || []).map(r => r.proposal_id))];
    let props = {};
    if (ids.length) {
      const { data: ps, error: pErr } = await supabase
        .from('research_proposals')
        .select('proposal_id, title, status, endorsement_stage, returned_by, users ( first_name, last_name )')
        .in('proposal_id', ids);
      if (pErr) throw pErr;

      const retIds = [...new Set((ps || []).map(p => p.returned_by).filter(Boolean))];
      let retRole = {};
      if (retIds.length) {
        const { data: rr } = await supabase.from('user_roles').select('user_id, role_type').in('user_id', retIds);
        (rr || []).forEach(r => { retRole[r.user_id] = r.role_type; });
      }
      (ps || []).forEach(p => {
        props[p.proposal_id] = {
          title:             p.title,
          proposal_status:   p.status,
          endorsement_stage: p.endorsement_stage || null,
          returned_by_role:  p.status === 'returned' ? (retRole[p.returned_by] || null) : null,
          researcher:        [p.users?.first_name, p.users?.last_name].filter(Boolean).join(' '),
        };
      });
    }

    const endorsements = (rows || [])
      .filter(r => props[r.proposal_id])
      .map(r => ({
        endorsement_id: r.endorsement_id,
        proposal_id:    r.proposal_id,
        endorser_role:  r.endorser_role,
        endorse_status: r.endorse_status,
        remarks:        r.remarks,
        date:           r.date_endorsed || r.date_rejected || null,
        round:          Number(r.round) || 1,
        ...props[r.proposal_id],
      }));

    return res.status(200).json({ endorsements });
  } catch (err) {
    console.error('getMyEndorsements error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getMyProposals,
  submitProposal,
  updateDraft,
  deleteDraft,
  getAllProposals,
  getProposalById,
  updateProposalStatus,
  resubmitProposal,
  endorseProposal,
  getProposalSignatures,
  getMyEndorsements,
  staffCanSee,
};