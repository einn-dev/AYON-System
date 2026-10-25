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

router.post('/register',            register);
router.post('/login',               login);
router.post('/verify-email',        verifyEmail);
router.post('/resend-verification', resendVerification);

router.post('/forgot-password',     forgotPassword);
router.post('/reset-password',      resetPassword);
router.post('/change-password',     verifyToken, changePassword);

router.get('/profile',   verifyToken, getProfile);
router.patch('/profile', verifyToken, updateProfile);

router.post('/profile/avatar',   verifyToken, handleAvatarUpload, uploadAvatar);
router.delete('/profile/avatar', verifyToken, removeAvatar);

module.exports = router;