const express  = require('express');
const router   = express.Router();
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/authMiddleware');
const { attachTrail } = require('../utils/endorsementChain');
const { staffCanSee } = require('../controllers/proposal.controller');
const { TYPE_LABEL, ROLE_LABEL } = require('../utils/terms');

/* ─────────────────────────────────────────────────────────────
   Global search (the search box in the top bar)
     GET /api/search?q=lake
   → { proposals: [...], repository: [...], users: [...] }

   Each role only finds what it may already see on its own pages:
     researcher              → own proposals (drafts too)
     chairperson             → proposals of researchers in the same department
     coordinator, dean       → proposals of researchers in the same college
     MSIRC Staff             → proposals that reached the Special Assistant (list fields only)
     SA, Director, OVCRED,
     Administrator           → all submitted proposals
   Repository: public items for researchers and the college roles; all items for the office.
   Users: Administrator only.
   It matches titles, researcher names, colleges, departments, types and proposal numbers
   (not abstracts or file contents).
   ───────────────────────────────────────────────────────────── */

const LIMIT    = 8;
const SCAN     = 1000;          // newest proposals looked at per search
const Q_MAX    = 100;
const OFFICE   = ['special_assistant', 'msric_director', 'ovcred', 'admin'];
const ALL_REPO = ['admin', 'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];

const clean = (v) => String(v ?? '').trim();
const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();

router.get('/', verifyToken, async (req, res) => {
  const raw = clean(req.query.q).slice(0, Q_MAX);
  const q   = raw.toLowerCase();
  const idMatch = q.match(/^#?(\d{1,9})$/);
  if (!idMatch && q.length < 2) {
    return res.status(200).json({ proposals: [], repository: [], users: [], q: raw });
  }

  const role = req.user.role;
  const has  = (...vals) => vals.some(v => String(v ?? '').toLowerCase().includes(q));

  try {
    /* ── proposals ── */
    let scopeIds = null;                                   // null = no limit by researcher
    if (['chairperson', 'research_coordinator', 'college_dean'].includes(role)) {
      const field = role === 'chairperson' ? 'department' : 'college';
      const { data: me } = await supabase.from('users').select('college, department')
        .eq('user_id', req.user.user_id).maybeSingle();
      const mine = clean(me?.[field]);
      if (!mine) scopeIds = [];
      else {
        const { data: same, error } = await supabase.from('users').select('user_id').eq(field, mine);
        if (error) throw error;
        scopeIds = (same || []).map(u => u.user_id);
      }
    }

    let proposals = [];
    const canSearchProposals = role === 'researcher' || scopeIds !== null || OFFICE.includes(role) || role === 'msric_staff';
    if (canSearchProposals && !(Array.isArray(scopeIds) && !scopeIds.length)) {
      let qb = supabase.from('research_proposals')
        .select('proposal_id, user_id, title, proposal_type, status, endorsement_stage, submitted_at, created_at, revision_count, returned_by, users ( first_name, last_name, college, department )')
        .order('created_at', { ascending: false })
        .limit(SCAN);
      if (role === 'researcher') qb = qb.eq('user_id', req.user.user_id);
      if (Array.isArray(scopeIds)) qb = qb.in('user_id', scopeIds);
      if (idMatch) qb = qb.eq('proposal_id', Number(idMatch[1]));

      const { data, error } = await qb;
      if (error) throw error;

      let rows = (data || []).map(p => ({
        ...p,
        first_name: p.users?.first_name, last_name: p.users?.last_name,
        college: p.users?.college, department: p.users?.department,
      }));
      if (role !== 'researcher') rows = rows.filter(p => p.status !== 'draft');
      if (!idMatch) {
        rows = rows.filter(p => has(p.title, fullName(p), p.college, p.department,
          TYPE_LABEL[p.proposal_type], p.proposal_type));
      }
      if (role === 'msric_staff') {
        await attachTrail(rows);
        rows = rows.filter(staffCanSee);
      }
      proposals = rows.slice(0, LIMIT).map(p => {
        const base = {
          proposal_id:   p.proposal_id,
          title:         p.title,
          proposal_type: p.proposal_type,
          status:        p.status,
          submitted_at:  p.submitted_at,
          researcher:    fullName(p),
          college:       p.college || null,
        };
        if (role === 'msric_staff') return base;
        return { ...base, department: p.department || null, endorsement_stage: p.endorsement_stage || null };
      });
    }

    /* ── repository ── */
    let repository = [];
    if (!idMatch) {
      let rq = supabase.from('repository')
        .select('repo_id, title, author, college, keywords, access_type, store_date, file_path')
        .order('store_date', { ascending: false }).limit(SCAN);
      if (!ALL_REPO.includes(role)) rq = rq.eq('access_type', 'public');
      const { data, error } = await rq;
      if (error) throw error;
      repository = (data || []).filter(r => has(r.title, r.author, r.keywords, r.college)).slice(0, LIMIT)
        .map(r => ({
          repo_id: r.repo_id, title: r.title, author: r.author || null, college: r.college || null,
          access_type: r.access_type, file_path: r.file_path || null, year: r.store_date ? new Date(r.store_date).getFullYear() : null,
        }));
    }

    /* ── users (Administrator) ── */
    let users = [];
    if (role === 'admin' && !idMatch) {
      const { data, error } = await supabase.from('users')
        .select('user_id, first_name, last_name, email, is_active, user_roles!user_roles_user_id_fkey ( role_type )')
        .limit(SCAN);
      if (error) throw error;
      users = (data || []).filter(u => has(fullName(u), u.email)).slice(0, LIMIT).map(u => {
        const r = u.user_roles?.[0]?.role_type || 'researcher';
        return { user_id: u.user_id, name: fullName(u), email: u.email, role: r, role_label: ROLE_LABEL[r] || r, is_active: u.is_active !== false };
      });
    }

    return res.status(200).json({ proposals, repository, users, q: raw });
  } catch (err) {
    console.error('search error:', err);
    return res.status(500).json({ message: 'Search is not available right now. Please try again.' });
  }
});

module.exports = router;