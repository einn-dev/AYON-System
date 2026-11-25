const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/audit');
const { notifyStaff } = require('../utils/roleNotify');

/* Who may see what:
     ?access=public  -> anyone (this is the public repository)
     anything else   -> signed-in MSRIC staff only, because it includes PRIVATE items */
const STAFF_ROLES = ['admin', 'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];
const COLLEGE_ROLES = ['chairperson', 'research_coordinator', 'college_dean'];

/* each item carries its submission type (Research Spotlight, Travel Subsidy...) */
const WITH_TYPE = '*, research_proposals ( proposal_type )';
const flat = (rows) => (rows || []).map(({ research_proposals: rp, ...r }) => ({ ...r, proposal_type: rp?.proposal_type || null }));
const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const listGate = (req, res, next) => {
  if (req.query.access === 'public') return next();
  return verifyToken(req, res, () => authorizeRoles(...STAFF_ROLES)(req, res, next));
};

/* ── GET repository items ── */
router.get('/', listGate, async (req, res) => {
  const { access } = req.query;
  try {
    let query = supabase
      .from('repository')
      .select(WITH_TYPE)
      .order('store_date', { ascending: false });

    if (access === 'public') {
      query = query.eq('access_type', 'public');
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ items: flat(data) });
  } catch (err) {
    console.error('Repository fetch error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET /repository/college: the College Chairperson, Coordinator and Dean ──
   Every public item, plus the private ones of their own college. */
router.get('/college', verifyToken, authorizeRoles(...COLLEGE_ROLES), async (req, res) => {
  try {
    const { data: me } = await supabase.from('users').select('college').eq('user_id', req.user.user_id).maybeSingle();
    const { data, error } = await supabase.from('repository').select(WITH_TYPE).order('store_date', { ascending: false });
    if (error) throw error;
    const items = flat(data).filter((r) => r.access_type === 'public' || (me?.college && same(r.college, me.college)));
    return res.status(200).json({ items, college: me?.college || null });
  } catch (err) {
    console.error('College repository error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── POST store to repository ── */
router.post('/', verifyToken, authorizeRoles('ovcred', 'admin'),
  async (req, res) => {
    const {
      proposal_id, external_id, title, abstract,
      author, college, department, file_path,
      access_type, source_type, keywords,
    } = req.body;

    if (!title || !source_type) {
      return res.status(400).json({ message: 'Title and source type are required.' });
    }
    /* Public or private is decided by the researcher who owns it, or the Administrator.
       Anyone else stores it as private; the owner can make it public later. */
    const access = req.user.role === 'admin' && access_type === 'public' ? 'public' : 'private';

    try {
      if (proposal_id) {
        const { data: existing } = await supabase
          .from('repository')
          .select('repo_id')
          .eq('proposal_id', proposal_id)
          .maybeSingle();

        if (existing) {
          return res.status(409).json({ message: 'Already in the repository.' });
        }
      }

      const { data: created, error } = await supabase.from('repository').insert({
        proposal_id:  proposal_id  || null,
        external_id:  external_id  || null,
        title,
        abstract:     abstract     || null,
        author:       author       || null,
        college:      college      || null,
        department:   department   || null,
        file_path:    file_path    || null,
        access_type:  access,
        source_type:  source_type  || 'proposal',
        keywords:     keywords     || null,
      }).select('repo_id').maybeSingle();

      if (error) throw error;

      await logAudit(req, {
        action:     'repository_created',
        targetType: 'repository',
        targetId:   created?.repo_id,
        targetName: title,
        details:    { access_type: access, source_type: source_type || 'proposal' },
      });
      await notifyStaff({
        title:   'New research in the Repository',
        message: `"${title}"${author ? ` by ${author}` : ''} was added to the Research Repository.`,
      });

      return res.status(201).json({ message: 'Research stored in repository.' });
    } catch (err) {
      console.error('Repository store error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ─────────────────────────────────────────────────────────────
   The researcher's own research in the Repository.
   Only the owner (the researcher who submitted it) and the Administrator
   may make an item public or private. Externally funded research always
   stays private.
   ───────────────────────────────────────────────────────────── */
const ownedItems = async (userId) => {
  const { data: mine, error: e1 } = await supabase
    .from('research_proposals').select('proposal_id, proposal_type').eq('user_id', userId);
  if (e1) throw e1;
  const ids = (mine || []).map((p) => p.proposal_id);
  const typeOf = Object.fromEntries((mine || []).map((p) => [p.proposal_id, p.proposal_type]));
  const { data: ext } = await supabase.from('externally_funded').select('external_id').eq('user_id', userId);
  const extIds = (ext || []).map((e) => e.external_id);

  const rows = [];
  if (ids.length) {
    const { data, error } = await supabase.from('repository')
      .select('repo_id, proposal_id, external_id, title, author, college, department, keywords, file_path, access_type, source_type, store_date').in('proposal_id', ids);
    if (error) throw error;
    rows.push(...(data || []).map((r) => ({ ...r, proposal_type: typeOf[r.proposal_id] || null })));
  }
  if (extIds.length) {
    const { data, error } = await supabase.from('repository')
      .select('repo_id, proposal_id, external_id, title, author, college, department, keywords, file_path, access_type, source_type, store_date').in('external_id', extIds);
    if (error) throw error;
    rows.push(...(data || []).filter((r) => !rows.some((x) => x.repo_id === r.repo_id)));
  }
  return rows.sort((a, b) => new Date(b.store_date || 0) - new Date(a.store_date || 0));
};

/* ── GET /repository/mine: my research in the Repository ── */
router.get('/mine', verifyToken, async (req, res) => {
  try {
    return res.status(200).json({ items: await ownedItems(req.user.user_id) });
  } catch (err) {
    console.error('My repository error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── PATCH /repository/mine/:id  { access_type }: the owner makes it public or private ── */
router.patch('/mine/:id', verifyToken, async (req, res) => {
  const { access_type } = req.body || {};
  if (!['public', 'private'].includes(access_type)) {
    return res.status(400).json({ message: 'Access must be public or private.' });
  }
  try {
    const item = (await ownedItems(req.user.user_id)).find((r) => String(r.repo_id) === String(req.params.id));
    if (!item) {
      return res.status(403).json({ message: 'Only the researcher who owns this research or the Administrator can change its access.', code: 'NOT_OWNER' });
    }
    if (item.source_type === 'external' && access_type !== 'private') {
      return res.status(400).json({ message: 'Externally funded research always stays private.', code: 'EXTERNAL_PRIVATE' });
    }
    if (item.access_type === access_type) {
      return res.status(200).json({ message: `It is already ${access_type}.` });
    }

    const { error } = await supabase.from('repository').update({ access_type }).eq('repo_id', item.repo_id);
    if (error) throw error;

    await logAudit(req, {
      action:     'repository_updated',
      targetType: 'repository',
      targetId:   item.repo_id,
      targetName: item.title,
      details:    { access_type: { from: item.access_type, to: access_type }, by: 'owner' },
    });

    return res.status(200).json({
      message: access_type === 'public'
        ? 'Your research is now public: anyone who opens the Research Repository can find it.'
        : 'Your research is now private: only you, your college offices and MSIRC can see it.',
    });
  } catch (err) {
    console.error('My repository access error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── PATCH update repository access type (the Administrator only) ── */
router.patch('/:id', verifyToken, authorizeRoles('admin'),
  async (req, res) => {
    const { access_type } = req.body;
    if (!['public', 'private'].includes(access_type)) {
      return res.status(400).json({ message: 'Access must be public or private.' });
    }
    try {
      const { data: before } = await supabase
        .from('repository')
        .select('title, access_type, source_type')
        .eq('repo_id', req.params.id)
        .maybeSingle();

      /* externally funded research is always private (only its college and the offices see it) */
      if (before?.source_type === 'external' && access_type !== 'private') {
        return res.status(400).json({ message: 'Externally funded research always stays private.', code: 'EXTERNAL_PRIVATE' });
      }

      const { error } = await supabase
        .from('repository')
        .update({ access_type })
        .eq('repo_id', req.params.id);

      if (error) throw error;

      await logAudit(req, {
        action:     'repository_updated',
        targetType: 'repository',
        targetId:   req.params.id,
        targetName: before?.title || null,
        details:    { access_type: { from: before?.access_type ?? null, to: access_type } },
      });

      return res.status(200).json({ message: 'Repository item updated.' });
    } catch (err) {
      console.error('Repo update error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;