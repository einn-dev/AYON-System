const express = require('express');
const router  = express.Router();
const {
  register, login, getProfile, updateProfile,
  verifyEmail, resendVerification,
} = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/register',            register);
router.post('/login',               login);
router.post('/verify-email',        verifyEmail);
router.post('/resend-verification', resendVerification);

router.get('/profile',   verifyToken, getProfile);
router.patch('/profile', verifyToken, updateProfile);

module.exports = router;