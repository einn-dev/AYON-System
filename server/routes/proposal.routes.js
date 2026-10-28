const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const supabase = require('../config/supabase');

const {
  getMyProposals, submitProposal, getAllProposals,
  getProposalById, updateProposalStatus, resubmitProposal,
  endorseProposal, getMyEndorsements,
} = require('../controllers/proposal.controller');

const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

/* ── Multer — memory storage (files go to Supabase, not disk) ── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    allowed.includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only PDF/DOC/DOCX files allowed.'));
  },
});

/* ── Supabase Storage upload middleware ── */
const uploadToSupabase = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const ext      = req.file.originalname.split('.').pop();
    const fileName = `proposals/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert:      false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    req.filePath = urlData?.publicUrl || fileName;
    next();
  } catch (err) {
    console.error('Supabase upload error:', err);
    return res.status(500).json({ message: 'File upload failed.' });
  }
};

/* Runs multer, but answers file problems (wrong type, too big) as clear JSON errors */
const uploadOne = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'The file is too large. The limit is 10 MB.'
      : (err.message || 'The file could not be uploaded.');
    return res.status(400).json({ message });
  });
};

const SA_ROLES    = ['special_assistant', 'admin'];
const REVIEW_ROLES = ['special_assistant','msric_director','ovcred','admin'];
const VIEW_ROLES   = ['admin','msric_staff','special_assistant','msric_director',
                      'ovcred','research_coordinator','chairperson','college_dean'];

/* ── Routes ── */
router.get('/my',           verifyToken, authorizeRoles('researcher'),  getMyProposals);
router.post('/',            verifyToken, authorizeRoles('researcher'),  uploadOne, uploadToSupabase, submitProposal);
router.get('/',             verifyToken, authorizeRoles(...VIEW_ROLES), getAllProposals);
router.post('/:id/resubmit', verifyToken, authorizeRoles('researcher'), uploadOne, uploadToSupabase, resubmitProposal);
router.get('/endorsements/mine', verifyToken,
  authorizeRoles('research_coordinator', 'chairperson', 'college_dean'), getMyEndorsements);
router.get('/:id',          verifyToken, getProposalById);
router.patch('/:id/status', verifyToken, authorizeRoles(...REVIEW_ROLES), updateProposalStatus);

/* ── Save document checklist (Special Assistant) ── */
router.post('/:id/checklist', verifyToken, authorizeRoles(...SA_ROLES),
  async (req, res) => {
    const { id } = req.params;
    const { requirements, remarks } = req.body;
    try {
      const { data: sub } = await supabase
        .from('submissions')
        .select('submission_id')
        .eq('proposal_id', id)
        .single();

      if (!sub) return res.status(404).json({ message: 'Submission not found.' });

      await supabase
        .from('check_doc_req')
        .delete()
        .eq('submission_id', sub.submission_id);

      const rows = Object.entries(requirements || {}).map(([name, status]) => ({
        submission_id:      sub.submission_id,
        requirement_name:   name,
        requirement_status: status,
        notes:              remarks || null,
        checked_by:         req.user.user_id,
        checked_at:         new Date().toISOString(),
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from('check_doc_req').insert(rows);
        if (error) throw error;
      }

      await supabase
        .from('submissions')
        .update({ submission_status: 'complete' })
        .eq('submission_id', sub.submission_id);

      return res.status(200).json({ message: 'Checklist saved.' });
    } catch (err) {
      console.error('Checklist error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ── Save Director review ── */
router.post('/:id/review', verifyToken, authorizeRoles('msric_director','ovcred','admin'),
  async (req, res) => {
    const { id } = req.params;
    const { remarks } = req.body || {};
    /* the table only accepts approve / reject / return; the screens may send other words */
    const DECISION = { approve: 'approve', approved: 'approve', endorse: 'approve', endorsed: 'approve',
                       reject: 'reject', rejected: 'reject', return: 'return', returned: 'return' };
    const decision = DECISION[String((req.body || {}).decision || '').trim().toLowerCase()];
    if (!decision) return res.status(400).json({ message: 'Invalid decision.' });
    try {
      const { data: proposal } = await supabase
        .from('research_proposals')
        .select('user_id, title')
        .eq('proposal_id', id)
        .single();

      if (!proposal) return res.status(404).json({ message: 'Proposal not found.' });

      const { error } = await supabase.from('review_documents').insert({
        proposal_id: parseInt(id),
        reviewer_id: req.user.user_id,
        remarks:     remarks || null,
        decision,
      });

      if (error) throw error;

      /* a return already told the researcher (with the reason) when the status changed */
      if (decision !== 'return') {
        const done = { approve: 'approved', reject: 'rejected' }[decision];
        const who  = req.user.role === 'ovcred' ? 'OVCRED' : req.user.role === 'admin' ? 'the Admin' : 'the MSRIC Director';
        await supabase.from('notifications').insert({
          user_id:     proposal.user_id,
          proposal_id: parseInt(id),
          notif_type:  'review',
          title:       'Proposal Decision Made',
          message:     `Your proposal "${proposal.title}" has been ${done} by ${who}.`,
        });
      }

      return res.status(201).json({ message: 'Review saved.' });
    } catch (err) {
      console.error('Review error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ── Endorse or return at the college level (Coordinator → Chairperson → Dean) ──
   The rules (whose turn, same college/department, required note) are in the controller. */
router.post('/:id/endorse', verifyToken,
  authorizeRoles('research_coordinator', 'chairperson', 'college_dean'),
  endorseProposal);

module.exports = router;