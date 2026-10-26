const supabase = require('../config/supabase');
const { logAudit } = require('../utils/audit');
const { withOptionalColumns } = require('../utils/optionalColumns');

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
    return res.status(200).json({ proposals: data });
  } catch (err) {
    console.error('getMyProposals error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST submit proposal ── */
const submitProposal = async (req, res) => {
  const { proposal_type, title, description } = req.body;
  const file_path = req.filePath || null;

  if (!proposal_type || !title) {
    return res.status(400).json({ message: 'Proposal type and title are required.' });
  }

  try {
    const { data: proposal, error: propError } = await supabase
      .from('research_proposals')
      .insert({
        user_id: req.user.user_id,
        proposal_type,
        title,
        description: description || null,
        file_path,
        status:       'submitted',
        submitted_at: new Date().toISOString(),
      })
      .select('proposal_id')
      .single();

    if (propError) throw propError;

    await supabase.from('submissions').insert({
      proposal_id:       proposal.proposal_id,
      submission_status: 'pending',
    });

    await supabase.from('notifications').insert({
      user_id:     req.user.user_id,
      proposal_id: proposal.proposal_id,
      notif_type:  'submission',
      title:       'Proposal Submitted',
      message:     `Your proposal "${title}" has been submitted successfully.`,
    });

    return res.status(201).json({
      message:     'Proposal submitted successfully.',
      proposal_id: proposal.proposal_id,
    });
  } catch (err) {
    console.error('submitProposal error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── GET all proposals — WITH COLLEGE-BASED FILTERING ──
   - Coordinator & Dean   → only proposals from THEIR college
   - Chairperson          → only proposals from THEIR department
   - Staff/SA/Director/OVCRED/Admin → see everything (institution-wide)   */
const COLLEGE_SCOPED_ROLES    = ['research_coordinator', 'college_dean'];
const DEPARTMENT_SCOPED_ROLES = ['chairperson'];

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

    const proposals = data.map(p => ({
      ...p,
      first_name: p.users?.first_name,
      last_name:  p.users?.last_name,
      email:      p.users?.email,
      college:    p.users?.college,
      department: p.users?.department,
    }));

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
      .select('user_id, title, status')
      .eq('proposal_id', id)
      .single();

    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

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
        { return_reason: reason, returned_at: now, returned_by: req.user.user_id },
      );
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id:     proposal.user_id,
        proposal_id: parseInt(id),
        notif_type:  'review',
        title:       'Proposal Returned: Changes Needed',
        message:     `Your proposal "${proposal.title}" was returned. Reason: ${reason}`,
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

    const { error } = await supabase
      .from('research_proposals')
      .update({ status })
      .eq('proposal_id', id);

    if (error) throw error;

    await supabase.from('notifications').insert({
      user_id:     proposal.user_id,
      proposal_id: parseInt(id),
      notif_type:  'review',
      title:       'Proposal Status Updated',
      message:     `Your proposal "${proposal.title}" status has been updated to: ${status}.`,
    });

    return res.status(200).json({ message: 'Status updated.' });
  } catch (err) {
    console.error('updateProposalStatus error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST edit and resubmit a returned proposal (owner only) ──
   Title / description / file are optional, but something has to change.
   Without a new file the old one is kept.                                  */
const activeHolders = async (roleType) => {
  const { data: roles } = await supabase
    .from('user_roles').select('user_id, role_type').eq('role_type', roleType);
  const ids = [...new Set((roles || []).map(r => r.user_id))];
  if (!ids.length) return [];
  const { data: users } = await supabase
    .from('users').select('user_id, is_active').in('user_id', ids);
  return (users || []).filter(u => u.is_active !== false).map(u => u.user_id);
};

const resubmitProposal = async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(String(id))) return res.status(400).json({ message: 'Invalid proposal.' });

  const body       = req.body || {};
  const hasTitle   = body.title !== undefined;
  const hasDesc    = body.description !== undefined;
  const newFile    = req.filePath || null;

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
    if (!titleChanged && !descChanged && !newFile) {
      return res.status(400).json({
        message: 'Nothing has changed yet. Edit the title or description, or attach a new file.',
        code: 'NO_CHANGES',
      });
    }

    const now      = new Date().toISOString();
    const revision = (Number(proposal.revision_count) || 0) + 1;
    const base     = { status: 'submitted', updated_at: now };
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
      { revision_count: revision },
    );
    if (updErr) throw updErr;
    if (!changed || !changed.length) {
      return res.status(409).json({
        message: 'This proposal was just changed. Please reload the page.',
        code: 'NOT_RETURNED',
      });
    }

    const finalTitle = titleChanged ? titleIn : proposal.title;

    /* the office validates it again from scratch (best effort) */
    const { error: subErr } = await supabase
      .from('submissions').update({ submission_status: 'pending' }).eq('proposal_id', id);
    if (subErr) console.error('resubmit submissions reset failed:', subErr.message || subErr);

    /* tell the researcher, and the Special Assistants who now have it in their queue */
    const rows = [{
      user_id:     proposal.user_id,
      proposal_id: proposal.proposal_id,
      notif_type:  'submission',
      title:       'Proposal Resubmitted',
      message:     `Your revised proposal "${finalTitle}" is back with MSIRC for validation.`,
    }];
    try {
      const sas = await activeHolders('special_assistant');
      sas.forEach(uid => rows.push({
        user_id:     uid,
        proposal_id: proposal.proposal_id,
        notif_type:  'submission',
        title:       'Returned proposal resubmitted',
        message:     `"${finalTitle}" was edited and resubmitted by the researcher (revision ${revision}). It is in your queue again.`,
      }));
    } catch (e) {
      console.error('resubmit: could not look up Special Assistants:', e.message || e);
    }
    const { error: nErr } = await supabase.from('notifications').insert(rows);
    if (nErr) console.error('resubmit notification failed:', nErr.message || nErr);

    await logAudit(req, {
      action:     'proposal_resubmitted',
      targetType: 'proposal',
      targetId:   proposal.proposal_id,
      targetName: finalTitle,
      details:    { revision, title_changed: !!titleChanged, description_changed: !!descChanged, file_replaced: !!newFile },
    });

    return res.status(200).json({
      message:        'Proposal resubmitted. It is back in the Special Assistant\'s queue.',
      status:         'submitted',
      revision_count: revision,
    });
  } catch (err) {
    console.error('resubmitProposal error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  getMyProposals,
  submitProposal,
  getAllProposals,
  getProposalById,
  updateProposalStatus,
  resubmitProposal,
};