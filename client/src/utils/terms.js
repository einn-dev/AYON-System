/* ─────────────────────────────────────────────────────────────
   AYON standard terms.
   One place for the words shown on screen, so every dashboard calls the
   same thing the same way. Only the LABELS live here; the values saved in
   the database (for example 'under_review') never change.
   ───────────────────────────────────────────────────────────── */

export const OFFICE = 'MSIRC';

/* ── roles ── */
export const ROLE_LABEL = {
  researcher:           'Researcher',
  research_coordinator: 'Research Coordinator',
  chairperson:          'Chairperson',
  college_dean:         'College Dean',
  msric_staff:          'MSIRC Staff',
  special_assistant:    'Special Assistant',
  msric_director:       'MSIRC Director',
  ovcred:               'OVCRED',
  admin:                'Administrator',
};

/* ── proposal statuses: where the proposal is ── */
export const STATUS_LABEL = {
  draft:           'Draft',
  for_endorsement: 'For College Endorsement',
  submitted:       'For Validation',
  under_review:    'For Director Review',
  endorsed:        'For OVCRED Approval',
  returned:        'Returned for Revision',
  approved:        'Approved',
  rejected:        'Rejected',
};

/* the same color for a status on every page */
export const STATUS_BADGE = {
  draft:           'badge-gray',
  for_endorsement: 'badge-amber',
  submitted:       'badge-blue',
  under_review:    'badge-amber',
  endorsed:        'badge-purple',
  returned:        'badge-red',
  approved:        'badge-green',
  rejected:        'badge-red',
};

/* order used in filters and summaries */
export const STATUS_ORDER = [
  'for_endorsement', 'submitted', 'under_review', 'endorsed', 'returned', 'approved', 'rejected',
];

export const statusLabel = (s) => STATUS_LABEL[s] || String(s || '').replace(/_/g, ' ');
export const statusBadge = (s) => STATUS_BADGE[s] || 'badge-gray';

/* ── proposal and grant types ── */
export const TYPE_LABEL = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded Research',
  externally_funded:     'Externally Funded Research',
  travel_subsidy:        'Travel Subsidy',
  oral_presentation:     'Oral Presentation',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel Subsidy / Oral Presentation',   // older records, before the two were split
};

/* The Researcher's two pages: My Research, and Grants and Incentives */
/* externally funded research is not submitted here: it goes to External Research (Repository only) */
export const RESEARCH_TYPES  = ['research_spotlight', 'internally_funded'];
export const GRANT_TYPES     = ['travel_subsidy', 'oral_presentation', 'publication_incentive'];
/* these need an approved Research Spotlight first */
export const NEEDS_SPOTLIGHT = ['travel_subsidy', 'oral_presentation'];
export const isGrantType = (t) => GRANT_TYPES.includes(t) || t === 'travel_oral';

/* "proposal" for research, "application" for a grant or incentive */
export const wordFor = (p) => (isGrantType(p && p.proposal_type)
  ? { p: 'application', P: 'Application' } : { p: 'proposal', P: 'Proposal' });

/* the types to offer in filters (older types only while records still use them:
   the combined Travel Subsidy / Oral Presentation, and Externally Funded, which moved to External Research) */
const OLD_TYPES = ['travel_oral', 'externally_funded'];
export const typeChoices = (records = []) => Object.entries(TYPE_LABEL)
  .filter(([k]) => !OLD_TYPES.includes(k) || records.some((r) => r.proposal_type === k));
export const typeLabel = (t) => TYPE_LABEL[t] || String(t || '').replace(/_/g, ' ');

/* grant application statuses */
export const GRANT_STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
export const grantStatusLabel = (s) => GRANT_STATUS_LABEL[s] || String(s || '');