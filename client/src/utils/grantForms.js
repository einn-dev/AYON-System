/* ─────────────────────────────────────────────────────────────
   The MSIRC forms behind Grants and Incentives.
     Travel Subsidy        : Form 001 (present a paper), Form 008 (attend a conference)
     Oral Presentation     : Form 003
     Publication Incentive : Form 002 (journal article), Form 004 (book or book chapter)

   For each form:
     fields  what the applicant fills in (the title is kept in the proposal's title)
     docs    the documents the applicant uploads; the first one is the main document
     steps   what each office ticks or fills in on its step of the paper form
             items   tick boxes            (optional: true = tick only if it applies)
             choices pick one              (showIf: only asked when another answer matches)
             inputs  boxes to fill in
   THE SAME FILE IS KEPT IN client/src/utils/grantForms.js AND server/utils/grantForms.js.
   When you change one, change the other.
   ───────────────────────────────────────────────────────────── */

const DESIGNATIONS = ['Faculty', 'Student', 'Staff'];
const FINANCIAL = 'With financial assistance';

const GRANT_FORMS = {
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
  travel_subsidy:        ['001', '008'],
  oral_presentation:     ['003'],
  publication_incentive: ['002', '004'],
};

const formOf  = (p) => (p && p.form_no ? GRANT_FORMS[p.form_no] || null : null);
const stepOf  = (p, role) => { const f = formOf(p); return (f && f.steps[role]) || null; };
const shown   = (q, answers) => !q.showIf || String((answers || {})[q.showIf.k] || '') === q.showIf.is;
const isMoney = (v) => /^\d{1,9}(\.\d{1,2})?$/.test(String(v || '').trim()) && Number(v) > 0;

/* Why the applicant's fields cannot be submitted yet, or '' */
const fieldsProblem = (form, data) => {
  for (const f of form.fields) {
    const v = String((data || {})[f.k] || '').trim();
    if (f.required && !v) return `Please fill in "${f.label}".`;
    if (!v) continue;
    if (v.length > 200) return `"${f.label}" must be 200 characters or fewer.`;
    if (f.type === 'select' && !f.options.includes(v)) return `Please choose "${f.label}".`;
    if (f.type === 'date' && Number.isNaN(Date.parse(v))) return `"${f.label}" is not a valid date.`;
    if (f.type === 'year' && !/^(19|20)\d{2}$/.test(v)) return `"${f.label}" must be a year, for example 2026.`;
  }
  const d = data || {};
  if (d.date_from && d.date_to && String(d.date_to) < String(d.date_from)) return 'The "To" date cannot be earlier than the "From" date.';
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
const cleanFields = (form, data) => {
  const out = {};
  form.fields.forEach((f) => { const v = String((data || {})[f.k] || '').trim().slice(0, 200); if (v) out[f.k] = v; });
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

export { GRANT_FORMS, FORMS_OF_TYPE, FINANCIAL, formOf, stepOf, shown, fieldsProblem, stepProblem, cleanFields, cleanStep };