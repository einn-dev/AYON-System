import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import './OfficeNotifications.css';

/* When someone clicks "Open" on a notification they land on the queue with ?open=<proposal id>.
   Every queue table puts data-pid={proposal_id} on its rows; this finds that row, scrolls to it and
   highlights it for a few seconds. If the row is not there (somebody already handled the proposal)
   it says so instead of leaving the person guessing.
     ready: true once the list has loaded.                                                       */
export const useOpenHighlight = (ready) => {
  const [params, setParams] = useSearchParams();
  const id = params.get('open');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id || !ready) return undefined;
    const row = Array.from(document.querySelectorAll('tr[data-pid]'))
      .find((el) => el.getAttribute('data-pid') === String(id));
    if (!row) { setMissing(true); return undefined; }
    setMissing(false);
    row.classList.add('row-hl');
    if (row.scrollIntoView) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const t = setTimeout(() => row.classList.remove('row-hl'), 6000);
    return () => { clearTimeout(t); row.classList.remove('row-hl'); };
  }, [id, ready]);

  const clear = () => {
    setMissing(false);
    const next = new URLSearchParams(params);
    next.delete('open');
    setParams(next, { replace: true });
  };

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