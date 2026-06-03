const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');

// ─── REGISTER ────────────────────────────────────────────────
const register = async (req, res) => {
  const { email, password, first_name, last_name,
          employee_id, department, college, contact_number, role } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }

  try {
    const [existing] = await db.query(
      'SELECT user_id FROM users WHERE email = ?', [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users
         (email, password, first_name, last_name,
          employee_id, department, college, contact_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name,
       employee_id || null, department || null,
       college || null, contact_number || null]
    );

    const newUserId = result.insertId;
    const assignedRole = role || 'researcher';

    await db.query(
      'INSERT INTO user_roles (user_id, role_type) VALUES (?, ?)',
      [newUserId, assignedRole]
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      user_id: newUserId,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ─── LOGIN ───────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [users] = await db.query(
      `SELECT u.user_id, u.email, u.password, u.first_name,
              u.last_name, u.is_active, r.role_type
       FROM users u
       JOIN user_roles r ON u.user_id = r.user_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        user_id:    user.user_id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        role:       user.role_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        user_id:    user.user_id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        role:       user.role_type,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ─── GET CURRENT USER PROFILE ────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.user_id, u.email, u.first_name, u.last_name,
              u.employee_id, u.department, u.college,
              u.contact_number, u.created_at, r.role_type
       FROM users u
       JOIN user_roles r ON u.user_id = r.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { register, login, getProfile };