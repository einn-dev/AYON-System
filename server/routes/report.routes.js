const express  = require('express');
const router   = express.Router();
const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

const REPORT_ROLES = ['admin','msric_staff','msric_director','ovcred'];

/* ── Helper: draw a simple table row ── */
const drawHeader = (doc, title) => {
  doc.rect(0, 0, doc.page.width, 90).fill('#1a3a5c');
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
     .text('AYON', 50, 26);
  doc.fontSize(9).font('Helvetica')
     .text('MSIRC – Mindanao State University Main Campus', 50, 54);
  doc.fillColor('#1a3a5c').fontSize(15).font('Helvetica-Bold')
     .text(title, 50, 110);
  doc.fontSize(9).font('Helvetica').fillColor('#718096')
     .text(`Generated: ${new Date().toLocaleString()}`, 50, 132);
  doc.moveTo(50, 150).lineTo(doc.page.width - 50, 150)
     .strokeColor('#e8edf2').stroke();
  doc.y = 165;
};

const drawRow = (doc, cols, widths, bold = false) => {
  const startX = 50;
  const y      = doc.y;
  if (y > doc.page.height - 80) { doc.addPage(); doc.y = 50; }
  let x = startX;
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
     .fontSize(8.5)
     .fillColor(bold ? '#1a3a5c' : '#2d3748');
  cols.forEach((col, i) => {
    doc.text(String(col ?? '—'), x, doc.y, { width: widths[i] - 8, ellipsis: true });
    x += widths[i];
  });
  doc.moveDown(0.8);
};

/* ── GET /api/reports/:type — generates & streams a PDF ── */
router.get('/:type', verifyToken, authorizeRoles(...REPORT_ROLES), async (req, res) => {
  const { type } = req.params;
  const valid = ['proposals','grants','repository','activity'];
  if (!valid.includes(type)) {
    return res.status(400).json({ message: 'Invalid report type.' });
  }

  try {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `attachment; filename=ayon-${type}-report.pdf`);
    doc.pipe(res);

    /* ─ Proposals Report ─ */
    if (type === 'proposals') {
      const { data } = await supabase
        .from('research_proposals')
        .select(`title, proposal_type, status, submitted_at,
                 users ( first_name, last_name, college )`)
        .order('created_at', { ascending: false });

      drawHeader(doc, 'Research Proposals Report');
      const widths = [150, 100, 90, 80, 75];
      drawRow(doc, ['Title','Researcher','Type','Status','Submitted'], widths, true);

      (data || []).forEach(p => drawRow(doc, [
        p.title,
        `${p.users?.first_name || ''} ${p.users?.last_name || ''}`,
        p.proposal_type?.replace(/_/g,' '),
        p.status?.replace(/_/g,' '),
        p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—',
      ], widths));

      doc.moveDown().font('Helvetica-Bold').fontSize(10).fillColor('#1a3a5c')
         .text(`Total Proposals: ${data?.length || 0}`, 50);
    }

    /* ─ Grants Report ─ */
    if (type === 'grants') {
      const { data } = await supabase
        .from('grant_applications')
        .select(`grant_type, status, date_applied,
                 research_proposals ( title, users ( first_name, last_name ) )`)
        .order('date_applied', { ascending: false });

      drawHeader(doc, 'Grant & Incentives Report');
      const widths = [160, 110, 100, 75, 60];
      drawRow(doc, ['Proposal','Researcher','Grant Type','Status','Applied'], widths, true);

      (data || []).forEach(g => drawRow(doc, [
        g.research_proposals?.title,
        `${g.research_proposals?.users?.first_name || ''} ${g.research_proposals?.users?.last_name || ''}`,
        g.grant_type?.replace(/_/g,' '),
        g.status,
        g.date_applied ? new Date(g.date_applied).toLocaleDateString() : '—',
      ], widths));

      doc.moveDown().font('Helvetica-Bold').fontSize(10).fillColor('#1a3a5c')
         .text(`Total Applications: ${data?.length || 0}`, 50);
    }

    /* ─ Repository Report ─ */
    if (type === 'repository') {
      const { data } = await supabase
        .from('repository')
        .select('*')
        .order('store_date', { ascending: false });

      drawHeader(doc, 'Research Repository Report');
      const widths = [170, 110, 80, 70, 75];
      drawRow(doc, ['Title','Author','College','Access','Stored'], widths, true);

      (data || []).forEach(r => drawRow(doc, [
        r.title, r.author, r.college, r.access_type,
        r.store_date ? new Date(r.store_date).toLocaleDateString() : '—',
      ], widths));

      doc.moveDown().font('Helvetica-Bold').fontSize(10).fillColor('#1a3a5c')
         .text(`Total Archived: ${data?.length || 0}`, 50);
    }

    /* ─ Activity Report (summary counts) ─ */
    if (type === 'activity') {
      const [{ count: userCount },   { count: propCount },
             { count: grantCount },  { count: repoCount }] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('research_proposals').select('*', { count: 'exact', head: true }),
        supabase.from('grant_applications').select('*', { count: 'exact', head: true }),
        supabase.from('repository').select('*', { count: 'exact', head: true }),
      ]);

      const { data: byStatus } = await supabase
        .from('research_proposals').select('status');

      const statusCounts = {};
      (byStatus || []).forEach(p => {
        statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      });

      drawHeader(doc, 'System Activity Report');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a3a5c')
         .text('Overall Statistics', 50).moveDown(0.5);

      const stats = [
        ['Registered Users',      userCount  || 0],
        ['Research Proposals',    propCount  || 0],
        ['Grant Applications',    grantCount || 0],
        ['Repository Items',      repoCount  || 0],
      ];
      stats.forEach(([label, val]) => {
        doc.font('Helvetica').fontSize(10).fillColor('#2d3748')
           .text(`${label}:  ${val}`, 60).moveDown(0.3);
      });

      doc.moveDown().font('Helvetica-Bold').fontSize(11).fillColor('#1a3a5c')
         .text('Proposals by Status', 50).moveDown(0.5);
      Object.entries(statusCounts).forEach(([status, count]) => {
        doc.font('Helvetica').fontSize(10).fillColor('#2d3748')
           .text(`${status.replace(/_/g,' ')}:  ${count}`, 60).moveDown(0.3);
      });
    }

    doc.end();

    /* Log the generated report */
    await supabase.from('reports').insert({
      generated_by: req.user.user_id,
      report_type:  type,
      report_title: `AYON ${type} report`,
    });
  } catch (err) {
    console.error('Report error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Report generation failed.' });
    }
  }
});

/* ── GET report history ── */
router.get('/', verifyToken, authorizeRoles(...REPORT_ROLES), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reports')
      .select(`*, users ( first_name, last_name )`)
      .order('generated_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return res.status(200).json({ reports: data });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;