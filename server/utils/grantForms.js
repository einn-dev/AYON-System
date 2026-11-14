/* ─────────────────────────────────────────────────────────────
   The MSIRC forms filled in inside AYON.
   My Research:
     Internally Funded Research : Form 005 (research proposal for internal funding)
   Grants and Incentives:
     Travel Subsidy        : Form 001 (present a paper), Form 008 (attend a conference)
     Oral Presentation     : Form 003
     Publication Incentive : Form 002 (journal article), Form 004 (book or book chapter)

   For each form:
     fields  what the applicant fills in (the title is kept in the proposal's title)
             types: text, select, date, year, textarea, agenda (R&D Agenda area),
                    people (proponents), workplan (5-month grid), budget (PS and MOOE lines)
     docs    the documents the applicant uploads; the first one is the main document
     steps   what each office ticks or fills in on its step of the paper form
             items   tick boxes            (optional: true = tick only if it applies)
             choices pick one              (showIf: only asked when another answer matches)
             inputs  boxes to fill in
   THE SAME FILE IS KEPT IN client/src/utils/grantForms.js AND server/utils/grantForms.js.
   When you change one, change the other.
   ───────────────────────────────────────────────────────────── */

const DESIGNATIONS = ['Faculty', 'Student', 'Staff'];

/* MSU Marawi Research and Development Agenda 2023-2028 (from the R&E Manual) */
const AGENDA = [
  ['I. Human and Community Development', ['Education', 'Peace and Development', 'Social Services and Social Protection', 'Gender and Development and Persons With Disabilities (PWDs) Inclusion']],
  ['II. Culture, Tourism and the Arts', ['Mapping, Conservation, Preservation and Restoration of Cultural Heritage', 'Halal Ecosystem', 'Education', 'Women and Youth', 'Tourism and Hospitality Business Management']],
  ['III. Language, Media, and Communication Research', ['Theoretical and Applied Linguistics', 'Media Content Research and Innovation', 'Media and Information Literacy and other 21st Century Literacies', 'Communication, Campaign and Popularization of Scientific Knowledge', 'Language Documentation']],
  ['IV. Industry, Innovation, Infrastructure, Energy and Emerging Technologies', ['Transportation', 'Energy and Power Generation', 'Communication and Digital Network', 'Water and Sanitation', 'Advanced Materials', 'Materials for Energy', 'Nanotechnology', 'Optics and Photonics', 'Electronics Industry', 'ICT Innovations', 'Industry 4.0', 'Quantum Technology', 'Smart Cities, Villages and Communities', 'Artificial Intelligence', 'Utilities', 'Unmanned Vehicle Systems (UVS)', 'Metals and Engineering', 'Start-up Development Program', 'Technology and Innovation', 'Data Analytics', 'Data Visualization']],
  ['V. Sustainable Economic Production, Food Security and Poverty', ['Agriculture', 'Inland Fisheries', 'Marine Fisheries', 'Technological Innovations that Help Farmers', 'Socio-Economic and Policy Research', 'Food Security and Safety', 'Halal (food, medicines, cosmetics, and pharmaceuticals)', 'Entrepreneurship and Social Enterprise Development', 'Technology Business Incubation Program', 'Forestry', 'Circular Economy']],
  ['VI. The Biological-Physical-Chemical Environment', ['Lake Lanao, Agus River and Other Aquatic Ecosystems', 'Ranao-Agus Riverbasin, Watersheds, and Forests', 'Iligan Bay, Illana Bay and Other Marine Ecosystems', 'Agricultural Ecosystems', 'Urban Ecosystems', 'Biodiversity (flora and fauna) and Ecosystem Studies', 'Mineral Resources', 'Solid Waste Management', 'Pollution and Rehabilitation Studies of Degradation of Ecosystems', 'Land-use Change Assessment and Monitoring', 'Biomass and Carbon Stocks Estimation and Modelling', 'Green Computing']],
  ['VII. Health Research and Development', ['Environmental Health and Sanitation', 'Health Prophetical Education and Services', 'Family Health', 'Health and Climate Change', 'Health in Emergencies', 'Studies on Health Systems', 'Communicable and Non-communicable Diseases', 'Mental Health', 'Health-seeking Behavior', 'Health and Digital Technology', 'Emerging and Re-emerging Diseases', 'Anti-microbial Resistance', 'Studies on Cultural and Indigenous Practices Affecting Health', 'Policy Research', 'Sports, Physical Activity, and Recreation as Interventions to Health Problems']],
  ['VIII. Law and Governance', ['Policy Development', 'E-governance', 'Ethics, Transparency and Accountability', 'Legal Research', 'Contemporary Issues and Trends in the Muslim World', 'Global Security, Foreign Policy, Diplomacy and International Relations']],
  ['IX. Basic Research', ['Pure Basic Research', 'Policy Research', 'Oriented Basic Research']],
  ['X. Disaster Risk Reduction and Climate Change', ['Observation and Monitoring Networks', 'Technology Development and Application for Monitoring', 'Modelling and Simulation for Improvement of Monitoring and Forecasting', 'Hazards, Vulnerability, and Risk Assessments', 'Infrastructure', 'Warning and Risk Communication', 'Technology Development and Application for Climate Change Mitigation and Adaptation', 'Technology Development and Application for DRRM', 'Policy Research']],
];
const AGENDA_OPTIONS = AGENDA.flatMap(([area, subs]) => subs.map((sub) => `${area}: ${sub}`));

/* Form 005 budget rules */
const BUDGET_MAX  = 50000;   // "Estimated Budget (maximum of PhP 50,000.00)"
const PS_SHARE    = 0.45;    // "Personal Services ... should not exceed 45% of the MOOE"
const PLAN_MONTHS = 5;       // "Implementation Schedule Duration: 5 months"
const num = (v) => { const n = Number(String(v ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) ? n : 0; };
const budgetTotals = (b) => {
  const sum = (rows) => (rows || []).reduce((a, r) => a + num(r.amount), 0);
  const ps = sum(b && b.ps); const mooe = sum(b && b.mooe);
  return { ps, mooe, total: ps + mooe };
};
const wordsIn = (v) => String(v || '').trim().split(/\s+/).filter(Boolean).length;
const FINANCIAL = 'With financial assistance';

const GRANT_FORMS = {
  '005': {
    no: '005', type: 'internally_funded', needsSpotlight: false,
    name: 'Research Proposal for Internal Funding (MSU-Main Campus Research and Development Grant)',
    short: 'Research proposal',
    note: 'Form 005 (BOR Res. No. 221, s. 2024). Up to ₱50,000.00, 5 months.',
    titleLabel: '(1) Project Title', titleHint: 'Title of your research project',
    descFrom: 'summary',          // the Executive Summary is also saved as the abstract
    fields: [
      { k: 'proponents',   label: '(2) Proponent(s)', type: 'people', required: true,
        hint: 'Name and contact details (department, college, cellphone and email) of each proponent. The first one is the Project Leader.' },
      { k: 'summary',      label: '(3) Executive Summary', type: 'textarea', maxWords: 300, rows: 5, required: true, hint: 'Not more than 300 words.' },
      { k: 'introduction', label: '(4) Introduction', type: 'textarea', required: true,
        hint: 'A brief background of the study: the problem or need being addressed and the historical basis for the R&D. Include what justifies the research design and methodology.' },
      { k: 'objectives',   label: '(5) Objectives', type: 'textarea', required: true,
        hint: 'The general and specific objectives. Make them SMART: Specific, Measurable, Attainable, Relevant and Time-bound.' },
      { k: 'significance', label: '(6) Significance of the Study', type: 'textarea', required: true,
        hint: 'How the output will be used, its socio-economic benefits and impacts on health or other areas. Mention the end-users or beneficiaries, with their number and location if applicable.' },
      { k: 'output',       label: '(7) Expected Output', type: 'textarea', rows: 3, required: true,
        hint: 'The expected results: products, technologies, processes, knowledge or other deliverables.' },
      { k: 'priority',     label: '(8) R&D Priority Area', type: 'agenda', required: true,
        hint: 'From the approved MSU-Main Campus Research and Development Agenda 2023-2028.' },
      { k: 'program',      label: 'Program under the Priority Area', hint: 'For example: Smart schools (optional)' },
      { k: 'literature',   label: '(9) Review of Related Literature', type: 'textarea', required: true,
        hint: 'What is already known on the topic, the gaps or inconsistencies, and how this research addresses them.' },
      { k: 'methodology',  label: '(10) Methodology', type: 'textarea', rows: 6, required: true,
        hint: 'Research design, sampling, and data collection and analysis methods. Mention ethical, biosafety or IACUC considerations and how each will be addressed.' },
      { k: 'clearance',    label: 'Clearance needed', type: 'select', required: true,
        options: ['None', 'Research Ethics Committee (MSUM_REC)', 'Institutional Biosafety Committee (MSUM_IBC)', 'Institutional Animal Care and Use Committee (MSUM_IACUC)'] },
      { k: 'references',   label: '(11) References', type: 'textarea', required: true, hint: 'The literature and sources cited.' },
      { k: 'workplan',     label: '(12) Activities or Work Plan', type: 'workplan', required: true,
        hint: 'The major activities and the months (1 to 5) when each is done.' },
      { k: 'budget',       label: '(13) and (14) Budget', type: 'budget', required: true,
        hint: 'List each expense. The Estimated Budget totals are added up for you. Maximum of ₱50,000.00. No honoraria for the project leader or members.' },
      { k: 'duties',       label: '(17) Duties and Responsibilities of the Proponent(s)', type: 'textarea', rows: 4, required: true },
    ],
    docs: [
      { label: 'Curriculum Vitae of Proponent(s)', required: true, hint: 'Section (16): one file with the CV of each proponent.' },
      { label: 'Research Ethics, Biosafety or IACUC Clearance', hint: 'Only if your research needs one. It can be attached later if it is not out yet.' },
    ],
    steps: {},
  },

  '001': {
    no: '001', type: 'travel_subsidy', needsSpotlight: true,
    name: 'Application for Travel Grant for Research Dissemination',
    short: 'I will present a paper',
    note: 'Form 001 (BOR Res. No. 222, s. 2024). Needs an approved Research Spotlight.',
    titleLabel: 'Title of Research', titleHint: 'Title of the paper you will present',
    fields: [
      { k: 'designation', label: 'Designation', type: 'select', options: DESIGNATIONS, required: true },
      { k: 'conference',  label: 'Name of Conference', required: true },
      { k: 'destination', label: 'Destination', required: true, hint: 'City and country' },
      { k: 'date_from',   label: 'Travel Date, From', type: 'date', required: true },
      { k: 'date_to',     label: 'Travel Date, To', type: 'date', required: true },
    ],
    docs: [
      { label: 'Request Letter', required: true },
      { label: 'Full Manuscript', required: true },
      { label: 'Acceptance Letter', required: true },
      { label: 'Itinerary of Travel', required: true },
      { label: 'Ethics Clearance (REC, IACUC or IBC)', hint: 'Only if one applies to your research.' },
    ],
    steps: {
      chairperson: { items: [
        { k: 'manuscript', label: 'Full Manuscript' },
        { k: 'acceptance', label: 'Acceptance Letter' },
        { k: 'request',    label: 'Request Letter' },
      ] },
      research_coordinator: { choices: [
        { k: 'clearance', label: 'Clearance that applies', options: ['REC', 'IACUC', 'IBC', 'None'], required: true },
      ] },
      college_dean: { items: [
        { k: 'travel_order', label: 'Travel Order' },
        { k: 'itinerary',    label: 'Itinerary of Travel' },
        { k: 'ors_dv',       label: '4 copies of ORS and DV' },
      ] },
      special_assistant: { items: [
        { k: 'so_draft', label: 'S.O. Draft' },
        { k: 'inhouse',  label: 'In-house Research Review' },
      ] },
      msric_director: { choices: [
        { k: 'recommendation', label: 'Recommendation', options: ['On official time only', FINANCIAL], required: true },
        { k: 'chargeable', label: 'Chargeable against', options: ['College Funds', 'Research Funds'], required: true, showIf: { k: 'recommendation', is: FINANCIAL } },
      ] },
    },
  },

  '008': {
    no: '008', type: 'travel_subsidy', needsSpotlight: false,
    name: 'Application for Travel Authority for Conference Attendance',
    short: 'I will attend a conference (no paper)',
    note: 'Form 008. No Research Spotlight needed.',
    titleLabel: 'Name of Conference', titleHint: 'Name of the conference you will attend',
    fields: [
      { k: 'designation', label: 'Designation', type: 'select', options: DESIGNATIONS, required: true },
      { k: 'destination', label: 'Destination', required: true, hint: 'City and country' },
      { k: 'date_from',   label: 'Travel Date, From', type: 'date', required: true },
      { k: 'date_to',     label: 'Travel Date, To', type: 'date', required: true },
    ],
    docs: [
      { label: 'Request Letter', required: true, hint: 'Explain how the conference is relevant to your academic or research interests.' },
      { label: 'Invitation Letter or Proof of Registration', required: true },
      { label: 'Official Call or Announcement of the Conference', required: true },
    ],
    steps: {
      chairperson: { items: [
        { k: 'request',     label: 'Request letter explaining the relevance of the conference to the applicant\'s academic or research interests' },
        { k: 'invitation',  label: 'Invitation letter or proof of registration from the conference organizers' },
        { k: 'call',        label: 'Official call or announcement of the conference' },
        { k: 'active_duty', label: 'Applicant is on active duty at the time of the request' },
        { k: 'ors_dv',      label: '4 copies of ORS and DV' },
      ] },
      special_assistant: { items: [
        { k: 'aligned',   label: 'Conference aligns with the applicant\'s specialization' },
        { k: 'reputable', label: 'Conference is organized or endorsed by reputable institutions' },
      ] },
      msric_director: {
        choices: [
          { k: 'recommendation', label: 'Recommendation', options: ['On official time only', FINANCIAL], required: true },
        ],
        inputs: [
          { k: 'amount', label: 'Financial assistance amount (₱), chargeable against College Funds', type: 'money', required: true, showIf: { k: 'recommendation', is: FINANCIAL } },
        ],
      },
    },
  },

  '003': {
    no: '003', type: 'oral_presentation', needsSpotlight: true,
    name: 'Application for International Presentation Cash Incentive',
    short: 'Presentation cash incentive',
    note: 'Form 003 (BOR Res. No. 272, s. 2019). Needs an approved Research Spotlight.',
    titleLabel: 'Presentation Title', titleHint: 'Title of the paper you presented',
    fields: [
      { k: 'conference',     label: 'Presented at (name of conference)', required: true },
      { k: 'date_presented', label: 'Presented on', type: 'date', required: true },
      { k: 'organizer',      label: 'Conference Organizer', required: true },
    ],
    docs: [
      { label: 'Request Letter', required: true },
      { label: 'Presentation Article', required: true },
      { label: 'Certificate of Presentation', required: true, hint: 'Research Spotlight and the international conference, in one file.' },
      { label: 'Special Order (S.O.)', required: true },
      { label: 'Consent or Waiver of Co-authors', hint: 'Only if there are 2 or more authors.' },
    ],
    steps: {
      chairperson: { items: [
        { k: 'request', label: 'Request Letter from the author' },
        { k: 'article', label: '2 copies of the presentation article' },
        { k: 'bor',     label: 'Copy of BOR Res. No. 272, s. 2019' },
        { k: 'waiver',  label: 'Consent/Waiver for 2 or more authors', optional: true },
      ] },
      college_dean: { items: [
        { k: 'active_duty', label: 'On active duty at the time of request' },
        { k: 'certificate', label: 'Certificate of presentation (Spotlight and International Conference)' },
        { k: 'so',          label: 'S.O. (Special Order)' },
        { k: 'ors_dv',      label: '4 copies of ORS and DV' },
      ] },
      special_assistant: {
        inputs: [
          { k: 'date_started', label: 'Research Date Started', type: 'date' },
          { k: 'date_ended',   label: 'Date Ended', type: 'date' },
          { k: 'funding',      label: 'Funding Institution' },
          { k: 'fund_amount',  label: 'Amount of Fund (₱)', type: 'money' },
          { k: 'amount',       label: 'Eligible for Incentive, Amount (₱)', type: 'money', required: true },
        ],
        hint: 'If the application is not eligible, return it with your remarks instead.',
      },
    },
  },

  '002': {
    no: '002', type: 'publication_incentive', needsSpotlight: false,
    name: 'Application for Journal Publication Incentive',
    short: 'Journal article',
    note: 'Form 002 (BOR Res. No. 327, s. 2024).',
    titleLabel: 'Publication Title', titleHint: 'Title of the published article',
    fields: [
      { k: 'journal', label: 'Journal Name', required: true },
      { k: 'volume',  label: 'Volume' },
      { k: 'issue',   label: 'Issue No.' },
      { k: 'pages',   label: 'Pages' },
      { k: 'year',    label: 'Year Published', type: 'year', required: true },
    ],
    docs: [
      { label: 'Request Letter', required: true },
      { label: 'Published Article', required: true },
      { label: 'Consent or Waiver of Co-authors', hint: 'Only if there are 2 or more authors.' },
    ],
    steps: {
      chairperson: { items: [
        { k: 'request', label: 'Request Letter from the author' },
        { k: 'article', label: '2 copies of the published article' },
        { k: 'bor',     label: 'Copy of BOR Res. No. 327, s. 2024' },
        { k: 'waiver',  label: 'Consent/Waiver for 2 or more authors', optional: true },
      ] },
      college_dean: { items: [
        { k: 'active_duty', label: 'On active duty at the time of request' },
        { k: 'affiliation', label: 'Author\'s affiliation in the publication is MSU-Main Campus, Marawi City' },
        { k: 'ors_dv',      label: '4 copies of ORS and DV' },
      ] },
      special_assistant: {
        choices: [
          { k: 'index', label: 'SCOPUS Index', options: ['Journal', 'Conference Proceeding'], required: true },
        ],
        inputs: [
          { k: 'quartile', label: 'Quartile Rank', hint: 'For example Q1' },
          { k: 'amount',   label: 'Eligible for Incentive, Amount (₱)', type: 'money', required: true },
        ],
        hint: 'If the application is not eligible, return it with your remarks instead.',
      },
    },
  },

  '004': {
    no: '004', type: 'publication_incentive', needsSpotlight: false,
    name: 'Application for Book and Book Chapter Publication Incentives',
    short: 'Book or book chapter',
    note: 'Form 004 (BOR Res. No. 223, s. 2024).',
    titleLabel: 'Book Title', titleHint: 'Title of the book (and the chapter, for a book chapter)',
    fields: [
      { k: 'kind',      label: 'Book or Book Chapter', type: 'select', options: ['Book', 'Book Chapter'], required: true },
      { k: 'publisher', label: 'Publisher', required: true },
      { k: 'year',      label: 'Year', type: 'year', required: true },
    ],
    docs: [
      { label: 'Request Letter', required: true },
      { label: 'Copy of the Book or Chapter', required: true },
      { label: 'CHED and DepEd Recognition or ISBN Record', hint: 'Certificate of recognition, or the ISBN Directory entry of the National Library of the Philippines.' },
      { label: 'Certification That Schools Use the Book', hint: 'From at least two DepEd schools or SUCs outside the MSU System.' },
      { label: 'Consent or Waiver of Co-authors', hint: 'Only if there are 2 or more authors.' },
    ],
    steps: {
      chairperson: { items: [
        { k: 'request',     label: 'Request Letter from the author' },
        { k: 'book',        label: '2 copies of the Book' },
        { k: 'bor',         label: 'Copy of BOR Res. No. 223, s. 2024' },
        { k: 'waiver',      label: 'Consent/Waiver for 2 or more authors', optional: true },
        { k: 'active_duty', label: 'On active duty at the time of request' },
        { k: 'ors_dv',      label: '4 copies of ORS and DV' },
      ] },
      special_assistant: {
        items: [
          { k: 'recognition', label: 'Certificate of CHED and DepEd Recognition, or ISBN Directory of the National Library of the Philippines', optional: true },
          { k: 'schools',     label: 'Certification that at least two DepEd schools or SUCs (outside the MSU System) use the book', optional: true },
          { k: 'textbook',    label: 'Endorsed by the University Textbook Board', optional: true },
        ],
        inputs: [
          { k: 'amount', label: 'Eligible for Incentive, Amount (₱)', type: 'money', required: true },
        ],
        hint: 'Tick what applies. If the application is not eligible, return it with your remarks instead.',
      },
    },
  },
};

const FORMS_OF_TYPE = {
  internally_funded:     ['005'],
  travel_subsidy:        ['001', '008'],
  oral_presentation:     ['003'],
  publication_incentive: ['002', '004'],
};

const formOf  = (p) => (p && p.form_no ? GRANT_FORMS[p.form_no] || null : null);
const stepOf  = (p, role) => { const f = formOf(p); return (f && f.steps[role]) || null; };
const shown   = (q, answers) => !q.showIf || String((answers || {})[q.showIf.k] || '') === q.showIf.is;
const LONG = ['textarea', 'agenda', 'people', 'workplan', 'budget'];   // shown across the full width
const isMoney = (v) => /^\d{1,9}(\.\d{1,2})?$/.test(String(v || '').trim()) && Number(v) > 0;

/* Why the applicant's fields cannot be submitted yet, or '' */
const peopleProblem = (f, list) => {
  if (!list.length) return f.required ? 'Please add at least one proponent.' : '';
  const i = list.findIndex((p) => !p.name || !p.contact);
  return i >= 0 ? `Please fill in the name and the contact details of proponent ${i + 1}.` : '';
};
const planProblem = (f, rows) => {
  if (!rows.length) return f.required ? 'Please add at least one activity to the work plan.' : '';
  const i = rows.findIndex((r) => !r.months.length);
  return i >= 0 ? `Please tick at least one month for "${rows[i].activity}" in the work plan.` : '';
};
const budgetProblem = (f, b) => {
  const lines = [...b.ps, ...b.mooe];
  if (!lines.length) return f.required ? 'Please add the budget lines.' : '';
  const bad = lines.find((r) => !r.item || !isMoney(r.amount));
  if (bad) return `Each budget line needs an item and an amount${bad.item ? ` (check "${bad.item}")` : ''}.`;
  const t = budgetTotals(b);
  if (t.total > BUDGET_MAX) return `The total budget (₱${t.total.toLocaleString('en-PH')}) is over the ₱${BUDGET_MAX.toLocaleString('en-PH')} maximum.`;
  return '';
};
const fieldsProblem = (form, data) => {
  const d = data || {};
  for (const f of form.fields) {
    const raw = d[f.k];
    if (f.type === 'people') { const p = peopleProblem(f, raw || []); if (p) return p; continue; }
    if (f.type === 'workplan') { const p = planProblem(f, raw || []); if (p) return p; continue; }
    if (f.type === 'budget') { const p = budgetProblem(f, raw || { ps: [], mooe: [] }); if (p) return p; continue; }
    const v = String(raw || '').trim();
    if (f.required && !v) return `Please fill in "${f.label}".`;
    if (!v) continue;
    if (f.type === 'textarea') {
      if (f.maxWords && wordsIn(v) > f.maxWords) return `"${f.label}" must be ${f.maxWords} words or fewer (now ${wordsIn(v)}).`;
      continue;
    }
    if (f.type === 'agenda') { if (!AGENDA_OPTIONS.includes(v)) return `Please choose "${f.label}".`; continue; }
    if (v.length > 200) return `"${f.label}" must be 200 characters or fewer.`;
    if (f.type === 'select' && !f.options.includes(v)) return `Please choose "${f.label}".`;
    if (f.type === 'date' && Number.isNaN(Date.parse(v))) return `"${f.label}" is not a valid date.`;
    if (f.type === 'year' && !/^(19|20)\d{2}$/.test(v)) return `"${f.label}" must be a year, for example 2026.`;
  }
  if (d.date_from && d.date_to && String(d.date_to) < String(d.date_from)) return 'The "To" date cannot be earlier than the "From" date.';
  return '';
};

/* A note that does not stop submitting (Form 005: Personal Services against MOOE) */
const fieldsWarning = (form, data) => {
  const b = (data || {}).budget;
  if (!form || !form.fields.some((f) => f.type === 'budget') || !b) return '';
  const t = budgetTotals(b);
  if (t.ps > 0 && t.ps > t.mooe * PS_SHARE) {
    return `Personal Services (₱${t.ps.toLocaleString('en-PH')}) is more than 45% of the MOOE (₱${(t.mooe * PS_SHARE).toLocaleString('en-PH')}). Form 005 says it should not exceed that.`;
  }
  return '';
};

/* Why an office's step cannot be signed yet, or ''.   value = { ticks: [keys], answers: { k: value } } */
const stepProblem = (step, value) => {
  if (!step) return '';
  const ticks = (value && value.ticks) || [];
  const answers = (value && value.answers) || {};
  for (const it of step.items || []) {
    if (!it.optional && !ticks.includes(it.k)) return `Please tick "${it.label}" on the checklist, or return the application if it is missing.`;
  }
  for (const c of step.choices || []) {
    if (!shown(c, answers)) continue;
    const v = String(answers[c.k] || '');
    if (c.required && !v) return `Please choose: ${c.label}.`;
    if (v && !c.options.includes(v)) return `Please choose: ${c.label}.`;
  }
  for (const i of step.inputs || []) {
    if (!shown(i, answers)) continue;
    const v = String(answers[i.k] || '').trim();
    if (i.required && !v) return `Please fill in: ${i.label}.`;
    if (!v) continue;
    if (v.length > 200) return `"${i.label}" must be 200 characters or fewer.`;
    if (i.type === 'money' && !isMoney(v)) return `"${i.label}" must be an amount, for example 20000.`;
    if (i.type === 'date' && Number.isNaN(Date.parse(v))) return `"${i.label}" is not a valid date.`;
  }
  return '';
};

/* keeps only what the form defines */
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const cleanMoney = (v) => { const t = String(v ?? '').replace(/,/g, '').trim(); return /^\d{0,9}(\.\d{0,2})?$/.test(t) ? t : ''; };
const cleanFields = (form, data) => {
  const out = {};
  const d = data || {};
  form.fields.forEach((f) => {
    const raw = d[f.k];
    if (f.type === 'people') {
      const list = (Array.isArray(raw) ? raw : []).slice(0, 10)
        .map((p) => ({ name: str(p && p.name, 150), contact: str(p && p.contact, 300) }))
        .filter((p) => p.name || p.contact);
      if (list.length) out[f.k] = list;
    } else if (f.type === 'workplan') {
      const rows = (Array.isArray(raw) ? raw : []).slice(0, 20)
        .map((r) => ({
          activity: str(r && r.activity, 300),
          months: [...new Set(((r && r.months) || []).map(Number))].filter((m) => Number.isInteger(m) && m >= 1 && m <= PLAN_MONTHS).sort((x, y) => x - y),
        }))
        .filter((r) => r.activity);
      if (rows.length) out[f.k] = rows;
    } else if (f.type === 'budget') {
      const lines = (rows) => (Array.isArray(rows) ? rows : []).slice(0, 30)
        .map((r) => ({ item: str(r && r.item, 150), unit: str(r && r.unit, 150), amount: cleanMoney(r && r.amount) }))
        .filter((r) => r.item || r.amount);
      const b = { ps: lines(raw && raw.ps), mooe: lines(raw && raw.mooe) };
      if (b.ps.length || b.mooe.length) out[f.k] = b;
    } else if (f.type === 'textarea') {
      const v = str(raw, f.maxChars || 10000); if (v) out[f.k] = v;
    } else if (f.type === 'agenda') {
      const v = str(raw, 300); if (AGENDA_OPTIONS.includes(v)) out[f.k] = v;
    } else {
      const v = str(raw, 200); if (v) out[f.k] = v;
    }
  });
  return out;
};
const cleanStep = (step, value) => {
  const ticks = ((value && value.ticks) || []).filter((k) => (step.items || []).some((it) => it.k === k));
  const answers = {};
  [...(step.choices || []), ...(step.inputs || [])].forEach((q) => {
    const v = String(((value && value.answers) || {})[q.k] || '').trim().slice(0, 200);
    if (v && shown(q, (value && value.answers) || {})) answers[q.k] = v;
  });
  return { ticks: [...new Set(ticks)], answers };
};

module.exports = { GRANT_FORMS, FORMS_OF_TYPE, FINANCIAL, AGENDA, AGENDA_OPTIONS, BUDGET_MAX, PS_SHARE, PLAN_MONTHS, LONG, budgetTotals, wordsIn, formOf, stepOf, shown, fieldsProblem, fieldsWarning, stepProblem, cleanFields, cleanStep };