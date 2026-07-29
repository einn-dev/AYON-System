const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { notifyUser } = require('../utils/notify');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/* ── POST apply for a grant ── */
router.post('/', verifyToken, authorizeRoles('researcher'), async (req, res) => {
  const { proposal_id, grant_type, details = {} } = req.body;

  const validTypes = ['research_spotlight','internally_funded','publication_incentive','travel_oral'];
  if (!proposal_id || !validTypes.includes(grant_type)) {
    return res.status(400).json({ message: 'Valid proposal and grant type required.' });
  }

  try {
    // Verify proposal belongs to user and is approved
    const { data: proposal } = await supabase
      .from('research_proposals')
      .select('proposal_id, title, status, user_id')
      .eq('proposal_id', proposal_id)
      .eq('user_id', req.user.user_id)
      .single();

    if (!proposal)               return res.status(404).json({ message: 'Proposal not found.' });
    if (proposal.status !== 'approved')
      return res.status(400).json({ message: 'Only approved proposals can apply for grants.' });

    // Create the parent grant application
    const { data: grant, error } = await supabase
      .from('grant_applications')
      .insert({ proposal_id, grant_type, status: 'pending' })
      .select('grant_id')
      .single();

    if (error) throw error;

    // Insert type-specific details
    const gid = grant.grant_id;
    if (grant_type === 'travel_oral') {
      await supabase.from('travel_oral').insert({
        grant_id: gid,
        event_name:      details.event_name      || null,
        location:        details.location        || null,
        event_date:      details.event_date      || null,
        conference_type: details.conference_type || null,
      });
    } else if (grant_type === 'publication_incentive') {
      await supabase.from('publication_incentives').insert({
        grant_id: gid,
        journal_name:     details.journal_name     || null,
        volume_issue:     details.volume_issue     || null,
        publication_date: details.publication_date || null,
        index_type:       details.index_type       || null,
      });
    } else if (grant_type === 'internally_funded') {
      await supabase.from('internally_funded').insert({
        grant_id: gid,
        funding_amount: details.funding_amount || null,
        funding_source: details.funding_source || null,
        start_date:     details.start_date     || null,
        end_date:       details.end_date       || null,
      });
    } else if (grant_type === 'research_spotlight') {
      await supabase.from('research_spotlight').insert({
        grant_id: gid,
        spotlight_title:       details.spotlight_title       || proposal.title,
        spotlight_description: details.spotlight_description || null,
        spotlight_date:        details.spotlight_date        || null,
      });
    }

    await notifyUser({
      user_id:     req.user.user_id,
      proposal_id,
      notif_type:  'submission',
      title:       'Grant Application Submitted',
      message:     `Your ${grant_type.replace(/_/g,' ')} application for "${proposal.title}" has been submitted.`,
    });

    return res.status(201).json({ message: 'Grant application submitted.', grant_id: gid });
  } catch (err) {
    console.error('Grant apply error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET my grant applications ── */
router.get('/my', verifyToken, authorizeRoles('researcher'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('grant_applications')
      .select(`*, research_proposals!inner ( title, user_id )`)
      .eq('research_proposals.user_id', req.user.user_id)
      .order('date_applied', { ascending: false });

    if (error) throw error;

    const grants = data.map(g => ({ ...g, proposal_title: g.research_proposals?.title }));
    return res.status(200).json({ grants });
  } catch (err) {
    console.error('My grants error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET all grant applications (staff view) ── */
router.get('/', verifyToken,
  authorizeRoles('admin','msric_staff','special_assistant','msric_director','ovcred'),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('grant_applications')
        .select(`*, research_proposals ( title, users ( first_name, last_name, college ) )`)
        .order('date_applied', { ascending: false });

      if (error) throw error;

      const grants = data.map(g => ({
        ...g,
        proposal_title: g.research_proposals?.title,
        first_name:     g.research_proposals?.users?.first_name,
        last_name:      g.research_proposals?.users?.last_name,
        college:        g.research_proposals?.users?.college,
      }));

      return res.status(200).json({ grants });
    } catch (err) {
      console.error('All grants error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ── PATCH approve/reject grant ── */
router.patch('/:id/status', verifyToken,
  authorizeRoles('msric_director','ovcred','admin'),
  async (req, res) => {
    const { status } = req.body;
    if (!['approved','rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    try {
      const { data: grant } = await supabase
        .from('grant_applications')
        .select(`grant_id, grant_type, research_proposals ( proposal_id, title, user_id )`)
        .eq('grant_id', req.params.id)
        .single();

      if (!grant) return res.status(404).json({ message: 'Grant not found.' });

      const { error } = await supabase
        .from('grant_applications')
        .update({ status })
        .eq('grant_id', req.params.id);

      if (error) throw error;

      await notifyUser({
        user_id:     grant.research_proposals.user_id,
        proposal_id: grant.research_proposals.proposal_id,
        notif_type:  status === 'approved' ? 'approval' : 'rejection',
        title:       `Grant Application ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        message:     `Your ${grant.grant_type.replace(/_/g,' ')} application for "${grant.research_proposals.title}" has been ${status}.`,
      });

      return res.status(200).json({ message: `Grant ${status}.` });
    } catch (err) {
      console.error('Grant status error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;