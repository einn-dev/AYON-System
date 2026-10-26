const supabase = require('../config/supabase');

/* Active accounts that hold a role (deactivated accounts are skipped). */
const activeHolders = async (roleType) => {
  const { data: roles, error } = await supabase
    .from('user_roles').select('user_id, role_type').eq('role_type', roleType);
  if (error) throw error;

  const ids = [...new Set((roles || []).map(r => r.user_id))];
  if (!ids.length) return [];

  const { data: users, error: uErr } = await supabase
    .from('users').select('user_id, is_active').in('user_id', ids);
  if (uErr) throw uErr;

  return (users || []).filter(u => u.is_active !== false).map(u => u.user_id);
};

/* In-app notification to everybody who holds a role, for example every active
   Special Assistant when a proposal is submitted.
   It NEVER throws: if telling the office fails, the real action (submit, forward,
   endorse...) still goes through and the problem is only printed on the server.
   Returns how many people were notified.
     exclude: user ids that should not be notified (the person who did the action). */
const notifyRole = async (roleType, { proposal_id = null, notif_type, title, message }, { exclude = [] } = {}) => {
  try {
    const skip = new Set(exclude.map(Number));
    const ids  = (await activeHolders(roleType)).filter(id => !skip.has(Number(id)));
    if (!ids.length) return 0;

    const { error } = await supabase.from('notifications').insert(
      ids.map(user_id => ({ user_id, proposal_id, notif_type, title, message }))
    );
    if (error) throw error;
    return ids.length;
  } catch (err) {
    console.error(`notifyRole(${roleType}) failed:`, err.message || err);
    return 0;
  }
};

const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();

module.exports = { activeHolders, notifyRole, fullName };