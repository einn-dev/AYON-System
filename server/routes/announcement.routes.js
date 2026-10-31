const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { logAudit } = require('../utils/audit');

/* ─────────────────────────────────────────────────────────────
   Announcements
     GET    /api/announcements/active      what the signed-in person should see now
     GET    /api/announcements             all of them (Administrator)
     POST   /api/announcements             post one (Administrator)
     PUT    /api/announcements/:id         edit (Administrator)
     PATCH  /api/announcements/:id/hidden  { hidden: true|false } (Administrator)
     DELETE /api/announcements/:id         delete for good (Administrator)
   ───────────────────────────────────────────────────────────── */

const TYPES = ['info', 'reminder', 'urgent'];
const ROLES = ['researcher', 'research_coordinator', 'chairperson', 'college_dean',
               'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];
const TITLE_MAX = 100;
const MESSAGE_MAX = 500;
const RANK = { urgent: 0, reminder: 1, info: 2 };

const tableMissing = (err) => /announcements|does not exist|schema cache/i.test(String(err?.message || ''));
const notReady = (res) => res.status(503).json({
  message: 'Announcements are not set up in the database yet. Please run add_announcements.sql.',
  code: 'ANNOUNCEMENTS_NOT_READY',
});
const fail = (res, err, where) => {
  if (tableMissing(err)) return notReady(res);
  console.error(`${where} error:`, err);
  return res.status(500).json({ message: 'Server error.' });
};

/* showing | scheduled | ended | hidden */
const stateOf = (a, now = Date.now()) => {
  if (a.is_hidden) return 'hidden';
  if (new Date(a.show_from).getTime() > now) return 'scheduled';
  if (a.show_until && new Date(a.show_until).getTime() <= now) return 'ended';
  return 'showing';
};

const shape = (a) => ({
  announcement_id: a.announcement_id,
  title:      a.title,
  message:    a.message,
  ann_type:   a.ann_type,
  audience:   a.audience || [],
  show_from:  a.show_from,
  show_until: a.show_until || null,
  is_hidden:  !!a.is_hidden,
  created_by: a.created_by ?? null,
  created_at: a.created_at,
  updated_at: a.updated_at,
  state:      stateOf(a),
});

const toDate = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

/* Checks the form. Returns { ok, row } or { ok:false, message } */
const validate = (body) => {
  const b = body || {};
  const title   = String(b.title ?? '').trim();
  const message = String(b.message ?? '').trim();
  const type    = String(b.ann_type ?? 'info').trim();
  if (!title)   return { ok: false, message: 'Please write a title.' };
  if (title.length > TITLE_MAX) return { ok: false, message: `The title must be ${TITLE_MAX} characters or fewer.` };
  if (!message) return { ok: false, message: 'Please write a message.' };
  if (message.length > MESSAGE_MAX) return { ok: false, message: `The message must be ${MESSAGE_MAX} characters or fewer.` };
  if (!TYPES.includes(type)) return { ok: false, message: 'Choose Info, Reminder or Urgent.' };

  if (b.audience !== undefined && !Array.isArray(b.audience)) return { ok: false, message: 'Invalid audience.' };
  const audience = [...new Set((b.audience || []).map(String))];
  if (audience.some(r => !ROLES.includes(r))) return { ok: false, message: 'Unknown role in "Shown to".' };

  const from  = toDate(b.show_from) || (b.show_from ? undefined : new Date());
  const until = toDate(b.show_until);
  if (from === undefined)  return { ok: false, message: '"Show from" is not a valid date.' };
  if (until === undefined) return { ok: false, message: '"Show until" is not a valid date.' };
  if (until && until <= from) return { ok: false, message: '"Show until" must be after "Show from".' };

  return {
    ok: true,
    row: {
      title, message, ann_type: type, audience,
      show_from: from.toISOString(), show_until: until ? until.toISOString() : null,
    },
  };
};

const audienceText = (aud) => (aud && aud.length ? aud.join(', ') : 'everyone');

/* In-app notification to everyone the announcement is shown to (no email). Never throws. */
const notifyAudience = async (ann, exclude) => {
  try {
    let q = supabase.from('user_roles').select('user_id, role_type');
    if (ann.audience && ann.audience.length) q = q.in('role_type', ann.audience);
    const { data: roles, error } = await q;
    if (error) throw error;
    const ids = [...new Set((roles || []).map(r => r.user_id))].filter(id => Number(id) !== Number(exclude));
    if (!ids.length) return 0;

    const { data: active, error: uErr } = await supabase
      .from('users').select('user_id, is_active').in('user_id', ids);
    if (uErr) throw uErr;
    const send = (active || []).filter(u => u.is_active !== false).map(u => u.user_id);

    for (let i = 0; i < send.length; i += 500) {
      const { error: nErr } = await supabase.from('notifications').insert(
        send.slice(i, i + 500).map(user_id => ({
          user_id, notif_type: 'general', title: `Announcement: ${ann.title}`.slice(0, 150), message: ann.message,
        }))
      );
      if (nErr) throw nErr;
    }
    return send.length;
  } catch (err) {
    console.error('announcement notify failed:', err.message || err);
    return 0;
  }
};

const findOne = async (id) => {
  const { data, error } = await supabase.from('announcements').select('*').eq('announcement_id', id).maybeSingle();
  if (error) throw error;
  return data || null;
};

const badId = (req, res) => {
  if (/^\d+$/.test(String(req.params.id))) return false;
  res.status(400).json({ message: 'Invalid announcement.' });
  return true;
};

/* ── what the signed-in person should see now ── */
router.get('/active', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('announcements').select('*').eq('is_hidden', false)
      .order('show_from', { ascending: false }).limit(200);
    if (error) throw error;
    const now = Date.now();
    const role = req.user.role;
    const list = (data || [])
      .filter(a => stateOf(a, now) === 'showing')
      .filter(a => !a.audience || !a.audience.length || a.audience.includes(role))
      .sort((x, y) => (RANK[x.ann_type] - RANK[y.ann_type])
        || (new Date(y.show_from) - new Date(x.show_from)))
      .map(a => ({
        announcement_id: a.announcement_id, title: a.title, message: a.message,
        ann_type: a.ann_type, show_from: a.show_from, updated_at: a.updated_at,
      }));
    return res.status(200).json({ announcements: list });
  } catch (err) {
    /* a missing table must never break the dashboards */
    if (tableMissing(err)) return res.status(200).json({ announcements: [] });
    return fail(res, err, 'active announcements');
  }
});

/* ── Administrator ── */
router.get('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('announcements').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ announcements: (data || []).map(shape) });
  } catch (err) { return fail(res, err, 'list announcements'); }
});

router.post('/', verifyToken, authorizeRoles('admin'), async (req, res) => {
  const v = validate(req.body);
  if (!v.ok) return res.status(400).json({ message: v.message });
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('announcements')
      .insert({ ...v.row, is_hidden: false, created_by: req.user.user_id, created_at: now, updated_at: now })
      .select('*').single();
    if (error) throw error;

    let notified = 0;
    if ((req.body || {}).notify === true) notified = await notifyAudience(data, req.user.user_id);

    await logAudit(req, {
      action: 'announcement_created', targetType: 'announcement', targetId: data.announcement_id,
      targetName: data.title, details: { type: data.ann_type, shown_to: audienceText(data.audience), notified },
    });
    return res.status(201).json({
      message: notified ? `Announcement posted. A notification was sent to ${notified} ${notified === 1 ? 'person' : 'people'}.` : 'Announcement posted.',
      announcement: shape(data),
    });
  } catch (err) { return fail(res, err, 'create announcement'); }
});

router.put('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  if (badId(req, res)) return undefined;
  const v = validate(req.body);
  if (!v.ok) return res.status(400).json({ message: v.message });
  try {
    const before = await findOne(req.params.id);
    if (!before) return res.status(404).json({ message: 'Announcement not found.' });
    const { data, error } = await supabase.from('announcements')
      .update({ ...v.row, updated_at: new Date().toISOString() })
      .eq('announcement_id', req.params.id).select('*');
    if (error) throw error;
    const row = (data || [])[0] || { ...before, ...v.row };

    let notified = 0;
    if ((req.body || {}).notify === true) notified = await notifyAudience(row, req.user.user_id);

    const changed = ['title', 'message', 'ann_type', 'show_from', 'show_until']
      .filter(k => String(before[k] ?? '') !== String(v.row[k] ?? ''));
    if (JSON.stringify(before.audience || []) !== JSON.stringify(v.row.audience)) changed.push('audience');

    await logAudit(req, {
      action: 'announcement_updated', targetType: 'announcement', targetId: row.announcement_id,
      targetName: row.title, details: { changed, notified },
    });
    return res.status(200).json({ message: 'Changes saved.', announcement: shape(row) });
  } catch (err) { return fail(res, err, 'update announcement'); }
});

router.patch('/:id/hidden', verifyToken, authorizeRoles('admin'), async (req, res) => {
  if (badId(req, res)) return undefined;
  const hidden = (req.body || {}).hidden;
  if (typeof hidden !== 'boolean') return res.status(400).json({ message: 'Say whether to hide or show it.' });
  try {
    const before = await findOne(req.params.id);
    if (!before) return res.status(404).json({ message: 'Announcement not found.' });
    const { error } = await supabase.from('announcements')
      .update({ is_hidden: hidden, updated_at: new Date().toISOString() })
      .eq('announcement_id', req.params.id);
    if (error) throw error;
    await logAudit(req, {
      action: hidden ? 'announcement_hidden' : 'announcement_shown', targetType: 'announcement',
      targetId: before.announcement_id, targetName: before.title,
    });
    return res.status(200).json({
      message: hidden ? 'Announcement hidden. It no longer shows on dashboards.' : 'Announcement is showing again.',
    });
  } catch (err) { return fail(res, err, 'hide announcement'); }
});

router.delete('/:id', verifyToken, authorizeRoles('admin'), async (req, res) => {
  if (badId(req, res)) return undefined;
  try {
    const before = await findOne(req.params.id);
    if (!before) return res.status(404).json({ message: 'Announcement not found.' });
    const { error } = await supabase.from('announcements').delete().eq('announcement_id', req.params.id);
    if (error) throw error;
    await logAudit(req, {
      action: 'announcement_deleted', targetType: 'announcement',
      targetId: before.announcement_id, targetName: before.title,
    });
    return res.status(200).json({ message: 'Announcement deleted.' });
  } catch (err) { return fail(res, err, 'delete announcement'); }
});

module.exports = router;
module.exports.validate = validate;
module.exports.stateOf = stateOf;