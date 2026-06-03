const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/* ── GET repository items (public or all) ── */
router.get('/', async (req, res) => {
  const { access } = req.query;
  try {
    let query  = 'SELECT * FROM repository';
    let params = [];
    if (access === 'public') {
      query  += ' WHERE access_type = ?';
      params  = ['public'];
    }
    query += ' ORDER BY store_date DESC';
    const [rows] = await db.query(query, params);
    return res.status(200).json({ items: rows });
  } catch (err) {
    console.error('Repository fetch error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── POST store research to repository (OVCRED / admin) ── */
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
      const [existing] = await db.query(
        'SELECT repo_id FROM repository WHERE proposal_id = ?',
        [proposal_id || null]
      );
      if (existing.length > 0) {
        return res.status(409).json({ message: 'This proposal is already in the repository.' });
      }

      await db.query(
        `INSERT INTO repository
           (proposal_id, external_id, title, abstract, author,
            college, department, file_path, access_type, source_type, keywords)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          proposal_id  || null,
          external_id  || null,
          title, abstract || null,
          author       || null,
          college      || null,
          department   || null,
          file_path    || null,
          access_type  || 'private',
          source_type  || 'proposal',
          keywords     || null,
        ]
      );

      return res.status(201).json({ message: 'Research stored in repository.' });
    } catch (err) {
      console.error('Repository store error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;