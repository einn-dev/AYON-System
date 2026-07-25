const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/authMiddleware');

/* ── GET my notifications ── */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.user_id)
      .order('date_sent', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.status(200).json({ notifications: data });
  } catch (err) {
    console.error('Notifications error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── PATCH mark as read ── */
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notif_id', req.params.id)
      .eq('user_id',  req.user.user_id);

    if (error) throw error;
    return res.status(200).json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET unread count ── */
router.get('/unread-count', verifyToken, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.user_id)
      .eq('is_read',  false);

    if (error) throw error;
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;