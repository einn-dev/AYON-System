const path = require('path');
const fs   = require('fs');
const supabase = require('../config/supabase');

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

/* ── PATCH update proposal status ── */
const updateProposalStatus = async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  const validStatuses = [
    'submitted','under_review','returned','endorsed','approved','rejected',
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status.' });
  }

  try {
    const { data: proposal } = await supabase
      .from('research_proposals')
      .select('user_id, title')
      .eq('proposal_id', id)
      .single();

    if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

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

module.exports = {
  getMyProposals,
  submitProposal,
  getAllProposals,
  getProposalById,
  updateProposalStatus,
};