import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { personName } from '../utils/names';
import { budgetTotals, mooeGroups, PLAN_MONTHS, FINANCIAL, personContact } from '../utils/grantForms';
import './OriginalForm.css';

/* ─────────────────────────────────────────────────────────────
   The filled-in MSIRC form, laid out like the original paper form.
     <OriginalForm proposal={p} />   the form on screen, with a Print / Save as PDF button

   Only what is on the paper form is shown. The researcher's answers fill the
   blanks; each office's step box gets the date it signed, its signature, the
   signer's name and what it ticked.
   Printing follows each paper form: Forms 001, 002, 003, 004 and 008 print
   two copies side by side on long bond paper (landscape); Form 005 prints on
   A4; the Research Spotlight prints its extended abstract title page and the
   Certification on letter paper.
   ───────────────────────────────────────────────────────────── */

const IMG = `${process.env.PUBLIC_URL || ''}/forms`;
const PAPER = {
  long:   '13in 8.5in',    // long bond, landscape, two copies
  a4:     'A4 portrait',
  letter: 'letter portrait',
};
const PAPER_OF = { SPOT: 'letter', '005': 'a4' };

/* ── small helpers ── */
const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (v) => {
  if (!v || Number.isNaN(Date.parse(v))) return '';
  return new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const span = (a, b) => {
  if (!a) return '';
  if (!b || a === b) return day(a);
  const x = new Date(a); const y = new Date(b);
  if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) {
    return `${x.toLocaleDateString('en-US', { month: 'short' })} ${x.getDate()} to ${y.getDate()}, ${y.getFullYear()}`;
  }
  return `${day(a)} to ${day(b)}`;
};
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const roundOf = (p) => (Number(p?.revision_count) || 0) + 1;

/* ── building blocks of the paper ── */
const Box = ({ on }) => <span className={`of-cb ${on ? 'on' : ''}`} aria-label={on ? 'checked' : 'not checked'}>{on ? '✓' : ''}</span>;
const Line = ({ v, grow = true, w }) => (
  <span className={`of-v ${grow ? 'grow' : ''}`} style={w ? { minWidth: w } : undefined}>{v || ' '}</span>
);
const Field = ({ label, v, w, full }) => (
  <div className={`of-f ${full ? 'full' : ''}`}><b>{label}</b><Line v={v} w={w} /></div>
);

const Head = ({ no, v = 'v.02-2024' }) => (
  <div className="of-head">
    <img src={`${IMG}/msu-seal.jpg`} alt="MSU seal" className="of-seal" />
    <img src={`${IMG}/msirc-banner.png`} alt="Mamitua Saber Institute of Research and Creation" className="of-banner" />
    {no && <div className="of-no">MSIRC Form No. {no}<br />{v}</div>}
  </div>
);

/* One signer's block inside a step: date, signature, name, title */
const Signer = ({ ctx, role, title, noDate, pad }) => {
  const s = ctx.sig(role);
  return (
    <div className="of-signer">
      {!noDate && <div className="of-date"><b>Date:</b> <Line v={s ? day(s.signed_at) : ''} grow={false} w="9em" /></div>}
      {noDate && pad && <div className="of-date of-date-pad" aria-hidden="true">&nbsp;</div>}
      <div className="of-sigimg">
        {s?.image_data ? <img src={s.image_data} alt={`Signature of ${s.signer_name}`} /> : null}
      </div>
      <div className="of-signame">{s ? String(s.signer_name || '').toUpperCase() : ' '}</div>
      <div className="of-sigrole">{title}</div>
    </div>
  );
};

const Ticks = ({ ctx, role, items }) => (
  <ul className="of-list">
    {items.map(([k, label]) => <li key={k}><Box on={ctx.ticked(role, k)} /> {label}</li>)}
  </ul>
);

/* A step: heading row with an optional right title, then left (signers) and right (checklist) */
const Step = ({ title, right, left, body }) => (
  <>
    <tr className="of-hd"><th>{title}</th>{right !== null && <th className="c">{right}</th>}</tr>
    <tr><td className="of-l" colSpan={right === null ? 2 : 1}>{left}</td>{right !== null && <td className="of-r">{body}</td>}</tr>
  </>
);

/* ── the short forms (001, 002, 003, 004, 008) ── */
const director = (ctx, title = 'Institute Director') => <Signer ctx={ctx} role="msric_director" title={title} />;

const SHORT = {
  '001': {
    title: 'APPLICATION FOR TRAVEL GRANT FOR RESEARCH DISSEMINATION', bor: '(BOR Res. No. 222, s. 2024)',
    info: (c) => [
      ['Name:', c.name], ['Designation', c.d.designation],
      ['College/Unit:', c.college], ['Department:', c.dept],
      ['Destination:', c.d.destination], ['Dates:', span(c.d.date_from, c.d.date_to)],
      ['Name of Conference:', c.d.conference, true], ['Title of Research:', c.title, true],
    ],
    steps: (c) => {
      const clr = c.ans('research_coordinator').clearance;
      const rec = c.ans('msric_director').recommendation;
      const chg = c.ans('msric_director').chargeable;
      return [
        ['Step 1. Department (1st Endorsement)', 'Checklist', <Signer ctx={c} role="chairperson" title="Department Chairperson" />,
          <Ticks ctx={c} role="chairperson" items={[['manuscript', 'Full Manuscript'], ['acceptance', 'Acceptance Letter'], ['request', 'Request Letter']]} />],
        ['Step 2. Research Coordinator', 'Checklist', <Signer ctx={c} role="research_coordinator" title="Research Coordinator" />,
          <><div className="of-two">{['REC', 'IBC', 'IACUC', 'None'].map((x) => <span key={x}><Box on={clr === x} /> {x}</span>)}</div>
            <p className="of-note"><i>Note: Check which clearance is applicable.</i></p></>],
        ['Step 3. College/Unit (2nd Endorsement)', 'Checklist', <Signer ctx={c} role="college_dean" title="Dean" />,
          <Ticks ctx={c} role="college_dean" items={[['travel_order', 'Travel Order'], ['itinerary', 'Itinerary of Travel'], ['ors_dv', '4 copies of ORS and DV']]} />],
        ['Step 4. Mamitua Saber Institute of Research & Creation', 'Checklist', <Signer ctx={c} role="special_assistant" title="Special Assistant" />,
          <Ticks ctx={c} role="special_assistant" items={[['so_draft', 'S.O. Draft'], ['inhouse', 'In-house Research Review']]} />],
        ['Step 5. Endorsement to OVCRED', 'Recommendation', director(c),
          <ul className="of-list">
            <li><Box on={rec === 'On official time only'} /> On official time only</li>
            <li><Box on={rec === FINANCIAL} /> With financial assistance
              <div className="of-sub">Chargeable against:</div>
              <div className="of-sub2"><Box on={chg === 'College Funds'} /> College Funds<br /><Box on={chg === 'Research Funds'} /> Research Funds</div>
            </li>
          </ul>],
      ];
    },
  },
  '002': {
    title: 'APPLICATION FOR JOURNAL PUBLICATION INCENTIVE',
    info: (c) => [
      ['Name:', c.name, true], ['College/Unit:', c.college], ['Department:', c.dept],
      ['Publication Title:', c.title, true], ['Journal Name:', c.d.journal, true],
    ],
    row: (c) => [['Volume:', c.d.volume], ['Issue No.:', c.d.issue], ['Pages:', c.d.pages], ['Year Published:', c.d.year]],
    steps: (c) => {
      const sa = c.ans('special_assistant');
      return [
        ['Step 1. Department (1st Endorsement)', 'Checklist', <Signer ctx={c} role="chairperson" title="Department Chairperson" />,
          <Ticks ctx={c} role="chairperson" items={[['request', 'Request Letter from the author'], ['article', '2 copies of the published article'],
            ['bor', 'Copy of BOR Res. No. 327, s. 2024'], ['waiver', 'Consent/Waiver for 2 or more authors']]} />],
        ['Step 2. College/Unit (2nd Endorsement)', 'Checklist',
          <><Signer ctx={c} role="research_coordinator" title="Research Coordinator" /><Signer ctx={c} role="college_dean" title="Dean" noDate /></>,
          <Ticks ctx={c} role="college_dean" items={[['active_duty', 'On active duty at the time of request'],
            ['affiliation', 'Author\'s affiliation in the publication is MSU-Main Campus, Marawi City'], ['ors_dv', '4 copies of ORS and DV']]} />],
        ['Step 3. Mamitua Saber Institute of Research & Creation (Indexing Database)', null, null, null, true,
          <div className="of-split">
            <Signer ctx={c} role="special_assistant" title="Special Assistant" />
            <div>
              <ul className="of-list"><li><Box on={!!sa.index} /> SCOPUS Index
                <div className="of-sub2"><Box on={sa.index === 'Journal'} /> Journal<br /><Box on={sa.index === 'Conference Proceeding'} /> Conference Proceeding</div></li></ul>
              <div>Quartile Rank: <Line v={sa.quartile} grow={false} w="5em" /></div>
              <div><i>Recommendation:</i></div>
              <ul className="of-list"><li><Box on={!!sa.amount} /> Eligible for Incentive &nbsp; Amount: <Line v={sa.amount ? peso(sa.amount) : ''} grow={false} w="7em" /></li>
                <li><Box on={false} /> Not Eligible</li></ul>
            </div>
          </div>],
        ['Step 4. Endorsement to OVCRED', null, null, null, true, director(c)],
      ];
    },
  },
  '003': {
    title: 'APPLICATION FOR INTERNATIONAL PRESENTATION CASH INCENTIVE',
    info: (c) => [
      ['Name:', c.name, true], ['College/Unit:', c.college], ['Department:', c.dept],
      ['Presentation Title:', c.title, true], ['Presented at:', c.d.conference], ['on:', day(c.d.date_presented)],
      ['Conference Organizer:', c.d.organizer, true],
    ],
    steps: (c) => {
      const sa = c.ans('special_assistant');
      return [
        ['Step 1. Department (1st Endorsement)', 'Checklist', <Signer ctx={c} role="chairperson" title="Department Chairperson" />,
          <Ticks ctx={c} role="chairperson" items={[['request', 'Request Letter from the author'], ['article', '2 copies of the presentation article'],
            ['bor', 'Copy of BOR Res. No. 272, s. 2019'], ['waiver', 'Consent/Waiver for 2 or more authors']]} />],
        ['Step 2. College/Unit (2nd Endorsement)', 'Checklist',
          <><Signer ctx={c} role="research_coordinator" title="Research Coordinator" /><Signer ctx={c} role="college_dean" title="Dean" noDate /></>,
          <Ticks ctx={c} role="college_dean" items={[['active_duty', 'On active duty at the time of request'],
            ['certificate', 'Certificate of presentation (Spotlight & International Conference)'], ['so', 'S.O (Special Order)'], ['ors_dv', '4 copies of ORS and DV']]} />],
        ['Step 3. Mamitua Saber Research Center (Indexing Database)', null, null, null, true,
          <div className="of-split">
            <div>
              <ul className="of-list">
                <li>Research Date Started <Line v={day(sa.date_started)} grow={false} w="7em" /></li>
                <li>Date Ended <Line v={day(sa.date_ended)} grow={false} w="7em" /></li>
                <li>Funding Institution <Line v={sa.funding} grow={false} w="9em" /></li>
              </ul>
              <Signer ctx={c} role="special_assistant" title="Special Assistant" />
            </div>
            <div>
              <ul className="of-list">
                <li>Amount of Fund <Line v={sa.fund_amount ? peso(sa.fund_amount) : ''} grow={false} w="8em" /></li>
                <li>Email Add <Line v={c.email} grow={false} w="9em" /></li>
                <li>Contact Number <Line v={c.phone} grow={false} w="8em" /></li>
              </ul>
              <div><i>Recommendation:</i></div>
              <ul className="of-list"><li><Box on={!!sa.amount} /> Eligible for Incentive &nbsp; <i>Amount:</i> <Line v={sa.amount ? peso(sa.amount) : ''} grow={false} w="7em" /></li>
                <li><Box on={false} /> Not Eligible</li></ul>
            </div>
          </div>],
        ['Step 4. Endorsement to OVCRED', null, null, null, true, director(c, 'Director of Research')],
      ];
    },
  },
  '004': {
    title: 'APPLICATION FOR BOOK & BOOK CHAPTER PUBLICATION INCENTIVES',
    info: (c) => [
      ['Name:', c.name, true], ['College/Unit:', c.college], ['Department:', c.dept],
      [c.d.kind === 'Book Chapter' ? 'Book Chapter Title:' : 'Book Title:', c.title, true],
      ['Publisher:', c.d.publisher], ['Year:', c.d.year],
    ],
    steps: (c) => {
      const sa = c.ans('special_assistant');
      return [
        ['Step 1. Department (1st Endorsement)', 'Checklist', <Signer ctx={c} role="chairperson" title="Department Chairperson" />,
          <Ticks ctx={c} role="chairperson" items={[['request', 'Request Letter from the author'], ['book', '2 copies of the Book'],
            ['bor', 'Copy of BOR Res. No. 223, s. 2024'], ['waiver', 'Consent/Waiver for 2 or more authors'],
            ['active_duty', 'On active duty at the time of request'], ['ors_dv', '4 copies of ORS and DV']]} />],
        ['Step 2. College/Unit (2nd Endorsement)', null, null, null, true,
          <div className="of-pair"><Signer ctx={c} role="research_coordinator" title="Research Coordinator" /><Signer ctx={c} role="college_dean" title="Dean" noDate pad /></div>],
        ['Step 3. Mamitua Saber Institute of Research & Creation (Indexing Database)', '', <Signer ctx={c} role="special_assistant" title="Special Assistant" />,
          <Ticks ctx={c} role="special_assistant" items={[['recognition', 'Certificate of CHED and DepEd Recognition or ISBN Directory of the National Library of the Philippines'],
            ['schools', 'Certification from at least two DepEd Schools or SUCs (outside MSU System) utilizes the book'], ['textbook', 'Endorsed by the University Textbook Board']]} />],
        ['Step 4. Endorsement to OVCRED', '', director(c),
          <><div><i>Recommendation:</i></div>
            <ul className="of-list"><li><Box on={!!sa.amount} /> Eligible for Incentive &nbsp; <i>Amount:</i> <Line v={sa.amount ? peso(sa.amount) : ''} grow={false} w="7em" /></li>
              <li><Box on={false} /> Not Eligible</li></ul></>],
      ];
    },
  },
  '008': {
    title: 'APPLICATION FOR TRAVEL AUTHORITY FOR CONFERENCE ATTENDANCE', v: 'v.01-2025',
    info: (c) => [
      ['Name:', c.name], ['Designation', c.d.designation],
      ['College/Unit:', c.college], ['Department:', c.dept],
      ['Destination:', c.d.destination], ['Dates:', span(c.d.date_from, c.d.date_to)],
      ['Name of Conference:', c.title, true],
    ],
    steps: (c) => {
      const dr = c.ans('msric_director');
      return [
        ['Step 1. Department (1st Endorsement)', 'Checklist', <Signer ctx={c} role="chairperson" title="Department Chairperson" />,
          <Ticks ctx={c} role="chairperson" items={[
            ['request', 'Request letter explaining the relevance of the conference to the applicant\'s academic or research interests'],
            ['invitation', 'Invitation letter or proof of registration from the conference organizers'],
            ['call', 'Official call or announcement of the conference'],
            ['active_duty', 'Applicant is on active duty at the time of the request'], ['ors_dv', '4 copies of ORS and DV']]} />],
        ['Step 2. College/Unit (2nd Endorsement)', null, null, null, true,
          <div className="of-pair"><Signer ctx={c} role="research_coordinator" title="Research Coordinator" /><Signer ctx={c} role="college_dean" title="Dean" noDate pad /></div>],
        ['Step 3. Mamitua Saber Institute of Research & Creation (Indexing Database)', '', <Signer ctx={c} role="special_assistant" title="Special Assistant" />,
          <Ticks ctx={c} role="special_assistant" items={[['aligned', 'Conference aligns with applicant\'s specialization'],
            ['reputable', 'Conference is organized or endorsed by reputable institutions (e.g., universities, government agencies, professional organizations)']]} />],
        ['Step 4. Endorsement to OVCRED', '', director(c),
          <ul className="of-list">
            <li><Box on={dr.recommendation === 'On official time only'} /> On official time only</li>
            <li><Box on={dr.recommendation === FINANCIAL} /> With financial assistance amounting to <Line v={dr.amount ? peso(dr.amount) : ''} grow={false} w="7em" />, chargeable against College Funds</li>
          </ul>],
      ];
    },
  },
};

const ShortForm = ({ ctx }) => {
  const f = SHORT[ctx.no];
  const row = f.row ? f.row(ctx) : null;
  return (
    <div className="of-copy">
      <Head no={ctx.no} v={f.v} />
      <h3 className="of-title">{f.title}</h3>
      {f.bor && <p className="of-bor">{f.bor}</p>}
      <div className="of-info">
        {f.info(ctx).map(([l, v, full]) => <Field key={l} label={l} v={v} full={full} />)}
        {row && <div className="of-row full">{row.map(([l, v]) => <Field key={l} label={l} v={v} />)}</div>}
      </div>
      <table className="of-table">
        <tbody>
          {f.steps(ctx).map(([title, right, left, body, wide, whole]) => (wide ? (
            <React.Fragment key={title}>
              <tr className="of-hd"><th colSpan={2}>{title}</th></tr>
              <tr><td colSpan={2} className="of-l of-whole">{whole}</td></tr>
            </React.Fragment>
          ) : (
            <Step key={title} title={title} right={right} left={left} body={body} />
          )))}
        </tbody>
      </table>
    </div>
  );
};

/* ── Form 005 (A4, several pages) ── */
const Sec = ({ n, title, children, hint }) => (
  <div className="of5-sec">
    <p className="of5-h">({n}) {title}</p>
    {hint && <p className="of5-hint">{hint}</p>}
    <div className="of5-body">{children}</div>
  </div>
);
const Para = ({ v }) => <div className="of5-text">{v || ' '}</div>;

const Form005 = ({ ctx }) => {
  const d = ctx.d;
  const plan = Array.isArray(d.workplan) ? d.workplan : [];
  const b = d.budget || {};
  const t = budgetTotals(b);
  const rows = (list) => (list || []).filter((r) => r.item || r.amount);
  const groups = mooeGroups(rows(b.mooe));
  const own = ctx.sig('researcher');            // (15): the Project Leader's signature, this round
  return (
    <div className="of5">
      <div className="of5-page">
        <Head no="005" />
        <h3 className="of-title">APPLICATION FORM</h3>
        <p className="of5-sub">MSU – Main Campus Research and Development Grant</p>
        <p className="of-bor">(BOR Res. No. 221, s. 2024)</p>
        <div className="of5-frame">
          <Sec n={1} title="Project Title"><Para v={ctx.title} /></Sec>
          <Sec n={2} title="Proponent(s)">
            {(d.proponents || []).map((p, i) => <div key={i} className="of5-text"><b>Name:</b> {p.name}<br /><b>Contact Details:</b> {personContact(p)}</div>)}
          </Sec>
          <Sec n={3} title="Executive Summary"><Para v={d.summary} /></Sec>
          <Sec n={4} title="Introduction"><Para v={d.introduction} /></Sec>
          <Sec n={5} title="Objectives"><Para v={d.objectives} /></Sec>
          <Sec n={6} title="Significance of the Study"><Para v={d.significance} /></Sec>
          <Sec n={7} title="Expected Output"><Para v={d.output} /></Sec>
          <Sec n={8} title="R&D PRIORITY AREA & PROGRAM"><Para v={[d.priority, d.program].filter(Boolean).join('\nProgram: ')} /></Sec>
          <Sec n={9} title="Review or Related Literature"><Para v={d.literature} /></Sec>
          <Sec n={10} title="Methodology">
            <Para v={d.methodology} />
            <p className="of5-note"><b>Note:</b> Obtain review and clearance from the relevant research review committees, such as
              the MSU Marawi Research Ethics Committee (MSUM_REC), Institutional Biosafety Committee (MSUM_IBC), or Institutional
              Animal Care and Use Committee (MSUM_IACUC).</p>
            <div className="of5-text"><b>Clearance needed:</b> {d.clearance || 'None'}</div>
          </Sec>
        </div>
      </div>

      <div className="of5-page">
        <Head no="005" />
        <div className="of5-frame">
          <Sec n={11} title="References"><Para v={d.references} /></Sec>
          <Sec n={12} title={<>Activities or Work Plan <span className="of5-light">(Implementation Schedule Duration: <b>{PLAN_MONTHS} months</b>)</span></>}>
            <p className="of5-small">Major Activities (per month of implementation)</p>
            <table className="of5-grid">
              <thead><tr><th>Monthly Activities</th>{Array.from({ length: PLAN_MONTHS }, (_, i) => <th key={i}>{i + 1}</th>)}</tr></thead>
              <tbody>
                {(plan.length ? plan : [{}, {}, {}]).map((a, i) => (
                  <tr key={i}><td>{a.activity || ' '}</td>
                    {Array.from({ length: PLAN_MONTHS }, (_, m) => <td key={m} className="c">{(a.months || []).includes(m + 1) ? 'X' : ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </Sec>
          <Sec n={13} title={<>Estimated Budget <span className="of5-blue">(maximum of PhP 50,000.00)</span></>}>
            <table className="of5-grid of5-budget">
              <thead><tr><th>ITEMS</th><th>AMOUNT IN PHILIPPINE PESO</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <b>Personal Services (PS)</b>
                    <span className="of5-cell-note">(Should not exceed 45% of the MOOE; No Honoraria for project leader/member; RELE only)</span>
                    {rows(b.ps).map((r, i) => <span key={i} className="of5-cell-line">{r.item}{r.unit ? ` (${r.unit})` : ''}</span>)}
                  </td>
                  <td className="n">{peso(t.ps)}</td>
                </tr>
                <tr>
                  <td>
                    <b>Maintenance and other Operating expenses (MOOE)</b>
                    <span className="of5-cell-note">Travel/per diem/food allowance; Supplies &amp; Materials (Glass wares/chemicals/supplies)</span>
                    {groups.map((g) => (
                      <span key={g.k} className="of5-cell-line of5-cell-amt"><span>{g.label}</span><span>{peso(g.total)}</span></span>
                    ))}
                  </td>
                  <td className="n">{peso(t.mooe)}</td>
                </tr>
                <tr className="of5-tot"><td>TOTAL</td><td className="n">{peso(t.total)}</td></tr>
              </tbody>
            </table>
          </Sec>
        </div>
      </div>

      <div className="of5-page">
        <Head no="005" />
        <div className="of5-frame">
          <Sec n={14} title="Line Item Budget (Detailed Breakdown of Expenditures)">
            <table className="of5-grid of5-budget">
              <thead><tr><th>LINE ITEM BUDGET</th><th>Unit Amount</th><th>Amount in PhP</th></tr></thead>
              <tbody>
                <tr className="of5-tot"><td colSpan={3}>PERSONNEL SERVICES</td></tr>
                {rows(b.ps).map((r, i) => <tr key={`p${i}`}><td>{r.item}</td><td>{r.unit}</td><td className="n">{peso(r.amount)}</td></tr>)}
                <tr className="of5-tot"><td>Sub-total for PS</td><td /><td className="n">{peso(t.ps)}</td></tr>
                <tr className="of5-tot"><td colSpan={3}>MOOE</td></tr>
                {groups.map((g) => (
                  <React.Fragment key={g.k}>
                    <tr className="of5-grp"><td colSpan={3}>{g.label}</td></tr>
                    {g.rows.map((r, i) => <tr key={`m${g.k}${i}`}><td className="of5-in">{r.item}</td><td>{r.unit}</td><td className="n">{peso(r.amount)}</td></tr>)}
                    <tr className="of5-sub"><td>Subtotal</td><td /><td className="n">{peso(g.total)}</td></tr>
                  </React.Fragment>
                ))}
                <tr className="of5-tot"><td>Subtotal for MOOE</td><td /><td className="n">{peso(t.mooe)}</td></tr>
                <tr className="of5-tot"><td colSpan={3}>Summary</td></tr>
                <tr><td>Sub-total for PS</td><td /><td className="n">{peso(t.ps)}</td></tr>
                <tr><td>Subtotal for MOOE</td><td /><td className="n">{peso(t.mooe)}</td></tr>
                <tr className="of5-tot"><td>Grand Total</td><td /><td className="n">{peso(t.total)}</td></tr>
              </tbody>
            </table>
          </Sec>
        </div>
      </div>

      <div className="of5-page">
        <Head no="005" />
        <div className="of5-frame">
          <Sec n={15} title="Submitted by:">
            <div className="of5-text of5-sub15">
              <div>
                <span>SIGNATURE:</span>
                <span className="of-v of5-sigline">
                  {own ? <img src={own.image_data} alt={`Signature of ${own.signer_name}`} /> : ' '}
                </span>
              </div>
              <div><span>NAME:</span> <Line v={own ? own.signer_name : ctx.name} grow={false} w="14em" /></div>
              <div><span>DESIGNATION:</span> <Line v="Project Leader" grow={false} w="14em" /></div>
              <div><span>DATE:</span> <Line v={day(own ? own.signed_at : ctx.p.submitted_at)} grow={false} w="14em" /></div>
            </div>
          </Sec>
          <Sec n={16} title="Curriculum Vitae of Proponent(s)">
            <p className="of5-small">Attached as a document (see Documents).</p>
          </Sec>
          <Sec n={17} title="Duties and Responsibilities of the Proponent(s)"><Para v={d.duties} /></Sec>
        </div>
      </div>
    </div>
  );
};

/* ── Research Spotlight: extended abstract title page + Certification ── */
const SpotForm = ({ ctx }) => {
  const d = ctx.d;
  const authors = Array.isArray(d.authors) ? d.authors : [];
  const signedOn = ctx.sig('college_dean')?.signed_at || ctx.sig('chairperson')?.signed_at;
  const dt = signedOn ? new Date(signedOn) : null;
  const signer = (role, title) => <Signer ctx={ctx} role={role} title={title} noDate />;
  return (
    <div className="ofs">
      <div className="ofs-page">
        <Head />
        <p className="ofs-kicker">Research Spotlight · Extended Abstract</p>
        <h3 className="ofs-title">{String(ctx.title || '').toUpperCase()}</h3>
        <p className="ofs-authors">
          {authors.map((a, i) => (
            <React.Fragment key={i}>
              {i > 0 && ', '}
              <span className={a.name === d.presenter ? 'ofs-presenter' : ''}>{a.name}</span><sup>{i + 1}</sup>
            </React.Fragment>
          ))}
        </p>
        {authors.map((a, i) => <p key={i} className="ofs-aff"><sup>{i + 1}</sup>{a.contact}</p>)}
        {d.presenter_contact && <p className="ofs-aff">Email: {d.presenter_contact}</p>}
        <p className="ofs-h">ABSTRACT</p>
        <p className="ofs-abs">{d.abstract}</p>
        <p className="ofs-kw"><b>Keywords:</b> {d.keywords}</p>
        <p className="ofs-kw"><b>Research Cluster:</b> {d.cluster} &nbsp;·&nbsp; <b>Type of Presentation:</b> {d.presentation}</p>
        <p className="of5-small">The full extended abstract is attached as a document.</p>
      </div>

      <div className="ofs-page">
        <Head />
        <h3 className="ofs-cert">C E R T I F I C A T I O N</h3>
        <div className="ofs-certbody">
          <p>This is to certify that Dr./Prof./Mr./Ms. <Line v={ctx.name} grow={false} w="14em" /></p>
          <p>of the College of <Line v={String(ctx.college || '').replace(/^College of /i, '')} grow={false} w="18em" /></p>
          <p>has not yet presented the research paper titled <u className="ofs-u">{ctx.title}</u></p>
          <p>in any conferences/symposia/fora elsewhere. Furthermore, this also certifies that the paper is a product of a research work.</p>
          <p className="ofs-given">Given this <Line v={dt ? ordinal(dt.getDate()) : ''} grow={false} w="3em" /> day of{' '}
            <Line v={dt ? dt.toLocaleDateString('en-US', { month: 'long' }) : ''} grow={false} w="6em" />, {dt ? dt.getFullYear() : '20__'} at MSU Main, Marawi City.</p>
        </div>
        <p className="ofs-endorsed">Endorsed by</p>
        <div className="ofs-three">
          {signer('research_coordinator', 'Research Coordinator')}
          {signer('chairperson', 'Chairman')}
          {signer('college_dean', 'Dean')}
        </div>
        <div className="ofs-dates">
          {['research_coordinator', 'chairperson', 'college_dean'].map((r) => (
            <span key={r}>{ctx.sig(r) ? `Signed ${day(ctx.sig(r).signed_at)}` : ''}</span>
          ))}
        </div>
        </div>

      {d.student === 'Yes' && (
        <div className="ofs-page">
          <Head />
          <h3 className="ofs-cert ofs-waiver">FACULTY WAIVER FORM</h3>
          <p className="ofs-center">(For student thesis entry which is not under a research project of a faculty/adviser/staff)</p>
          <div className="ofs-certbody">
            <p>The undersigned is waiving his/her right to present the paper titled “<u className="ofs-u">{ctx.title}</u>”
              in the MSU Main Campus Research Spotlight. Furthermore, the Research paper will be presented by the Adviser,
              <Line v={d.presenter} grow={false} w="12em" /> as the co-author and participant of the said Research Spotlight.</p>
            <p className="of5-small">The signed waiver is attached as a document.</p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── the context every layout reads ── */
const useCtx = (proposal, sigs, me) => {
  const p = proposal || {};
  const round = roundOf(p);
  const now = (sigs || []).filter((s) => Number(s.round || 1) === round);
  const checks = (p.form_checks || []).filter((c) => Number(c.round || 1) === round);
  const mine = me && Number(me.user_id) === Number(p.user_id);
  const who = p.first_name ? p : (mine ? me : (p.users || p));
  const check = (role) => checks.find((c) => c.role === role) || {};
  return {
    p, no: p.form_no, d: p.form_data || {}, title: p.title,
    name: personName(who), college: who.college || p.college, dept: who.department || p.department,
    email: who.email || p.email, phone: who.contact_number || p.contact_number,
    sig: (role) => now.find((s) => s.signer_role === role) || null,
    ticked: (role, k) => (check(role).ticks || []).includes(k),
    ans: (role) => check(role).answers || {},
  };
};

/* ── the page ── */
export const hasOriginalForm = (proposal) => {
  const no = proposal?.form_no;
  return !!(no && (SHORT[no] || no === '005' || no === 'SPOT'));
};

const Sheet = ({ ctx }) => {
  if (ctx.no === '005') return <Form005 ctx={ctx} />;
  if (ctx.no === 'SPOT') return <SpotForm ctx={ctx} />;
  return <ShortForm ctx={ctx} />;
};

export const OriginalForm = ({ proposal }) => {
  const { user } = useAuth() || {};
  const [sigs, setSigs] = useState([]);
  const [profile, setProfile] = useState(null);   // the researcher's own college and department, on their own pages
  const own = !!user && Number(user.user_id) === Number(proposal?.user_id) && !proposal?.first_name;
  const [printing, setPrinting] = useState(false);
  const id = proposal?.proposal_id;
  const stamp = `${proposal?.status}|${proposal?.endorsement_stage}|${proposal?.revision_count}`;

  useEffect(() => {
    if (!id || proposal?.status === 'draft') { setSigs([]); return undefined; }
    let alive = true;
    API.get(`/proposals/${id}/signatures`)
      .then((res) => { if (alive) setSigs(res.data?.signatures || []); })
      .catch(() => { if (alive) setSigs([]); });
    return () => { alive = false; };
  }, [id, stamp, proposal?.status]);

  useEffect(() => {
    if (!own) return undefined;
    let alive = true;
    API.get('/auth/profile')
      .then((res) => { if (alive) setProfile(res.data?.user || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [own]);

  /* Print: only the form, on the paper size of the original */
  useEffect(() => {
    if (!printing) return undefined;
    const paper = PAPER_OF[proposal?.form_no] || 'long';
    const style = document.createElement('style');
    style.id = 'of-page-size';
    style.textContent = `@page { size: ${PAPER[paper]}; margin: ${paper === 'long' ? '0.3in' : '0.5in'}; }`;
    document.head.appendChild(style);
    document.body.classList.add('of-printing');
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 250);    // let the copies and images render first
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('of-printing');
      style.remove();
    };
  }, [printing, proposal?.form_no]);

  const ctx = useCtx(proposal, sigs, profile ? { ...user, ...profile } : user);
  if (!hasOriginalForm(proposal)) return null;
  const two = !PAPER_OF[proposal.form_no];

  return (
    <div className="of-wrap">
      <div className="of-tools">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setPrinting(true)}>Print / Save as PDF</button>
      </div>
      <div className="of-scroll">
        <div className={`of-paper ${two ? 'of-short' : ''}`}><Sheet ctx={ctx} /></div>
      </div>
      {printing && createPortal(
        <div className={`of-print ${two ? 'of-print-two' : ''}`}>
          <Sheet ctx={ctx} />
          {two && <Sheet ctx={ctx} />}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default OriginalForm;