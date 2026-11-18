import React, { useMemo, useState } from 'react';
import { TYPE_LABEL, RESEARCH_TYPES, GRANT_TYPES } from '../utils/terms';
import './ProposalStats.css';

/* ─────────────────────────────────────────────────────────────
   Submission Statistics: a dashboard section built from the proposals
   the person can already see (no extra request to the server).
     <ProposalStats proposals={list} groupBy="college" />
   groupBy: 'college' (MSIRC offices), 'department' (College Dean and Coordinator),
            or null (College Chairperson: no group chart)

   One picture per question, nothing repeated:
     Where they stand   total, one bar split by stage, and the approval rate
     When               submissions per month (one year) or per year
     What               each type in its own color
     Who                by college or department
     Type by year       only when there are two or more years to compare
   ───────────────────────────────────────────────────────────── */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS_SHOWN = 5;

/* each type keeps its own color everywhere (fixed order, checked for color blindness) */
export const OFFERED = [...RESEARCH_TYPES, ...GRANT_TYPES];
export const TYPE_COLOR = {
  research_spotlight:    '#2a78d6',
  internally_funded:     '#eb6834',
  travel_subsidy:        '#1baf7a',
  oral_presentation:     '#eda100',
  publication_incentive: '#e87ba4',
};
export const OLD_TYPE_COLOR = '#8a8a86';     // types no longer offered, shown only if records still use them

/* where a submission stands, in the order it moves */
const STAGES = [
  { k: 'college',  label: 'With the college', color: '#2a78d6', statuses: ['for_endorsement'] },
  { k: 'msirc',    label: 'With MSIRC',       color: '#6250d6', statuses: ['submitted', 'under_review', 'endorsed'] },
  { k: 'returned', label: 'Returned',         color: '#eda100', statuses: ['returned'] },
  { k: 'approved', label: 'Approved',         color: '#0ca30c', statuses: ['approved'] },
  { k: 'rejected', label: 'Rejected',         color: '#d03b3b', statuses: ['rejected'] },
];
/* { status: count } -> the five stages with their counts */
export const stagesOf = (byStatus = {}) => STAGES.map(s => ({ ...s, count: s.statuses.reduce((a, st) => a + (Number(byStatus[st]) || 0), 0) }));

const whenOf = (p) => p.submitted_at || p.created_at || null;
const yearOf = (p) => (whenOf(p) ? new Date(whenOf(p)).getFullYear() : null);
const pct    = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const plural = (n, w = 'submission') => `${n} ${w}${n === 1 ? '' : 's'}`;

/* small hover note that follows the mouse */
export const useTip = () => {
  const [tip, setTip] = useState(null);
  const bind = (title, text) => ({
    onMouseMove:  (e) => setTip({ x: e.clientX + 14, y: e.clientY + 14, title, text }),
    onMouseLeave: () => setTip(null),
    onBlur:       () => setTip(null),
  });
  const node = tip && (
    <div className="ps-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      <b>{tip.title}</b>{tip.text}
    </div>
  );
  return [bind, node];
};

/* horizontal bars, each row its own color (or one color for all) */
export const HBars = ({ rows, total, bind, color }) => {
  const max = Math.max(1, ...rows.map(r => r.count));
  if (!total) return <div className="ps-empty">Nothing submitted yet.</div>;
  return (
    <ul className="ps-hbars">
      {rows.map(r => (
        <li key={r.name} className="ps-hbar" tabIndex={0} aria-label={`${r.name}: ${r.count}`}
          {...bind(r.name, `${plural(r.count)} · ${pct(r.count, total)}% of ${total}`)}>
          <span className="ps-hbar-name">
            <i className="ps-dot" style={{ background: r.color || color }} aria-hidden="true" />{r.name}
          </span>
          <span className="ps-hbar-track">
            <span className="ps-hbar-bar" style={{ width: `${Math.max(r.count ? 3 : 0, (r.count / max) * 82)}%`, background: r.color || color }} />
            <span className="ps-hbar-val">{r.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

/* columns over time, one color */
export const Columns = ({ cols, bind, caption }) => {
  const top = Math.max(1, ...cols.map(c => c.count));
  return (
    <>
      <div className="ps-cols" role="img" aria-label={caption}>
        {[25, 50, 75].map(p => <div key={p} className="ps-gridline" style={{ bottom: `${p}%` }} />)}
        {cols.map(c => (
          <div key={c.key} className="ps-col" tabIndex={0} {...bind(c.long || c.label, plural(c.count))}>
            {c.count > 0 && <span className="ps-col-cap">{c.count}</span>}
            <div className={`ps-col-bar${c.count ? '' : ' zero'}`} style={{ height: `${(c.count / top) * 86}%` }} />
          </div>
        ))}
      </div>
      <div className="ps-xlabels">{cols.map(c => <span key={c.key}>{c.label}</span>)}</div>
    </>
  );
};

/* the approval rate as a ring */
export const Ring = ({ value, label }) => {
  const r = 34; const c = 2 * Math.PI * r;
  return (
    <svg className="ps-ring" viewBox="0 0 84 84" role="img" aria-label={label}>
      <circle cx="42" cy="42" r={r} className="ps-ring-bg" />
      {value > 0 && (
        <circle cx="42" cy="42" r={r} className="ps-ring-fg"
          strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 42 42)" />
      )}
      <text x="42" y="47" textAnchor="middle" className="ps-ring-text">{label === 'none' ? '—' : `${value}%`}</text>
    </svg>
  );
};

/* Where they stand: the total, one bar split by stage, and the approval rate.
   extra: one more figure on the right (the Administrator's average days to a decision) */
export const StageOverview = ({ total, totalLabel, stages, bind, extra = null }) => {
  const approved = stages.find(s => s.k === 'approved').count;
  const decided = approved + stages.find(s => s.k === 'rejected').count;
  return (
    <div className={`ps-card ps-overview${extra ? ' has-extra' : ''}`}>
      <div className="ps-ov-total">
        <span className="ps-ov-num">{total}</span>
        <span className="ps-ov-label">{totalLabel}</span>
      </div>
      <div className="ps-ov-stages">
        <h3>Where they stand</h3>
        {total ? (
          <>
            <div className="ps-stack" role="img"
              aria-label={stages.filter(s => s.count).map(s => `${s.label} ${s.count}`).join(', ')}>
              {stages.filter(s => s.count).map(s => (
                <span key={s.k} className="ps-seg" tabIndex={0} style={{ flexGrow: s.count, background: s.color }}
                  aria-label={`${s.label}: ${plural(s.count)}, ${pct(s.count, total)}%`}
                  {...bind(s.label, `${plural(s.count)} · ${pct(s.count, total)}%`)} />
              ))}
            </div>
            <ul className="ps-legend">
              {stages.map(s => (
                <li key={s.k} className={s.count ? '' : 'none'}>
                  <i style={{ background: s.color }} aria-hidden="true" />
                  <span>{s.label}</span><b>{s.count}</b>
                </li>
              ))}
            </ul>
          </>
        ) : <div className="ps-empty">Nothing submitted yet.</div>}
      </div>
      <div className="ps-ov-rate">
        <Ring value={pct(approved, decided)} label={decided ? `${pct(approved, decided)}% approved` : 'none'} />
        <div>
          <span className="ps-ov-label strong">Approval rate</span>
          <span className="ps-ov-label">{decided ? `${approved} of ${decided} decided` : 'nothing decided yet'}</span>
        </div>
      </div>
      {extra && <div className="ps-ov-extra">{extra}</div>}
    </div>
  );
};

const ProposalStats = ({ proposals = [], groupBy = 'college', title = 'Submission Statistics' }) => {
  const [year, setYear] = useState('all');
  const [bind, tipNode] = useTip();

  /* drafts are not submitted, so they are not counted */
  const all = useMemo(() => proposals.filter(p => p.status !== 'draft'), [proposals]);

  const years = useMemo(() => {
    const ys = [...new Set(all.map(yearOf).filter(Boolean))].sort((a, b) => b - a);
    return ys.length ? ys : [new Date().getFullYear()];
  }, [all]);

  const list = year === 'all' ? all : all.filter(p => yearOf(p) === Number(year));
  const total = list.length;
  const byStatus = {};
  list.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
  const stages = stagesOf(byStatus);

  /* per month when one year is shown (or all the records are from one year), otherwise per year */
  const oneYear = year !== 'all' ? Number(year) : (years.length === 1 ? years[0] : null);
  const cols = oneYear
    ? MONTHS.map((m, i) => ({
        key: m, label: m, long: `${m} ${oneYear}`,
        count: all.filter(p => yearOf(p) === oneYear && new Date(whenOf(p)).getMonth() === i).length,
      }))
    : [...years].slice(0, YEARS_SHOWN).reverse().map(y => ({
        key: y, label: String(y), long: `Year ${y}`, count: all.filter(p => yearOf(p) === y).length,
      }));

  /* the types offered now, plus an older type only if some records still use it */
  const typeOrder = Object.keys(TYPE_LABEL).filter(t => OFFERED.includes(t) || all.some(p => p.proposal_type === t));
  const byType = typeOrder.map(t => ({
    name: TYPE_LABEL[t], color: TYPE_COLOR[t] || OLD_TYPE_COLOR, count: list.filter(p => p.proposal_type === t).length,
  }));

  let byGroup = null;
  if (groupBy) {
    const counts = {};
    list.forEach(p => { const g = p[groupBy] || 'Not set'; counts[g] = (counts[g] || 0) + 1; });
    const sorted = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    byGroup = sorted.length > 7
      ? [...sorted.slice(0, 6), { name: `Other ${groupBy === 'college' ? 'colleges' : 'departments'}`, count: sorted.slice(6).reduce((a, r) => a + r.count, 0) }]
      : sorted;
  }

  /* type x year table: only worth showing with two or more years */
  const tableYears = [...years].slice(0, YEARS_SHOWN).reverse();
  const cell = (t, y) => all.filter(p => p.proposal_type === t && yearOf(p) === y).length;
  const cellMax = Math.max(1, ...typeOrder.flatMap(t => tableYears.map(y => cell(t, y))));
  const shade = (n) => (n ? `rgba(42, 120, 214, ${0.1 + (n / cellMax) * 0.45})` : 'transparent');

  return (
    <section className="ps" aria-labelledby="ps-title">
      <div className="ps-head">
        <div>
          <h2 id="ps-title">{title}</h2>
          <p>Research proposals and applications together. Drafts are not counted.</p>
        </div>
        <label className="ps-field">
          Year
          <select value={year} onChange={e => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <StageOverview total={total} stages={stages} bind={bind}
        totalLabel={year === 'all' ? 'submitted in total' : `submitted in ${year}`} />

      <div className="ps-grid">
        <div className="ps-card">
          <h3>{oneYear ? `Submissions per Month, ${oneYear}` : 'Submissions per Year'}</h3>
          <div className="ps-card-sub">{oneYear ? 'By the month each one was submitted' : `The last ${Math.min(YEARS_SHOWN, years.length)} years`}</div>
          <Columns cols={cols} bind={bind} caption={oneYear ? `Submissions per month in ${oneYear}` : 'Submissions per year'} />
        </div>
        <div className="ps-card">
          <h3>By Type</h3>
          <div className="ps-card-sub">Research, grants and incentives{year === 'all' ? '' : `, ${year}`}</div>
          <HBars rows={byType} total={total} bind={bind} />
        </div>
      </div>

      {byGroup && (
        <div className="ps-card ps-solo">
          <h3>{groupBy === 'college' ? 'By College' : 'By Department'}</h3>
          <div className="ps-card-sub">{groupBy === 'college' ? 'The top 6 colleges, the rest grouped together' : 'Departments of your college'}</div>
          <HBars rows={byGroup} total={total} bind={bind} color="#1baf7a" />
        </div>
      )}

      {tableYears.length > 1 && (
        <div className="ps-card ps-table-card">
          <h3>Type by Year</h3>
          <div className="ps-card-sub">How many of each type were submitted each year. Darker cells mean more.</div>
          <div className="ps-scroll">
            <table className="ps-table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  {tableYears.map(y => <th key={y} scope="col">{y}</th>)}
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {typeOrder.map(t => {
                  const row = tableYears.map(y => cell(t, y));
                  const sum = all.filter(p => p.proposal_type === t).length;
                  return (
                    <tr key={t}>
                      <th scope="row"><i className="ps-dot" style={{ background: TYPE_COLOR[t] || OLD_TYPE_COLOR }} aria-hidden="true" />{TYPE_LABEL[t]}</th>
                      {row.map((n, i) => (
                        <td key={tableYears[i]} style={{ background: shade(n) }}
                          {...bind(`${TYPE_LABEL[t]}, ${tableYears[i]}`, plural(n))}>
                          {n || <span className="ps-zero">0</span>}
                        </td>
                      ))}
                      <td className="ps-sum">{sum}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">All types</th>
                  {tableYears.map(y => <td key={y}>{all.filter(p => yearOf(p) === y).length}</td>)}
                  <td className="ps-sum">{all.length}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {tipNode}
    </section>
  );
};

export default ProposalStats;