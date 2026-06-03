const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

/* ── GET my notifications ── */
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY date_sent DESC
       LIMIT 50`,
      [req.user.user_id]
    );
    return res.status(200).json({ notifications: rows });
  } catch (err) {
    console.error('Notifications fetch error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── PATCH mark notification as read ── */
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE notif_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );
    return res.status(200).json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET unread count ── */
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user.user_id]
    );
    return res.status(200).json({ count: rows[0].count });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;