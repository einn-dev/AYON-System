const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const supabase = require('../config/supabase');
const { notifyUser } = require('../utils/notify');
const { notifyStaff } = require('../utils/roleNotify');
const { personName } = require('../utils/names');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/* ─────────────────────────────────────────────────────────────
   External Research: externally funded research, for the Repository only.
   No office chain: once every required field is filled in, it is stored in
   the Research Repository, always PRIVATE. Who can see it:
     the researcher          their own        GET /my
     Chairperson, Research   their college    GET /college
       Coordinator, Dean
     MSIRC offices + Admin   all              GET /
   Other researchers cannot see or search it.
   ───────────────────────────────────────────────────────────── */

const MAX_MB    = 10;
const ABSTRACT_WORDS = 300;
const COLLEGE_ROLES  = ['chairperson', 'research_coordinator', 'college_dean'];
const OFFICE_ROLES   = ['admin', 'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    allowed.includes(file.mimetype) ? cb(null, true)
      : cb(new Error('Only PDF, DOC or DOCX files are allowed.'));
  },
});

/* a bad or too-large file answers 400 with a clear message, not a server error */
const uploadOne = (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  const msg = err.code === 'LIMIT_FILE_SIZE' ? `The document must be ${MAX_MB} MB or smaller.` : (err.message || 'The document could not be read.');
  return res.status(400).json({ message: msg });
});

const clean   = (v, max) => String(v ?? '').trim().slice(0, max);
const wordsIn = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
const isDate  = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/* What is missing or wrong, or '' */
const problemOf = (f, file) => {
  if (!f.title)           return 'Research title is required.';
  if (!f.external_agency) return 'External funding agency is required.';
  if (!f.researchers)     return 'Researchers / co-authors are required.';
  if (!f.description)     return 'Abstract is required.';
  if (wordsIn(f.description) > ABSTRACT_WORDS) return `The abstract must be ${ABSTRACT_WORDS} words or fewer.`;
  if (!(Number(f.funding_amount) > 0)) return 'Funding amount is required (more than ₱0).';
  if (!isDate(f.start_date)) return 'Start date is required.';
  if (!isDate(f.end_date))   return 'End date is required.';
  if (f.end_date < f.start_date) return 'The end date must be on or after the start date.';
  if (!file) return 'The research document is required (PDF or Word).';
  return '';
};

/* ── POST upload externally funded research (researcher) ──
   Every field is required except keywords. Stored in the Repository, private. */
router.post('/', verifyToken, authorizeRoles('researcher'), uploadOne, async (req, res) => {
  const b = req.body || {};
  const f = {
    title:           clean(b.title, 255),
    external_agency: clean(b.external_agency, 255),
    researchers:     clean(b.researchers, 1000),
    description:     clean(b.description, 5000),
    keywords:        clean(b.keywords, 500),
    funding_amount:  clean(b.funding_amount, 20),
    start_date:      clean(b.start_date, 10),
    end_date:        clean(b.end_date, 10),
  };
  const problem = problemOf(f, req.file);
  if (problem) return res.status(400).json({ message: problem });

  try {
    const ext      = (req.file.originalname.split('.').pop() || 'pdf').toLowerCase();
    const fileName = `external/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (upErr) throw upErr;
    const { data: urlData } = supabase.storage.from(process.env.SUPABASE_BUCKET).getPublicUrl(fileName);
    const file_path = urlData?.publicUrl || fileName;

    const { data: row, error } = await supabase
      .from('externally_funded')
      .insert({
        user_id:         req.user.user_id,
        title:           f.title,
        external_agency: f.external_agency,
        researchers:     f.researchers,
        description:     f.description,
        keywords:        f.keywords || null,
        file_path,
        funding_amount:  Number(f.funding_amount),
        start_date:      f.start_date,
        end_date:        f.end_date,
      })
      .select('external_id')
      .single();
    if (error) throw error;

    const { data: user } = await supabase
      .from('users')
      .select('first_name, middle_name, last_name, college, department')
      .eq('user_id', req.user.user_id)
      .single();

    /* always private: only the researcher, their college and the offices see it */
    const { error: repoErr } = await supabase.from('repository').insert({
      external_id: row.external_id,
      title:       f.title,
      abstract:    f.description,
      author:      f.researchers || (user ? personName(user) : null),
      college:     user?.college    || null,
      department:  user?.department || null,
      keywords:    f.keywords || null,
      file_path,
      access_type: 'private',
      source_type: 'external',
    });
    if (repoErr) console.error('External research: repository insert failed:', repoErr.message || repoErr);

    await notifyStaff({
      title:   'New research in the Repository',
      message: `"${f.title}" (externally funded)${user ? ` by ${personName(user)}` : ''} was added to the Research Repository as private.`,
    });

    await notifyUser({
      user_id:    req.user.user_id,
      notif_type: 'submission',
      title:      'External Research Stored',
      message:    `Your externally funded research "${f.title}" was stored in the Research Repository. It is private: only you, your college and the MSIRC offices can see it.`,
    });

    return res.status(201).json({
      message:     'External research stored in the Research Repository (private).',
      external_id: row.external_id,
    });
  } catch (err) {
    console.error('External upload error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* the researcher's name, college and department on each item */
const withOwners = async (items) => {
  const ids = [...new Set((items || []).map((e) => e.user_id))];
  if (!ids.length) return [];
  const { data: us, error } = await supabase
    .from('users').select('user_id, first_name, middle_name, last_name, college, department').in('user_id', ids);
  if (error) throw error;
  const by = {};
  (us || []).forEach((u) => { by[u.user_id] = u; });
  return items.map((e) => {
    const u = by[e.user_id] || {};
    return {
      ...e,
      first_name: u.first_name, middle_name: u.middle_name, last_name: u.last_name,
      college: u.college || null, department: u.department || null,
    };
  });
};

/* ── GET my external research (researcher) ── */
router.get('/my', verifyToken, authorizeRoles('researcher'), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('externally_funded')
      .select('*')
      .eq('user_id', req.user.user_id)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ items: data });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET external research of my college (Chairperson, Research Coordinator, Dean) ── */
router.get('/college', verifyToken, authorizeRoles(...COLLEGE_ROLES), async (req, res) => {
  try {
    const { data: me, error: meErr } = await supabase
      .from('users').select('college').eq('user_id', req.user.user_id).maybeSingle();
    if (meErr) throw meErr;
    if (!me?.college) return res.status(200).json({ items: [], college: null });

    const { data: people, error: pErr } = await supabase
      .from('users').select('user_id').eq('college', me.college);
    if (pErr) throw pErr;
    const ids = (people || []).map((u) => u.user_id);
    if (!ids.length) return res.status(200).json({ items: [], college: me.college });

    const { data, error } = await supabase
      .from('externally_funded')
      .select('*')
      .in('user_id', ids)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ items: await withOwners(data || []), college: me.college });
  } catch (err) {
    console.error('External research (college) error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

/* ── GET all external research (MSIRC offices and Admin) ── */
router.get('/', verifyToken, authorizeRoles(...OFFICE_ROLES), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('externally_funded')
      .select('*')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return res.status(200).json({ items: await withOwners(data || []) });
  } catch (err) {
    console.error('External research (all) error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;