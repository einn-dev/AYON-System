import React, { useCallback, useEffect, useRef, useState } from 'react';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL } from '../utils/terms';
import { FaPenNib, FaUpload, FaEraser, FaTrashCan, FaSignature } from '../utils/icons';
import './Signature.css';
import { personName } from '../utils/names';
import MessageToast from './MessageToast';

/* ─────────────────────────────────────────────────────────────
   Electronic signatures
     MySignature        : draw or upload, save, replace, remove (My Profile → Digital Signature)
     SignConfirm        : "your signature + I confirm" box on a signing action
                          (no signature yet → a button that opens My Profile on that tab)
     ProposalSignatures : the signature lines on a proposal's details
   Who signs, and when:
     College Chairperson, College Coordinator, College Dean → Endorse and Sign
     MSIRC Special Assistant → Validate and Forward
     MSIRC Director    → Endorse to VCRED / Approve
     VCRED            → Grant Final Approval
   Returning or rejecting never signs.
   ───────────────────────────────────────────────────────────── */

export const SIGNER_ROLES = [
  'research_coordinator', 'chairperson', 'college_dean',
  'special_assistant', 'msric_director', 'ovcred',
  'researcher',                                  // signs Form 005, (15) Submitted by
];

const MAX_BYTES = 1024 * 1024;              // what the server accepts
const OUT_W = 600;                          // saved image size (keeps it small)
const OUT_H = 200;

const fullName = (u) => personName(u);
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

/* ── Is this picture a signature? ──
   A photo of a signature is mostly plain, light paper with a little dark ink.
   A photo of a person, a place or a thing has many colours and no plain background.
   The paper's brightness is measured in small areas, so a shadow across the paper is fine.
   This cannot read handwriting: it only refuses pictures that clearly are not ink on paper.
   Returns { ok, why, paperAt } where paperAt[i] is the paper brightness behind pixel i. */
export const SIG_NOT_SIGNATURE = "This doesn't look like a signature. Use a clear photo of your signature in dark ink on plain white paper, or draw it instead.";
const SIG_NO_INK = 'No signature was found in this picture. Make sure the ink is dark and the photo is in focus.';
const lumOf = (px, i) => 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

/* the paper brightness around every pixel: the bright end (85%) of each area of a grid,
   blended smoothly between areas */
const paperMap = (lum, w, h) => {
  const cols = Math.max(1, Math.min(12, Math.round(w / 80))), rows = Math.max(1, Math.min(8, Math.round(h / 80)));
  const cw = w / cols, ch = h / rows;
  const grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const hist = new Uint32Array(256);
      let n = 0;
      for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y += 2) {
        for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x += 2) { hist[Math.round(lum[y * w + x])] += 1; n += 1; }
      }
      let seen = 0, v = 255;
      for (let k = 0; k < 256; k += 1) { seen += hist[k]; if (seen >= n * 0.85) { v = k; break; } }
      grid[r * cols + c] = v;
    }
  }
  const at = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    const gy = Math.min(rows - 1, Math.max(0, y / ch - 0.5)), y0 = Math.floor(gy), y1 = Math.min(rows - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x += 1) {
      const gx = Math.min(cols - 1, Math.max(0, x / cw - 0.5)), x0 = Math.floor(gx), x1 = Math.min(cols - 1, x0 + 1), fx = gx - x0;
      const top = grid[y0 * cols + x0] * (1 - fx) + grid[y0 * cols + x1] * fx;
      const bot = grid[y1 * cols + x0] * (1 - fx) + grid[y1 * cols + x1] * fx;
      at[y * w + x] = top * (1 - fy) + bot * fy;
    }
  }
  return at;
};

export const checkSignaturePixels = (px, w, h) => {
  const n = w * h;
  if (!n) return { ok: false, why: SIG_NOT_SIGNATURE };
  const lum = new Float32Array(n);
  let rg = 0, yb = 0, rg2 = 0, yb2 = 0;                      // colourfulness (Hasler and Süsstrunk)
  for (let i = 0; i < n; i += 1) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    lum[i] = lumOf(px, i);
    const a = r - g, c = 0.5 * (r + g) - b;
    rg += a; yb += c; rg2 += a * a; yb2 += c * c;
  }
  const mrg = rg / n, myb = yb / n;
  const colour = Math.sqrt(Math.max(0, rg2 / n - mrg * mrg) + Math.max(0, yb2 / n - myb * myb))
    + 0.3 * Math.sqrt(mrg * mrg + myb * myb);
  const paperAt = paperMap(lum, w, h);
  let paper = 0, ink = 0, light = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.abs(lum[i] - paperAt[i]) <= 35) paper += 1;
    if (lum[i] < paperAt[i] - 70) ink += 1;
    if (paperAt[i] >= 130) light += 1;
  }
  if (light / n < 0.8)   return { ok: false, why: SIG_NOT_SIGNATURE };                       // no light paper
  if (colour > 30)       return { ok: false, why: SIG_NOT_SIGNATURE };                       // a colourful photo
  if (paper / n < 0.70)  return { ok: false, why: SIG_NOT_SIGNATURE };                       // no plain background
  if (ink / n > 0.25)    return { ok: false, why: SIG_NOT_SIGNATURE };                       // far too much "ink"
  if (ink / n < 0.0005)  return { ok: false, why: SIG_NO_INK };
  return { ok: true, paperAt };
};

/* Keeps only the ink: the paper becomes see-through, then the picture is trimmed to the
   signature and saved as a PNG, like a drawn signature */
const inkOnly = (c, paperAt) => {
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p += 1) {
    const L = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const fadeFrom = paperAt[p] - 30, fadeTo = paperAt[p] - 90;   // lighter: paper; darker: full ink
    const a = L >= fadeFrom ? 0 : L <= fadeTo ? 1 : (fadeFrom - L) / (fadeFrom - fadeTo);
    const k = 0.75;                                          // a little darker, so it prints clearly
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
    d[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  return exportTrimmed(c);
};

/* Reads an uploaded PNG/JPG, checks that it looks like a signature, and keeps only the ink */
const prepareUpload = (file) => new Promise((resolve, reject) => {
  if (!/^image\/(png|jpeg)$/.test(file.type)) return reject(new Error('Please choose a PNG or JPG image.'));
  if (file.size > 5 * MAX_BYTES) return reject(new Error('That image is too large. Please choose one under 5 MB.'));
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    const scale = Math.min(1, 900 / img.width, 400 / img.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * scale));
    c.height = Math.max(1, Math.round(img.height * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';                      // a see-through PNG counts as white paper
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const check = checkSignaturePixels(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
    if (!check.ok) return reject(new Error(check.why));
    const out = inkOnly(c, check.paperAt);
    if (!out) return reject(new Error(SIG_NO_INK));
    if (bytesOf(out) > MAX_BYTES) return reject(new Error('That image is too large. The limit is 1 MB.'));
    resolve(out);
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
  img.src = url;
});

/* events shared with Layout.jsx */
export const SIG_CHANGED  = 'ayon:signature-changed';
export const OPEN_PROFILE = 'ayon:open-profile';
export const openMyProfile = (tab = 'profile') =>
  window.dispatchEvent(new CustomEvent(OPEN_PROFILE, { detail: { tab } }));

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

  /* saved or removed in My Profile: every open signing box picks it up */
  useEffect(() => {
    window.addEventListener(SIG_CHANGED, reload);
    return () => window.removeEventListener(SIG_CHANGED, reload);
  }, [reload]);

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
export const MySignature = ({ onSaved }) => {
  const { user } = useAuth();
  const { sig, setSig, loading, error, canSign } = useMySignature();
  const [mode,    setMode]    = useState('draw');
  const [inked,   setInked]   = useState(false);
  const [upload,  setUpload]  = useState(null);     // prepared data URL
  const [editing, setEditing] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [alert,   setAlert]   = useState(null);
  const [askRemove, setAskRemove] = useState(false);
  const [vouched, setVouched] = useState(false);    // "this is my own handwritten signature"
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
    if (!vouched) return setAlert({ type: 'error', msg: 'Please tick the box to confirm this is your own handwritten signature.' });

    setBusy(true);
    try {
      const res = await API.put('/signatures/me', { image_data: image });
      setSig(res.data?.signature || { image_data: image, updated_at: new Date().toISOString() });
      setEditing(false);
      setUpload(null);
      setInked(false);
      setVouched(false);
      setMode('draw');
      setAlert({ type: 'success', msg: res.data?.message || 'Your signature was saved.' });
      window.dispatchEvent(new Event(SIG_CHANGED));
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
      window.dispatchEvent(new Event(SIG_CHANGED));
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Could not remove your signature.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sig-section">
      <div className="sig-head">
        <h3><FaSignature className="ic" />Digital Signature</h3>
        {sig ? <span className="badge badge-green">Saved</span> : !loading && <span className="badge badge-amber">Not set up</span>}
      </div>
      <p className="sig-hint">
        Used when you {user?.role === 'special_assistant' ? 'validate and forward'
          : user?.role === 'msric_director' ? 'endorse to VCRED or approve'
          : user?.role === 'ovcred' ? 'grant final approval' : 'endorse'} a proposal.
        Returning or rejecting never signs.
      </p>

      <MessageToast message={alert} onClose={() => setAlert(null)} />

      {loading ? (
        <p className="sig-hint">Loading your signature…</p>
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
                  <div className="sig-hint">
                    PNG or JPG, up to 1 MB. Sign in dark ink on plain white paper and take a clear photo of it.
                    AYON keeps only the ink, so the paper does not show. Photos of people or other things are refused.
                  </div>
                </>
              )}
              <label className="sig-vouch">
                <input type="checkbox" checked={vouched} onChange={(e) => setVouched(e.target.checked)} />
                <span>I confirm this is my own handwritten signature, and I allow AYON to place it on the forms I sign.</span>
              </label>
            </div>
          )}

          {askRemove ? (
            <div className="sig-warn">
              <p>Remove your signature? You will need a signature again before you can sign a proposal. Proposals you already signed keep their signature.</p>
              <div className="sig-actions">
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={remove}>
                  {busy ? 'Removing…' : 'Yes, Remove It'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setAskRemove(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="sig-actions">
              {showEditor && (
                <button type="button" className="btn btn-primary btn-sm" disabled={busy || !vouched} onClick={save}
                  title={vouched ? undefined : 'Tick the box above first'}>
                  {busy ? 'Saving…' : (sig ? 'Save New Signature' : 'Save Signature')}
                </button>
              )}
              {sig && !editing && (
                <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditing(true); setAlert(null); setInked(false); setUpload(null); }}>
                  <FaPenNib className="ic" />Replace
                </button>
              )}
              {sig && editing && (
                <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => { setEditing(false); setAlert(null); setVouched(false); }}>
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

          <p className="sig-hint" style={{ marginTop: 10 }}>
            Only you can set or change your signature. Changing it later does not change proposals you already signed.
          </p>
        </>
      )}
    </div>
  );
};

/* ── "Your signature + I confirm" box on a signing action ──
   Calls onReady(true) only when a signature is saved AND the box is ticked.
   `verb` completes the sentence "I, <name> (<role>), ___ this <noun> …"
   `noun` is "proposal" (research) or "application" (grants and incentives) */
/* roleLabel: how the signer is named in the box (the Project Leader on Form 005); id: the tick box */
export const SignConfirm = ({ onReady, verb = 'endorse', noun = 'proposal', disabled = false, roleLabel = '', id }) => {
  const { user } = useAuth();
  const { sig, loading, error } = useMySignature();
  const [checked, setChecked] = useState(false);

  useEffect(() => { onReady(!!sig && checked); }, [sig, checked, onReady]);

  return (
    <div className="sig-confirm">
      <span className="sig-label">Your signature</span>
      {loading ? (
        <div className="sig-box"><span className="sig-pend">Loading…</span></div>
      ) : error ? (
        <div className="alert alert-error" role="alert">{error}</div>
      ) : sig ? (
        <div className="sig-box">
          <img src={sig.image_data} alt="Your signature" />
          <div><span className="sig-name">{fullName(user) || 'You'}</span></div>
          <div className="sig-role">{roleLabel || ROLE_LABEL[user?.role] || ''}</div>
        </div>
      ) : (
        <div className="sig-warn">
          You have not set up your digital signature yet. You need one to sign.
          Set it up in <b>My Profile</b>, under <b>Digital Signature</b>. This box updates as soon as it is saved.
          <div style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openMyProfile('signature')}>
              <FaSignature className="ic" />Open My Profile
            </button>
          </div>
        </div>
      )}

      {sig && (
        <label className="sig-check">
          <input type="checkbox" id={id} checked={checked} disabled={disabled}
            onChange={(e) => setChecked(e.target.checked)} />
          <span>
            I, <b>{fullName(user) || 'the signer'}</b> ({roleLabel || ROLE_LABEL[user?.role] || 'official'}), {verb} this {noun}{' '}
            and agree that my electronic signature is placed on it.
          </span>
        </label>
      )}

    </div>
  );
};

/* ── Signature lines on a proposal ── */
const LINE_ORDER = ['chairperson', 'research_coordinator', 'college_dean', 'special_assistant', 'msric_director', 'ovcred'];
const OFFICE_HOLDER = { submitted: 'special_assistant', under_review: 'msric_director', endorsed: 'ovcred' };
const roundOf = (p) => Number(p?.round) || (Number(p?.revision_count) || 0) + 1;

const lineStates = (p, sigs) => {
  const lines = officeLines(p, sigs);
  if (p.form_no !== '005') return lines;
  /* Form 005: the Project Leader signs first, under (15) Submitted by */
  const own = sigs.find(x => Number(x.round) === roundOf(p) && x.signer_role === 'researcher');
  const first = own ? { role: 'researcher', state: 'ok', sig: own }
    : { role: 'researcher', state: p.status === 'draft' || p.status === 'returned' ? 'todo' : 'none' };
  return [first, ...lines];
};
const LINE_LABEL = { researcher: 'Project Leader' };

const officeLines = (p, sigs) => {
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
        <p className="sig-hint">Loading signatures…</p>
      ) : failed ? (
        <p className="sig-hint">{failed}</p>
      ) : (
        <>
          <div className="sig-lines">
            {lines.map(l => (
              <div key={l.role} className={`sig-line${l.state === 'skip' ? ' skip' : ''}`}>
                <div className="sig-sp">{l.sig && <img src={l.sig.image_data} alt={`Signature of ${l.sig.signer_name}`} />}</div>
                <div><span className="sig-name">{l.sig ? l.sig.signer_name : ' '}</span></div>
                <div className="sig-role">{LINE_LABEL[l.role] || ROLE_LABEL[l.role]}</div>
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