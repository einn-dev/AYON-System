const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const supabase = require('../config/supabase');
const { logAudit, fullName } = require('../utils/audit');
const { sendEmail } = require('../utils/mailer');
const {
  TOKEN_TTL_MS, newToken, hashToken, sendVerificationEmail,
} = require('../utils/verification');

const VALID_ROLES = [
  'researcher','msric_staff','research_coordinator',
  'chairperson','college_dean','special_assistant',
  'msric_director','ovcred','admin',
];

/* Same rule as the Add User form: these roles belong to a college / department */
const ROLES_NEED_COLLEGE    = ['researcher', 'research_coordinator', 'chairperson', 'college_dean'];
const ROLES_NEED_DEPARTMENT = ['researcher', 'chairperson'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isId     = (v) => /^\d+$/.test(String(v));
const sameId   = (a, b) => String(a) === String(b);

/* 1 / true / "1" / "true"  -> true,  0 / false / "0" / "false" -> false, anything else -> undefined */
const toBool = (v) => {
  if (v === true  || v === 1 || v === '1' || v === 'true')  return true;
  if (v === false || v === 0 || v === '0' || v === 'false') return false;
  return undefined;
};

/* Keeps user-typed search text safe to put inside a Supabase .or() filter */
const safeSearch = (s) => String(s || '').replace(/[%,()*\\"'`]/g, ' ').trim().slice(0, 60);

/* ── Load one user together with their role ── */
const loadUser = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      user_id, email, first_name, last_name, department, college,
      is_active, email_verified,
      user_roles!user_roles_user_id_fkey ( role_id, role_type )
    `)
    .eq('user_id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, role_type: data.user_roles?.[0]?.role_type || null };
};

/* How many OTHER admins are still active? (used by the last-admin guard) */
const countOtherActiveAdmins = async (excludeId) => {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role_type', 'admin');
  if (error) throw error;

  const ids = [...new Set((roles || []).map(r => r.user_id))].filter(i => !sameId(i, excludeId));
  if (ids.length === 0) return 0;

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('user_id')
    .in('user_id', ids)
    .eq('is_active', true);
  if (uErr) throw uErr;
  return (users || []).length;
};

/* Safety rules. Returns an error message, or null when the change is allowed.
   1) You can't change your own role or deactivate yourself.
   2) The last active Admin can't be demoted or deactivated.              */
const checkGuards = async (req, target, { newRole, newActive }) => {
  const changingRole   = newRole   !== undefined && newRole !== target.role_type;
  const deactivating   = newActive === false && target.is_active !== false;
  const isSelf         = sameId(req.user.user_id, target.user_id);

  if (isSelf && changingRole) return 'You cannot change your own role.';
  if (isSelf && deactivating) return 'You cannot deactivate your own account.';

  const removingAdmin = target.role_type === 'admin' && target.is_active !== false
                        && (changingRole || deactivating);
  if (removingAdmin) {
    const others = await countOtherActiveAdmins(target.user_id);
    if (others === 0) {
      return 'This is the last active Admin account. Create or activate another Admin first.';
    }
  }
  return null;
};

/* ── GET all users with roles ──
   Join disambiguated: user_roles has 2 FKs to users  */
const getAllUsers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        user_id, email, first_name, last_name,
        employee_id, department, college,
        contact_number, is_active, email_verified, created_at,
        user_roles!user_roles_user_id_fkey ( role_id, role_type )
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

  if (!email || !password || !first_name || !last_name) {
    return res.status(400).json({ message: 'Please fill in all required fields.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role.' });
  }
  const emailLc = String(email).trim().toLowerCase();
  if (!EMAIL_RE.test(emailLc)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  }

  try {
    const { data: existing } = await supabase
      .from('users')
      .select('user_id')
      .eq('email', emailLc)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email:          emailLc,
        password:       hashedPassword,
        first_name:     String(first_name).trim(),
        last_name:      String(last_name).trim(),
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

    await logAudit(req, {
      action:     'user_created',
      targetType: 'user',
      targetId:   newUser.user_id,
      targetName: `${String(first_name).trim()} ${String(last_name).trim()}`,
      details:    { role, email: emailLc },
    });

    return res.status(201).json({
      message: `User created with role: ${role}.`,
      user_id: newUser.user_id,
    });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── The one place where an account is changed ──
   Used by PATCH /users/:id (the Edit pop-up) and by the older
   /status and /role routes, so every path has the same guards + logging. */
const applyUserChanges = async (req, id, input) => {
  const target = await loadUser(id);
  if (!target) return { code: 404, body: { message: 'User not found.' } };

  const userUpdates = {};
  const fieldChanges = {};          // for the audit log: { field: { from, to } }

  /* names */
  for (const f of ['first_name', 'last_name']) {
    if (input[f] === undefined) continue;
    const v = String(input[f] || '').trim();
    if (!v) return { code: 400, body: { message: 'First name and last name cannot be empty.' } };
    if (v.length > 50) return { code: 400, body: { message: 'Names can be up to 50 characters.' } };
    if (v !== target[f]) { userUpdates[f] = v; fieldChanges[f] = { from: target[f], to: v }; }
  }

  /* email */
  if (input.email !== undefined) {
    const v = String(input.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(v)) return { code: 400, body: { message: 'Please enter a valid email address.' } };
    if (v !== String(target.email).toLowerCase()) {
      const { data: taken } = await supabase
        .from('users').select('user_id').eq('email', v).maybeSingle();
      if (taken && !sameId(taken.user_id, target.user_id)) {
        return { code: 409, body: { message: 'That email is already used by another account.' } };
      }
      userUpdates.email = v;
      fieldChanges.email = { from: target.email, to: v };
    }
  }

  /* role + status */
  const newRole = input.role_type;
  if (newRole !== undefined && !VALID_ROLES.includes(newRole)) {
    return { code: 400, body: { message: 'Invalid role.' } };
  }
  let newActive;
  if (input.is_active !== undefined) {
    newActive = toBool(input.is_active);
    if (newActive === undefined) return { code: 400, body: { message: 'Invalid status.' } };
  }

  const roleChanging   = newRole !== undefined && newRole !== target.role_type;
  const statusChanging = newActive !== undefined && newActive !== (target.is_active !== false);

  const guardMsg = await checkGuards(req, target, {
    newRole:   roleChanging   ? newRole   : undefined,
    newActive: statusChanging ? newActive : undefined,
  });
  if (guardMsg) return { code: 400, body: { message: guardMsg } };

  /* college / department (cleared when the role no longer needs them) */
  let college    = input.college    !== undefined ? (String(input.college    || '').trim() || null) : (target.college    || null);
  let department = input.department !== undefined ? (String(input.department || '').trim() || null) : (target.department || null);

  const effectiveRole = roleChanging ? newRole : target.role_type;
  if (roleChanging) {
    if (!ROLES_NEED_COLLEGE.includes(effectiveRole))    college    = null;
    if (!ROLES_NEED_DEPARTMENT.includes(effectiveRole)) department = null;
    if (ROLES_NEED_COLLEGE.includes(effectiveRole) && !college) {
      return { code: 400, body: { message: 'Please choose a college for this role.' } };
    }
    if (ROLES_NEED_DEPARTMENT.includes(effectiveRole) && !department) {
      return { code: 400, body: { message: 'Please choose a department for this role.' } };
    }
  }
  if (college !== (target.college || null)) {
    userUpdates.college = college;
    fieldChanges.college = { from: target.college || null, to: college };
  }
  if (department !== (target.department || null)) {
    userUpdates.department = department;
    fieldChanges.department = { from: target.department || null, to: department };
  }

  if (statusChanging) userUpdates.is_active = newActive;

  if (Object.keys(userUpdates).length === 0 && !roleChanging) {
    return { code: 200, body: { message: 'No changes to save.', changed: false } };
  }

  /* save */
  if (Object.keys(userUpdates).length > 0) {
    const { error } = await supabase.from('users').update(userUpdates).eq('user_id', target.user_id);
    if (error) throw error;
  }

  if (roleChanging) {
    const { data: updated, error } = await supabase
      .from('user_roles')
      .update({ role_type: newRole, assigned_by: req.user.user_id })
      .eq('user_id', target.user_id)
      .select('role_id');
    if (error) throw error;

    if (!updated || updated.length === 0) {
      const { error: insErr } = await supabase
        .from('user_roles')
        .insert({ user_id: target.user_id, role_type: newRole, assigned_by: req.user.user_id });
      if (insErr) throw insErr;
    }
  }

  /* audit trail: one entry per kind of change */
  const targetName = fullName({
    first_name: userUpdates.first_name || target.first_name,
    last_name:  userUpdates.last_name  || target.last_name,
  });
  const base = { targetType: 'user', targetId: target.user_id, targetName };
  const reason = String(input.reason || '').trim().slice(0, 200) || undefined;

  if (Object.keys(fieldChanges).length > 0) {
    await logAudit(req, { ...base, action: 'user_updated', details: { changes: fieldChanges } });
  }
  if (roleChanging) {
    await logAudit(req, { ...base, action: 'role_changed', details: { from: target.role_type, to: newRole } });
  }
  if (statusChanging) {
    await logAudit(req, {
      ...base,
      action:  newActive ? 'user_activated' : 'user_deactivated',
      details: reason ? { reason } : null,
    });
  }

  return { code: 200, body: { message: 'User updated.', changed: true } };
};

const runChange = (buildInput) => async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid user.' });
  try {
    const out = await applyUserChanges(req, id, buildInput(req.body || {}));
    return res.status(out.code).json(out.body);
  } catch (err) {
    console.error('User update error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* PATCH /admin/users/:id  — the Edit pop-up (name, email, role, status, college, department) */
const updateUser = runChange((b) => ({
  first_name: b.first_name, last_name: b.last_name, email: b.email,
  role_type:  b.role_type,  is_active: b.is_active,
  college:    b.college,    department: b.department,
  reason:     b.reason,
}));

/* PATCH /admin/users/:id/status  — kept for the Activate / Deactivate button */
const updateUserStatus = runChange((b) => ({ is_active: b.is_active, reason: b.reason }));

/* PATCH /admin/users/:id/role  — kept for older screens */
const updateUserRole = runChange((b) => ({ role_type: b.role_type }));

/* ── POST reset a user's password (ADMIN ONLY) ──
   Makes a random temporary password, saves only its hash, and shows it ONCE
   to the admin, who hands it to the user. It is never emailed or logged.   */
const makeTempPassword = () => {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digit = '23456789';
  const all   = upper + lower + digit;
  const pick  = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digit)];
  while (chars.length < 12) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {          // shuffle
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const resetPassword = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid user.' });

  try {
    const target = await loadUser(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });

    const temp   = makeTempPassword();
    const hashed = await bcrypt.hash(temp, 10);
    const { error } = await supabase.from('users').update({ password: hashed }).eq('user_id', target.user_id);
    if (error) throw error;

    await logAudit(req, {
      action:     'password_reset',
      targetType: 'user',
      targetId:   target.user_id,
      targetName: fullName(target),
    });

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      message: 'Temporary password created.',
      temporary_password: temp,
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── POST mark a user's email as verified (ADMIN ONLY) ── */
const verifyUserEmail = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid user.' });

  try {
    const target = await loadUser(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.email_verified !== false) {
      return res.status(400).json({ message: 'This email is already verified.' });
    }

    const { error } = await supabase
      .from('users')
      .update({ email_verified: true, verification_token_hash: null, verification_expires: null })
      .eq('user_id', target.user_id);
    if (error) throw error;

    await logAudit(req, {
      action:     'email_verified',
      targetType: 'user',
      targetId:   target.user_id,
      targetName: fullName(target),
      details:    { email: target.email, by: 'admin' },
    });

    return res.status(200).json({ message: 'Email marked as verified.' });
  } catch (err) {
    console.error('verifyUserEmail error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* Makes a fresh verification link for an unverified user and emails it.
   Returns true when the mail provider accepted the email. */
const issueVerificationEmail = async (user) => {
  const token = newToken();
  const { error } = await supabase
    .from('users')
    .update({
      verification_token_hash: hashToken(token),
      verification_expires:    new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
    })
    .eq('user_id', user.user_id);
  if (error) throw error;

  return sendVerificationEmail({ email: user.email, first_name: user.first_name }, token);
};

/* ── POST send a new verification email (ADMIN ONLY) ── */
const resendVerification = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid user.' });

  try {
    const target = await loadUser(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.email_verified !== false) {
      return res.status(400).json({ message: 'This email is already verified.' });
    }

    const sent = await issueVerificationEmail(target);

    await logAudit(req, {
      action:     'verification_resent',
      targetType: 'user',
      targetId:   target.user_id,
      targetName: fullName(target),
      details:    { email: target.email, sent },
    });

    if (!sent) {
      return res.status(502).json({
        message: 'The email could not be sent. Open the Email Log to see why.',
      });
    }
    return res.status(200).json({ message: 'Verification email sent.' });
  } catch (err) {
    console.error('resendVerification error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ── pagination helpers for the two log pages ── */
const pageParams = (q, defaultSize = 25, maxSize = 100) => {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const size = Math.min(maxSize, Math.max(1, parseInt(q.page_size, 10) || defaultSize));
  return { page, size, from: (page - 1) * size, to: (page - 1) * size + size - 1 };
};

const validDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const countOf = async (query) => {
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
};

/* ── GET audit log (ADMIN ONLY) ──
   Filters: action, q (person), from, to (ISO dates), page, page_size.
   export=1 returns up to 5000 rows for the CSV download.               */
const getAuditLogs = async (req, res) => {
  try {
    const { action, q, from, to, today_from } = req.query;
    const exporting = req.query.export === '1';
    const pg = exporting ? { from: 0, to: 4999, page: 1, size: 5000 } : pageParams(req.query);

    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('audit_id',   { ascending: false });

    if (action) query = query.eq('action', String(action).slice(0, 40));
    const fromIso = validDate(from);
    const toIso   = validDate(to);
    if (fromIso) query = query.gte('created_at', fromIso);
    if (toIso)   query = query.lt('created_at', toIso);

    const term = safeSearch(q);
    if (term) query = query.or(`actor_name.ilike.%${term}%,target_name.ilike.%${term}%`);

    const { data, count, error } = await query.range(pg.from, pg.to);
    if (error) throw error;

    /* small summary cards */
    const weekAgo   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dayStart  = validDate(today_from) || new Date(new Date().setUTCHours(0, 0, 0, 0)).toISOString();
    const head = { count: 'exact', head: true };

    const [today, roleChanges, failedLogins] = await Promise.all([
      countOf(supabase.from('audit_logs').select('audit_id', head).gte('created_at', dayStart)),
      countOf(supabase.from('audit_logs').select('audit_id', head).eq('action', 'role_changed').gte('created_at', weekAgo)),
      countOf(supabase.from('audit_logs').select('audit_id', head).eq('action', 'login_failed').gte('created_at', weekAgo)),
    ]);

    return res.status(200).json({
      logs:      data || [],
      total:     count || 0,
      page:      pg.page,
      page_size: pg.size,
      stats:     { today, role_changes_7d: roleChanges, failed_logins_7d: failedLogins },
    });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json({ message: 'Could not load the audit log.' });
  }
};

/* ── GET email log (ADMIN ONLY) ── the email body is never sent to the browser */
const getEmailLogs = async (req, res) => {
  try {
    const { status, type, q } = req.query;
    const pg = pageParams(req.query);

    let query = supabase
      .from('email_logs')
      .select('email_id, recipient_email, subject, status, sent_at, created_at, error_message, email_type', { count: 'exact' })
      .order('email_id', { ascending: false });

    if (['sent', 'failed', 'pending'].includes(status)) query = query.eq('status', status);
    if (type) query = query.eq('email_type', String(type).slice(0, 30));

    const term = safeSearch(q);
    if (term) query = query.or(`recipient_email.ilike.%${term}%,subject.ilike.%${term}%`);

    const { data, count, error } = await query.range(pg.from, pg.to);
    if (error) throw error;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const head = { count: 'exact', head: true };
    const [sent, failed] = await Promise.all([
      countOf(supabase.from('email_logs').select('email_id', head).eq('status', 'sent').gte('created_at', weekAgo)),
      countOf(supabase.from('email_logs').select('email_id', head).eq('status', 'failed').gte('created_at', weekAgo)),
    ]);

    return res.status(200).json({
      logs:      data || [],
      total:     count || 0,
      page:      pg.page,
      page_size: pg.size,
      stats:     { sent_7d: sent, failed_7d: failed },
    });
  } catch (err) {
    console.error('getEmailLogs error:', err);
    return res.status(500).json({ message: 'Could not load the email log.' });
  }
};

/* ── POST try a failed email again (ADMIN ONLY) ── */
const resendEmail = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid email.' });

  try {
    const { data: row, error } = await supabase
      .from('email_logs')
      .select('email_id, notif_id, recipient_email, subject, body, status, email_type')
      .eq('email_id', id)
      .maybeSingle();
    if (error) throw error;
    if (!row) return res.status(404).json({ message: 'Email not found.' });
    if (row.status !== 'failed') {
      return res.status(400).json({ message: 'Only failed emails can be sent again.' });
    }

    let sent = false;

    if (row.email_type === 'verification') {
      /* the old link is not stored, so make a fresh one for that person */
      const { data: u, error: uErr } = await supabase
        .from('users')
        .select('user_id, email, first_name, email_verified')
        .eq('email', String(row.recipient_email).toLowerCase())
        .maybeSingle();
      if (uErr) throw uErr;
      if (!u) return res.status(404).json({ message: 'No account uses this email address anymore.' });
      if (u.email_verified !== false) {
        return res.status(400).json({ message: 'This person has already verified their email.' });
      }
      sent = await issueVerificationEmail(u);
    } else {
      if (!row.body || String(row.body).startsWith('[hidden')) {
        return res.status(400).json({
          message: 'This email contained a private link, so it cannot be sent again from the log.',
        });
      }
      sent = await sendEmail({
        to:       row.recipient_email,
        subject:  row.subject,
        html:     row.body,
        notif_id: row.notif_id,
        type:     row.email_type || 'notification',
      });
    }

    await logAudit(req, {
      action:     'email_resent',
      targetType: 'email',
      targetId:   row.email_id,
      targetName: row.recipient_email,
      details:    { type: row.email_type || 'notification', sent },
    });

    if (!sent) {
      return res.status(502).json({
        message: 'The email could not be sent again. A new entry with the error was added to the log.',
      });
    }
    return res.status(200).json({ message: 'Email sent again.' });
  } catch (err) {
    console.error('resendEmail error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* ─────────────────────────────────────────────────────────────
   DASHBOARD NUMBERS (ADMIN ONLY)
   GET /admin/dashboard?range=all|year|90|30
   One call gives the Admin Dashboard everything it draws.
   ───────────────────────────────────────────────────────────── */
const DAY_MS = 24 * 60 * 60 * 1000;
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;      // months are counted in Philippine time (UTC+8)

const OPEN_STATUSES    = ['submitted', 'under_review', 'endorsed'];
const DECIDED_STATUSES = ['approved', 'rejected'];
const PROPOSAL_TYPES   = [
  'research_spotlight', 'internally_funded', 'publication_incentive',
  'travel_oral', 'externally_funded',
];

/* Supabase returns at most 1000 rows per request, so read big tables page by page */
const fetchAll = async (table, columns, orderCol) => {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(orderCol, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
};

const ts = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

/* "2026-10" for a moment in time, counted in Philippine time */
const monthKey = (ms) => {
  const d = new Date(ms + PH_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/* a count that must never break the dashboard if its table isn't ready yet */
const safeCount = async (query) => {
  try {
    const { count, error } = await query;
    if (error) return null;
    return count || 0;
  } catch {
    return null;
  }
};

const getDashboard = async (req, res) => {
  try {
    const range = ['all', 'year', '90', '30'].includes(String(req.query.range)) ? String(req.query.range) : 'all';
    const now   = Date.now();

    let since = 0;
    if (range === 'year') {
      const ph = new Date(now + PH_OFFSET_MS);
      since = Date.UTC(ph.getUTCFullYear(), 0, 1) - PH_OFFSET_MS;     // Jan 1, 00:00 Philippine time
    } else if (range === '90' || range === '30') {
      since = now - Number(range) * DAY_MS;
    }

    const [proposals, submissions, endorsements, reviews, checks] = await Promise.all([
      fetchAll('research_proposals',
        'proposal_id, title, proposal_type, status, submitted_at, created_at, updated_at, users ( first_name, last_name, college )',
        'proposal_id'),
      fetchAll('submissions', 'submission_id, proposal_id, date_submitted, approved_date, rejected_date', 'submission_id'),
      fetchAll('endorsements', 'endorsement_id, proposal_id, date_endorsed, date_rejected', 'endorsement_id'),
      fetchAll('review_documents', 'review_id, proposal_id, review_date', 'review_id'),
      fetchAll('check_doc_req', 'check_id, submission_id, checked_at', 'check_id'),
    ]);

    /* the last thing that happened to each proposal, and the recorded decision date */
    const lastAction = new Map();
    const bump = (proposalId, value) => {
      const t = ts(value);
      if (t !== null && t > (lastAction.get(proposalId) || 0)) lastAction.set(proposalId, t);
    };

    const proposalOfSubmission = new Map();
    const decisionDate = new Map();
    for (const s of submissions) {
      proposalOfSubmission.set(s.submission_id, s.proposal_id);
      bump(s.proposal_id, s.date_submitted);
      const decided = ts(s.approved_date) || ts(s.rejected_date);
      if (decided) decisionDate.set(s.proposal_id, decided);
    }
    for (const e of endorsements) { bump(e.proposal_id, e.date_endorsed); bump(e.proposal_id, e.date_rejected); }
    for (const r of reviews)      bump(r.proposal_id, r.review_date);
    for (const c of checks)       bump(proposalOfSubmission.get(c.submission_id), c.checked_at);

    /* drafts were never submitted, so they are left out of every number */
    const sent = proposals
      .filter(p => p.status !== 'draft')
      .map(p => {
        const submittedAt = ts(p.submitted_at) || ts(p.created_at);
        bump(p.proposal_id, p.updated_at);
        bump(p.proposal_id, p.submitted_at || p.created_at);
        return { ...p, submittedAt, last: lastAction.get(p.proposal_id) || submittedAt };
      })
      .filter(p => p.submittedAt !== null);

    const inRange = sent.filter(p => p.submittedAt >= since);

    /* ── headline numbers ── */
    const inProgress = inRange.filter(p => OPEN_STATUSES.includes(p.status)).length;
    const approved   = inRange.filter(p => p.status === 'approved').length;
    const decided    = inRange.filter(p => DECIDED_STATUSES.includes(p.status));

    const decisionDays = decided
      .map(p => ((decisionDate.get(p.proposal_id) || p.last) - p.submittedAt) / DAY_MS)
      .filter(d => d >= 0);

    /* ── by status / college / type ── */
    const byStatus = {};
    const byCollege = {};
    const byType = Object.fromEntries(PROPOSAL_TYPES.map(t => [t, 0]));
    for (const p of inRange) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      const college = p.users?.college || 'Not specified';
      byCollege[college] = (byCollege[college] || 0) + 1;
      if (p.proposal_type in byType) byType[p.proposal_type] += 1;
    }

    /* ── submissions per month: the last 6 months, in the chosen period ── */
    const months = [];
    const nowPh = new Date(now + PH_OFFSET_MS);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(nowPh.getUTCFullYear(), nowPh.getUTCMonth() - i, 1));
      months.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, count: 0 });
    }
    for (const p of inRange) {
      const m = months.find(x => x.month === monthKey(p.submittedAt));
      if (m) m.count += 1;
    }

    /* ── needs attention: every open proposal (any period), longest wait first ── */
    const needsAttention = sent
      .filter(p => OPEN_STATUSES.includes(p.status))
      .map(p => ({
        proposal_id:  p.proposal_id,
        title:        p.title,
        proposal_type: p.proposal_type,
        status:       p.status,
        researcher:   [p.users?.first_name, p.users?.last_name].filter(Boolean).join(' ') || '—',
        college:      p.users?.college || null,
        waiting_days: Math.max(0, Math.floor((now - p.last) / DAY_MS)),
      }))
      .sort((a, b) => b.waiting_days - a.waiting_days)
      .slice(0, 300);

    /* ── system health (each one is optional, so a missing table never breaks the page) ── */
    const weekAgo = new Date(now - 7 * DAY_MS).toISOString();
    const head = { count: 'exact', head: true };
    const [failedEmails, failedLogins, activeAccounts, pendingAccounts] = await Promise.all([
      safeCount(supabase.from('email_logs').select('email_id', head).eq('status', 'failed').gte('created_at', weekAgo)),
      safeCount(supabase.from('audit_logs').select('audit_id', head).eq('action', 'login_failed').gte('created_at', weekAgo)),
      safeCount(supabase.from('users').select('user_id', head).eq('is_active', true).eq('email_verified', true)),
      safeCount(supabase.from('users').select('user_id', head).eq('is_active', true).eq('email_verified', false)),
    ]);

    return res.status(200).json({
      range,
      kpis: {
        total:             inRange.length,
        in_progress:       inProgress,
        approved,
        decided:           decided.length,
        approval_rate:     decided.length ? Math.round((approved / decided.length) * 100) : null,
        avg_decision_days: decisionDays.length
          ? Math.round(decisionDays.reduce((a, b) => a + b, 0) / decisionDays.length)
          : null,
      },
      by_status:  byStatus,
      by_college: Object.entries(byCollege).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      by_type:    byType,
      months,
      needs_attention: needsAttention,
      health: {
        failed_emails_7d:     failedEmails,
        failed_logins_7d:     failedLogins,
        active_accounts:      activeAccounts,
        pending_verification: pendingAccounts,
      },
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json({ message: 'Could not load the dashboard numbers.' });
  }
};

module.exports = {
  getAllUsers, createUser, updateUser, updateUserStatus, updateUserRole,
  resetPassword, verifyUserEmail, resendVerification,
  getAuditLogs, getEmailLogs, resendEmail,
  getDashboard,
};