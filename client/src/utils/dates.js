/* ─────────────────────────────────────────────────────────────
   One date format for the whole system:
     dateText(d)      "Nov 15, 2026"
     dateTimeText(d)  "Nov 15, 2026, 2:09 PM"   (in the person's own time)
   An empty or invalid date shows as "—".
   ───────────────────────────────────────────────────────────── */
const valid = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const dateText = (v) => {
  const d = valid(v);
  return d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
};

export const dateTimeText = (v) => {
  const d = valid(v);
  return d ? d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
};