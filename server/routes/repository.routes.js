const express = require('express');
const router  = express.Router();
const db       = require('../config/supabase');
const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/* ── GET repository items ── */
router.get('/', async (req, res) => {
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

      const { error } = await supabase.from('repository').insert({
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
      });

      if (error) throw error;

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
    try {
      const { error } = await supabase
        .from('repository')
        .update({ access_type })
        .eq('repo_id', req.params.id);

      if (error) throw error;
      return res.status(200).json({ message: 'Repository item updated.' });
    } catch (err) {
      console.error('Repo update error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;