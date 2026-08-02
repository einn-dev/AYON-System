const supabase = require('../config/supabase');
const { sendEmail, emailTemplate } = require('./mailer');

/**
 * Sends BOTH an in-app notification and an email to a user.
 * Usage: await notifyUser({ user_id, proposal_id, notif_type, title, message });
 */
const notifyUser = async ({ user_id, proposal_id = null, notif_type, title, message }) => {
  try {
    // 1. In-app notification
    const { data: notif } = await supabase
      .from('notifications')
      .insert({ user_id, proposal_id, notif_type, title, message })
      .select('notif_id')
      .single();

    // 2. Email notification
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('user_id', user_id)
      .single();

    if (user?.email) {
      await sendEmail({
        to:       user.email,
        subject:  `AYON: ${title}`,
        html:     emailTemplate(title, message),
        notif_id: notif?.notif_id || null,
      });
    }
  } catch (err) {
    console.error('notifyUser error:', err.message);
  }
};

module.exports = { notifyUser };