const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/audit');
const { SIGNER_ROLES, checkImage, getSignature, tableMissing } = require('../utils/signatures');

/* ── My Signature (signer roles only) ──
   GET    /api/signatures/me   → { signature: { image_data, updated_at } | null }
   PUT    /api/signatures/me   body { image_data: 'data:image/png;base64,...' }
   DELETE /api/signatures/me                                                   */

const notReady = (res) => res.status(503).json({
  message: 'Signatures are not set up in the database yet. Please ask the Administrator to run add_signatures.sql.',
  code: 'SIGNATURES_NOT_READY',
});

router.get('/me', verifyToken, authorizeRoles(...SIGNER_ROLES), async (req, res) => {
  try {
    const signature = await getSignature(req.user.user_id);
    return res.status(200).json({ signature });
  } catch (err) {
    if (tableMissing(err)) return notReady(res);
    console.error('get signature error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

router.put('/me', verifyToken, authorizeRoles(...SIGNER_ROLES), async (req, res) => {
  const check = checkImage((req.body || {}).image_data);
  if (!check.ok) return res.status(400).json({ message: check.message, code: 'BAD_SIGNATURE' });

  try {
    const before = await getSignature(req.user.user_id);
    const now = new Date().toISOString();
    const { error } = await supabase.from('user_signatures').upsert(
      { user_id: req.user.user_id, image_data: check.image, updated_at: now },
      { onConflict: 'user_id' },
    );
    if (error) throw error;

    await logAudit(req, {
      action:     before ? 'signature_replaced' : 'signature_saved',
      targetType: 'user',
      targetId:   req.user.user_id,
      targetName: [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || null,
      details:    { size_kb: Math.round(Buffer.from(check.image.split(',')[1], 'base64').length / 1024) },
    });

    return res.status(200).json({
      message:   before ? 'Your signature was replaced.' : 'Your signature was saved.',
      signature: { image_data: check.image, updated_at: now },
    });
  } catch (err) {
    if (tableMissing(err)) return notReady(res);
    console.error('save signature error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

router.delete('/me', verifyToken, authorizeRoles(...SIGNER_ROLES), async (req, res) => {
  try {
    const before = await getSignature(req.user.user_id);
    if (!before) return res.status(200).json({ message: 'You have no saved signature.' });

    const { error } = await supabase.from('user_signatures').delete().eq('user_id', req.user.user_id);
    if (error) throw error;

    await logAudit(req, {
      action:     'signature_removed',
      targetType: 'user',
      targetId:   req.user.user_id,
      targetName: [req.user.first_name, req.user.last_name].filter(Boolean).join(' ') || null,
    });

    return res.status(200).json({
      message: 'Your signature was removed. Proposals you already signed keep their signature.',
    });
  } catch (err) {
    if (tableMissing(err)) return notReady(res);
    console.error('remove signature error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;