import { ROLE_REDIRECTS } from './roleRoutes';

/* ─────────────────────────────────────────────────────────────
   Where a notification takes you when you click it.
   A notification about a proposal or an application opens that record:
     - on the page where you act on it (For Endorsement, For Validation,
       For Review...), already opened, when it is your turn;
     - read-only, when someone has already handled it;
     - for the researcher, in My Research or Grants and Incentives.
   ───────────────────────────────────────────────────────────── */
export const isGrantAlert = (n) => /^new grant application/i.test(n.title || '');
export const isRepoNews   = (n) => /^new research in the repository/i.test(n.title || '');
/* Terminal Report (Form 007) notices: offices open their Terminal Reports page */
export const isTerminalNews = (n) => /terminal report/i.test(n.title || '');
const TERMINAL_ROLES = ['college_dean', 'special_assistant', 'msric_director'];
/* Administrator notices */
export const isEmailFail  = (n) => /^an email failed to send/i.test(n.title || '');
export const isNewAccount = (n) => /^new account verified/i.test(n.title || '');
/* the email address inside a "New account verified" notice, to find that account */
const emailIn = (n) => (String(n.message || '').match(/\(([^()\s]+@[^()\s]+)\)/) || [])[1] || '';

/* the page (under each role's address) that opens a record with ?open=<id> */
const OPEN_ON = {
  researcher:           'proposals',
  chairperson:          'for-endorsement',
  research_coordinator: 'for-endorsement',
  college_dean:         'for-endorsement',
  special_assistant:    'validate',
  msric_director:       'for-review',
  ovcred:               'for-endorsement',
  msric_staff:          'submissions',
  admin:                'proposals',
};

/* the address to open, or '' when the notification is not about a record */
export const notifTarget = (n, role) => {
  const base = ROLE_REDIRECTS[role];
  if (!base || !n) return '';
  if (role === 'admin' && isEmailFail(n))  return '/admin/emails';
  if (role === 'admin' && isNewAccount(n)) {
    const email = emailIn(n);
    return email ? `/admin/users?q=${encodeURIComponent(email)}` : '/admin/users';
  }
  if (isRepoNews(n) && role === 'msric_staff') return '/msric-staff/repository';
  if (isGrantAlert(n) && role !== 'researcher') return `${base}/grants`;
  if (isTerminalNews(n) && TERMINAL_ROLES.includes(role)) return `${base}/terminal-reports`;
  if (isTerminalNews(n) && role === 'researcher') return n.proposal_id ? `${base}/terminal-reports?open=${n.proposal_id}` : `${base}/terminal-reports`;
  if (!n.proposal_id || !OPEN_ON[role]) return '';
  return `${base}/${OPEN_ON[role]}?open=${n.proposal_id}`;
};

/* "2 hours ago", "Yesterday", or the date */
export const timeAgo = (d) => {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} min ago`; }
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'} ago`; }
  if (s < 7 * 86400) { const n = Math.floor(s / 86400); return n === 1 ? 'Yesterday' : `${n} days ago`; }
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* "Nov 18, 2026, 2:09 PM" in the person's own time */
export const fullTime = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};