import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/terms';
import { FaPenNib, FaUpload, FaEraser, FaTrashCan, FaXmark, FaSignature } from 'react-icons/fa6';
import './Signature.css';

/* ─────────────────────────────────────────────────────────────
   Electronic signatures
     MySignature        : draw or upload, save, replace, remove (profile)
     SignConfirm        : "your signature + I confirm" box on a signing action
     ProposalSignatures : the signature lines on a proposal's details
   Who signs, and when:
     Research Coordinator, Chairperson, College Dean → Endorse and Sign
     Special Assistant → Validate and Forward
     MSIRC Director    → Endorse to OVCRED / Approve
     OVCRED            → Grant Final Approval
   Returning or rejecting never signs.
   ───────────────────────────────────────────────────────────── */

export const SIGNER_ROLES = [
  'research_coordinator', 'chairperson', 'college_dean',
  'special_assistant', 'msric_director', 'ovcred',
];

const MAX_BYTES = 1024 * 1024;              // what the server accepts
const OUT_W = 600;                          // saved image size (keeps it small)
const OUT_H = 200;

const fullName = (u) => [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
const fmtDate  = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtTime  = (d) => (d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const bytesOf  = (dataUrl) => Math.floor((String(dataUrl).split(',')[1] || '').length * 3 / 4);

/* Copies the inked part of a canvas onto a white-free PNG, trimmed and scaled to fit OUT_W × OUT_H */
const exportTrimmed = (src) => {
  const ctx = src.getContext('2d');
  const { width: w, height: h } = src;
  const px = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (px[(y * w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;                       // nothing drawn
  const pad = 8;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const scale = Math.min(1, OUT_W / cw, OUT_H / ch);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(cw * scale));
  out.height = Math.max(1, Math.round(ch * scale));
  out.getContext('2d').drawImage(src, x0, y0, cw, ch, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
};

/* Redraws an uploaded PNG/JPG at a safe size (this also strips anything that is not the picture) */
const prepareUpload = (file) => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpeg)$/.test(file.type)) return reject(new Error('Please choose a PNG or JPG image.'));
  if (file.size > 5 * MAX_BYTES) return reject(new Error('That image is too large. Please choose one under 5 MB.'));
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, OUT_W / img.width, OUT_H / img.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';                      // JPG photos have no transparency
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const isPng = file.type === 'image/png';
    const out = isPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
    if (bytesOf(out) > MAX_BYTES) return reject(new Error('That image is too large. The limit is 1 MB.'));
    resolve(out);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
  img.src = url;
});

/* ── The signed-in official's saved signature ── */
export const useMySignature = () => {
  const { user } = useAuth();
  const canSign = SIGNER_ROLES.includes(user?.role);
  const [sig,     setSig]     = useState(null);
  const [loading, setLoading] = useState(canSign);
  const [error,   setError]   = useState('');

  const reload = useCallback(async () => {
    if (!canSign) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await API.get('/signatures/me');
      setSig(res.data?.signature || null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load your signature.');
    } finally {
      setLoading(false);
    }
  }, [canSign]);

  useEffect(() => { reload(); }, [reload]);
  return { sig, setSig, loading, error, reload, canSign };
};

/* ── Drawing pad ── */
const SignaturePad = ({ padRef, onInk }) => {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);

  const fit = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    const d = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
    const ctx = c.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f1a33';
    onInk(false);
  }, [onInk]);

  useEffect(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  useEffect(() => {
    padRef.current = {
      clear: fit,
      export: () => (canvasRef.current ? exportTrimmed(canvasRef.current) : null),
    };
  }, [fit, padRef]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const [x, y] = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    onInk(true);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const [x, y] = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => { drawing.current = false; };

  return (
    <canvas ref={canvasRef} className="sig-pad" aria-label="Signature pad: sign inside the box"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} />
  );
};

/* ── My Signature (in the profile of officials who sign) ── */
export const MySignature = ({ onSaved, compact = false }) => {
  const { user } = useAuth();
  const { sig, setSig, loading, error, canSign } = useMySignature();
  const [mode,    setMode]    = useState('draw');
  const [inked,   setInked]   = useState(false);
  const [upload,  setUpload]  = useState(null);     // prepared data URL
  const [editing, setEditing] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [alert,   setAlert]   = useState(null);
  const [askRemove, setAskRemove] = useState(false);
  const padRef  = useRef(null);
  const fileRef = useRef(null);

  const onInk = useCallback((v) => setInked(v), []);

  if (!canSign) return null;

  const showEditor = !sig || editing;

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAlert(null);
    try { setUpload(await prepareUpload(f)); }
    catch (err) { setUpload(null); setAlert({ type: 'error', msg: err.message }); }
  };

  const save = async () => {
    setAlert(null);
    let image = null;
    if (mode === 'draw') {
      image = inked ? padRef.current?.export() : null;
      if (!image) return setAlert({ type: 'error', msg: 'Draw your signature inside the box first.' });
    } else {
      image = upload;
      if (!image) return setAlert({ type: 'error', msg: 'Choose a PNG or JPG image first.' });
    }
    if (bytesOf(image) > MAX_BYTES) return setAlert({ type: 'error', msg: 'The signature image is too large. The limit is 1 MB.' });

    setBusy(true);
    try {
      const res = await API.put('/signatures/me', { image_data: image });
      setSig(res.data?.signature || { image_data: image, updated_at: new Date().toISOString() });
      setEditing(false);
      setUpload(null);
      setInked(false);
      setMode('draw');
      setAlert({ type: 'success', msg: res.data?.message || 'Your signature was saved.' });
      if (onSaved) onSaved(res.data?.signature);
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Could not save your signature. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setAlert(null);
    try {
      const res = await API.delete('/signatures/me');
      setSig(null);
      setAskRemove(false);
      setEditing(false);
      setMode('draw');
      setAlert({ type: 'success', msg: res.data?.message || 'Your signature was removed.' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Could not remove your signature.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`sig-section${compact ? ' compact' : ''}`}>
      {!compact && (
        <div className="sig-head">
          <h3><FaSignature className="ic" />My Signature</h3>
          {sig && <span className="badge badge-green">Saved</span>}
        </div>
      )}
      {!compact && (
        <p className="sig-hint">
          Used when you {user?.role === 'special_assistant' ? 'validate and forward'
            : user?.role === 'msric_director' ? 'endorse to OVCRED or approve'
            : user?.role === 'ovcred' ? 'grant final approval' : 'endorse'} a proposal.
          Returning or rejecting never signs.
        </p>
      )}

      {alert && <div className={`alert alert-${alert.type}`} role="status">{alert.msg}</div>}

      {loading ? (
        <p className="sig-hint">Loading your signature...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : (
        <>
          {sig && (
            <div className="sig-current">
              <span className="sig-label">Current signature</span>
              <div className="sig-box">
                <img src={sig.image_data} alt="Your saved signature" />
                <div><span className="sig-name">{fullName(user) || 'You'}</span></div>
                <div className="sig-role">{ROLE_LABEL[user?.role] || ''}</div>
              </div>
              <span className="sig-hint">Saved {fmtTime(sig.updated_at)}</span>
            </div>
          )}

          {showEditor && (
            <div className="sig-editor">
              <div className="sig-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'draw'}
                  className={`sig-tab${mode === 'draw' ? ' on' : ''}`} onClick={() => { setMode('draw'); setAlert(null); }}>
                  <FaPenNib className="ic" />Draw
                </button>
                <button type="button" role="tab" aria-selected={mode === 'upload'}
                  className={`sig-tab${mode === 'upload' ? ' on' : ''}`} onClick={() => { setMode('upload'); setAlert(null); }}>
                  <FaUpload className="ic" />Upload
                </button>
              </div>

              {mode === 'draw' ? (
                <>
                  <SignaturePad padRef={padRef} onInk={onInk} />
                  <div className="sig-hint">
                    Sign inside the box with your mouse, finger or stylus.{' '}
                    <button type="button" className="sig-link" onClick={() => padRef.current?.clear()} disabled={!inked}>
                      <FaEraser className="ic" />Clear
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden onChange={pickFile} />
                  <div className="sig-drop">
                    {upload
                      ? <img src={upload} alt="Signature to upload" />
                      : <span className="sig-pend">No image chosen</span>}
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                    <FaUpload className="ic" />{upload ? 'Choose Another Image' : 'Choose Image'}
                  </button>
                  <div className="sig-hint">PNG or JPG, up to 1 MB. A clear photo of your signature on white paper works.</div>
                </>
              )}
            </div>
          )}

          {askRemove ? (
            <div className="sig-warn">
              <p>Remove your signature? You will need a signature again before you can sign a proposal. Proposals you already signed keep their signature.</p>
              <div className="sig-actions">
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>
                  {busy ? 'Removing...' : 'Yes, Remove It'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setAskRemove(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="sig-actions">
              {showEditor && (
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
                  {busy ? 'Saving...' : (sig ? 'Save New Signature' : 'Save Signature')}
                </button>
              )}
              {sig && !editing && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(true); setAlert(null); setInked(false); setUpload(null); }}>
                  <FaPenNib className="ic" />Replace
                </button>
              )}
              {sig && editing && (
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setEditing(false); setAlert(null); }}>
                  Cancel
                </button>
              )}
              {sig && !editing && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setAskRemove(true)}>
                  <FaTrashCan className="ic" />Remove
                </button>
              )}
            </div>
          )}

          {!compact && (
            <p className="sig-hint" style={{ marginTop: 10 }}>
              Only you can set or change your signature. Changing it later does not change proposals you already signed.
            </p>
          )}
        </>
      )}
    </div>
  );
};

/* ── Small window with My Signature, opened from a signing box ── */
const SignatureSetupModal = ({ onClose, onSaved }) => createPortal(
  <div className="sig-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sig-dialog" role="dialog" aria-modal="true" aria-labelledby="sig-setup-title">
      <div className="sig-dialog-head">
        <h2 id="sig-setup-title">Set Up My Signature</h2>
        <button type="button" className="sig-close" onClick={onClose} aria-label="Close"><FaXmark /></button>
      </div>
      <div className="sig-dialog-body">
        <MySignature compact onSaved={(s) => { onSaved(s); onClose(); }} />
      </div>
    </div>
  </div>,
  document.body,
);

/* ── "Your signature + I confirm" box on a signing action ──
   Calls onReady(true) only when a signature is saved AND the box is ticked.
   `verb` completes the sentence "I, <name> (<role>), ___ this proposal ..." */
export const SignConfirm = ({ onReady, verb = 'endorse', disabled = false }) => {
  const { user } = useAuth();
  const { sig, setSig, loading, error } = useMySignature();
  const [checked, setChecked] = useState(false);
  const [setup,   setSetup]   = useState(false);

  useEffect(() => { onReady(!!sig && checked); }, [sig, checked, onReady]);

  return (
    <div className="sig-confirm">
      <span className="sig-label">Your signature</span>
      {loading ? (
        <div className="sig-box"><span className="sig-pend">Loading...</span></div>
      ) : error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : sig ? (
        <div className="sig-box">
          <img src={sig.image_data} alt="Your signature" />
          <div><span className="sig-name">{fullName(user) || 'You'}</span></div>
          <div className="sig-role">{ROLE_LABEL[user?.role] || ''}</div>
        </div>
      ) : (
        <div className="sig-warn">
          You have not set up your signature yet. You need one to sign.
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setSetup(true)}>
              <FaSignature className="ic" />Set Up My Signature
            </button>
          </div>
        </div>
      )}

      {sig && (
        <label className="sig-check">
          <input type="checkbox" checked={checked} disabled={disabled}
            onChange={(e) => setChecked(e.target.checked)} />
          <span>
            I, <b>{fullName(user) || 'the signer'}</b> ({ROLE_LABEL[user?.role] || 'official'}), {verb} this proposal
            and agree that my electronic signature is placed on it.
          </span>
        </label>
      )}

      {setup && <SignatureSetupModal onClose={() => setSetup(false)} onSaved={(s) => s && setSig(s)} />}
    </div>
  );
};

/* ── Signature lines on a proposal ── */
const LINE_ORDER = ['research_coordinator', 'chairperson', 'college_dean', 'special_assistant', 'msric_director', 'ovcred'];
const OFFICE_HOLDER = { submitted: 'special_assistant', under_review: 'msric_director', endorsed: 'ovcred' };
const roundOf = (p) => Number(p?.round) || (Number(p?.revision_count) || 0) + 1;

const lineStates = (p, sigs) => {
  const round = roundOf(p);
  const now   = sigs.filter(s => Number(s.round) === round);
  const holder = p.status === 'for_endorsement' ? p.endorsement_stage : OFFICE_HOLDER[p.status] || null;
  const holderIdx = holder ? LINE_ORDER.indexOf(holder) : -1;
  const done  = p.status === 'approved' || p.status === 'rejected';
  const endorsedNoSig = (role) => (p.endorsements || []).some(e =>
    Number(e.round || 1) === round && e.endorser_role === role && e.endorse_status === 'endorsed');
  const directorApprovedOnly = now.some(s => s.signer_role === 'msric_director' && s.action === 'approve');

  return LINE_ORDER.map((role, i) => {
    const s = now.find(x => x.signer_role === role);
    if (s) return { role, state: 'ok', sig: s };
    if (p.status === 'draft' || p.status === 'returned') return { role, state: 'todo' };
    if (i === holderIdx) return { role, state: 'wait' };
    if (role === 'ovcred' && directorApprovedOnly) return { role, state: 'skip' };
    const passed = done || (holderIdx >= 0 && i < holderIdx);
    if (passed) {
      if (i < 3 && !endorsedNoSig(role)) return { role, state: 'skip' };   // no account for that college: skipped
      return { role, state: p.status === 'rejected' ? 'todo' : 'none' };   // acted before signatures existed
    }
    return { role, state: 'todo' };
  });
};

const STATE_TEXT = { wait: 'Waiting', todo: 'Not yet', skip: 'Not needed', none: 'No signature' };

export const ProposalSignatures = ({ proposal }) => {
  const [sigs,    setSigs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState('');
  const [showOld, setShowOld] = useState(false);
  const id = proposal?.proposal_id;
  const stamp = `${proposal?.status}|${proposal?.endorsement_stage}|${proposal?.revision_count}`;

  useEffect(() => {
    if (!id) return undefined;
    let alive = true;
    setLoading(true);
    API.get(`/proposals/${id}/signatures`)
      .then((res) => { if (alive) { setSigs(res.data?.signatures || []); setFailed(''); } })
      .catch((err) => { if (alive) setFailed(err.response?.data?.message || 'Could not load the signatures.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, stamp]);

  if (!proposal || proposal.status === 'draft') return null;

  const round = roundOf(proposal);
  const lines = lineStates(proposal, sigs);
  const older = sigs.filter(s => Number(s.round) < round);

  return (
    <div className="sig-lines-wrap">
      <div className="sig-lines-head">
        <span className="sig-label">Signatures</span>
        {round > 1 && <span className="sig-hint">Round {round}</span>}
      </div>
      {loading ? (
        <p className="sig-hint">Loading signatures...</p>
      ) : failed ? (
        <p className="sig-hint">{failed}</p>
      ) : (
        <>
          <div className="sig-lines">
            {lines.map(l => (
              <div key={l.role} className={`sig-line${l.state === 'skip' ? ' skip' : ''}`}>
                <div className="sig-sp">{l.sig && <img src={l.sig.image_data} alt={`Signature of ${l.sig.signer_name}`} />}</div>
                <div><span className="sig-name">{l.sig ? l.sig.signer_name : ' '}</span></div>
                <div className="sig-role">{ROLE_LABEL[l.role]}</div>
                <div className={`sig-st ${l.state}`} title={l.sig ? fmtTime(l.sig.signed_at) : undefined}>
                  {l.state === 'ok' ? `${l.sig.action_label || 'Signed'} · ${fmtDate(l.sig.signed_at)}` : STATE_TEXT[l.state]}
                </div>
              </div>
            ))}
          </div>
          {older.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="sig-link" onClick={() => setShowOld(v => !v)}>
                {showOld ? 'Hide' : 'Show'} signatures from earlier rounds ({older.length})
              </button>
              {showOld && (
                <ul className="sig-older">
                  {older.map(s => (
                    <li key={s.signature_id}>
                      Round {s.round}: <b>{s.signer_name}</b> ({s.role_label}), {String(s.action_label || '').toLowerCase()} on {fmtTime(s.signed_at)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};