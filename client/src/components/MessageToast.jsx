import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaCircleExclamation, FaCircleCheck, FaCircleInfo, FaXmark } from '../utils/icons';
import './FormToast.css';

/* ─────────────────────────────────────────────────────────────
   A message that pops up at the top of the screen after an action,
   so the person sees it wherever they are on the page.
     <MessageToast message={alert} onClose={() => setAlert(null)} />
   message  { type: 'error' | 'success' | 'info', msg }   (or { type, text })
   error    red, stays 8 seconds or until closed
   success  green, hides after 4 seconds
   info     amber, stays 8 seconds or until closed
   A new message object restarts the timer, so the same text shows again.
   Same look as FormToast, the message for missing boxes on a form.
   ───────────────────────────────────────────────────────────── */
const ICON = { error: FaCircleExclamation, success: FaCircleCheck, info: FaCircleInfo };

const MessageToast = ({ message, onClose }) => {
  const type = (message && ICON[message.type]) ? message.type : 'error';
  const text = message ? (message.msg ?? message.text) : null;

  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, type === 'success' ? 4000 : 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, type, text]);

  if (!message || !text) return null;
  const Icon = ICON[type];
  return createPortal(
    <div className={`ftoast ftoast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon className="ftoast-ic" aria-hidden="true" />
      <div className="ftoast-text">{text}</div>
      <button type="button" className="ftoast-x" aria-label="Close message" onClick={onClose}><FaXmark /></button>
    </div>,
    document.body
  );
};

export default MessageToast;