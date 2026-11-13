import { useEffect } from 'react';

/* ─────────────────────────────────────────────────────────────
   Live updates while a page stays open.

   Layout.jsx asks the server every LIVE_EVERY ms (only while the tab is
   visible) how many unread notifications there are. When the number goes UP,
   something happened to this person's proposals, so it sends LIVE_UPDATE and
   every open page that uses useLiveRefresh(load) quietly reloads its data.
   ───────────────────────────────────────────────────────────── */

export const LIVE_EVERY  = 15000;                 // 15 seconds
export const LIVE_UPDATE = 'ayon:live-update';
export const OPEN_BELL   = 'ayon:open-bell';

export const useLiveRefresh = (load) => {
  useEffect(() => {
    if (!load) return undefined;
    const run = () => { load(); };
    window.addEventListener(LIVE_UPDATE, run);
    return () => window.removeEventListener(LIVE_UPDATE, run);
  }, [load]);
};