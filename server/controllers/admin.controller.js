const bcrypt   = require('bcryptjs');
const supabase = require('../config/supabase');

/* ── GET all users with roles ── */
const getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        user_id, email, first_name, last_name,
        employee_id, department, college,
        contact_number, is_active, created_at,
        user_roles ( role_id, role_type )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = data.map(u => ({
      ...u,
      role_id:   u.user_roles?.[0]?.role_id,
      role_type: u.user_roles?.[0]?.role_type,
    }));

    return res.status(200).json({ users });
  } catch (err) {
    console.error('getAllUsers error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST create user with ANY role (ADMIN ONLY) ── */
const createUser = async (req, res) => {
  const {
    email, password, first_name, last_name,
    employee_id, department, college, contact_number, role,
  } = req.body;

  const validRoles = [
    'researcher','msric_staff','research_coordinator',
    'chairperson','college_dean','special_assistant',
    'msric_director','ovcred','admin',
  ];

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }
  if (!validRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
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
      .insert({
        user_id:     newUser.user_id,
        role_type:   role,
        assigned_by: req.user.user_id,
      });

    if (roleError) throw roleError;

    return res.status(201).json({
      message: `User created with role: ${role}.`,
      user_id: newUser.user_id,
    });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PATCH user active status ── */
const updateUserStatus = async (req, res) => {
  const { id }        = req.params;
  const { is_active } = req.body;
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_active })
      .eq('user_id', id);

    if (error) throw error;
    return res.status(200).json({ message: 'User status updated.' });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── PATCH user role ── */
const updateUserRole = async (req, res) => {
  const { id }        = req.params;
  const { role_type } = req.body;

  const validRoles = [
    'researcher','msric_staff','research_coordinator',
    'chairperson','college_dean','special_assistant',
    'msric_director','ovcred','admin',
  ];

  if (!validRoles.includes(role_type)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }

  try {
    const { data: existing } = await supabase
      .from('user_roles')
      .select('role_id')
      .eq('user_id', id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('user_roles')
        .update({ role_type })
        .eq('user_id', id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: parseInt(id), role_type });
      if (error) throw error;
    }

    return res.status(200).json({ message: 'Role updated successfully.' });
  } catch (err) {
    console.error('updateUserRole error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = { getAllUsers, createUser, updateUserStatus, updateUserRole };