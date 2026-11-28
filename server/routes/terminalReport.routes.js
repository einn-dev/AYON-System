const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const supabase = require('../config/supabase');

const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { requireSignature }            = require('../utils/signatures');
const { notifyRole, notifyStaff }     = require('../utils/roleNotify');
const { endorsersFor, notifyIds }     = require('../utils/endorsementChain');
const { logAudit }                    = require('../utils/audit');
const { personName }                  = require('../utils/names');
const { ROLE_LABEL }                  = require('../utils/terms');
const { contentProblem }              = require('../utils/proposalFiles');

/* ─────────────────────────────────────────────────────────────
   Terminal Report (MSIRC Form No. 007) for approved Internally Funded Research.
     The researcher fills in the cover form, signs as Project Leader and uploads
     the full report as one file.
     Route: College Dean (endorses and signs) → MSIRC Special Assistant (checks)
            → MSIRC Director (accepts).
     Accepted: the research is Completed (research_proposals.completed_at) and the
     report is added to its Research Repository entry.
     Any step can return it with a reason; the researcher fixes it and it starts
     again from the College Dean.
   Table: terminal_reports (run add_terminal_reports.sql).
   ───────────────────────────────────────────────────────────── */

const FILE_MAX_MB        = 20;
const ABSTRACT_MAX_WORDS = 250;
const NOTE_MIN           = 10;
const NOTE_MAX           = 500;
const ALLOWED_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/* who acts at each step, and what the step becomes when they approve it */
const STEP = {
  for_dean:       { role: 'college_dean',      next: 'for_validation', done: 'Endorsed to MSIRC' },
  for_validation: { role: 'special_assistant', next: 'for_director',   done: 'Validated and forwarded' },
  for_director:   { role: 'msric_director',    next: 'accepted',       done: 'Accepted' },
};
const OFFICE_ROLES = ['college_dean', 'special_assistant', 'msric_director'];
const VIEW_ROLES   = [...OFFICE_ROLES, 'admin'];

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const long  = (v, max) => String(v ?? '').trim().slice(0, max);
const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isId   = (v) => /^\d+$/.test(String(v));

/* The table is missing until add_terminal_reports.sql is run */
const notReady = (err) => /terminal_reports|completed_at|does not exist|schema cache/i
  .test(String(err?.message || err?.details || ''));
const NOT_READY = {
  message: 'Terminal reports are not set up in the database yet. Please ask the Administrator to run add_terminal_reports.sql.',
  code: 'TERMINAL_REPORTS_NOT_READY',
};
const fail = (res, err, where) => {
  console.error(`Terminal report (${where}):`, err.message || err);
  if (notReady(err)) return res.status(503).json(NOT_READY);
  return res.status(500).json({ message: 'Server error.' });
};

/* ── the report file: one PDF, DOC or DOCX, at most 20 MB ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: FILE_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED_MIME.includes(file.mimetype)
    ? cb(null, true)
    : cb(new Error('The report must be a PDF, DOC or DOCX file.'))),
});
const uploadReport = (req, res, next) => upload.single('report')(req, res, (err) => {
  if (!err) return next();
  const message = err.code === 'LIMIT_FILE_SIZE'
    ? `The report file is too big. The limit is ${FILE_MAX_MB} MB.`
    : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT'
      ? 'Upload the full terminal report as one file.'
      : err.message || 'Could not read the file.';
  return res.status(400).json({ message });
});

const bucket = () => supabase.storage.from(process.env.SUPABASE_BUCKET);
const storeFile = async (file, proposalId) => {
  const ext = (file.originalname.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z]/g, '') || 'pdf';
  const key = `terminal-reports/${proposalId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await bucket().upload(key, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  const { data } = bucket().getPublicUrl(key);
  return { key, url: data?.publicUrl || key };
};
/* the storage key inside a public link, to remove an old file (never throws) */
const removeFile = async (url) => {
  try {
    const m = String(url || '').match(/\/terminal-reports\/[^?#]+/);
    if (m) await bucket().remove([m[0].slice(1)]);
  } catch (e) { console.error('Terminal report: could not remove the old file:', e.message || e); }
};

/* ── loading ── */
const proposalOf = async (id) => {
  const { data, error } = await supabase
    .from('research_proposals').select('proposal_id, user_id, title, description, proposal_type, status')
    .eq('proposal_id', id).maybeSingle();
  if (error) throw error;
  return data || null;
};
const userOf = async (id) => {
  const { data, error } = await supabase
    .from('users').select('user_id, first_name, middle_name, last_name, email, college, department')
    .eq('user_id', id).maybeSingle();
  if (error) throw error;
  return data || null;
};
const reportOfProposal = async (proposalId) => {
  const { data, error } = await supabase
    .from('terminal_reports').select('*').eq('proposal_id', proposalId).maybeSingle();
  if (error) throw error;
  return data || null;
};
const asList = (v) => {
  if (Array.isArray(v)) return v;
  try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
};
const asObject = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; }
};
/* a report as the screens use it: with its title, the researcher and the college */
const shape = (r, p, u) => ({
  ...r,
  form_data:   asObject(r.form_data),
  signatures:  asList(r.signatures),
  history:     asList(r.history),
  title:       p?.title || '',
  first_name:  u?.first_name || '', middle_name: u?.middle_name || '', last_name: u?.last_name || '',
  college:     u?.college || '', department: u?.department || '',
});

/* the cover form (MSIRC Form No. 007), cleaned; returns { f } or { error } */
const readForm = (raw) => {
  const b = asObject(raw);
  const f = {
    proponents: clean(b.proponents, 1000),
    months:     clean(b.months, 3),
    start_date: clean(b.start_date, 10),
    end_date:   clean(b.end_date, 10),
    agency:     clean(b.agency, 255),
    amount:     clean(b.amount, 20).replace(/[^\d.]/g, ''),
    site:       clean(b.site, 500),
    abstract:   long(b.abstract, 5000),
    keywords:   clean(b.keywords, 255),
  };
  if (!f.proponents) return { error: 'Please list the proponents.' };
  if (!(Number(f.months) > 0)) return { error: 'Please enter the number of months.' };
  if (!isDate(f.start_date) || !isDate(f.end_date)) return { error: 'Please enter the project start and end dates.' };
  if (f.end_date < f.start_date) return { error: 'The end date cannot be before the start date.' };
  if (!f.agency) return { error: 'Please enter the funding agency.' };
  if (!(Number(f.amount) > 0)) return { error: 'Please enter the amount of funds.' };
  if (!f.site) return { error: 'Please enter the implementation site(s).' };
  if (!f.abstract) return { error: 'Please write the abstract.' };
  if (words(f.abstract) > ABSTRACT_MAX_WORDS) {
    return { error: `The abstract is ${words(f.abstract)} words. Please keep it to ${ABSTRACT_MAX_WORDS} words or fewer.` };
  }
  return { f };
};

/* may this person see the report of this researcher? */
const canView = async (me, owner) => {
  if (Number(me.user_id) === Number(owner?.user_id)) return true;
  if (['special_assistant', 'msric_director', 'admin'].includes(me.role)) return true;
  if (me.role === 'college_dean') {
    const dean = await userOf(me.user_id);
    return !!dean?.college && dean.college === owner?.college;
  }
  return false;
};

/* ── GET the terminal report of one proposal (the researcher, or an office) ── */
router.get('/proposals/:id/terminal-report', verifyToken, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid proposal.' });
  try {
    const p = await proposalOf(id);
    if (!p) return res.status(404).json({ message: 'Proposal not found.' });
    const owner = await userOf(p.user_id);
    if (!(await canView(req.user, owner))) return res.status(403).json({ message: 'You cannot view this report.' });
    const r = await reportOfProposal(p.proposal_id);
    return res.json({ report: r ? shape(r, p, owner) : null });
  } catch (err) {
    return fail(res, err, 'get');
  }
});

/* ── POST submit, or fix and resubmit, the terminal report (the researcher) ──
   multipart: form_data (JSON), attest ("true"), report (the file; optional on a resubmit) */
router.post('/proposals/:id/terminal-report', verifyToken, authorizeRoles('researcher'), uploadReport, async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid proposal.' });
  const body = req.body || {};
  body.attest = body.attest === true || body.attest === 'true';
  try {
    const p = await proposalOf(id);
    if (!p || Number(p.user_id) !== Number(req.user.user_id)) return res.status(404).json({ message: 'Proposal not found.' });
    if (p.proposal_type !== 'internally_funded' || p.status !== 'approved') {
      return res.status(400).json({ message: 'A terminal report is only for approved Internally Funded Research.' });
    }
    const old = await reportOfProposal(p.proposal_id);
    if (old && old.status !== 'returned') {
      return res.status(409).json({ message: old.status === 'accepted'
        ? 'The terminal report was already accepted.'
        : 'The terminal report is already with the offices. You can change it only if it is returned to you.' });
    }

    const { f, error } = readForm(body.form_data);
    if (error) return res.status(400).json({ message: error });
    if (!req.file && !old?.file_path) return res.status(400).json({ message: 'Please upload the full terminal report.' });
    if (req.file) { const bad = contentProblem(req.file); if (bad) return res.status(400).json({ message: bad }); }

    const sig = await requireSignature(req);
    if (!sig.ok) return res.status(sig.status).json(sig.body);

    const me  = await userOf(req.user.user_id);
    const now = new Date().toISOString();
    /* a college with no active College Dean: the Dean step is skipped and the report
       goes straight to the MSIRC Special Assistant, like a submission skips a missing role */
    const deans = await endorsersFor('college_dean', me);
    const noDean = deans.length === 0;
    const stored = req.file ? await storeFile(req.file, p.proposal_id) : null;
    const leader = {
      role: 'researcher', signer_name: personName(me) || 'Project Leader',
      image_data: sig.signature.image_data, signed_at: now,
    };
    const history = [...asList(old?.history), {
      action: 'submitted', label: old ? 'Resubmitted' : 'Submitted', by: personName(me) || 'Researcher', at: now,
    }, ...(noDean ? [{
      action: 'skipped', label: 'College Dean step skipped: the college has no College Dean account, so it went to the MSIRC Special Assistant', at: now,
    }] : [])];
    const row = {
      proposal_id: p.proposal_id,
      user_id:     req.user.user_id,
      status:      noDean ? 'for_validation' : 'for_dean',
      form_data:   f,
      ...(stored ? { file_path: stored.url, file_name: clean(req.file.originalname, 255), file_size: req.file.size } : {}),
      signatures:  [leader],                  // a resubmit starts the signing again
      history,
      return_reason: null, returned_by_label: null, returned_at: null,
      submitted_at: now, updated_at: now,
    };
    const q = old
      ? supabase.from('terminal_reports').update(row).eq('report_id', old.report_id)
      : supabase.from('terminal_reports').insert(row);
    const { error: saveErr } = await q;
    if (saveErr) {
      if (stored) await removeFile(stored.url);
      throw saveErr;
    }
    if (stored && old?.file_path) await removeFile(old.file_path);

    if (noDean) {
      await notifyRole('special_assistant', {
        proposal_id: p.proposal_id, notif_type: 'submission',
        title: old ? 'Terminal Report Resubmitted' : 'New Terminal Report',
        message: `${personName(me) || 'A researcher'} ${old ? 'resubmitted' : 'submitted'} the Terminal Report for "${p.title}". `
          + `${me?.college || 'Their college'} has no College Dean account, so it came straight to you for validation.`,
      });
    } else {
      await notifyIds(deans, {
        proposal_id: p.proposal_id, notif_type: 'submission',
        title: old ? 'Terminal Report Resubmitted' : 'New Terminal Report',
        message: `${personName(me) || 'A researcher'} ${old ? 'resubmitted' : 'submitted'} the Terminal Report for "${p.title}". It is waiting for your endorsement.`,
      });
    }
    await logAudit(req, {
      action: old ? 'terminal_report_resubmitted' : 'terminal_report_submitted',
      targetType: 'proposal', targetId: p.proposal_id, targetName: p.title,
    });
    return res.status(old ? 200 : 201).json({
      message: noDean
        ? 'Terminal report submitted. Your college has no College Dean account, so it went straight to the MSIRC Special Assistant.'
        : 'Terminal report submitted. It is now with your College Dean.',
    });
  } catch (err) {
    return fail(res, err, 'submit');
  }
});

/* ── GET the terminal reports an office works on ──
   College Dean: the reports of researchers in their college. MSIRC: all. */
router.get('/terminal-reports', verifyToken, authorizeRoles(...VIEW_ROLES), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('terminal_reports').select('*').order('submitted_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) return res.json({ reports: [] });

    const pids = [...new Set(rows.map((r) => r.proposal_id))];
    const uids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    const [{ data: props, error: pErr }, { data: users, error: uErr }] = await Promise.all([
      supabase.from('research_proposals').select('proposal_id, title').in('proposal_id', pids),
      supabase.from('users').select('user_id, first_name, middle_name, last_name, college, department').in('user_id', uids),
    ]);
    if (pErr) throw pErr;
    if (uErr) throw uErr;
    const P = new Map((props || []).map((x) => [Number(x.proposal_id), x]));
    const U = new Map((users || []).map((x) => [Number(x.user_id), x]));

    let mineCollege = null;
    if (req.user.role === 'college_dean') mineCollege = (await userOf(req.user.user_id))?.college || '';

    const reports = rows
      .map((r) => shape(r, P.get(Number(r.proposal_id)), U.get(Number(r.user_id))))
      .filter((r) => mineCollege === null || (mineCollege && r.college === mineCollege));
    return res.json({ reports });
  } catch (err) {
    return fail(res, err, 'list');
  }
});

/* ── POST the office's decision: { decision: 'approve' | 'return', remarks, attest } ──
   College Dean: endorse (note and signature required). Special Assistant: forward.
   MSIRC Director: accept (Completed + Research Repository). Return needs a reason. */
router.post('/terminal-reports/:id/decision', verifyToken, authorizeRoles(...OFFICE_ROLES), async (req, res) => {
  const { id } = req.params;
  if (!isId(id)) return res.status(400).json({ message: 'Invalid report.' });
  const b = req.body || {};
  const decision = b.decision === 'return' ? 'return' : b.decision === 'approve' ? 'approve' : '';
  const remarks  = long(b.remarks, NOTE_MAX);
  if (!decision) return res.status(400).json({ message: 'Choose to approve or return the report.' });

  try {
    const { data: r, error } = await supabase.from('terminal_reports').select('*').eq('report_id', id).maybeSingle();
    if (error) throw error;
    if (!r) return res.status(404).json({ message: 'Report not found.' });

    const step = STEP[r.status];
    if (!step || step.role !== req.user.role) {
      return res.status(409).json({ message: 'This report is not waiting for you.', code: 'NOT_YOUR_TURN' });
    }
    const p     = await proposalOf(r.proposal_id);
    const owner = await userOf(r.user_id);
    if (!(await canView(req.user, owner))) return res.status(403).json({ message: 'This report is not from your college.' });

    if (decision === 'return' && remarks.length < NOTE_MIN) {
      return res.status(400).json({ message: `Please write the reason for returning it (at least ${NOTE_MIN} characters).` });
    }
    if (decision === 'approve' && req.user.role === 'college_dean' && remarks.length < NOTE_MIN) {
      return res.status(400).json({ message: `Please write a note (at least ${NOTE_MIN} characters) before endorsing.` });
    }

    const me  = await userOf(req.user.user_id);
    const by  = `${personName(me) || ROLE_LABEL[req.user.role]} (${ROLE_LABEL[req.user.role]})`;
    const now = new Date().toISOString();
    const history = asList(r.history);
    let signatures = asList(r.signatures);
    let patch;

    if (decision === 'return') {
      patch = {
        status: 'returned', return_reason: remarks, returned_by_label: ROLE_LABEL[req.user.role], returned_at: now,
        history: [...history, { action: 'returned', label: 'Returned', by, at: now, remarks }],
      };
    } else {
      if (req.user.role === 'college_dean') {             // the Dean signs Form 007 ("Endorsed by")
        const sig = await requireSignature(req);
        if (!sig.ok) return res.status(sig.status).json(sig.body);
        signatures = [...signatures.filter((s) => s.role !== 'college_dean'), {
          role: 'college_dean', signer_name: personName(me) || 'College Dean', image_data: sig.signature.image_data, signed_at: now,
        }];
      }
      patch = {
        status: step.next, signatures,
        ...(step.next === 'accepted' ? { decided_at: now } : {}),
        history: [...history, { action: 'approved', label: step.done, by, at: now, ...(remarks ? { remarks } : {}) }],
      };
    }
    patch.updated_at = now;

    /* only if nobody acted on it in the meantime */
    const { data: saved, error: upErr } = await supabase
      .from('terminal_reports').update(patch).eq('report_id', r.report_id).eq('status', r.status).select('report_id');
    if (upErr) throw upErr;
    if (!saved || !saved.length) return res.status(409).json({ message: 'Someone already acted on this report. Please refresh.' });

    const title = p?.title || 'your research';
    if (decision === 'return') {
      await notifyIds([r.user_id], {
        proposal_id: r.proposal_id, notif_type: 'review', title: 'Terminal Report Returned',
        message: `The ${ROLE_LABEL[req.user.role]} returned your Terminal Report for "${title}": ${remarks}`,
      });
    } else if (step.next === 'for_validation') {
      await notifyRole('special_assistant', {
        proposal_id: r.proposal_id, notif_type: 'endorsement', title: 'Terminal Report for Validation',
        message: `The College Dean endorsed the Terminal Report for "${title}" by ${personName(owner) || 'a researcher'}.`,
      });
      await notifyIds([r.user_id], {
        proposal_id: r.proposal_id, notif_type: 'endorsement', title: 'Terminal Report Endorsed',
        message: `Your College Dean endorsed your Terminal Report for "${title}". It is now with the MSIRC Special Assistant.`,
      });
    } else if (step.next === 'for_director') {
      await notifyRole('msric_director', {
        proposal_id: r.proposal_id, notif_type: 'review', title: 'Terminal Report for Review',
        message: `The MSIRC Special Assistant forwarded the Terminal Report for "${title}" by ${personName(owner) || 'a researcher'}.`,
      });
    } else if (step.next === 'accepted') {
      await completeResearch(r, p, owner);
      await notifyIds([r.user_id], {
        proposal_id: r.proposal_id, notif_type: 'approval', title: 'Research Completed',
        message: `The MSIRC Director accepted your Terminal Report for "${title}". Your research is now Completed and the report is in the Research Repository.`,
      });
    }

    await logAudit(req, {
      action: decision === 'return' ? 'terminal_report_returned' : `terminal_report_${step.next}`,
      targetType: 'proposal', targetId: r.proposal_id, targetName: title,
      details: remarks ? { remarks } : undefined,
    });
    return res.json({ message: decision === 'return' ? 'Returned to the researcher.' : `${step.done}.`, status: patch.status });
  } catch (err) {
    return fail(res, err, 'decision');
  }
});

/* Accepted: the research is Completed and the report goes to the Research Repository
   (its entry is updated, or a new private entry is made). Never throws. */
const completeResearch = async (r, p, owner) => {
  const f = asObject(r.form_data);
  try {
    const { error } = await supabase.from('research_proposals')
      .update({ completed_at: new Date().toISOString() }).eq('proposal_id', r.proposal_id);
    if (error) throw error;
  } catch (e) { console.error('Terminal report: could not mark the research Completed:', e.message || e); }

  try {
    const { data: existing, error } = await supabase
      .from('repository').select('repo_id').eq('proposal_id', r.proposal_id).maybeSingle();
    if (error) throw error;
    const entry = {
      title:      p?.title || 'Untitled research',
      abstract:   f.abstract || p?.description || null,
      author:     personName(owner) || null,
      college:    owner?.college || null,
      department: owner?.department || null,
      file_path:  r.file_path || null,
      keywords:   f.keywords ? String(f.keywords).slice(0, 255) : null,
    };
    if (existing) {
      const { error: e2 } = await supabase.from('repository').update(entry).eq('repo_id', existing.repo_id);
      if (e2) throw e2;
    } else {
      const { error: e3 } = await supabase.from('repository')
        .insert({ ...entry, proposal_id: r.proposal_id, access_type: 'private', source_type: 'proposal' });
      if (e3) throw e3;
      await notifyStaff({
        proposal_id: r.proposal_id,
        title: 'New research in the Repository',
        message: `"${entry.title}"${entry.author ? ` by ${entry.author}` : ''} was completed and added to the Research Repository.`,
      });
    }
  } catch (e) { console.error('Terminal report: could not add the report to the Research Repository:', e.message || e); }
};

module.exports = router;