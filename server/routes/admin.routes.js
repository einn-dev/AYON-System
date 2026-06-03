const express = require('express');
const router  = express.Router();
const { getAllUsers, updateUserStatus, updateUserRole } = require('../controllers/admin.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [verifyToken, authorizeRoles('admin')];

router.get('/users',                  ...adminOnly, getAllUsers);
router.patch('/users/:id/status',     ...adminOnly, updateUserStatus);
router.patch('/users/:id/role',       ...adminOnly, updateUserRole);

module.exports = router;