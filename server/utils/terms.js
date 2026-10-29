/* ─────────────────────────────────────────────────────────────
   AYON standard terms (server side), the same words the screens use.
   Used in notification messages, emails and reports.
   Only labels live here; the values saved in the database never change.
   ───────────────────────────────────────────────────────────── */

const ROLE_LABEL = {
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

const STATUS_LABEL = {
  draft:           'Draft',
  for_endorsement: 'For College Endorsement',
  submitted:       'For Validation',
  under_review:    'For Director Review',
  endorsed:        'For OVCRED Approval',
  returned:        'Returned for Revision',
  approved:        'Approved',
  rejected:        'Rejected',
};

const TYPE_LABEL = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded Research',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel Subsidy / Oral Presentation',
  externally_funded:     'Externally Funded Research',
};

const statusLabel = (s) => STATUS_LABEL[s] || String(s || '').replace(/_/g, ' ');
const typeLabel   = (t) => TYPE_LABEL[t] || String(t || '').replace(/_/g, ' ');
const roleLabel   = (r) => ROLE_LABEL[r] || String(r || '').replace(/_/g, ' ');

module.exports = { ROLE_LABEL, STATUS_LABEL, TYPE_LABEL, statusLabel, typeLabel, roleLabel };