import React, { useRef } from 'react';
import { FaCheck, FaFileLines, FaArrowUpFromBracket, FaTrashCan, FaPlus, FaXmark } from 'react-icons/fa6';
import { ROLE_LABEL } from '../utils/terms';
import {
  GRANT_FORMS, formOf, stepOf, shown, AGENDA, LONG, PLAN_MONTHS, BUDGET_MAX, budgetTotals, wordsIn,
} from '../utils/grantForms';
import './GrantForms.css';

/* ─────────────────────────────────────────────────────────────
   The MSIRC forms filled in inside AYON (utils/grantForms.js): Form 005 on
   My Research, and the forms behind Grants and Incentives.
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
const pesoNum = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* (2) Proponents: name and contact details, one row each */
const PeopleField = ({ id, value, onChange, disabled }) => {
  const list = value && value.length ? value : [{ name: '', contact: '' }];
  const set = (i, k, v) => onChange(list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  return (
    <div className="gf-people" id={id}>
      {list.map((p, i) => (
        <div key={i} className="gf-person">
          <span className="gf-person-no">{i === 0 ? 'Project Leader' : `Proponent ${i + 1}`}</span>
          <input aria-label={`Name of proponent ${i + 1}`} placeholder="Full name" maxLength={150}
            value={p.name} disabled={disabled} onChange={(e) => set(i, 'name', e.target.value)} />
          <input aria-label={`Contact details of proponent ${i + 1}`} maxLength={300}
            placeholder="Department, college, cellphone, email" value={p.contact} disabled={disabled}
            onChange={(e) => set(i, 'contact', e.target.value)} />
          {list.length > 1 && (
            <button type="button" className="gf-x" disabled={disabled} aria-label={`Remove proponent ${i + 1}`}
              onClick={() => onChange(list.filter((_, j) => j !== i))}><FaXmark /></button>
          )}
        </div>
      ))}
      {list.length < 10 && (
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
          onClick={() => onChange([...list, { name: '', contact: '' }])}><FaPlus className="ic" />Add Proponent</button>
      )}
    </div>
  );
};

/* (12) Work plan: activities against months 1 to 5 */
const WorkplanField = ({ id, value, onChange, disabled }) => {
  const rows = value && value.length ? value : [{ activity: '', months: [] }];
  const set = (i, row) => onChange(rows.map((r, j) => (j === i ? row : r)));
  const months = Array.from({ length: PLAN_MONTHS }, (_, i) => i + 1);
  return (
    <div className="gf-plan" id={id}>
      <table className="gf-plan-table">
        <thead>
          <tr><th scope="col">Activity</th>{months.map((m) => <th key={m} scope="col">Month {m}</th>)}<th aria-label="Remove" /></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>
                <input aria-label={`Activity ${i + 1}`} placeholder="For example: Data gathering" maxLength={300}
                  value={r.activity} disabled={disabled} onChange={(e) => set(i, { ...r, activity: e.target.value })} />
              </td>
              {months.map((m) => {
                const on = (r.months || []).includes(m);
                return (
                  <td key={m} className="gf-plan-cell">
                    <input type="checkbox" checked={on} disabled={disabled}
                      aria-label={`${r.activity || `Activity ${i + 1}`}, month ${m}`}
                      onChange={() => set(i, { ...r, months: on ? r.months.filter((x) => x !== m) : [...(r.months || []), m].sort() })} />
                  </td>
                );
              })}
              <td>
                {rows.length > 1 && (
                  <button type="button" className="gf-x" disabled={disabled} aria-label={`Remove activity ${i + 1}`}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}><FaXmark /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length < 20 && (
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
          onClick={() => onChange([...rows, { activity: '', months: [] }])}><FaPlus className="ic" />Add Activity</button>
      )}
    </div>
  );
};

/* (13) and (14) Budget: line items under Personal Services and MOOE, totals added up */
const BUDGET_PARTS = [
  { k: 'ps',   title: 'Personal Services (PS)', hint: 'For example: Enumerators, ₱500/day x 20 days. No honoraria for the project leader or members.' },
  { k: 'mooe', title: 'Maintenance and Other Operating Expenses (MOOE)', hint: 'Travel, per diem, food allowance, supplies and materials.' },
];
const BudgetField = ({ id, value, onChange, disabled }) => {
  const b = { ps: [], mooe: [], ...(value || {}) };
  const t = budgetTotals(b);
  const setPart = (k, rows) => onChange({ ...b, [k]: rows });
  return (
    <div className="gf-budget" id={id}>
      {BUDGET_PARTS.map((part) => {
        const rows = b[part.k].length ? b[part.k] : [{ item: '', unit: '', amount: '' }];
        const set = (i, row) => setPart(part.k, rows.map((r, j) => (j === i ? row : r)));
        return (
          <div key={part.k} className="gf-budget-part">
            <p className="gf-budget-title">{part.title}</p>
            <p className="gf-budget-hint">{part.hint}</p>
            {rows.map((r, i) => (
              <div key={i} className="gf-line">
                <input aria-label={`${part.title} item ${i + 1}`} placeholder="Item" maxLength={150}
                  value={r.item} disabled={disabled} onChange={(e) => set(i, { ...r, item: e.target.value })} />
                <input aria-label={`${part.title} item ${i + 1}, unit amount`} placeholder="Unit amount, e.g. ₱500/day x 20 days" maxLength={150}
                  value={r.unit} disabled={disabled} onChange={(e) => set(i, { ...r, unit: e.target.value })} />
                <input aria-label={`${part.title} item ${i + 1}, amount in pesos`} placeholder="Amount (₱)" inputMode="decimal" maxLength={13}
                  className="gf-line-amt" value={r.amount} disabled={disabled} onChange={(e) => set(i, { ...r, amount: e.target.value })} />
                <button type="button" className="gf-x" disabled={disabled || (rows.length === 1 && !r.item && !r.amount)}
                  aria-label={`Remove ${part.title} item ${i + 1}`}
                  onClick={() => setPart(part.k, rows.filter((_, j) => j !== i))}><FaXmark /></button>
              </div>
            ))}
            {rows.length < 30 && (
              <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
                onClick={() => setPart(part.k, [...rows, { item: '', unit: '', amount: '' }])}><FaPlus className="ic" />Add Line</button>
            )}
          </div>
        );
      })}
      <table className="gf-budget-sum" aria-label="(13) Estimated Budget">
        <caption>(13) Estimated Budget (added up from the lines above)</caption>
        <tbody>
          <tr><th scope="row">Personal Services (PS)</th><td>{pesoNum(t.ps)}</td></tr>
          <tr><th scope="row">MOOE</th><td>{pesoNum(t.mooe)}</td></tr>
          <tr className={t.total > BUDGET_MAX ? 'over' : ''}>
            <th scope="row">TOTAL <small>(maximum {pesoNum(BUDGET_MAX)})</small></th><td>{pesoNum(t.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export const GrantFormFields = ({ form, value, onChange, disabled = false }) => {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const put = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className="gf-fields">
      {form.fields.map((f) => {
        const id = `gf-${f.k}`;
        const wide = LONG.includes(f.type);
        const words = f.maxWords ? wordsIn(value[f.k]) : 0;
        return (
          <div key={f.k} className={`form-group${wide ? ' gf-wide' : ''}`}>
            <label htmlFor={id}>{f.label}{f.required && <span className="gf-req"> *</span>}</label>
            {wide && f.hint && <p className="gf-field-hint">{f.hint}</p>}
            {f.type === 'select' ? (
              <select id={id} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}>
                <option value="">Choose...</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'agenda' ? (
              <select id={id} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}>
                <option value="">Choose the priority area...</option>
                {AGENDA.map(([area, subs]) => (
                  <optgroup key={area} label={area}>
                    {subs.map((sub) => <option key={sub} value={`${area}: ${sub}`}>{sub}</option>)}
                  </optgroup>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <>
                <textarea id={id} rows={f.rows || 4} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}
                  maxLength={f.maxChars || 10000} style={{ resize: 'vertical' }} />
                {f.maxWords && (
                  <small className={`gf-count${words > f.maxWords ? ' over' : ''}`}>{words} / {f.maxWords} words</small>
                )}
              </>
            ) : f.type === 'people' ? (
              <PeopleField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} />
            ) : f.type === 'workplan' ? (
              <WorkplanField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} />
            ) : f.type === 'budget' ? (
              <BudgetField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} />
            ) : (
              <input id={id} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}
                type={f.type === 'date' ? 'date' : 'text'} maxLength={f.type === 'year' ? 4 : 200}
                inputMode={f.type === 'year' ? 'numeric' : undefined}
                placeholder={f.hint || (f.type === 'year' ? 'For example 2026' : '')} />
            )}
          </div>
        );
      })}
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
  if (!form || !Object.keys(form.steps || {}).length) return null;   // e.g. Form 005 has no office checklist
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
const LongValue = ({ f, v }) => {
  if (f.type === 'people') {
    return <ol className="gf-view-people">{v.map((p, i) => <li key={i}><b>{p.name}</b>{i === 0 && ' (Project Leader)'}<br /><span>{p.contact}</span></li>)}</ol>;
  }
  if (f.type === 'workplan') {
    const months = Array.from({ length: PLAN_MONTHS }, (_, i) => i + 1);
    return (
      <div className="gf-scroll">
        <table className="gf-plan-table view">
          <thead><tr><th scope="col">Activity</th>{months.map((m) => <th key={m} scope="col">{m}</th>)}</tr></thead>
          <tbody>{v.map((r, i) => (
            <tr key={i}><td>{r.activity}</td>{months.map((m) => (
              <td key={m} className="gf-plan-cell">{r.months.includes(m) ? <span className="gf-on" aria-label={`Month ${m}`}>■</span> : ''}</td>
            ))}</tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  if (f.type === 'budget') {
    const t = budgetTotals(v);
    const part = (rows, title, sub) => (
      <>
        <tr className="gf-bgroup"><th colSpan={3} scope="colgroup">{title}</th></tr>
        {rows.map((r, i) => <tr key={i}><td>{r.item}</td><td>{r.unit}</td><td className="num">{peso(r.amount || 0)}</td></tr>)}
        <tr className="gf-bsub"><td colSpan={2}>Sub-total for {sub}</td><td className="num">{peso(sub === 'PS' ? t.ps : t.mooe)}</td></tr>
      </>
    );
    return (
      <div className="gf-scroll">
        <table className="gf-budget-view">
          <thead><tr><th scope="col">Item</th><th scope="col">Unit Amount</th><th scope="col" className="num">Amount</th></tr></thead>
          <tbody>
            {part(v.ps || [], 'Personal Services', 'PS')}
            {part(v.mooe || [], 'Maintenance and Other Operating Expenses', 'MOOE')}
            <tr className="gf-btotal"><td colSpan={2}>Grand Total</td><td className="num">{peso(t.total)}</td></tr>
          </tbody>
        </table>
      </div>
    );
  }
  if (f.type === 'agenda') return <p className="gf-view-text">{v}</p>;
  return <p className="gf-view-text">{v}</p>;
};

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
        {form.fields.filter((f) => data[f.k] && !LONG.includes(f.type)).map((f) => (
          <div key={f.k}><dt>{f.label}</dt><dd>{showValue(f, data[f.k])}</dd></div>
        ))}
      </dl>
      {form.fields.filter((f) => data[f.k] && LONG.includes(f.type)).map((f) => (
        <div key={f.k} className="gf-view-long">
          <p className="gf-view-label">{f.label}</p>
          <LongValue f={f} v={data[f.k]} />
        </div>
      ))}

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