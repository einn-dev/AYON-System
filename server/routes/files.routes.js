const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/authMiddleware');

/* ─────────────────────────────────────────────────────────────
   Private files.
   The storage bucket is private: a stored link no longer opens the file by itself.
   To view or download a file, the page asks here; the server checks that this
   person may see the record the file belongs to, and gives back a link that
   works for LINK_MINUTES only.

     GET /api/files/link?path=<the stored link>&download=<file name>
         Signed in: the same rules as the screens.
         Not signed in: only files of PUBLIC Research Repository items.
     GET /api/files/avatar/<name>
         Profile pictures (not sensitive): shown to anyone.

   Nothing in the database changes: the links already saved are used to find the file.
   ───────────────────────────────────────────────────────────── */

const LINK_MINUTES = 10;
const BUCKET = () => process.env.SUPABASE_BUCKET;
const bucket = () => supabase.storage.from(BUCKET());

const COLLEGE_SCOPED    = ['research_coordinator', 'college_dean'];
const DEPARTMENT_SCOPED = ['chairperson'];
const MSIRC_OFFICES     = ['special_assistant', 'msric_director', 'ovcred', 'admin'];
const REPO_STAFF        = ['admin', 'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];

/* the file's place in the bucket, from a stored link ("https://…/object/public/<bucket>/<key>"),
   or null when the link is not in our storage */
const keyOf = (path) => {
  const p = String(path || '').split('?')[0];
  const m = p.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
  if (!m || decodeURIComponent(m[1]) !== BUCKET()) return null;
  try { return decodeURIComponent(m[2]); } catch { return m[2]; }
};

/* signed in or not: a token is checked if there is one */
const optionalAuth = (req, res, next) => {
  if (!req.headers.authorization) { req.user = null; return next(); }
  return verifyToken(req, res, next);
};

const userOf = async (id) => {
  if (!id) return null;
  const { data, error } = await supabase
    .from('users').select('user_id, college, department').eq('user_id', id).maybeSingle();
  if (error) throw error;
  return data || null;
};
const one = async (table, cols, column, value) => {
  const { data, error } = await supabase.from(table).select(cols).eq(column, value).limit(1);
  if (error) throw error;
  return (data || [])[0] || null;
};

/* same college / department as the owner? */
const sameScope = async (me, ownerId, field) => {
  const [mine, owner] = await Promise.all([userOf(me.user_id), userOf(ownerId)]);
  return !!mine?.[field] && mine[field] === owner?.[field];
};

/* ── who may see a proposal (the same rules as GET /api/proposals/:id) ── */
const mayProposal = async (me, proposalId) => {
  if (!me) return false;
  const p = await one('research_proposals', 'proposal_id, user_id, status', 'proposal_id', proposalId);
  if (!p) return false;
  const mine = Number(p.user_id) === Number(me.user_id);
  if (mine) return true;
  if (p.status === 'draft') return false;
  if (me.role === 'researcher' || me.role === 'msric_staff') return false;
  if (COLLEGE_SCOPED.includes(me.role)) return sameScope(me, p.user_id, 'college');
  if (DEPARTMENT_SCOPED.includes(me.role)) return sameScope(me, p.user_id, 'department');
  return MSIRC_OFFICES.includes(me.role);
};

/* ── Terminal Report: the researcher, their College Dean, the MSIRC offices ── */
const mayTerminal = async (me, r) => {
  if (!me) return false;
  if (Number(r.user_id) === Number(me.user_id)) return true;
  if (['special_assistant', 'msric_director', 'admin'].includes(me.role)) return true;
  if (me.role === 'college_dean') return sameScope(me, r.user_id, 'college');
  return false;
};

/* ── External research: the researcher, the college offices of their college, the MSIRC offices ── */
const mayExternal = async (me, externalId) => {
  if (!me) return false;
  const x = await one('externally_funded', 'external_id, user_id', 'external_id', externalId);
  if (!x) return false;
  if (Number(x.user_id) === Number(me.user_id)) return true;
  if (REPO_STAFF.includes(me.role)) return true;
  if ([...COLLEGE_SCOPED, ...DEPARTMENT_SCOPED].includes(me.role)) return sameScope(me, x.user_id, 'college');
  return false;
};

/* ── Research Repository: public items for everyone; private ones for MSIRC,
      the college offices of the owner's college, and the owner ── */
const mayRepository = async (me, item) => {
  if (item.access_type === 'public') return true;
  if (!me) return false;
  if (REPO_STAFF.includes(me.role)) return true;
  if ([...COLLEGE_SCOPED, ...DEPARTMENT_SCOPED].includes(me.role)) {
    const mine = await userOf(me.user_id);
    const col = item.college || (await one('repository', 'college', 'repo_id', item.repo_id))?.college;
    if (mine?.college && col && String(mine.college).trim().toLowerCase() === String(col).trim().toLowerCase()) return true;
  }
  if (item.proposal_id) {
    const p = await one('research_proposals', 'user_id', 'proposal_id', item.proposal_id);
    if (p && Number(p.user_id) === Number(me.user_id)) return true;
  }
  if (item.external_id) {
    const x = await one('externally_funded', 'user_id', 'external_id', item.external_id);
    if (x && Number(x.user_id) === Number(me.user_id)) return true;
  }
  return false;
};

/* May this person open the file at `path`? Looks for every record that holds it:
   one record that allows it is enough. Unknown files: no. */
const mayOpen = async (me, path) => {
  const repo = await supabase.from('repository')
    .select('repo_id, proposal_id, external_id, access_type, college').eq('file_path', path);
  if (repo.error) throw repo.error;
  for (const item of repo.data || []) if (await mayRepository(me, item)) return true;
  if (!me) return false;                                   // not signed in: public repository only

  const pf = await one('proposal_files', 'proposal_id', 'file_path', path);
  if (pf && await mayProposal(me, pf.proposal_id)) return true;
  const rp = await one('research_proposals', 'proposal_id', 'file_path', path);
  if (rp && await mayProposal(me, rp.proposal_id)) return true;

  const tr = await one('terminal_reports', 'report_id, user_id', 'file_path', path).catch(() => null);
  if (tr && await mayTerminal(me, tr)) return true;

  const xf = await one('external_files', 'external_id', 'file_path', path);
  if (xf && await mayExternal(me, xf.external_id)) return true;
  const xr = await one('externally_funded', 'external_id', 'file_path', path);
  if (xr && await mayExternal(me, xr.external_id)) return true;
  return false;
};

/* ── GET a short-lived link to a file ── */
router.get('/link', optionalAuth, async (req, res) => {
  const path = String(req.query.path || '').trim().slice(0, 600);
  if (!/^https?:\/\//i.test(path)) return res.status(400).json({ message: 'Invalid file.' });

  const key = keyOf(path);
  try {
    if (!(await mayOpen(req.user, path))) {
      return res.status(req.user ? 403 : 401).json({
        message: req.user ? 'You cannot open this file.' : 'Please sign in to open this file.',
        code: 'FILE_NOT_ALLOWED',
      });
    }
    if (!key) return res.json({ url: path });              // a link to another website (Repository): as it is

    const download = String(req.query.download || '').replace(/[\\/"]/g, '_').slice(0, 200);
    const { data, error } = await bucket()
      .createSignedUrl(key, LINK_MINUTES * 60, download ? { download } : undefined);
    if (error || !data?.signedUrl) throw error || new Error('No signed link');
    res.set('Cache-Control', 'no-store');
    return res.json({ url: data.signedUrl, expires_in: LINK_MINUTES * 60 });
  } catch (err) {
    console.error('File link error:', err.message || err);
    return res.status(500).json({ message: 'Could not open the file. Please try again.' });
  }
});

/* ── GET a profile picture (anyone) ── */
const AVATAR_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
router.get('/avatar/:name', async (req, res) => {
  const name = String(req.params.name || '');
  const m = name.match(/^[\w-]{1,80}\.(png|jpe?g|webp)$/i);
  if (!m) return res.status(404).end();
  try {
    const { data, error } = await bucket().download(`avatars/${name}`);
    if (error || !data) return res.status(404).end();
    const buf = Buffer.from(await data.arrayBuffer());
    res.set({
      'Content-Type':  AVATAR_TYPES[m[1].toLowerCase()],
      'Cache-Control': 'public, max-age=86400, immutable',   // every new picture gets a new name
    });
    return res.send(buf);
  } catch (err) {
    console.error('Avatar error:', err.message || err);
    return res.status(404).end();
  }
});

module.exports = router;