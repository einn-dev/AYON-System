const db = require('../config/db');

/* ── GET all users with their roles ── */
const getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.user_id, u.email, u.first_name, u.last_name,
              u.employee_id, u.department, u.college,
              u.contact_number, u.is_active, u.created_at,
              r.role_id, r.role_type
       FROM users u
       LEFT JOIN user_roles r ON u.user_id = r.user_id
       ORDER BY u.created_at DESC`
    );
    return res.status(200).json({ users: rows });
  } catch (err) {
    console.error('getAllUsers error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PATCH update user active status ── */
const updateUserStatus = async (req, res) => {
  const { id }        = req.params;
  const { is_active } = req.body;
  try {
    await db.query(
      'UPDATE users SET is_active = ? WHERE user_id = ?',
      [is_active, id]
    );
    return res.status(200).json({ message: 'User status updated.' });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PATCH update user role ── */
const updateUserRole = async (req, res) => {
  const { id }        = req.params;
  const { role_type } = req.body;

  const validRoles = [
    'researcher', 'msric_staff', 'research_coordinator',
    'chairperson', 'college_dean', 'special_assistant',
    'msric_director', 'ovcred', 'admin',
  ];

  if (!validRoles.includes(role_type)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT role_id FROM user_roles WHERE user_id = ?', [id]
    );
    if (existing.length > 0) {
      await db.query(
        'UPDATE user_roles SET role_type = ? WHERE user_id = ?',
        [role_type, id]
      );
    } else {
      await db.query(
        'INSERT INTO user_roles (user_id, role_type) VALUES (?, ?)',
        [id, role_type]
      );
    }
    return res.status(200).json({ message: 'Role updated successfully.' });
  } catch (err) {
    console.error('updateUserRole error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getAllUsers, updateUserStatus, updateUserRole };