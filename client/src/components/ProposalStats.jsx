import React, { useMemo, useState } from 'react';
import { STATUS_LABEL, STATUS_ORDER, TYPE_LABEL } from '../utils/terms';
import './ProposalStats.css';

/* ─────────────────────────────────────────────────────────────
   Proposal Statistics: a dashboard section built from the proposals
   the person can already see (no extra request to the server).
     <ProposalStats proposals={list} groupBy="college" />
   groupBy: 'college' (MSIRC offices), 'department' (the Dean),
            or null (Chairperson, Coordinator, Researcher: no group chart)
   ───────────────────────────────────────────────────────────── */

const TYPE_LABELS = TYPE_LABEL;
const TYPE_ORDER = Object.keys(TYPE_LABELS);
const OPEN       = ['for_endorsement', 'submitted', 'under_review', 'endorsed', 'returned'];
const MONTHS     = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const YEARS_SHOWN = 5;

const whenOf = (p) => p.submitted_at || p.created_at || null;
const yearOf = (p) => (whenOf(p) ? new Date(whenOf(p)).getFullYear() : null);
const pct    = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* small hover note that follows the mouse */
const useTip = () => {
  const [tip, setTip] = useState(null);
  const bind = (title, text) => ({
    onMouseMove:  (e) => setTip({ x: e.clientX + 14, y: e.clientY + 14, title, text }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip && (
    <div className="ps-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      <b>{tip.title}</b>{tip.text}
    </div>
  );
  return [bind, node];
};

const HBars = ({ rows, total, bind, unit = 'proposal' }) => {
  const max = Math.max(1, ...rows.map(r => r.count));
  if (!total) return <div className="ps-empty">No proposals yet.</div>;
  return (
    <ul className="ps-hbars">
      {rows.map(r => (
        <li key={r.name} className="ps-hbar" tabIndex={0}
          aria-label={`${r.name}: ${r.count}`}
          {...bind(r.name, `${r.count} ${unit}${r.count === 1 ? '' : 's'} · ${pct(r.count, total)}% of ${total}`)}>
          <span className="ps-hbar-name">{r.name}</span>
          <span className="ps-hbar-track">
            <span className="ps-hbar-bar" style={{ width: `${(r.count / max) * 82}%` }} />
            <span className="ps-hbar-val">{r.count}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

const Columns = ({ cols, bind, caption }) => {
  const top = Math.max(1, ...cols.map(c => c.count));
  return (
    <>
      <div className="ps-cols" role="img" aria-label={caption}>
        {[25, 50, 75].map(p => <div key={p} className="ps-gridline" style={{ bottom: `${p}%` }} />)}
        {cols.map(c => (
          <div key={c.key} className="ps-col" tabIndex={0} {...bind(c.long || c.label, `${c.count} proposal${c.count === 1 ? '' : 's'}`)}>
            <span className="ps-col-cap">{c.count}</span>
            <div className="ps-col-bar" style={{ height: `${(c.count / top) * 88}%` }} />
          </div>
        ))}
      </div>
      <div className="ps-xlabels">{cols.map(c => <span key={c.key}>{c.label}</span>)}</div>
    </>
  );
};

const ProposalStats = ({ proposals = [], groupBy = 'college', title = 'Proposal Statistics' }) => {
  const [year, setYear] = useState('all');
  const [bind, tipNode] = useTip();

  /* drafts are not submitted, so they are not counted */
  const all = useMemo(() => proposals.filter(p => p.status !== 'draft'), [proposals]);

  const years = useMemo(() => {
    const ys = [...new Set(all.map(yearOf).filter(Boolean))].sort((a, b) => b - a);
    return ys.length ? ys : [new Date().getFullYear()];
  }, [all]);

  const list = year === 'all' ? all : all.filter(p => yearOf(p) === Number(year));
  const total    = list.length;
  const open     = list.filter(p => OPEN.includes(p.status)).length;
  const approved = list.filter(p => p.status === 'approved').length;
  const rejected = list.filter(p => p.status === 'rejected').length;
  const decided  = approved + rejected;

  /* per year (all years) or per month (one year) */
  const cols = year === 'all'
    ? [...years].slice(0, YEARS_SHOWN).reverse().map(y => ({
        key: y, label: String(y), long: `Year ${y}`, count: all.filter(p => yearOf(p) === y).length,
      }))
    : MONTHS.map((m, i) => ({
        key: m, label: m, long: `${m} ${year}`,
        count: list.filter(p => whenOf(p) && new Date(whenOf(p)).getMonth() === i).length,
      }));

  /* the older combined type is listed only if some records still use it */
  const typeOrder = TYPE_ORDER.filter(t => t !== 'travel_oral' || all.some(p => p.proposal_type === t));
  const byType = typeOrder.map(t => ({ name: TYPE_LABELS[t], count: list.filter(p => p.proposal_type === t).length }));
  const byStatus = STATUS_ORDER
    .map(s => ({ name: STATUS_LABEL[s], count: list.filter(p => p.status === s).length }))
    .filter(r => r.count > 0);

  let byGroup = null;
  if (groupBy) {
    const counts = {};
    list.forEach(p => { const g = p[groupBy] || 'Not set'; counts[g] = (counts[g] || 0) + 1; });
    const sorted = Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    byGroup = sorted.length > 7
      ? [...sorted.slice(0, 6), { name: `Other ${groupBy === 'college' ? 'colleges' : 'departments'}`, count: sorted.slice(6).reduce((a, r) => a + r.count, 0) }]
      : sorted;
  }

  /* type x year table (always all years, so the years can be compared) */
  const tableYears = [...years].slice(0, YEARS_SHOWN).reverse();
  const cell = (t, y) => all.filter(p => p.proposal_type === t && yearOf(p) === y).length;
  const cellMax = Math.max(1, ...typeOrder.flatMap(t => tableYears.map(y => cell(t, y))));
  const shade = (n) => (n ? `rgba(141, 27, 45, ${0.08 + (n / cellMax) * 0.42})` : 'transparent');

  return (
    <section className="ps" aria-labelledby="ps-title">
      <div className="ps-head">
        <div>
          <h2 id="ps-title">{title}</h2>
          <p>Drafts are not counted. Dates are when each proposal was submitted.</p>
        </div>
        <label className="ps-field">
          Year
          <select value={year} onChange={e => setYear(e.target.value)}>
            <option value="all">All years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <div className="ps-kpis">
        <div className="ps-tile">
          <div className="ps-tile-label">Total Proposals</div>
          <div className="ps-tile-value">{total}</div>
          <div className="ps-tile-sub">{year === 'all' ? 'all years' : `submitted in ${year}`}</div>
        </div>
        <div className="ps-tile">
          <div className="ps-tile-label">In Progress</div>
          <div className="ps-tile-value">{open}</div>
          <div className="ps-tile-sub">still being reviewed or returned</div>
        </div>
        <div className="ps-tile">
          <div className="ps-tile-label">Approved</div>
          <div className="ps-tile-value">{approved}</div>
          <div className="ps-tile-sub">{rejected} rejected</div>
        </div>
        <div className="ps-tile">
          <div className="ps-tile-label">Approval Rate</div>
          <div className="ps-tile-value">{decided ? `${pct(approved, decided)}%` : '—'}</div>
          <div className="ps-tile-sub">{decided ? `${approved} of ${decided} decided` : 'nothing decided yet'}</div>
        </div>
      </div>

      <div className="ps-grid">
        <div className="ps-card">
          <h3>{year === 'all' ? 'Proposals per Year' : `Proposals per Month, ${year}`}</h3>
          <div className="ps-card-sub">{year === 'all' ? `Submitted each year, last ${Math.min(YEARS_SHOWN, years.length)} years` : 'Submitted each month of the year'}</div>
          <Columns cols={cols} bind={bind} caption={year === 'all' ? 'Proposals per year' : `Proposals per month in ${year}`} />
        </div>
        <div className="ps-card">
          <h3>By Proposal Type</h3>
          <div className="ps-card-sub">Research, grants and incentives{year === 'all' ? '' : `, ${year}`}</div>
          <HBars rows={byType} total={total} bind={bind} />
        </div>
      </div>

      <div className="ps-grid">
        <div className="ps-card">
          <h3>By Status</h3>
          <div className="ps-card-sub">Where these proposals stand right now</div>
          <HBars rows={byStatus} total={total} bind={bind} />
        </div>
        {byGroup ? (
          <div className="ps-card">
            <h3>{groupBy === 'college' ? 'By College' : 'By Department'}</h3>
            <div className="ps-card-sub">{groupBy === 'college' ? 'Top 6 colleges, the rest grouped together' : 'Departments of your college'}</div>
            <HBars rows={byGroup} total={total} bind={bind} />
          </div>
        ) : (
          <div className="ps-card">
            <h3>Decisions</h3>
            <div className="ps-card-sub">Approved and rejected{year === 'all' ? '' : `, ${year}`}</div>
            <HBars rows={[{ name: 'Approved', count: approved }, { name: 'Rejected', count: rejected }, { name: 'Not decided yet', count: total - decided }]} total={total} bind={bind} />
          </div>
        )}
      </div>

      <div className="ps-card ps-table-card">
        <h3>Proposal Type by Year</h3>
        <div className="ps-card-sub">How many of each type were submitted each year. Darker cells mean more proposals.</div>
        <div className="ps-scroll">
          <table className="ps-table">
            <thead>
              <tr>
                <th scope="col">Proposal Type</th>
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
                    <th scope="row">{TYPE_LABELS[t]}</th>
                    {row.map((n, i) => (
                      <td key={tableYears[i]} style={{ background: shade(n) }}
                        {...bind(`${TYPE_LABELS[t]}, ${tableYears[i]}`, `${n} proposal${n === 1 ? '' : 's'}`)}>
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
      {tipNode}
    </section>
  );
};

export default ProposalStats;