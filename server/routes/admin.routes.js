const express = require('express');
const router  = express.Router();
const {
  getAllUsers, createUser, updateUser, updateUserStatus, updateUserRole,
  resetPassword, verifyUserEmail, resendVerification,
  getAuditLogs, getEmailLogs, resendEmail,
} = require('../controllers/admin.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [verifyToken, authorizeRoles('admin')];

/* ── Users ── */
router.get('/users',                          ...adminOnly, getAllUsers);
router.post('/users',                         ...adminOnly, createUser);
router.patch('/users/:id',                    ...adminOnly, updateUser);
router.patch('/users/:id/status',             ...adminOnly, updateUserStatus);
router.patch('/users/:id/role',               ...adminOnly, updateUserRole);
router.post('/users/:id/reset-password',      ...adminOnly, resetPassword);
router.post('/users/:id/verify-email',        ...adminOnly, verifyUserEmail);
router.post('/users/:id/resend-verification', ...adminOnly, resendVerification);

/* ── Logs ── */
router.get('/audit-logs',                     ...adminOnly, getAuditLogs);
router.get('/email-logs',                     ...adminOnly, getEmailLogs);
router.post('/email-logs/:id/resend',         ...adminOnly, resendEmail);

module.exports = router;