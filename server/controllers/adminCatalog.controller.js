const supabase = require('../config/supabase');
const { logAudit, fullName } = require('../utils/audit');
const { notifyStaff } = require('../utils/roleNotify');

/* ─────────────────────────────────────────────────────────────
   Admin: Repository and Grants.
   Every change is written to the Audit Log with the Admin's name.
   No new database tables or columns are needed.
   ───────────────────────────────────────────────────────────── */

const REASON_MIN = 10;
const REASON_MAX = 500;
const TITLE_MAX  = 255;
const ABSTRACT_MAX = 10000;
const KEYWORDS_MAX = 255;

const isId = (v) => /^\d+$/.test(String(v));

const readReason = (body) => String((body || {}).reason || '').trim();
const checkReason = (reason) => {
  if (reason.length < REASON_MIN) return `Please type a reason (at least ${REASON_MIN} characters).`;
  if (reason.length > REASON_MAX) return `The reason must be ${REASON_MAX} characters or fewer.`;
  return null;
};

/* ══════════════════════════ REPOSITORY ══════════════════════════ */

/* GET /admin/repository: everything that is stored, public and private */
const listRepository = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('repository')
      .select('*')
      .order('store_date', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ items: data || [] });
  } catch (err) {
    console.error('Admin repository list error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* GET /admin/repository/candidates: approved proposals that were never stored */
const listRepositoryCandidates = async (req, res) => {
  try {
    const { data: stored, error: sErr } = await supabase
      .from('repository').select('proposal_id').not('proposal_id', 'is', null);
    if (sErr) throw sErr;
    const storedIds = new Set((stored || []).map(r => String(r.proposal_id)));

    const { data, error } = await supabase
      .from('research_proposals')
      .select('proposal_id, title, description, file_path, submitted_at, created_at, users ( first_name, middle_name, last_name, college, department )')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const candidates = (data || [])
      .filter(p => !storedIds.has(String(p.proposal_id)))
      .map(p => ({
        proposal_id: p.proposal_id,
        title:       p.title,
        author:      fullName(p.users) || null,
        college:     p.users?.college || null,
        department:  p.users?.department || null,
        file_path:   p.file_path || null,
        date:        p.submitted_at || p.created_at || null,
      }));

    return res.status(200).json({ candidates });
  } catch (err) {
    console.error('Admin repository candidates error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* POST /admin/repository  { proposal_id, access_type? }: store an approved proposal (private by default) */
const storeToRepository = async (req, res) => {
  const { proposal_id } = req.body || {};
  const access = (req.body || {}).access_type || 'private';

  if (!isId(proposal_id))                      return res.status(400).json({ message: 'Choose a proposal to store.' });
  if (!['public', 'private'].includes(access)) return res.status(400).json({ message: 'Access must be public or private.' });

  try {
    const { data: p, error } = await supabase
      .from('research_proposals')
      .select('proposal_id, title, description, file_path, status, users ( first_name, middle_name, last_name, college, department )')
      .eq('proposal_id', proposal_id)
      .maybeSingle();
    if (error) throw error;

    if (!p) return res.status(404).json({ message: 'Proposal not found.' });
    if (p.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved proposals can be stored in the repository.' });
    }

    const { data: existing } = await supabase
      .from('repository').select('repo_id').eq('proposal_id', p.proposal_id).maybeSingle();
    if (existing) return res.status(409).json({ message: 'This proposal is already in the repository.' });

    const { data: created, error: insErr } = await supabase
      .from('repository')
      .insert({
        proposal_id: p.proposal_id,
        title:       p.title,
        abstract:    p.description || null,
        author:      fullName(p.users) || null,
        college:     p.users?.college || null,
        department:  p.users?.department || null,
        file_path:   p.file_path || null,
        access_type: access,
        source_type: 'proposal',
      })
      .select('repo_id')
      .maybeSingle();
    if (insErr) throw insErr;

    await logAudit(req, {
      action:     'repository_created',
      targetType: 'repository',
      targetId:   created?.repo_id,
      targetName: p.title,
      details:    { access_type: access, source_type: 'proposal', by: 'admin' },
    });
    await notifyStaff({
      title:   'New research in the Repository',
      message: `"${p.title}"${fullName(p.users) ? ` by ${fullName(p.users)}` : ''} was added to the Research Repository.`,
    });

    return res.status(201).json({ message: 'Stored in the repository.' });
  } catch (err) {
    console.error('Admin repository store error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* PATCH /admin/repository/:id  { title?, abstract?, keywords?, access_type? } */
const updateRepositoryItem = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid repository item.' });

  const body = req.body || {};
  const next = {};

  if (body.title !== undefined) {
    const t = String(body.title).trim();
    if (!t)                  return res.status(400).json({ message: 'Title cannot be empty.' });
    if (t.length > TITLE_MAX) return res.status(400).json({ message: `Title must be ${TITLE_MAX} characters or fewer.` });
    next.title = t;
  }
  if (body.abstract !== undefined) {
    const a = String(body.abstract).trim();
    if (a.length > ABSTRACT_MAX) return res.status(400).json({ message: `Abstract must be ${ABSTRACT_MAX} characters or fewer.` });
    next.abstract = a || null;
  }
  if (body.keywords !== undefined) {
    const k = String(body.keywords).trim();
    if (k.length > KEYWORDS_MAX) return res.status(400).json({ message: `Keywords must be ${KEYWORDS_MAX} characters or fewer.` });
    next.keywords = k || null;
  }
  if (body.access_type !== undefined) {
    if (!['public', 'private'].includes(body.access_type)) {
      return res.status(400).json({ message: 'Access must be public or private.' });
    }
    next.access_type = body.access_type;
  }

  try {
    const { data: before, error } = await supabase
      .from('repository').select('*').eq('repo_id', id).maybeSingle();
    if (error) throw error;
    if (!before) return res.status(404).json({ message: 'Repository item not found.' });

    /* only what really changed */
    const changed = {};
    Object.keys(next).forEach((k) => {
      if ((before[k] ?? null) !== (next[k] ?? null)) changed[k] = next[k];
    });
    if (!Object.keys(changed).length) {
      return res.status(200).json({ message: 'Nothing changed.', changed: false });
    }

    const { error: updErr } = await supabase.from('repository').update(changed).eq('repo_id', id);
    if (updErr) throw updErr;

    const changes = {};
    ['title', 'keywords', 'access_type'].forEach((k) => {
      if (k in changed) changes[k] = { from: before[k] ?? null, to: changed[k] ?? null };
    });

    await logAudit(req, {
      action:     'repository_updated',
      targetType: 'repository',
      targetId:   id,
      targetName: changed.title || before.title,
      details:    { changes, abstract_changed: 'abstract' in changed, by: 'admin' },
    });

    return res.status(200).json({ message: 'Saved.', changed: true });
  } catch (err) {
    console.error('Admin repository update error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/* POST /admin/repository/:id/remove  { reason }
   Takes it out of the repository. The proposal and its file are NOT deleted. */
const removeRepositoryItem = async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid repository item.' });

  const reason = readReason(req.body);
  const bad = checkReason(reason);
  if (bad) return res.status(400).json({ message: bad, code: 'REASON_REQUIRED' });

  try {
    const { data: item, error } = await supabase
      .from('repository').select('repo_id, title, access_type, source_type, proposal_id').eq('repo_id', id).maybeSingle();
    if (error) throw error;
    if (!item) return res.status(404).json({ message: 'Repository item not found.' });

    const { error: delErr } = await supabase.from('repository').delete().eq('repo_id', id);
    if (delErr) throw delErr;

    await logAudit(req, {
      action:     'repository_removed',
      targetType: 'repository',
      targetId:   id,
      targetName: item.title,
      details:    { reason, access_type: item.access_type, source_type: item.source_type, proposal_id: item.proposal_id },
    });

    return res.status(200).json({ message: 'Removed from the repository.' });
  } catch (err) {
    console.error('Admin repository remove error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = {
  listRepository, listRepositoryCandidates, storeToRepository,
  updateRepositoryItem, removeRepositoryItem,
};