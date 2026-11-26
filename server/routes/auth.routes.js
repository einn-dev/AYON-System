const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const {
  register, login, getProfile, updateProfile,
  verifyEmail, resendVerification,
  uploadAvatar, removeAvatar,
} = require('../controllers/auth.controller');
const {
  changePassword, forgotPassword, resetPassword,
} = require('../controllers/password.controller');
const { verifyToken } = require('../middleware/authMiddleware');
const { limit } = require('../utils/rateLimit');
const { logAudit, fullName } = require('../utils/audit');

/* Profile pictures: kept in memory (they go to Supabase, not to disk), 2MB max. */
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Please choose a JPG, PNG or WEBP picture.'));
  },
}).single('avatar');

// turns upload problems (too big, wrong type) into a clear message instead of a crash
const handleAvatarUpload = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'The picture must be 2MB or smaller.'
      : err.message || 'Could not read the picture.';
    return res.status(400).json({ message });
  });
};

/* How often the same person can try (see utils/rateLimit.js) */
const tries = {
  login:     [limit({ name: 'login-ip', max: 50, windowMin: 15 }), limit({ name: 'login', max: 10, windowMin: 15, by: 'ip+email' })],
  register:  limit({ name: 'register', max: 10, windowMin: 60 }),
  emailSend: limit({ name: 'email-send', max: 5, windowMin: 15, by: 'ip+email' }),   // reset link, verification email
  code:      limit({ name: 'code', max: 20, windowMin: 15 }),                         // verify link, reset link use
  password:  limit({ name: 'password', max: 10, windowMin: 15 }),
};

router.post('/register',            tries.register, register);
router.post('/login',               ...tries.login, login);
router.post('/verify-email',        tries.code, verifyEmail);
router.post('/resend-verification', tries.emailSend, resendVerification);

router.post('/forgot-password',     tries.emailSend, forgotPassword);
router.post('/reset-password',      tries.code, resetPassword);
router.post('/change-password',     verifyToken, tries.password, changePassword);

/* Logout: the token simply stops being used on the device; this only records it in the Audit Log.
   (A session that ends because the token expired or the tab closed is not a logout.) */
router.post('/logout', verifyToken, async (req, res) => {
  await logAudit(req, {
    action:     'logout',
    targetType: 'user',
    targetId:   req.user.user_id,
    targetName: fullName(req.user) || req.user.email,
  });
  return res.status(200).json({ message: 'Signed out.' });
});

router.get('/profile',   verifyToken, getProfile);
router.patch('/profile', verifyToken, updateProfile);

router.post('/profile/avatar',   verifyToken, handleAvatarUpload, uploadAvatar);
router.delete('/profile/avatar', verifyToken, removeAvatar);

module.exports = router;