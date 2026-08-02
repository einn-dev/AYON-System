const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('../config/supabase');

/* ── PUBLIC REGISTER — always creates a RESEARCHER account ── */
const register = async (req, res) => {
  const {
    email, password, first_name, last_name,
    employee_id, department, college, contact_number,
  } = req.body;

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email:          email.toLowerCase(),
        password:       hashedPassword,
        first_name,
        last_name,
        employee_id:    employee_id    || null,
        department:     department     || null,
        college:        college        || null,
        contact_number: contact_number || null,
      })
      .select('user_id')
      .single();

    if (userError) throw userError;

    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: newUser.user_id, role_type: 'researcher' });

    if (roleError) throw roleError;

    return res.status(201).json({
      message: 'Researcher account created successfully.',
      user_id: newUser.user_id,
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── LOGIN ──
   NOTE: user_roles has TWO foreign keys to users (user_id, assigned_by),
   so we MUST disambiguate the join with !user_roles_user_id_fkey  */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        user_id, email, password, first_name, last_name, is_active,
        user_roles!user_roles_user_id_fkey ( role_type )
      `)
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Login query error:', error);   // real error is now visible
      return res.status(500).json({ message: 'Server error. Please try again.' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account has been deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const role  = user.user_roles?.[0]?.role_type || 'researcher';
    const token = jwt.sign(
      {
        user_id:    user.user_id,
        email:      user.email,
        first_name: user.first_name,
        last_name:  user.last_name,
        role,
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
        role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

/* ── GET PROFILE ── */
const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        user_id, email, first_name, last_name,
        employee_id, department, college,
        contact_number, created_at,
        user_roles!user_roles_user_id_fkey ( role_type )
      `)
      .eq('user_id', req.user.user_id)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      user: { ...user, role: user.user_roles?.[0]?.role_type },
    });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── UPDATE PROFILE ── */
const updateProfile = async (req, res) => {
  const {
    first_name, last_name, department,
    college, contact_number, password,
  } = req.body;

  try {
    const updates = {};
    if (first_name)     updates.first_name     = first_name;
    if (last_name)      updates.last_name      = last_name;
    if (department)     updates.department     = department;
    if (college)        updates.college        = college;
    if (contact_number) updates.contact_number = contact_number;

    if (password && password.trim().length >= 8) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', req.user.user_id);

    if (error) throw error;

    return res.status(200).json({ message: 'Profile updated successfully.' });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { register, login, getProfile, updateProfile };