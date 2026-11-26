import React, { useEffect, useState } from 'react';
import './Pager.css';

/* ─────────────────────────────────────────────────────────────
   Long lists show 10 rows at a time, with Previous / Next under the table.
     const pager = usePaged(rows);          // rows = the whole (filtered) list
     {pager.rows.map((r, i) => … pager.offset + i + 1 …)}
     {pager.bar}                             // under the table; hidden when it all fits on one page
   A new search or filter goes back to page 1.
   ───────────────────────────────────────────────────────────── */
export const PAGE_SIZE = 10;

export const PagerBar = ({ page, pageSize, total, onPage }) => {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to   = Math.min(total, page * pageSize);
  /* go to the page, and back up to the top of its table */
  const go = (e, n) => {
    const box = e.currentTarget.closest('.panel') || e.currentTarget.closest('nav');
    onPage(n);
    if (box) box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  return (
    <nav className="pg-bar" aria-label="Pages">
      <span className="pg-count">Showing {from}–{to} of {total}</span>
      <div className="pg-btns">
        <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={(e) => go(e, page - 1)}>Previous</button>
        <span className="pg-page">Page {page} of {last}</span>
        <button type="button" className="btn btn-outline btn-sm" disabled={page >= last} onClick={(e) => go(e, page + 1)}>Next</button>
      </div>
    </nav>
  );
};

export const usePaged = (rows, pageSize = PAGE_SIZE) => {
  const list  = Array.isArray(rows) ? rows : [];
  const total = list.length;
  const last  = Math.max(1, Math.ceil(total / pageSize));
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [total]);              // the list changed (a search, a filter)
  const now    = Math.min(page, last);
  const offset = (now - 1) * pageSize;
  return {
    rows: list.slice(offset, offset + pageSize),
    offset,
    bar: <PagerBar page={now} pageSize={pageSize} total={total} onPage={setPage} />,
  };
};