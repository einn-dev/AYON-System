import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './OfficeNotifications.css';

/* When someone clicks "Open" on a notification they land on the queue with ?open=<proposal id>.
   Every queue table puts data-pid={proposal_id} on its rows; this finds that row, scrolls to it and
   highlights it for a few seconds. If the row is not there (somebody already handled the proposal)
   it says so instead of leaving the person guessing.
     ready: true once the list has loaded.
     opts.open(id)     opens the record itself (the review screen); returns false when it is not in this list
     opts.fallback(id) opens it read-only when it is not in this list any more (already handled)
   With open/fallback the person lands right inside the record, not just on its row.           */
export const useOpenHighlight = (ready, opts = {}) => {
  const [params, setParams] = useSearchParams();
  const id = params.get('open');
  const [missing, setMissing] = useState(false);
  const { open, fallback } = opts;

  const clear = () => {
    setMissing(false);
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!id) return undefined;
    /* the list may be empty (nothing left to do): do not wait for it forever */
    if (!ready) {
      if (!fallback) return undefined;
      const t = setTimeout(() => { fallback(id); clear(); }, 2500);
      return () => clearTimeout(t);
    }
    /* open() returns true when it opened the record here, or 'moved' when it went to another page */
    const opened = open ? open(id) : false;
    if (opened === true) { clear(); return undefined; }
    if (opened) return undefined;
    const row = Array.from(document.querySelectorAll('tr[data-pid]'))
      .find((el) => el.getAttribute('data-pid') === String(id));
    if (!row && fallback) { fallback(id); clear(); return undefined; }
    if (!row) { setMissing(true); return undefined; }
    setMissing(false);
    row.classList.add('row-hl');
    if (row.scrollIntoView) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => row.classList.remove('row-hl'), 6000);
    return () => { clearTimeout(t); row.classList.remove('row-hl'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);

  return { id, missing, clear };
};

export const OpenNotice = ({ state, where = 'this list' }) => {
  if (!state?.missing) return null;
  return (
    <div className="alert alert-error" role="status"
      style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span>That proposal is no longer in {where}. Someone may have already handled it.</span>
      <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}
        onClick={state.clear}>Dismiss</button>
    </div>
  );
};