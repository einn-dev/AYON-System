import React from 'react';

/* ─────────────────────────────────────────────────────────────
   Small things shared by the Admin pages (users, audit log,
   email log), so the same labels and colors are used everywhere.
   ───────────────────────────────────────────────────────────── */

export const ROLES = [
  'researcher', 'msric_staff', 'research_coordinator',
  'chairperson', 'college_dean', 'special_assistant',
  'msric_director', 'ovcred', 'admin',
];

export const ROLE_LABELS = {
  researcher:           'Researcher',
  msric_staff:          'MSRIC Staff',
  research_coordinator: 'Research Coordinator',
  chairperson:          'Chairperson',
  college_dean:         'College Dean',
  special_assistant:    'Special Assistant',
  msric_director:       'MSRIC Director',
  ovcred:               'OVCRED',
  admin:                'Admin',
};

/* Which roles must have a college / department.
   Coordinators and Deans are scoped by college, Chairpersons by department,
   researchers need both. The other roles don't belong to a college. */
export const ROLES_NEED_COLLEGE    = ['researcher', 'research_coordinator', 'chairperson', 'college_dean'];
export const ROLES_NEED_DEPARTMENT = ['researcher', 'chairperson'];

/* greyed-out look for a box that is locked */
export const LOCKED_STYLE = { background: '#f1ecec', color: '#a89b9e', cursor: 'not-allowed' };

export const roleBadge = (role) => {
  const map = {
    admin:                'badge-purple',
    msric_director:       'badge-blue',
    ovcred:               'badge-blue',
    special_assistant:    'badge-amber',
    researcher:           'badge-green',
    msric_staff:          'badge-gray',
    research_coordinator: 'badge-gray',
    chairperson:          'badge-gray',
    college_dean:         'badge-gray',
  };
  return map[role] || 'badge-gray';
};

/* An account is one of three things */
export const userStatus = (u) => {
  if (!u.is_active) return 'deactivated';
  if (u.email_verified === false) return 'pending';
  return 'active';
};

export const STATUS_META = {
  active:      { label: 'Active',               badge: 'badge-green' },
  pending:     { label: 'Pending verification', badge: 'badge-amber' },
  deactivated: { label: 'Deactivated',          badge: 'badge-red'   },
};

export const errText = (err, fallback) => err?.response?.data?.message || fallback;

/* ── dates ── */
const timeOf = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export const startOfDay = (value) => {
  const d = value ? new Date(value) : new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/* "Today 3:58 PM", "Yesterday 4:20 PM", "Oct 23, 2:47 PM" (adds the year for older dates) */
export const fmtWhen = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  const today     = startOfDay();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  if (d >= today)     return `Today ${timeOf(d)}`;
  if (d >= yesterday) return `Yesterday ${timeOf(d)}`;

  const date = d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
  return `${date}, ${timeOf(d)}`;
};

/* ── "Showing 1–25 of 120   [Previous] [Next]" ── */
export const Pager = ({ page, pageSize, total, onPage }) => {
  if (!total) return null;
  const from  = (page - 1) * pageSize + 1;
  const to    = Math.min(total, page * pageSize);
  const last  = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="am-pager">
      <span>Showing {from}–{to} of {total}</span>
      <div className="am-pager-btns">
        <button type="button" className="btn btn-outline btn-sm"
          disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="am-pager-page">Page {page} of {last}</span>
        <button type="button" className="btn btn-outline btn-sm"
          disabled={page >= last} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
};