const express  = require('express');
const router   = express.Router();
const PDFDocument = require('pdfkit');
const supabase = require('../config/supabase');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');
const { withOptionalColumns } = require('../utils/optionalColumns');
const { attachTrail, roundOf } = require('../utils/endorsementChain');

const REPORT_ROLES = ['admin', 'msric_staff', 'msric_director', 'ovcred'];

/* ─────────────────────────────────────────────────────────────
   FILTERS (query string, the same for every report)
     period  : all | year | 90 | 30 | custom
     from,to : YYYY-MM-DD (only for period=custom)
     college : exact college name, empty = all
     status  : proposal status, empty = all      (proposals and summary)
     type    : proposal type, empty = all        (proposals and summary)
   ───────────────────────────────────────────────────────────── */
const STATUSES = ['for_endorsement', 'submitted', 'under_review', 'endorsed', 'returned', 'approved', 'rejected'];
const TYPES    = ['research_spotlight', 'internally_funded', 'publication_incentive', 'travel_oral', 'externally_funded'];
const PERIODS  = ['all', 'year', '90', '30', 'custom'];

const { STATUS_LABEL, TYPE_LABEL } = require('../utils/terms');
const PERIOD_LABEL = { all: 'All Time', year: 'This Year', 90: 'Last 90 Days', 30: 'Last 30 Days' };
const STAGE_LABEL = {
  research_coordinator: 'Research Coordinator', chairperson: 'Chairperson', college_dean: 'College Dean',
};
const OFFICE_ROLES = ['special_assistant', 'msric_director', 'ovcred'];
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;   // dates are read in Philippine time (UTC+8)
const DAY_MS = 24 * 60 * 60 * 1000;
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) && !Number.isNaN(Date.parse(v));

const readFilters = (q = {}) => {
  const period = PERIODS.includes(String(q.period)) ? String(q.period) : 'all';
  const f = {
    period,
    college: String(q.college || '').trim().slice(0, 100),
    status:  STATUSES.includes(q.status) ? q.status : '',
    type:    TYPES.includes(q.type) ? q.type : '',
    from: null, to: null,
  };
  const now = Date.now();
  if (period === '90' || period === '30') f.from = now - Number(period) * DAY_MS;
  if (period === 'year') {
    const ph = new Date(now + PH_OFFSET_MS);
    f.from = Date.UTC(ph.getUTCFullYear(), 0, 1) - PH_OFFSET_MS;
  }
  if (period === 'custom') {
    if (isDate(q.from)) f.from = Date.parse(`${q.from}T00:00:00Z`) - PH_OFFSET_MS;
    if (isDate(q.to))   f.to   = Date.parse(`${q.to}T00:00:00Z`) - PH_OFFSET_MS + DAY_MS - 1;
    f.fromText = isDate(q.from) ? q.from : '';
    f.toText   = isDate(q.to) ? q.to : '';
  }
  return f;
};

const inPeriod = (f, when) => {
  if (f.from === null && f.to === null) return true;
  const t = Date.parse(when || '');
  if (Number.isNaN(t)) return false;
  return (f.from === null || t >= f.from) && (f.to === null || t <= f.to);
};

/* the filters in words, for the PDF header and the history list */
const filterWords = (f, { withStatus = true } = {}) => {
  const period = f.period === 'custom'
    ? `${f.fromText || 'start'} to ${f.toText || 'today'}`
    : PERIOD_LABEL[f.period];
  const parts = [period, f.college || 'All Colleges'];
  if (withStatus) {
    parts.push(f.status ? STATUS_LABEL[f.status] : 'All Statuses');
    parts.push(f.type ? TYPE_LABEL[f.type] : 'All Types');
  }
  return parts.join(' · ');
};

/* reads every row (Supabase returns at most 1000 at a time) */
const fetchAll = async (table, columns, orderBy) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns)
      .order(orderBy, { ascending: true }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
};

const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();

/* where an open proposal is waiting */
const waitingOn = (p) => {
  if (p.status === 'for_endorsement') return STAGE_LABEL[p.endorsement_stage] || 'College';
  return { submitted: 'Special Assistant', under_review: 'MSIRC Director', endorsed: 'OVCRED', returned: 'Researcher' }[p.status] || '—';
};

/* MSIRC Staff see only proposals that reached the Special Assistant (same rule as their dashboard) */
const staffCanSee = (p) => {
  if (['submitted', 'under_review', 'endorsed', 'approved', 'rejected'].includes(p.status)) return true;
  if (p.status !== 'returned') return false;
  if (p.returned_by_role) return OFFICE_ROLES.includes(p.returned_by_role);
  return !p.returned_by && !(p.endorsements || []).some(e => e.endorse_status === 'returned' && Number(e.round || 1) === roundOf(p));
};

/* every submitted proposal the person may see, before the filters */
const loadProposals = async (req) => {
  const rows = await fetchAll('research_proposals',
    '*, users ( first_name, last_name, college, department )', 'proposal_id');
  const list = rows
    .filter(p => p.status !== 'draft')
    .map(p => ({
      ...p,
      researcher: fullName(p.users) || '—',
      college:    p.users?.college || '',
      department: p.users?.department || '',
      when:       p.submitted_at || p.created_at,
    }));
  if (req.user.role === 'msric_staff') {
    await attachTrail(list);
    return list.filter(staffCanSee);
  }
  return list;
};

const filterProposals = (list, f) => list.filter(p =>
  inPeriod(f, p.when)
  && (!f.college || p.college === f.college)
  && (!f.status || p.status === f.status)
  && (!f.type || p.proposal_type === f.type));

/* the numbers shown on the Reports page (and in the Summary PDF) */
const buildSummary = (all, f) => {
  const rows = filterProposals(all, f);
  const count = (s) => rows.filter(p => p.status === s).length;
  const approved = count('approved');
  const rejected = count('rejected');
  const decided  = approved + rejected;

  const byCollege = {};
  for (const p of rows) {
    const c = p.college || 'Not specified';
    const b = byCollege[c] || (byCollege[c] = { name: c, total: 0, at_college: 0, in_office: 0, returned: 0, approved: 0, rejected: 0 });
    b.total += 1;
    if (p.status === 'for_endorsement') b.at_college += 1;
    if (['submitted', 'under_review', 'endorsed'].includes(p.status)) b.in_office += 1;
    if (p.status === 'returned') b.returned += 1;
    if (p.status === 'approved') b.approved += 1;
    if (p.status === 'rejected') b.rejected += 1;
  }

  return {
    filters_text: filterWords(f),
    totals: {
      total:      rows.length,
      at_college: count('for_endorsement'),
      in_office:  count('submitted') + count('under_review') + count('endorsed'),
      returned:   count('returned'),
      approved,
      rejected,
      decided,
      approval_rate: decided ? Math.round((approved / decided) * 100) : null,
    },
    by_status: STATUSES.map(s => ({ status: s, label: STATUS_LABEL[s], count: count(s) })),
    waiting: [
      ...Object.keys(STAGE_LABEL).map(r => ({
        label: STAGE_LABEL[r], count: rows.filter(p => p.status === 'for_endorsement' && p.endorsement_stage === r).length,
      })),
      { label: 'Special Assistant',     count: count('submitted') },
      { label: 'MSIRC Director',        count: count('under_review') },
      { label: 'OVCRED',                count: count('endorsed') },
      { label: 'Researcher (returned)', count: count('returned') },
    ],
    by_college: Object.values(byCollege)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .map(b => ({ ...b, approval_rate: (b.approved + b.rejected) ? Math.round((b.approved / (b.approved + b.rejected)) * 100) : null })),
  };
};

/* ── PDF helpers (maroon AYON style) ── */
const MAROON = '#5e1420';

const drawHeader = (doc, title, filtersText, who) => {
  doc.rect(0, 0, doc.page.width, 84).fill(MAROON);
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('AYON', 50, 24);
  doc.fontSize(9).font('Helvetica').text('MSIRC – Mindanao State University Main Campus', 50, 52);
  doc.fillColor(MAROON).fontSize(15).font('Helvetica-Bold').text(title, 50, 104);
  doc.fontSize(9).font('Helvetica').fillColor('#6b5e61')
     .text(`Filters: ${filtersText}`, 50, 124, { width: doc.page.width - 100 });
  doc.text(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}${who ? ` by ${who}` : ''}`, 50, doc.y + 2);
  const y = doc.y + 8;
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#efe5e6').stroke();
  doc.y = y + 12;
};

const drawRow = (doc, cols, widths, bold = false) => {
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
  const heights = cols.map((c, i) => doc.heightOfString(String(c ?? '—'), { width: widths[i] - 8 }));
  const h = Math.min(Math.max(...heights, 10), 40);
  if (doc.y + h > doc.page.height - 60) { doc.addPage(); doc.y = 50; }
  const y = doc.y;
  if (bold) doc.rect(46, y - 4, widths.reduce((a, b) => a + b, 0) + 4, h + 8).fill('#faf3f4');
  let x = 50;
  doc.fillColor(bold ? MAROON : '#2d2327');
  cols.forEach((c, i) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
       .text(String(c ?? '—'), x, y, { width: widths[i] - 8, height: 40, ellipsis: true });
    x += widths[i];
  });
  doc.y = y + h + 7;
  doc.moveTo(50, doc.y - 3).lineTo(50 + widths.reduce((a, b) => a + b, 0) - 4, doc.y - 3).strokeColor('#f3eced').stroke();
};

const drawTotal = (doc, text) => {
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(10).fillColor(MAROON).text(text, 50);
};

const drawSection = (doc, title) => {
  if (doc.y > doc.page.height - 120) { doc.addPage(); doc.y = 50; }
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(11).fillColor(MAROON).text(title, 50).moveDown(0.4);
};

/* ── CSV helpers ── */
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;                 // a spreadsheet must never run a cell as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, rows) => '﻿' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const cap = (v) => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : '');
const grantStatus = cap;
const day = (v) => (v ? new Date(v).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }) : '');

/* ── report contents ── */
const REPORT_KINDS = ['proposals', 'grants', 'repository', 'summary'];
const TITLES = {
  proposals:  'Research Proposals Report',
  grants:     'Grants and Incentives Report',
  repository: 'Research Repository Report',
  summary:    'Summary Report',
};

const proposalRows = (list) => list
  .slice().sort((a, b) => String(b.when || '').localeCompare(String(a.when || '')))
  .map(p => ({
    title:      p.title,
    researcher: p.researcher,
    college:    p.college || '—',
    type:       TYPE_LABEL[p.proposal_type] || p.proposal_type,
    status:     STATUS_LABEL[p.status] || p.status,
    waiting:    ['approved', 'rejected'].includes(p.status) ? '—' : waitingOn(p),
    submitted:  day(p.when),
  }));

const loadGrants = async (f) => {
  const rows = await fetchAll('grant_applications',
    'grant_id, grant_type, status, date_applied, research_proposals ( title, users ( first_name, last_name, college ) )', 'grant_id');
  return rows
    .map(g => ({
      proposal:   g.research_proposals?.title || '—',
      researcher: fullName(g.research_proposals?.users) || '—',
      college:    g.research_proposals?.users?.college || '',
      type:       TYPE_LABEL[g.grant_type] || String(g.grant_type || '').replace(/_/g, ' '),
      status:     String(g.status || ''),
      applied:    g.date_applied,
    }))
    .filter(g => inPeriod(f, g.applied) && (!f.college || g.college === f.college))
    .sort((a, b) => String(b.applied || '').localeCompare(String(a.applied || '')));
};

const loadRepository = async (f) => {
  const rows = await fetchAll('repository', 'repo_id, title, author, college, department, access_type, source_type, store_date', 'repo_id');
  return rows
    .filter(r => inPeriod(f, r.store_date) && (!f.college || r.college === f.college))
    .sort((a, b) => String(b.store_date || '').localeCompare(String(a.store_date || '')));
};

/* ── GET /api/reports/stats — the numbers on the Reports page (JSON) ── */
router.get('/stats', verifyToken, authorizeRoles(...REPORT_ROLES), async (req, res) => {
  try {
    const f   = readFilters(req.query);
    const all = await loadProposals(req);
    const colleges = [...new Set(all.map(p => p.college).filter(Boolean))].sort();
    return res.status(200).json({ ...buildSummary(all, f), colleges });
  } catch (err) {
    console.error('Report summary error:', err);
    return res.status(500).json({ message: 'Could not load the report numbers.' });
  }
});

/* ── GET /api/reports/:type?format=pdf|csv&filters — downloads a report ──
   (the old name "activity" still works and gives the Summary report) */
router.get('/:type', verifyToken, authorizeRoles(...REPORT_ROLES), async (req, res) => {
  const type   = req.params.type === 'activity' ? 'summary' : req.params.type;
  const format = req.query.format === 'csv' ? 'csv' : 'pdf';
  if (!REPORT_KINDS.includes(type)) {
    return res.status(400).json({ message: 'Invalid report type.' });
  }
  if (type === 'summary' && format === 'csv') {
    return res.status(400).json({ message: 'The Summary report is only available as a PDF.' });
  }

  const f = readFilters(req.query);
  const words = filterWords(f, { withStatus: type === 'proposals' || type === 'summary' });
  const who = fullName(req.user) || null;

  try {
    /* gather everything BEFORE sending, so a database error can still answer with a clear message */
    let rows = [];
    let summary = null;
    if (type === 'proposals')  rows = proposalRows(filterProposals(await loadProposals(req), f));
    if (type === 'grants')     rows = await loadGrants(f);
    if (type === 'repository') rows = await loadRepository(f);
    if (type === 'summary')    summary = buildSummary(await loadProposals(req), f);

    const stamp = new Date(Date.now() + PH_OFFSET_MS).toISOString().slice(0, 10);
    const filename = `ayon-${type}-report-${stamp}.${format}`;

    if (format === 'csv') {
      let csv;
      if (type === 'proposals') {
        csv = toCsv(['Research Title', 'Researcher', 'College', 'Proposal Type', 'Status', 'Waiting On', 'Date Submitted'],
          rows.map(r => [r.title, r.researcher, r.college, r.type, r.status, r.waiting, r.submitted]));
      } else if (type === 'grants') {
        csv = toCsv(['Research Title', 'Researcher', 'College', 'Grant Type', 'Status', 'Date Applied'],
          rows.map(g => [g.proposal, g.researcher, g.college || '', g.type, grantStatus(g.status), day(g.applied)]));
      } else {
        csv = toCsv(['Research Title', 'Author', 'College', 'Department', 'Access', 'Source', 'Date Stored'],
          rows.map(r => [r.title, r.author || '', r.college || '', r.department || '', cap(r.access_type), r.source_type === 'external' ? 'Externally Funded Research' : 'Proposal', day(r.store_date)]));
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.status(200).send(csv);
    } else {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      doc.pipe(res);
      drawHeader(doc, TITLES[type], words, who);

      if (type === 'proposals') {
        const widths = [150, 85, 80, 70, 55, 55];
        drawRow(doc, ['Research Title', 'Researcher', 'College', 'Status', 'Waiting On', 'Date Submitted'], widths, true);
        rows.forEach(r => drawRow(doc, [r.title, r.researcher, r.college, r.status, r.waiting, r.submitted], widths));
        if (!rows.length) doc.font('Helvetica').fontSize(9).fillColor('#6b5e61').text('No proposals match these filters.', 50);
        drawTotal(doc, `Total Proposals: ${rows.length}`);
      }
      if (type === 'grants') {
        const widths = [140, 85, 75, 85, 50, 60];
        drawRow(doc, ['Research Title', 'Researcher', 'College', 'Grant Type', 'Status', 'Date Applied'], widths, true);
        rows.forEach(g => drawRow(doc, [g.proposal, g.researcher, g.college || '—', g.type, grantStatus(g.status), day(g.applied)], widths));
        if (!rows.length) doc.font('Helvetica').fontSize(9).fillColor('#6b5e61').text('No grant applications match these filters.', 50);
        drawTotal(doc, `Total Applications: ${rows.length}`);
      }
      if (type === 'repository') {
        const widths = [170, 100, 90, 55, 80];
        drawRow(doc, ['Research Title', 'Author', 'College', 'Access', 'Date Stored'], widths, true);
        rows.forEach(r => drawRow(doc, [r.title, r.author || '—', r.college || '—', cap(r.access_type), day(r.store_date)], widths));
        if (!rows.length) doc.font('Helvetica').fontSize(9).fillColor('#6b5e61').text('No repository items match these filters.', 50);
        drawTotal(doc, `Total Stored: ${rows.length}`);
      }
      if (type === 'summary') {
        const t = summary.totals;
        drawSection(doc, 'Totals');
        const tw = [250, 80];
        [['Total Proposals', t.total], ['At the College (endorsement)', t.at_college],
         ['In Office Review (Special Assistant, Director, OVCRED)', t.in_office], ['Returned for Revision', t.returned],
         ['Approved', t.approved], ['Rejected', t.rejected],
         ['Approval Rate (approved ÷ decided)', t.approval_rate === null ? '—' : `${t.approval_rate}%`],
        ].forEach(r => drawRow(doc, r, tw));

        drawSection(doc, 'Proposals by Status');
        summary.by_status.forEach(s => drawRow(doc, [s.label, s.count], tw));

        drawSection(doc, 'Where Open Proposals Are Waiting');
        summary.waiting.forEach(w => drawRow(doc, [w.label, w.count], tw));

        drawSection(doc, 'Proposals by College');
        const cw = [150, 45, 60, 65, 55, 55, 65];
        drawRow(doc, ['College', 'Total', 'At College', 'Office Review', 'Approved', 'Rejected', 'Approval Rate'], cw, true);
        summary.by_college.forEach(c => drawRow(doc,
          [c.name, c.total, c.at_college, c.in_office, c.approved, c.rejected, c.approval_rate === null ? '—' : `${c.approval_rate}%`], cw));
        if (!summary.by_college.length) doc.font('Helvetica').fontSize(9).fillColor('#6b5e61').text('No proposals match these filters.', 50);
      }
      doc.end();
    }

    /* log the generated report (best effort: a failed log never breaks the download) */
    try {
      const { error } = await withOptionalColumns(
        (payload) => supabase.from('reports').insert(payload),
        {
          generated_by: req.user.user_id,
          report_type:  type === 'summary' ? 'activity' : type,      // the table calls the summary "activity"
          report_title: `${TITLES[type]} (${format.toUpperCase()})`,
        },
        { filters: { text: words, period: f.period, college: f.college, status: f.status, type: f.type }, file_format: format },
      );
      if (error) console.error('Report log failed:', error.message || error);
    } catch (logErr) {
      console.error('Report log failed:', logErr.message || logErr);
    }
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