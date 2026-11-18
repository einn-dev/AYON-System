import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaCircleExclamation, FaXmark } from 'react-icons/fa6';
import './FormToast.css';

/* ─────────────────────────────────────────────────────────────
   A small message that slides in at the top when something on a
   form still needs filling in, then hides by itself.
     <FormToast toast={{ msg, more, n }} onClose={...} />
   msg   what to fix first
   more  how many other boxes are also marked in red (optional)
   n     changes every time, so the same message shows again
   ───────────────────────────────────────────────────────────── */
const SHOW_MS = 5000;

const FormToast = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, SHOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast && toast.n]);
  if (!toast) return null;
  return createPortal(
    <div className="ftoast" role="alert" key={toast.n}>
      <FaCircleExclamation className="ftoast-ic" aria-hidden="true" />
      <div className="ftoast-text">
        {toast.msg}
        {toast.more > 0 && (
          <small>{toast.more === 1 ? '1 more box is' : `${toast.more} more boxes are`} marked in red.</small>
        )}
      </div>
      <button type="button" className="ftoast-x" aria-label="Close message" onClick={onClose}><FaXmark /></button>
    </div>,
    document.body
  );
};

/* Scroll to a box, put the cursor in it and make it blink once.
   A group (the work plan, the budget) gets the cursor in its first box. */
export const jumpTo = (id) => {
  if (!id) return;
  /* wait a moment: the box may only appear after this render (another step, a red line) */
  setTimeout(() => jumpNow(id), 60);
};
const jumpNow = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const box = el.matches('input, select, textarea, button') ? el : el.querySelector('input, select, textarea, button') || el;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    try { box.focus({ preventScroll: true }); } catch (e) { /* not focusable */ }
    el.classList.remove('ftoast-flash');
    void el.offsetWidth;                       // restart the blink
    el.classList.add('ftoast-flash');
  }, 350);
};

export default FormToast;