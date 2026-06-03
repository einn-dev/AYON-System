const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const db       = require('../config/db');

const {
  getMyProposals, submitProposal, getAllProposals,
  getProposalById, updateProposalStatus,
} = require('../controllers/proposal.controller');

const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    allowed.includes(ext) ? cb(null, true) : cb(new Error('Only PDF/DOC/DOCX allowed.'));
  },
});

const SA_ROLES = ['special_assistant', 'admin'];
const REVIEW_ROLES = ['special_assistant', 'msric_director', 'ovcred', 'admin'];
const VIEW_ROLES   = ['admin', 'msric_staff', 'special_assistant', 'msric_director',
                      'ovcred', 'research_coordinator', 'chairperson', 'college_dean'];

router.get('/my',           verifyToken, authorizeRoles('researcher'),  getMyProposals);
router.post('/',            verifyToken, authorizeRoles('researcher'),  upload.single('file'), submitProposal);
router.get('/',             verifyToken, authorizeRoles(...VIEW_ROLES), getAllProposals);
router.get('/:id',          verifyToken, getProposalById);
router.patch('/:id/status', verifyToken, authorizeRoles(...REVIEW_ROLES), updateProposalStatus);

router.post('/:id/checklist', verifyToken, authorizeRoles(...SA_ROLES),
  async (req, res) => {
    const { id } = req.params;
    const { requirements, remarks } = req.body;
    try {
      const [sub] = await db.query(
        'SELECT submission_id FROM submissions WHERE proposal_id = ?', [id]
      );
      if (sub.length === 0) return res.status(404).json({ message: 'Submission not found.' });
      const sid = sub[0].submission_id;

      await db.query('DELETE FROM check_doc_req WHERE submission_id = ?', [sid]);

      for (const [name, status] of Object.entries(requirements || {})) {
        await db.query(
          `INSERT INTO check_doc_req
             (submission_id, requirement_name, requirement_status, notes, checked_by, checked_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [sid, name, status, remarks || null, req.user.user_id]
        );
      }

      await db.query(
        'UPDATE submissions SET submission_status = ? WHERE submission_id = ?',
        ['complete', sid]
      );

      return res.status(200).json({ message: 'Checklist saved.' });
    } catch (err) {
      console.error('Checklist error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;

/* ── Save Director review/decision ── */
router.post('/:id/review', verifyToken, authorizeRoles('msric_director', 'admin'),
  async (req, res) => {
    const { id } = req.params;
    const { decision, remarks } = req.body;
    try {
      const [proposal] = await db.query(
        'SELECT user_id, title FROM research_proposals WHERE proposal_id = ?', [id]
      );
      if (proposal.length === 0) return res.status(404).json({ message: 'Proposal not found.' });

      await db.query(
        `INSERT INTO review_documents
           (proposal_id, reviewer_id, remarks, decision, review_date)
         VALUES (?, ?, ?, ?, NOW())`,
        [id, req.user.user_id, remarks || null, decision]
      );

      await db.query(
        `INSERT INTO notifications
           (user_id, proposal_id, notif_type, title, message)
         VALUES (?, ?, 'review', 'Proposal Decision Made', ?)`,
        [proposal[0].user_id, id,
         `Your proposal "${proposal[0].title}" has been ${decision} by the MSRIC Director.`]
      );

      return res.status(201).json({ message: 'Review saved.' });
    } catch (err) {
      console.error('Review save error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ── POST endorse proposal (Coordinator / Chairperson / Dean) ── */
router.post('/:id/endorse', verifyToken,
  authorizeRoles('research_coordinator','chairperson','college_dean','admin'),
  async (req, res) => {
    const { id } = req.params;
    const { endorser_role, endorse_status, remarks } = req.body;

    const validRoles    = ['research_coordinator','chairperson','college_dean'];
    const validStatuses = ['endorsed','rejected'];

    if (!validRoles.includes(endorser_role) || !validStatuses.includes(endorse_status)) {
      return res.status(400).json({ message: 'Invalid endorser role or status.' });
    }

    try {
      const [proposal] = await db.query(
        'SELECT user_id, title FROM research_proposals WHERE proposal_id = ?', [id]
      );
      if (proposal.length === 0) return res.status(404).json({ message: 'Proposal not found.' });

      await db.query(
        `INSERT INTO endorsements
           (proposal_id, endorser_id, endorser_role, endorse_status, remarks,
            date_endorsed, date_rejected)
         VALUES (?, ?, ?, ?, ?,
           ${endorse_status === 'endorsed' ? 'NOW()' : 'NULL'},
           ${endorse_status === 'rejected' ? 'NOW()' : 'NULL'})`,
        [id, req.user.user_id, endorser_role, endorse_status, remarks || null]
      );

      await db.query(
        `INSERT INTO notifications
           (user_id, proposal_id, notif_type, title, message)
         VALUES (?, ?, 'endorsement', 'Proposal Endorsement Update', ?)`,
        [proposal[0].user_id, id,
         `Your proposal "${proposal[0].title}" has been ${endorse_status} by the ${endorser_role.replace(/_/g, ' ')}.`]
      );

      return res.status(201).json({ message: `Proposal ${endorse_status} successfully.` });
    } catch (err) {
      console.error('Endorse error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);