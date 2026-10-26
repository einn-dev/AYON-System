const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/audit');

/* Who may see what:
     ?access=public  -> anyone (this is the public repository)
     anything else   -> signed-in MSRIC staff only, because it includes PRIVATE items */
const STAFF_ROLES = ['admin', 'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];
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
      .select('*')
      .order('store_date', { ascending: false });

    if (access === 'public') {
      query = query.eq('access_type', 'public');
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ items: data });
  } catch (err) {
    console.error('Repository fetch error:', err);
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
        access_type:  access_type  || 'private',
        source_type:  source_type  || 'proposal',
        keywords:     keywords     || null,
      }).select('repo_id').maybeSingle();

      if (error) throw error;

      await logAudit(req, {
        action:     'repository_created',
        targetType: 'repository',
        targetId:   created?.repo_id,
        targetName: title,
        details:    { access_type: access_type || 'private', source_type: source_type || 'proposal' },
      });

      return res.status(201).json({ message: 'Research stored in repository.' });
    } catch (err) {
      console.error('Repository store error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ── PATCH update repository access type ── */
router.patch('/:id', verifyToken, authorizeRoles('ovcred', 'admin'),
  async (req, res) => {
    const { access_type } = req.body;
    if (!['public', 'private'].includes(access_type)) {
      return res.status(400).json({ message: 'Access must be public or private.' });
    }
    try {
      const { data: before } = await supabase
        .from('repository')
        .select('title, access_type')
        .eq('repo_id', req.params.id)
        .maybeSingle();

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