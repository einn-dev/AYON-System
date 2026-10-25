const supabase = require('../config/supabase');

/* ── Audit log helper ──
   Records who did what, to whom, and when, in the audit_logs table.
   It NEVER throws: if the log can't be written, the real action still
   goes through (the error is only printed on the server).

   Usage (inside a route that already has req.user):
     await logAudit(req, {
       action:      'role_changed',
       targetType:  'user',
       targetId:    42,
       targetName:  'Juan Dela Cruz',
       details:     { from: 'researcher', to: 'chairperson' },
     });

   Usage when nobody is signed in yet (failed login):
     await logAudit(req, { action: 'login_failed', actor: null, ... });
     or pass actor: { user_id, name, role } to name the person.            */

const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();

const clientIp = (req) => {
  const fwd = req?.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : String(fwd || '').split(',')[0];
  return (first || req?.ip || req?.socket?.remoteAddress || '').trim().slice(0, 64) || null;
};

const logAudit = async (req, entry) => {
  try {
    const actor = entry.actor !== undefined
      ? entry.actor
      : (req?.user
          ? { user_id: req.user.user_id, name: fullName(req.user) || req.user.email, role: req.user.role }
          : null);

    const { error } = await supabase.from('audit_logs').insert({
      actor_id:    actor?.user_id ?? null,
      actor_name:  actor?.name ? String(actor.name).slice(0, 150) : null,
      actor_role:  actor?.role || null,
      action:      entry.action,
      target_type: entry.targetType || null,
      target_id:   entry.targetId != null ? String(entry.targetId).slice(0, 50) : null,
      target_name: entry.targetName ? String(entry.targetName).slice(0, 200) : null,
      details:     entry.details || null,
      ip_address:  clientIp(req),
    });

    if (error) console.error('Audit log write failed:', error.message || error);
  } catch (err) {
    console.error('Audit log write failed:', err.message || err);
  }
};

module.exports = { logAudit, fullName };