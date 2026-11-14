import React, { useRef } from 'react';
import { FaCheck, FaFileLines, FaArrowUpFromBracket, FaTrashCan } from 'react-icons/fa6';
import { ROLE_LABEL } from '../utils/terms';
import { GRANT_FORMS, formOf, stepOf, shown } from '../utils/grantForms';
import './GrantForms.css';

/* ─────────────────────────────────────────────────────────────
   The MSIRC forms behind Grants and Incentives (utils/grantForms.js).
     GrantFormFields  the applicant's fields of the chosen form        (Researcher, step 2)
     SlotDocs         one upload box per document the form asks for    (Researcher, step 3)
     FormChecklist    an office's own step: tick boxes, choices, boxes (when it signs)
     GrantFormView    the filled-in form and what each office ticked   (everyone, read only)
   ───────────────────────────────────────────────────────────── */

const MAX_MB  = 10;
const ALLOWED = ['pdf', 'doc', 'docx'];
const peso = (v) => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const niceDate = (v) => (v && !Number.isNaN(Date.parse(v))
  ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : v);
const showValue = (q, v) => (q.type === 'money' ? peso(v) : q.type === 'date' ? niceDate(v) : v);

/* ── Applicant's fields ── */
export const GrantFormFields = ({ form, value, onChange, disabled = false }) => {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="gf-fields">
      {form.fields.map((f) => (
        <div key={f.k} className="form-group">
          <label htmlFor={`gf-${f.k}`}>{f.label}{f.required && <span className="gf-req"> *</span>}</label>
          {f.type === 'select' ? (
            <select id={`gf-${f.k}`} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}>
              <option value="">Choose...</option>
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input id={`gf-${f.k}`} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}
              type={f.type === 'date' ? 'date' : 'text'} maxLength={f.type === 'year' ? 4 : 200}
              inputMode={f.type === 'year' ? 'numeric' : undefined}
              placeholder={f.hint || (f.type === 'year' ? 'For example 2026' : '')} />
          )}
        </div>
      ))}
    </div>
  );
};

/* ── Documents: one box per document on the form ──
   Uses the same value as DocumentsEditor (ProposalFiles.jsx), so saving,
   drafts and resubmitting work the same way. The first document of the form
   is the main document; the others are supporting documents with that label. */
let slotSeq = 0;
const rowOf = (docs, label) => docs.rows.find((r) => (r.existing ? r.existing.label : r.choice) === label);

export const slotDocsProblem = (form, docs) => {
  const [main, ...rest] = form.docs;
  if (!docs.main.existing && !docs.main.file) return `Please attach the ${main.label}.`;
  for (const d of rest) {
    const r = rowOf(docs, d.label);
    if (d.required && !(r && (r.existing || r.file))) return `Please attach the ${d.label}.`;
  }
  return '';
};
export const slotDocsSummary = (form, docs) => form.docs
  .filter((d, i) => (i === 0 ? (docs.main.existing || docs.main.file) : (() => { const r = rowOf(docs, d.label); return r && (r.existing || r.file); })()))
  .map((d) => d.label);

export const SlotDocs = ({ form, value, onChange, onError, disabled = false }) => {
  const inputs = useRef({});
  const ok = (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED.includes(ext)) { onError?.(`"${file.name}" is not allowed. Use a PDF, DOC or DOCX file.`); return false; }
    if (file.size > MAX_MB * 1024 * 1024) { onError?.(`"${file.name}" is too large. The limit is ${MAX_MB} MB per file.`); return false; }
    onError?.('');
    return true;
  };
  const pick = (i, label) => (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !ok(file)) return;
    if (i === 0) { onChange({ ...value, main: { ...value.main, file } }); return; }
    const cur = rowOf(value, label);
    onChange({
      ...value,
      rows: cur
        ? value.rows.map((r) => (r === cur ? { ...r, file } : r))
        : [...value.rows, { key: `s${++slotSeq}`, existing: null, file, choice: label, custom: '' }],
    });
  };
  const clear = (i, label) => () => {
    if (i === 0) { onChange({ ...value, main: { ...value.main, file: null } }); return; }
    const cur = rowOf(value, label);
    if (!cur) return;
    onChange({
      ...value,
      rows: value.rows.filter((r) => r !== cur),
      removed: cur.existing?.file_id ? [...value.removed, cur.existing.file_id] : value.removed,
    });
  };

  return (
    <ul className="gf-slots">
      {form.docs.map((d, i) => {
        const cur   = i === 0 ? value.main : rowOf(value, d.label);
        const saved = cur?.existing;
        const fresh = cur?.file;
        const has   = !!(saved || fresh);
        return (
          <li key={d.label} className={`gf-slot${has ? ' has' : ''}`}>
            <span className="gf-slot-ic" aria-hidden="true">{has ? <FaCheck /> : <FaFileLines />}</span>
            <div className="gf-slot-text">
              <b>{d.label}{d.required ? <span className="gf-req"> *</span> : <span className="gf-opt"> (if it applies)</span>}</b>
              {d.hint && <small>{d.hint}</small>}
              <small className="gf-slot-file">
                {fresh ? `${fresh.name} (not saved yet)` : saved ? (saved.file_name || 'Uploaded') : 'No file chosen'}
              </small>
            </div>
            <div className="gf-slot-actions">
              <input type="file" hidden accept=".pdf,.doc,.docx" data-slot={d.label}
                ref={(el) => { inputs.current[d.label] = el; }} onChange={pick(i, d.label)} />
              <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
                onClick={() => inputs.current[d.label]?.click()}>
                <FaArrowUpFromBracket className="ic" />{has ? 'Replace' : 'Choose File'}
              </button>
              {((i === 0 && fresh) || (i > 0 && has)) && (
                <button type="button" className="btn btn-sm btn-danger-soft" disabled={disabled}
                  onClick={clear(i, d.label)} aria-label={`Remove ${d.label}`}><FaTrashCan /></button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

/* ── An office's step on the form ──   value = { ticks: [], answers: {} } */
export const EMPTY_CHECK = { ticks: [], answers: {} };

export const FormChecklist = ({ proposal, role, value, onChange, disabled = false }) => {
  const form = formOf(proposal);
  const step = stepOf(proposal, role);
  if (!form) return null;
  if (!step) {
    return (
      <div className="gf-check">
        <p className="gf-check-title">MSIRC Form No. {form.no}</p>
        <p className="gf-check-none">This form has no checklist for the {ROLE_LABEL[role] || 'office'}. Review the application, then sign.</p>
      </div>
    );
  }
  const v = value || EMPTY_CHECK;
  const tick = (k) => onChange({ ...v, ticks: v.ticks.includes(k) ? v.ticks.filter((x) => x !== k) : [...v.ticks, k] });
  const answer = (k, val) => onChange({ ...v, answers: { ...v.answers, [k]: val } });

  return (
    <div className="gf-check">
      <p className="gf-check-title">MSIRC Form No. {form.no}: your checklist</p>
      {step.hint && <p className="gf-check-hint">{step.hint}</p>}

      {(step.items || []).map((it) => {
        const on = v.ticks.includes(it.k);
        return (
          <label key={it.k} className={`gf-tick${on ? ' on' : ''}`}>
            <input type="checkbox" checked={on} disabled={disabled} onChange={() => tick(it.k)} data-tick={it.k} />
            <span>{it.label}{it.optional && <em> (if it applies)</em>}</span>
          </label>
        );
      })}

      {(step.choices || []).filter((c) => shown(c, v.answers)).map((c) => (
        <fieldset key={c.k} className="gf-choice">
          <legend>{c.label}{c.required && <span className="gf-req"> *</span>}</legend>
          {c.options.map((o) => (
            <label key={o} className={`gf-radio${v.answers[c.k] === o ? ' on' : ''}`}>
              <input type="radio" name={`gf-${c.k}`} checked={v.answers[c.k] === o} disabled={disabled}
                onChange={() => answer(c.k, o)} data-choice={`${c.k}:${o}`} />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
      ))}

      {(step.inputs || []).filter((i) => shown(i, v.answers)).map((i) => (
        <div key={i.k} className="form-group gf-input">
          <label htmlFor={`gfc-${i.k}`}>{i.label}{i.required && <span className="gf-req"> *</span>}</label>
          <input id={`gfc-${i.k}`} value={v.answers[i.k] || ''} disabled={disabled} maxLength={200}
            type={i.type === 'date' ? 'date' : 'text'} inputMode={i.type === 'money' ? 'decimal' : undefined}
            placeholder={i.hint || (i.type === 'money' ? 'For example 20000' : '')}
            onChange={(e) => answer(i.k, e.target.value)} />
        </div>
      ))}
    </div>
  );
};

/* ── The filled-in form, and what each office ticked (read only) ── */
const STEP_ORDER = ['chairperson', 'research_coordinator', 'college_dean', 'special_assistant', 'msric_director'];

export const GrantFormView = ({ proposal }) => {
  const form = formOf(proposal);
  if (!form) return null;
  const data   = proposal.form_data || {};
  const checks = proposal.form_checks || [];
  const done   = STEP_ORDER.map((role) => ({ role, step: form.steps[role], check: checks.find((c) => c.role === role) }))
    .filter((s) => s.check && s.step);

  return (
    <div className="gf-view">
      <p className="gf-view-no">MSIRC Form No. {form.no}</p>
      <p className="gf-view-name">{form.name}</p>
      <dl className="gf-view-grid">
        {form.fields.filter((f) => data[f.k]).map((f) => (
          <div key={f.k}><dt>{f.label}</dt><dd>{showValue(f, data[f.k])}</dd></div>
        ))}
      </dl>

      {done.length > 0 && (
        <div className="gf-view-steps">
          <p className="gf-view-sub">Checked on the form</p>
          {done.map(({ role, step, check }) => (
            <div key={role} className="gf-view-step">
              <b>{ROLE_LABEL[role]}{check.signer_name ? `: ${check.signer_name}` : ''}</b>
              <ul>
                {(step.items || []).filter((it) => (check.ticks || []).includes(it.k)).map((it) => (
                  <li key={it.k}><FaCheck className="gf-ok" aria-hidden="true" />{it.label}</li>
                ))}
                {[...(step.choices || []), ...(step.inputs || [])].filter((q) => (check.answers || {})[q.k]).map((q) => (
                  <li key={q.k}><FaCheck className="gf-ok" aria-hidden="true" />{q.label}: <strong>{showValue(q, check.answers[q.k])}</strong></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const mainDocLabel = (proposal) => { const f = formOf(proposal); return f ? f.docs[0].label : null; };
export { GRANT_FORMS };