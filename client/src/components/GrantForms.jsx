import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaFileLines, FaArrowUpFromBracket, FaTrashCan, FaPlus, FaXmark, FaMagnifyingGlass, FaChevronDown } from 'react-icons/fa6';
import { ROLE_LABEL } from '../utils/terms';
import {
  GRANT_FORMS, formOf, formLabel, stepOf, shown, requiredDocs, AGENDA, LONG, PLAN_MONTHS, BUDGET_MAX, budgetTotals, wordsIn, MOOE_GROUPS, groupOf, mooeGroups,
  OTHER_COLLEGE, personContact, personIssues,
} from '../utils/grantForms';
import { COLLEGE_DEPARTMENTS, COLLEGES } from '../data/Colleges';
import { OriginalForm, hasOriginalForm } from './OriginalForm';
import './GrantForms.css';
import './FormToast.css';

/* ─────────────────────────────────────────────────────────────
   The MSIRC forms filled in inside AYON (utils/grantForms.js): Form 005 on
   My Research, and the forms behind Grants and Incentives.
     GrantFormFields  the applicant's fields of the chosen form        (Researcher, step 2)
     SlotDocs         one upload box per document the form asks for    (Researcher, step 3)
     FormChecklist    an office's own step: tick boxes, choices, boxes (when it signs)
     GrantFormView    the filled-in form and what each office ticked   (everyone, read only)
                      Opens on the original MSIRC form (OriginalForm.jsx); "List view" shows the fields as a list.
   ───────────────────────────────────────────────────────────── */

const MAX_MB  = 10;
const ALLOWED = ['pdf', 'doc', 'docx'];
const peso = (v) => `₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const niceDate = (v) => (v && !Number.isNaN(Date.parse(v))
  ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : v);
const showValue = (q, v) => (q.type === 'money' ? peso(v) : q.type === 'date' ? niceDate(v) : v);

/* ── Applicant's fields ── */
const pesoNum = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* (2) Proponents of Form 005: one card each, with separate boxes for
   name, college, department, email (required) and cellphone (optional) */
/* the account's college as it is named in the list ("College of X" or "College of X (CX)") */
export const collegeKey = (c) => {
  const v = String(c || '').trim();
  if (!v) return '';
  const bare = (s) => s.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();
  return COLLEGES.find((k) => k === v) || COLLEGES.find((k) => bare(k) === bare(v)) || v;
};
const EMPTY_PROPONENT = { name: '', college: '', department: '', email: '', cellphone: '' };
const ProponentsField = ({ id, value, onChange, disabled, issues = [] }) => {
  const list = value && value.length ? value : [EMPTY_PROPONENT];
  const [seen, setSeen] = useState({});            // boxes the researcher has left, so format errors show
  const set = (i, patch) => onChange(list.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const leave = (i, k) => setSeen((s) => ({ ...s, [`${i}.${k}`]: true }));
  return (
    <div className="gf-people" id={id}>
      {list.map((p, i) => {
        const who = i === 0 ? 'Project Leader' : `Proponent ${i + 1}`;
        const other = p.college === OTHER_COLLEGE;
        const colleges = p.college && p.college !== OTHER_COLLEGE && !COLLEGES.includes(p.college) ? [p.college, ...COLLEGES] : COLLEGES;
        const depts = COLLEGE_DEPARTMENTS[p.college] || [];
        const deptList = p.department && !other && !depts.includes(p.department) ? [p.department, ...depts] : depts;
        /* a wrong email or cellphone shows as soon as the box is left; empty boxes turn red after Next */
        const own = personIssues(p, i);
        const bad = (k) => own.some((x) => x.k === k) && (k === 'email' || k === 'cellphone') && String(p[k] || '').trim() && seen[`${i}.${k}`];
        const box = (k) => `${id}-${i}-${k}`;
        /* red after Next was pressed (issues), or a wrong format right after leaving the box */
        const flagged = (k) => issues.find((x) => x.box === box(k));
        const red = (k) => !!flagged(k) || !!bad(k);
        const mark = (k) => (red(k) ? { className: 'f-bad', 'aria-invalid': true, 'aria-describedby': `${box(k)}-err` } : {});
        const FORMAT = { email: 'Check the email. Ex: name@msumain.edu.ph', cellphone: '11 digits starting with 09' };
        const note = (k) => {
          const m = flagged(k) ? flagged(k).msg : bad(k) ? FORMAT[k] : '';
          return m ? <small className="f-err" id={`${box(k)}-err`}>{m}</small> : null;
        };
        return (
          <fieldset key={i} className="gf-pcard" disabled={disabled}>
            <legend className="gf-person-no">{who}</legend>
            {list.length > 1 && (
              <button type="button" className="gf-x gf-pcard-x" aria-label={`Remove ${who.toLowerCase()}`}
                onClick={() => onChange(list.filter((_, j) => j !== i))}><FaXmark /></button>
            )}
            {p.contact && !p.college && !p.department && !p.email && !p.cellphone && (
              <p className="gf-pcard-old">Saved before as: <b>{p.contact}</b>. Fill in the boxes below to update it.</p>
            )}
            <div className="gf-pgrid">
              <label className="gf-pbox full" htmlFor={box('name')}>
                <span>Full name <i>*</i></span>
                <input id={box('name')} maxLength={150} placeholder="Ex: Juan A. Dela Cruz" {...mark('name')}
                  value={p.name || ''} onChange={(e) => set(i, { name: e.target.value })} />
                {note('name')}
              </label>
              <label className="gf-pbox" htmlFor={box('college')}>
                <span>College <i>*</i></span>
                <select id={box('college')} value={p.college || ''} {...mark('college')}
                  onChange={(e) => set(i, { college: e.target.value, department: '' })}>
                  <option value="">Choose a college</option>
                  {colleges.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value={OTHER_COLLEGE}>{OTHER_COLLEGE}</option>
                </select>
                {note('college')}
              </label>
              <label className="gf-pbox" htmlFor={box('department')}>
                <span>{other ? 'Institution or office' : 'Department'} <i>*</i></span>
                {other ? (
                  <input id={box('department')} maxLength={200} {...mark('department')} placeholder="Ex: MSU-Iligan Institute of Technology"
                    value={p.department || ''} onChange={(e) => set(i, { department: e.target.value })} />
                ) : (
                  <select id={box('department')} value={p.department || ''} {...mark('department')} disabled={disabled || !p.college}
                    onChange={(e) => set(i, { department: e.target.value })}>
                    <option value="">{p.college ? 'Choose a department' : 'Choose the college first'}</option>
                    {deptList.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
                {note('department')}
              </label>
              <label className="gf-pbox" htmlFor={box('email')}>
                <span>Email <i>*</i></span>
                <input id={box('email')} type="email" maxLength={150} placeholder="Ex: name@msumain.edu.ph"
                  {...mark('email')}
                  value={p.email || ''} onChange={(e) => set(i, { email: e.target.value })} onBlur={() => leave(i, 'email')} />
                {note('email')}
              </label>
              <label className="gf-pbox" htmlFor={box('cellphone')}>
                <span>Cellphone <em>(optional)</em></span>
                <input id={box('cellphone')} inputMode="numeric" maxLength={13} placeholder="Ex: 09171234567"
                  {...mark('cellphone')}
                  value={p.cellphone || ''} onChange={(e) => set(i, { cellphone: e.target.value.replace(/[^\d\s-]/g, '') })}
                  onBlur={() => leave(i, 'cellphone')} />
                {note('cellphone')}
              </label>
            </div>
          </fieldset>
        );
      })}
      {list.length < 10 && (
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
          onClick={() => onChange([...list, EMPTY_PROPONENT])}><FaPlus className="ic" />Add Proponent</button>
      )}
    </div>
  );
};

/* Spotlight authors: name and affiliation, one row each */
const PeopleField = ({ id, value, onChange, disabled, authors = false }) => {
  const who = authors ? 'author' : 'proponent';
  const list = value && value.length ? value : [{ name: '', contact: '' }];
  const set = (i, k, v) => onChange(list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  return (
    <div className="gf-people" id={id}>
      {list.map((p, i) => (
        <div key={i} className="gf-person">
          <span className="gf-person-no">{authors ? (i === 0 ? 'Main Author' : `Author ${i + 1}`) : (i === 0 ? 'Project Leader' : `Proponent ${i + 1}`)}</span>
          <input aria-label={`Name of ${who} ${i + 1}`} placeholder="Full name" maxLength={150}
            value={p.name} disabled={disabled} onChange={(e) => set(i, 'name', e.target.value)} />
          <input aria-label={`${authors ? 'Affiliation' : 'Contact details'} of ${who} ${i + 1}`} maxLength={300}
            placeholder={authors ? 'Department and college' : 'Department, college, cellphone, email'} value={p.contact} disabled={disabled}
            onChange={(e) => set(i, 'contact', e.target.value)} />
          {list.length > 1 && (
            <button type="button" className="gf-x" disabled={disabled} aria-label={`Remove ${who} ${i + 1}`}
              onClick={() => onChange(list.filter((_, j) => j !== i))}><FaXmark /></button>
          )}
        </div>
      ))}
      {list.length < 10 && (
        <button type="button" className="btn btn-outline btn-sm" disabled={disabled}
          onClick={() => onChange([...list, { name: '', contact: '' }])}><FaPlus className="ic" />{authors ? 'Add Author' : 'Add Proponent'}</button>
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
                <input aria-label={`Activity ${i + 1}`} placeholder="Ex: Data gathering" maxLength={300}
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
const BudgetField = ({ id, value, onChange, disabled }) => {
  const b = { ps: [], mooe: [], ...(value || {}) };
  const t = budgetTotals(b);
  const blank = (group) => ({ item: '', unit: '', amount: '', ...(group ? { group } : {}) });
  /* one line: item, unit amount, amount, remove */
  /* a plain function, not a component, so typing never loses the cursor */
  const line = ({ key, r, label, n, onSet, onRemove, canRemove }) => (
    <div key={key} className="gf-line">
      <input aria-label={`${label} item ${n}`} placeholder="Item" maxLength={150}
        value={r.item} disabled={disabled} onChange={(e) => onSet({ ...r, item: e.target.value })} />
      <input aria-label={`${label} item ${n}, unit amount`} placeholder="Unit amount, e.g. ₱500/day x 20 days" maxLength={150}
        value={r.unit} disabled={disabled} onChange={(e) => onSet({ ...r, unit: e.target.value })} />
      <input aria-label={`${label} item ${n}, amount in pesos`} placeholder="Amount (₱)" inputMode="decimal" maxLength={13}
        className="gf-line-amt" value={r.amount} disabled={disabled} onChange={(e) => onSet({ ...r, amount: e.target.value })} />
      <button type="button" className="gf-x" disabled={disabled || !canRemove} aria-label={`Remove ${label} item ${n}`}
        onClick={onRemove}><FaXmark /></button>
    </div>
  );
  const add = (label, onClick) => (
    <button type="button" className="btn btn-outline btn-sm" disabled={disabled} onClick={onClick}>
      <FaPlus className="ic" />{label}
    </button>
  );

  /* Personal Services: one list */
  const ps = b.ps.length ? b.ps : [blank()];
  const setPs = (rows) => onChange({ ...b, ps: rows });
  /* MOOE: one list, shown in the paper's groups (each line keeps its group) */
  const mooe = b.mooe;
  const setMooe = (rows) => onChange({ ...b, mooe: rows });
  const groups = mooeGroups(mooe);
  const totalOf = (k) => (groups.find((g) => g.k === k) || {}).total || 0;

  return (
    <div className="gf-budget" id={id}>
      <div className="gf-budget-part">
        <p className="gf-budget-title">Personal Services (PS)</p>
        <p className="gf-budget-hint">Should not exceed 45% of the MOOE. No honoraria for the project leader or members (RELE only). Ex: Enumerators, ₱500/day x 20 days.</p>
        {ps.map((r, i) => (
          line({
            key: i, r, label: 'Personal Services (PS)', n: i + 1,
            onSet: (row) => setPs(ps.map((x, j) => (j === i ? row : x))),
            onRemove: () => setPs(ps.filter((_, j) => j !== i)),
            canRemove: !(ps.length === 1 && !r.item && !r.amount),
          })
        ))}
        {ps.length < 30 && add('Add Line', () => setPs([...ps, blank()]))}
      </div>

      <div className="gf-budget-part">
        <p className="gf-budget-title">Maintenance and Other Operating Expenses (MOOE)</p>
        <p className="gf-budget-hint">Put each line under its group, like the sample line-item budget on the form.</p>
        {MOOE_GROUPS.map((g) => {
          const mine = mooe.map((r, i) => ({ r, i })).filter(({ r }) => groupOf(r) === g.k);
          return (
            <div key={g.k} className="gf-bgrp">
              <p className="gf-bgrp-title">{g.label}<small>{g.hint}</small></p>
              {mine.map(({ r, i }, n) => (
                line({
                  key: i, r, label: g.label, n: n + 1,
                  onSet: (row) => setMooe(mooe.map((x, j) => (j === i ? row : x))),
                  onRemove: () => setMooe(mooe.filter((_, j) => j !== i)), canRemove: true,
                })
              ))}
              {mine.length > 0 && <p className="gf-bgrp-sub">Subtotal: <b>{pesoNum(totalOf(g.k))}</b></p>}
              {mooe.length < 30 && add(mine.length ? 'Add Line' : `Add ${g.label} Line`, () => setMooe([...mooe, blank(g.k)]))}
            </div>
          );
        })}
      </div>

      <table className="gf-budget-sum" aria-label="(13) Estimated Budget">
        <caption>(13) Estimated Budget (added up from the lines above)</caption>
        <tbody>
          <tr><th scope="row">Personal Services (PS)</th><td>{pesoNum(t.ps)}</td></tr>
          <tr><th scope="row">MOOE</th><td>{pesoNum(t.mooe)}</td></tr>
          {groups.map((g) => (
            <tr key={g.k} className="gf-bsum-grp"><th scope="row">{g.label}</th><td>{pesoNum(g.total)}</td></tr>
          ))}
          <tr className={t.total > BUDGET_MAX ? 'over' : ''}>
            <th scope="row">TOTAL <small>(maximum {pesoNum(BUDGET_MAX)})</small></th><td>{pesoNum(t.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

/* ── R&D priority area: type to search, or open the full grouped list ──
   Saves the same "<area>: <sub-area>" text the old dropdown did. */
const SHORT_FORMS = { ai: 'artificial intelligence' };
const agendaLabel = (v) => {
  if (!v) return '';
  const [area, ...rest] = v.split(': ');
  return `${rest.join(': ')}  (${area.split('. ')[0]})`;
};

const AgendaPicker = ({ id, value, onChange, disabled }) => {
  const [text, setText] = useState(agendaLabel(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (!open) setText(agendaLabel(value)); }, [value, open]);

  const typed = open && text !== agendaLabel(value) ? text.trim().toLowerCase() : '';
  const word = SHORT_FORMS[typed] || typed;
  const groups = AGENDA.map(([area, subs]) => {
    const areaHit = word && area.toLowerCase().includes(word);
    return [area, subs.filter((s) => !word || areaHit || s.toLowerCase().includes(word))];
  }).filter(([, subs]) => subs.length);
  const items = groups.flatMap(([area, subs]) => subs.map((s) => `${area}: ${s}`));
  const at = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    const el = listRef.current?.querySelector('.gf-ag-opt.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [at, open]);

  const mark = (t) => {
    if (!word) return t;
    const i = t.toLowerCase().indexOf(word);
    if (i < 0) return t;
    return <>{t.slice(0, i)}<mark>{t.slice(i, i + word.length)}</mark>{t.slice(i + word.length)}</>;
  };
  const pick = (v) => { onChange(v); setText(agendaLabel(v)); setOpen(false); };
  const showAll = () => { setText(''); setActive(0); setOpen(true); inputRef.current?.focus(); };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(Math.min(at + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(at - 1, 0)); }
    else if (e.key === 'Enter') { if (open && items[at]) { e.preventDefault(); pick(items[at]); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  let n = -1;
  return (
    <div className="gf-ag">
      <div className={`gf-ag-box${disabled ? ' off' : ''}`}>
        <FaMagnifyingGlass className="gf-ag-icon" aria-hidden="true" />
        <input id={id} ref={inputRef} type="text" role="combobox" autoComplete="off" disabled={disabled}
          aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          placeholder="Type to search, or open the list" value={text}
          onFocus={(e) => { e.target.select(); setActive(0); setOpen(true); }}
          onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKey} />
        {value && !disabled && (
          <button type="button" className="gf-ag-btn" aria-label="Clear the priority area"
            onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(''); setText(''); inputRef.current?.focus(); }}>
            <FaXmark />
          </button>
        )}
        <button type="button" className="gf-ag-btn" aria-label="Show all priority areas" disabled={disabled}
          onMouseDown={(e) => { e.preventDefault(); if (open) setOpen(false); else showAll(); }}>
          <FaChevronDown />
        </button>
      </div>
      {open && !disabled && (
        <div className="gf-ag-list" id={`${id}-list`} role="listbox" ref={listRef}>
          {items.length === 0 ? (
            <div className="gf-ag-none">No priority area matches "{text}". Try another word, or open the full list.</div>
          ) : groups.map(([area, subs]) => (
            <div key={area} role="group" aria-label={area}>
              <div className="gf-ag-group">{mark(area)}</div>
              {subs.map((s) => {
                n += 1;
                const i = n;
                const v = `${area}: ${s}`;
                return (
                  <div key={v} role="option" aria-selected={v === value}
                    className={`gf-ag-opt${i === at ? ' active' : ''}${v === value ? ' chosen' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); pick(v); }} onMouseEnter={() => setActive(i)}>
                    {mark(s)}{v === value && <FaCheck className="ic-r" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* issues: what is still missing or wrong (fieldsIssues in utils/grantForms.js), shown in red
   under each box. Empty until the researcher presses Next or Submit once. */
export const GrantFormFields = ({ form, value, onChange, disabled = false, issues = [] }) => {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const put = (k) => (v) => onChange({ ...value, [k]: v });
  return (
    <div className="gf-fields">
      {form.fields.map((f) => {
        const id = `gf-${f.k}`;
        const wide = LONG.includes(f.type);
        const full = wide || f.full;           /* a short field that still takes the whole row */
        const words = f.maxWords ? wordsIn(value[f.k]) : 0;
        const mine = issues.filter((x) => x.k === f.k);
        const own = mine.find((x) => x.box === id);              /* about the field as a whole */
        const bad = own ? { 'aria-invalid': true, 'aria-describedby': `${id}-err` } : {};
        return (
          <div key={f.k} className={`form-group${full ? ' gf-wide' : ''}${own ? ' gf-has-err' : ''}`}>
            <label htmlFor={id}>{f.label}{f.required && <span className="gf-req"> *</span>}</label>
            {wide && f.hint && <p className="gf-field-hint">{f.hint}</p>}
            {f.type === 'select' ? (
              <select id={id} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled} {...bad}>
                <option value="">Choose...</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'agenda' ? (
              <AgendaPicker id={id} value={value[f.k] || ''} disabled={disabled}
                onChange={(v) => onChange({ ...value, [f.k]: v })} />
            ) : f.type === 'textarea' ? (
              <>
                <textarea id={id} rows={f.rows || 4} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled} {...bad}
                  maxLength={f.maxChars || 10000} style={{ resize: 'vertical' }} />
                {f.maxWords && (
                  <small className={`gf-count${words > f.maxWords ? ' over' : ''}`}>{words} / {f.maxWords} words</small>
                )}
              </>
            ) : f.type === 'people' ? (
              f.k === 'proponents'
                ? <ProponentsField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} issues={mine} />
                : <PeopleField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} authors={f.k === 'authors'} />
            ) : f.type === 'workplan' ? (
              <WorkplanField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} />
            ) : f.type === 'budget' ? (
              <BudgetField id={id} value={value[f.k]} onChange={put(f.k)} disabled={disabled} />
            ) : (
              <input id={id} value={value[f.k] || ''} onChange={set(f.k)} disabled={disabled}
                type={f.type === 'date' ? 'date' : 'text'} maxLength={f.type === 'year' ? 4 : 200}
                inputMode={f.type === 'year' ? 'numeric' : undefined}
                placeholder={f.hint || (f.type === 'year' ? 'Ex: 2026' : '')} {...bad} />
            )}
            {own && <div className="f-err" id={`${id}-err`}>{own.msg}</div>}
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

/* data = the form's answers; some answers make another document required */
export const slotDocsProblem = (form, docs, data) => {
  const [main, ...rest] = form.docs;
  if (!docs.main.existing && !docs.main.file) return `Please attach the ${main.label}.`;
  const needed = requiredDocs(form, data);
  for (const d of rest) {
    const r = rowOf(docs, d.label);
    if (needed.includes(d.label) && !(r && (r.existing || r.file))) return `Please attach the ${d.label}.`;
  }
  return '';
};
export const slotDocsSummary = (form, docs) => form.docs
  .filter((d, i) => (i === 0 ? (docs.main.existing || docs.main.file) : (() => { const r = rowOf(docs, d.label); return r && (r.existing || r.file); })()))
  .map((d) => d.label);

export const SlotDocs = ({ form, value, onChange, onError, disabled = false, data = {} }) => {
  const needed = requiredDocs(form, data);
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
              <b>{d.label}{needed.includes(d.label) ? <span className="gf-req"> *</span> : <span className="gf-opt"> (if it applies)</span>}</b>
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

/* ── The form's guidelines (Research Spotlight) ── */
export const FormGuide = ({ form }) => (form && form.guide ? (
  <details className="gf-guide" open>
    <summary>Guidelines</summary>
    <ul>{form.guide.map((g) => <li key={g}>{g}</li>)}</ul>
  </details>
) : null);

/* ── An office's step on the form ──   value = { ticks: [], answers: {} } */
export const EMPTY_CHECK = { ticks: [], answers: {} };

export const FormChecklist = ({ proposal, role, value, onChange, disabled = false }) => {
  const form = formOf(proposal);
  const step = stepOf(proposal, role);
  if (!form || !Object.keys(form.steps || {}).length) return null;   // e.g. Form 005 has no office checklist
  if (!step) {
    return (
      <div className="gf-check">
        <p className="gf-check-title">{formLabel(form)}</p>
        <p className="gf-check-none">This form has no checklist for the {ROLE_LABEL[role] || 'office'}. Review the application, then sign.</p>
      </div>
    );
  }
  const v = value || EMPTY_CHECK;
  const tick = (k) => onChange({ ...v, ticks: v.ticks.includes(k) ? v.ticks.filter((x) => x !== k) : [...v.ticks, k] });
  const answer = (k, val) => onChange({ ...v, answers: { ...v.answers, [k]: val } });

  return (
    <div className="gf-check">
      <p className="gf-check-title">{formLabel(form)}: your checklist</p>
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
            placeholder={i.hint || (i.type === 'money' ? 'Ex: 20000' : '')}
            onChange={(e) => answer(i.k, e.target.value)} />
        </div>
      ))}
    </div>
  );
};

/* ── The filled-in form, and what each office ticked (read only) ── */
const LongValue = ({ f, v }) => {
  if (f.type === 'people') {
    return <ol className="gf-view-people">{v.map((p, i) => <li key={i}><b>{p.name}</b>{i === 0 && (f.k === 'authors' ? ' (Main Author)' : ' (Project Leader)')}<br /><span>{f.k === 'proponents' ? personContact(p) : p.contact}</span></li>)}</ol>;
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
    const lines = (rows) => rows.map((r, i) => <tr key={i}><td>{r.item}</td><td>{r.unit}</td><td className="num">{peso(r.amount || 0)}</td></tr>);
    return (
      <div className="gf-scroll">
        <table className="gf-budget-view">
          <thead><tr><th scope="col">Item</th><th scope="col">Unit Amount</th><th scope="col" className="num">Amount</th></tr></thead>
          <tbody>
            <tr className="gf-bgroup"><th colSpan={3} scope="colgroup">Personnel Services</th></tr>
            {lines(v.ps || [])}
            <tr className="gf-bsub"><td colSpan={2}>Sub-total for PS</td><td className="num">{peso(t.ps)}</td></tr>
            <tr className="gf-bgroup"><th colSpan={3} scope="colgroup">MOOE</th></tr>
            {mooeGroups(v.mooe).map((g) => (
              <React.Fragment key={g.k}>
                <tr className="gf-bgrp-row"><td colSpan={3}>{g.label}</td></tr>
                {lines(g.rows)}
                <tr className="gf-bsub light"><td colSpan={2}>Subtotal</td><td className="num">{peso(g.total)}</td></tr>
              </React.Fragment>
            ))}
            <tr className="gf-bsub"><td colSpan={2}>Subtotal for MOOE</td><td className="num">{peso(t.mooe)}</td></tr>
            <tr className="gf-bgroup"><th colSpan={3} scope="colgroup">Summary</th></tr>
            <tr><td colSpan={2}>Sub-total for PS</td><td className="num">{peso(t.ps)}</td></tr>
            <tr><td colSpan={2}>Subtotal for MOOE</td><td className="num">{peso(t.mooe)}</td></tr>
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

/* The filled-in form after it is submitted: a small card on the page, and the
   form itself in a panel that slides in from the right (Form view or List view),
   so the documents and the decision buttons stay near the top. */
export const GrantFormView = ({ proposal }) => {
  const [open, setOpen] = useState('');           // '' | 'form' | 'list'
  const openerRef = useRef(null);
  const form = formOf(proposal);
  if (!form) return null;
  const paper = hasOriginalForm(proposal);
  const data = proposal.form_data || {};
  const facts = [];
  form.fields.forEach((f) => {
    const v = data[f.k];
    if (f.type === 'people' && Array.isArray(v) && v.length) {
      const one = f.k === 'authors' ? 'author' : 'proponent';
      facts.push(`${v.length} ${one}${v.length === 1 ? '' : 's'}`);
    }
    if (f.type === 'budget' && v) facts.push(`Budget ${pesoNum(budgetTotals(v).total)}`);
  });
  const show = (view) => (e) => { openerRef.current = e.currentTarget; setOpen(view); };
  return (
    <div className="gf-fcard">
      <FaFileLines className="gf-fcard-ic" aria-hidden="true" />
      <div className="gf-fcard-text">
        <span className="gf-fcard-no">{formLabel(form)}</span>
        <b>{form.name}</b>
        {facts.length > 0 && <small>{facts.join(' · ')}</small>}
      </div>
      <div className="gf-fcard-btns">
        {paper && <button type="button" className="btn btn-primary btn-sm" onClick={show('form')}>Form view</button>}
        <button type="button" className={`btn btn-sm ${paper ? 'btn-outline' : 'btn-primary'}`} onClick={show('list')}>
          {paper ? 'List view' : 'View form'}
        </button>
      </div>
      {open && (
        <FormPanel proposal={proposal} form={form} view={open} paper={paper} onView={setOpen}
          onClose={() => { setOpen(''); if (openerRef.current) openerRef.current.focus(); }} />
      )}
    </div>
  );
};

/* The panel on the right. Closes with ✕, the Esc key, or a click on the dark area. */
const FormPanel = ({ proposal, form, view, paper, onView, onClose }) => {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const bodyRef = useRef(null);
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    /* Esc closes only the panel, not the window under it; Tab stays inside the panel */
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const all = [...panelRef.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!all.length) return;
      const first = all[0]; const last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = before; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [view]);
  return createPortal(
    <div className="gf-panel-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="gf-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="gf-panel-title">
        <div className="gf-panel-head">
          <div className="gf-panel-title">
            <b id="gf-panel-title">{formLabel(form)}</b>
            {proposal.title && <small>{proposal.title}</small>}
          </div>
          {paper && (
            <div className="gf-viewbar" role="group" aria-label="How to show the form">
              <button type="button" className={view === 'form' ? 'on' : ''} aria-pressed={view === 'form'} onClick={() => onView('form')}>Form view</button>
              <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => onView('list')}>List view</button>
            </div>
          )}
          <button type="button" className="gf-x gf-panel-x" ref={closeRef} onClick={onClose} aria-label="Close the form"><FaXmark /></button>
        </div>
        <div className="gf-panel-body" ref={bodyRef}>
          {paper && view === 'form' ? <OriginalForm proposal={proposal} /> : <ListView proposal={proposal} form={form} />}
        </div>
      </aside>
    </div>,
    document.body
  );
};

const ListView = ({ proposal, form }) => {
  const data   = proposal.form_data || {};
  const checks = proposal.form_checks || [];
  const done   = STEP_ORDER.map((role) => ({ role, step: form.steps[role], check: checks.find((c) => c.role === role) }))
    .filter((s) => s.check && s.step);

  /* in the order of the form: short answers side by side, long ones across the width */
  const runs = [];
  form.fields.filter((f) => data[f.k]).forEach((f) => {
    const long = LONG.includes(f.type);
    const last = runs[runs.length - 1];
    if (!long && last && !last.long) last.fields.push(f);
    else runs.push({ long, fields: [f] });
  });
  const leader = form.no === '005' ? ((data.proponents || [])[0] || {}).name : '';
  /* (15) and (16) of Form 005, placed before (17) like the paper */
  const paperEnd = (
    <>
      <dl className="gf-view-grid gf-view-long">
        <div><dt>(15) Submitted by</dt><dd>{leader || '—'}{leader ? ', Project Leader' : ''}</dd></div>
        <div><dt>Date submitted</dt><dd>{proposal.submitted_at ? new Date(proposal.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</dd></div>
      </dl>
      <div className="gf-view-long">
        <p className="gf-view-label">(16) Curriculum Vitae of Proponent(s)</p>
        <p className="gf-view-text">Attached as a document (see Documents).</p>
      </div>
    </>
  );

  return (
    <div className="gf-view">
      <p className="gf-view-no">{formLabel(form)}</p>
      <p className="gf-view-name">{form.name}</p>
      {proposal.title && (
        <div className="gf-view-long first">
          <p className="gf-view-label">{form.titleLabel || 'Title'}</p>
          <p className="gf-view-text">{proposal.title}</p>
        </div>
      )}
      {runs.map((run) => (run.long ? (
        <React.Fragment key={run.fields[0].k}>
          {form.no === '005' && run.fields[0].k === 'duties' && paperEnd}
          <div className="gf-view-long">
            <p className="gf-view-label">{run.fields[0].label}</p>
            <LongValue f={run.fields[0]} v={data[run.fields[0].k]} />
          </div>
        </React.Fragment>
      ) : (
        <dl key={run.fields[0].k} className="gf-view-grid gf-view-long">
          {run.fields.map((f) => (
            <div key={f.k}><dt>{f.label}</dt><dd>{showValue(f, data[f.k])}</dd></div>
          ))}
        </dl>
      )))}
      {form.no === '005' && !data.duties && paperEnd}

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