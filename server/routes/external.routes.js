const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const supabase = require('../config/supabase');
const { notifyUser } = require('../utils/notify');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    allowed.includes(file.mimetype) ? cb(null, true)
      : cb(new Error('Only PDF/DOC/DOCX files allowed.'));
  },
});

/* ── POST upload externally funded research ──
   Per the capstone scope: goes DIRECTLY to repository (no workflow) */
router.post('/', verifyToken, authorizeRoles('researcher'),
  upload.single('file'),
  async (req, res) => {
    const {
      title, external_agency, description,
      funding_amount, start_date, end_date,
    } = req.body;

    if (!title) return res.status(400).json({ message: 'Title is required.' });

    try {
      /* Upload file to Supabase Storage (if provided) */
      let file_path = null;
      if (req.file) {
        const ext      = req.file.originalname.split('.').pop();
        const fileName = `external/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype, upsert: false,
          });
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage
          .from(process.env.SUPABASE_BUCKET)
          .getPublicUrl(fileName);
        file_path = urlData?.publicUrl || fileName;
      }

      /* Insert externally funded record */
      const { data: ext, error } = await supabase
        .from('externally_funded')
        .insert({
          user_id:         req.user.user_id,
          title,
          external_agency: external_agency || null,
          description:     description     || null,
          file_path,
          funding_amount:  funding_amount  || null,
          start_date:      start_date      || null,
          end_date:        end_date        || null,
        })
        .select('external_id')
        .single();

      if (error) throw error;

      /* Auto-store to repository (private by default) */
      const { data: user } = await supabase
        .from('users')
        .select('first_name, last_name, college, department')
        .eq('user_id', req.user.user_id)
        .single();

      await supabase.from('repository').insert({
        external_id: ext.external_id,
        title,
        abstract:    description || null,
        author:      user ? `${user.first_name} ${user.last_name}` : null,
        college:     user?.college    || null,
        department:  user?.department || null,
        file_path,
        access_type: 'private',
        source_type: 'external',
      });

      await notifyUser({
        user_id:    req.user.user_id,
        notif_type: 'submission',
        title:      'External Research Uploaded',
        message:    `Your externally funded research "${title}" has been uploaded and stored in the repository.`,
      });

      return res.status(201).json({
        message:     'External research uploaded and stored to repository.',
        external_id: ext.external_id,
      });
    } catch (err) {
      console.error('External upload error:', err);
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

/* ── GET my external research ── */
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

/* ── GET all external research (staff view) ── */
router.get('/', verifyToken,
  authorizeRoles('admin','msric_staff','special_assistant','msric_director','ovcred'),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('externally_funded')
        .select(`*, users ( first_name, last_name, college )`)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      const items = data.map(e => ({
        ...e,
        first_name: e.users?.first_name,
        last_name:  e.users?.last_name,
        college:    e.users?.college,
      }));

      return res.status(200).json({ items });
    } catch (err) {
      return res.status(500).json({ message: 'Server error.' });
    }
  }
);

module.exports = router;