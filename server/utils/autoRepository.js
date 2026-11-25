const supabase = require('../config/supabase');
const { personName } = require('./names');
const { TYPE_LABEL } = require('./terms');

/* ─────────────────────────────────────────────────────────────
   Every approved submission goes into the Research Repository by itself,
   as PRIVATE. The researcher who owns it (or the Administrator) decides
   whether it becomes public.
     Private: the owner, the college offices of their college, the MSIRC
              offices and the Administrator can see it. Other researchers cannot.
   Called once, when a submission gets its final approval.
   Never throws: a problem here must not undo the approval.
   ───────────────────────────────────────────────────────────── */
const storeApproved = async (proposalId) => {
  try {
    const { data: existing } = await supabase
      .from('repository').select('repo_id').eq('proposal_id', proposalId).maybeSingle();
    if (existing) return;

    const { data: p, error } = await supabase
      .from('research_proposals')
      .select('proposal_id, user_id, title, description, file_path, proposal_type, status')
      .eq('proposal_id', proposalId)
      .maybeSingle();
    if (error) throw error;
    if (!p || p.status !== 'approved') return;

    const { data: owner } = await supabase
      .from('users').select('first_name, middle_name, last_name, college, department')
      .eq('user_id', p.user_id).maybeSingle();

    const { error: insErr } = await supabase.from('repository').insert({
      proposal_id: p.proposal_id,
      title:       p.title,
      abstract:    p.description || null,
      author:      personName(owner) || null,
      college:     owner?.college || null,
      department:  owner?.department || null,
      file_path:   p.file_path || null,
      access_type: 'private',
      source_type: 'proposal',
    });
    if (insErr) throw insErr;

    await supabase.from('notifications').insert({
      user_id:     p.user_id,
      proposal_id: p.proposal_id,
      notif_type:  'approval',
      title:       'Stored in the Research Repository',
      message:     `Your ${TYPE_LABEL[p.proposal_type] || 'research'} "${p.title}" is now in the Research Repository as Private. `
                 + 'Only you, your college offices and MSIRC can see it. To share it with every researcher, '
                 + 'open Research Repository and choose Make Public.',
    });
  } catch (err) {
    console.error('Could not store the approved submission in the Research Repository:', err.message || err);
  }
};

module.exports = { storeApproved };