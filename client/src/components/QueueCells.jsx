import React from 'react';
import { dateText } from '../utils/dates';
import { waitDays, waitingSince, amountOf, waitText, WAIT_LATE } from '../utils/queue';

/* Table cells shared by the office queues */

/* "5 days" with "since Nov 20, 2026" under it; red from 7 days */
export const WaitCell = ({ p }) => {
  const d = waitDays(p);
  const since = waitingSince(p);
  return (
    <td style={{ whiteSpace: 'nowrap' }}>
      <span className={d !== null && d >= WAIT_LATE ? 'q-late' : 'q-wait'}>{waitText(d)}</span>
      {since && <div className="q-since">since {dateText(since)}</div>}
    </td>
  );
};

const peso = (n) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* the budget of an Internally Funded Research, or the amount set on an application; "—" otherwise */
export const AmountCell = ({ p }) => {
  const a = amountOf(p);
  return <td style={{ whiteSpace: 'nowrap' }}>{a === null ? <span className="q-none">—</span> : peso(a)}</td>;
};

/* a date cell ("—" when unknown) */
export const DateCell = ({ value }) => (
  <td style={{ color: '#718096', whiteSpace: 'nowrap' }}>{value ? dateText(value) : '—'}</td>
);

/* oldest first, so the longest wait is on top */
export const oldestFirst = (list) => [...list].sort((a, b) =>
  (waitingSince(a)?.getTime() || 0) - (waitingSince(b)?.getTime() || 0));