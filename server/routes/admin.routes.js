const express = require('express');
const router  = express.Router();
const {
  getAllUsers, createUser, updateUser, updateUserStatus, updateUserRole,
  resetPassword, verifyUserEmail, resendVerification,
  getAuditLogs, getEmailLogs, resendEmail, getDashboard,
  listProposals, getProposalTimeline, moveProposal, remindOffice,
} = require('../controllers/admin.controller');
const {
  listRepository, listRepositoryCandidates, storeToRepository,
  updateRepositoryItem, removeRepositoryItem,
  listGrants, getGrant, decideGrant,
} = require('../controllers/adminCatalog.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [verifyToken, authorizeRoles('admin')];

/* ── Dashboard numbers ── */
router.get('/dashboard',                      ...adminOnly, getDashboard);

/* ── Users ── */
router.get('/users',                          ...adminOnly, getAllUsers);
router.post('/users',                         ...adminOnly, createUser);
router.patch('/users/:id',                    ...adminOnly, updateUser);
router.patch('/users/:id/status',             ...adminOnly, updateUserStatus);
router.patch('/users/:id/role',               ...adminOnly, updateUserRole);
router.post('/users/:id/reset-password',      ...adminOnly, resetPassword);
router.post('/users/:id/verify-email',        ...adminOnly, verifyUserEmail);
router.post('/users/:id/resend-verification', ...adminOnly, resendVerification);

/* ── Proposal oversight ── */
router.get('/proposals',                      ...adminOnly, listProposals);
router.get('/proposals/:id/timeline',         ...adminOnly, getProposalTimeline);
router.post('/proposals/:id/move',            ...adminOnly, moveProposal);
router.post('/proposals/:id/remind',          ...adminOnly, remindOffice);

/* ── Repository ── */
router.get('/repository',                     ...adminOnly, listRepository);
router.get('/repository/candidates',          ...adminOnly, listRepositoryCandidates);
router.post('/repository',                    ...adminOnly, storeToRepository);
router.patch('/repository/:id',               ...adminOnly, updateRepositoryItem);
router.post('/repository/:id/remove',         ...adminOnly, removeRepositoryItem);

/* ── Grants ── */
router.get('/grants',                         ...adminOnly, listGrants);
router.get('/grants/:id',                     ...adminOnly, getGrant);
router.post('/grants/:id/decision',           ...adminOnly, decideGrant);

/* ── Logs ── */
router.get('/audit-logs',                     ...adminOnly, getAuditLogs);
router.get('/email-logs',                     ...adminOnly, getEmailLogs);
router.post('/email-logs/:id/resend',         ...adminOnly, resendEmail);

module.exports = router;