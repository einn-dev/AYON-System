import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FaFileLines, FaXmark, FaCloudArrowUp, FaCheck, FaRotateLeft, FaFlagCheckered, FaCircleCheck, FaFilePdf, FaFileWord,
} from 'react-icons/fa6';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { SignConfirm } from './Signature';
import { FileButtons, sizeText } from './ProposalFiles';
import { budgetTotals, PLAN_MONTHS } from '../utils/grantForms';
import { personName } from '../utils/names';
import './OriginalForm.css';
import './TerminalReport.css';

/* ─────────────────────────────────────────────────────────────
   Terminal Report (MSIRC Form No. 007) for approved Internally Funded Research.
     The researcher fills in the cover form (most of it comes from Form 005),
     signs as Project Leader and uploads the full report as one file.
     Route: College Dean (endorses and signs) → MSIRC Special Assistant (checks)
            → MSIRC Director (accepts). Accepted: the research is Completed and
            the report is added to its Research Repository entry.
     Any step can return it with a reason; the researcher fixes it and it starts
     again from the College Dean.
   ───────────────────────────────────────────────────────────── */

export const TR_STEPS = [
  { role: 'college_dean',      label: 'College Dean',            status: 'for_dean' },
  { role: 'special_assistant', label: 'MSIRC Special Assistant', status: 'for_validation' },
  { role: 'msric_director',    label: 'MSIRC Director',          status: 'for_director' },
];
export const TR_STATUS = {
  for_dean:       'Waiting for the College Dean',
  for_validation: 'Waiting for the MSIRC Special Assistant',
  for_director:   'Waiting for the MSIRC Director',
  returned:       'Returned for changes',
  accepted:       'Accepted · Research Completed',
};
const ROLE_STATUS = { college_dean: 'for_dean', special_assistant: 'for_validation', msric_director: 'for_director' };
export const canHaveTerminalReport = (p) => p?.proposal_type === 'internally_funded' && p?.status === 'approved';

const MSIRC_AGENCY = 'Mamitua Saber Institute of Research and Creation, MSU-Main Campus, Marawi City';
const ABSTRACT_MAX_WORDS = 250;
const FILE_MAX_MB = 20;
const ALLOWED = ['pdf', 'doc', 'docx'];
const words = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
const short = (v) => (v ? new Date(v).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

/* what Form 005 already says, to start the cover form */
export const prefillFrom = (proposal) => {
  const d = proposal?.form_data || {};
  const total = d.budget ? budgetTotals(d.budget).total : 0;
  return {
    proponents:  (d.proponents || []).map((p) => p.name).filter(Boolean).join(', '),
    months:      String(PLAN_MONTHS),
    start_date:  '',
    end_date:    '',
    agency:      MSIRC_AGENCY,
    amount:      total ? String(total) : '',
    site:        '',
    abstract:    proposal?.description || '',
    keywords:    '',
  };
};

/* ── the paper form, as on MSIRC Form No. 007 ── */
export const Form007Paper = ({ proposal, report }) => {
  const f = report?.form_data || {};
  const sig = (role) => (report?.signatures || []).find((s) => s.role === role);
  const leader = sig('researcher'), dean = sig('college_dean');
  const Sign = ({ s, title }) => (
    <div className="f7-sign">
      <div className="of-sigimg">{s?.image_data ? <img src={s.image_data} alt={`Signature of ${s.signer_name}`} /> : null}</div>
      <div className="f7-signame">{s ? String(s.signer_name || '').toUpperCase() : ' '}</div>
      <div className="f7-sigrole">{title}</div>
    </div>
  );
  const row = (label, value) => <tr><th>{label}</th><td>{value}</td></tr>;
  return (
    <div className="of-paper f7-paper">
      <div className="of-head">
        <img src={`${process.env.PUBLIC_URL || ''}/forms/msu-seal.jpg`} alt="MSU seal" className="of-seal" />
        <img src={`${process.env.PUBLIC_URL || ''}/forms/msirc-banner.png`} alt="Mamitua Saber Institute of Research and Creation" className="of-banner" />
        <div className="of-no">MSIRC Form No. 007<br />v.01-2024</div>
      </div>
      <h3 className="f7-title">TERMINAL REPORT FORM FOR FUNDED RESEARCH</h3>
      <table className="f7-table">
        <tbody>
          {row('Title Page', proposal?.title)}
          {row('Proponents', f.proponents)}
          {row('Project Duration', (
            <>Number of Months: {f.months}<br />Project Start Date: {day(f.start_date)}<br />Project End Date: {day(f.end_date)}</>
          ))}
          {row('Funding Agency', f.agency)}
          {row('Amount of Funds', f.amount ? peso(f.amount) : '')}
          {row('Implementation Site(s)', f.site)}
          {row('Abstract', <div className="f7-long">{f.abstract}</div>)}
          {row('Keywords', f.keywords)}
        </tbody>
      </table>
      <div className="f7-signs">
        <div><b>Submitted by:</b><Sign s={leader} title="Project Leader" /></div>
        <div><b>Endorsed by:</b><Sign s={dean} title="Dean of College / Head of Unit" /></div>
      </div>
      <div className="f7-notes">
        <p><b>Report Contents.</b> This form serves as the cover page for the following sections:</p>
        <ol>
          <li>Table of Contents</li><li>Introduction (Significance)</li><li>Objectives (General and Specific)</li>
          <li>Beneficiaries of the Research Results</li><li>Materials and Methods</li><li>Results and Discussion</li>
          <li>Summary and Conclusions</li><li>Policy Recommendations and Target Recipients/Agencies</li>
          <li>Outputs Generated from the Research Project (e.g., publications, patents, products, policies, students trained, etc.)</li>
          <li>Acknowledgments (the funding agency should be acknowledged)</li><li>Literature Cited / References (in alphabetical order)</li>
        </ol>
        <p><b>Submission Guidelines</b></p>
        <ol>
          <li>Submit two (2) hardbound copies and one (1) electronic copy of the terminal report.</li>
          <li>The cover should be maroon in color.</li>
          <li>The report should be printed on A4-sized bond paper, double-spaced.</li>
          <li>Ensure all tables and figures/photos are properly labeled.</li>
        </ol>
      </div>
    </div>
  );
};

/* ── the steps of the report: Submitted → Dean → Special Assistant → Director → Completed ── */
export const ReportTracker = ({ report }) => {
  const at = report.status === 'accepted' ? 4 : report.status === 'returned' ? -1
    : TR_STEPS.findIndex((s) => s.status === report.status) + 1;
  const steps = [{ label: 'Submitted' }, ...TR_STEPS, { label: 'Completed' }];
  return (
    <ol className="tr-track" aria-label="Terminal report steps">
      {steps.map((s, i) => {
        const done = report.status === 'accepted' ? true : i < at;
        const now = i === at && report.status !== 'accepted';
        return (
          <li key={s.label} className={`${done ? 'done' : ''} ${now ? 'now' : ''}`}>
            <span className="tr-dot">{done ? <FaCheck /> : i + 1}</span>
            <span className="tr-lbl">{s.label}{now && <em>Current</em>}</span>
          </li>
        );
      })}
    </ol>
  );
};

/* ── the cover form card, with Form view in a panel on the right ── */
const ReportCard = ({ proposal, report }) => {
  const [open, setOpen] = useState(false);
  const f = report.form_data || {};
  return (
    <div className="gf-fcard tr-fcard">
      <FaFileLines className="gf-fcard-ic" aria-hidden="true" />
      <div className="gf-fcard-text">
        <span className="gf-fcard-no">MSIRC Form No. 007</span>
        <b>Terminal Report Form for Funded Research</b>
        <small>{[f.months && `${f.months} months`, f.amount && peso(f.amount)].filter(Boolean).join(' · ')}</small>
      </div>
      <div className="gf-fcard-btns">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Form View</button>
      </div>
      {open && createPortal(
        <div className="gf-panel-back" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <aside className="gf-panel" role="dialog" aria-modal="true" aria-label="MSIRC Form No. 007">
            <div className="gf-panel-head">
              <div className="gf-panel-title"><b>MSIRC Form No. 007</b><small>{proposal.title}</small></div>
              <button type="button" className="btn-close" onClick={() => setOpen(false)} aria-label="Close the form"><FaXmark /></button>
            </div>
            <div className="gf-panel-body">
              <div className="of-wrap">
                <div className="of-tools"><button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>Print / Save as PDF</button></div>
                <div className="of-scroll"><Form007Paper proposal={proposal} report={report} /></div>
              </div>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  );
};

const ReportFile = ({ report }) => (report.file_path ? (
  <div className="tr-file">
    {/\.docx?$/i.test(report.file_name || '') ? <FaFileWord className="tr-file-ic word" /> : <FaFilePdf className="tr-file-ic" />}
    <div className="tr-file-text"><b>{report.file_name || 'Terminal report'}</b><small>Full terminal report{report.file_size ? ` · ${sizeText(report.file_size)}` : ''}</small></div>
    <FileButtons path={report.file_path} name={report.file_name} label="terminal report" />
  </div>
) : null);

const History = ({ report }) => (report.history?.length ? (
  <div className="tr-hist">
    <span className="tr-cap">Report history</span>
    <ul>
      {report.history.map((h, i) => (
        <li key={i}>
          <b className={h.action === 'returned' ? 'bad' : ''}>{h.label}</b> by {h.by} · {short(h.at)}
          {h.remarks && <q>{h.remarks}</q>}
        </li>
      ))}
    </ul>
  </div>
) : null);

/* ── the form the researcher fills in (new or after a return) ── */
export const TerminalReportForm = ({ proposal, report, onClose, onDone }) => {
  const [f, setF] = useState(() => ({ ...prefillFrom(proposal), ...(report?.form_data || {}) }));
  const [file, setFile] = useState(null);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const wc = words(f.abstract);
  const hasFile = !!file || !!report?.file_path;

  const pick = (e) => {
    const x = e.target.files?.[0]; e.target.value = '';
    if (!x) return;
    const ext = x.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) return setError('The report must be a PDF, DOC or DOCX file.');
    if (x.size > FILE_MAX_MB * 1024 * 1024) return setError(`The report file is too big. The limit is ${FILE_MAX_MB} MB.`);
    setError(''); setFile(x);
  };

  const problem = () => {
    if (!f.proponents.trim()) return 'Please list the proponents.';
    if (!(Number(f.months) > 0)) return 'Please enter the number of months.';
    if (!f.start_date || !f.end_date) return 'Please enter the project start and end dates.';
    if (f.end_date < f.start_date) return 'The end date cannot be before the start date.';
    if (!f.agency.trim()) return 'Please enter the funding agency.';
    if (!(Number(f.amount) > 0)) return 'Please enter the amount of funds.';
    if (!f.site.trim()) return 'Please enter the implementation site(s).';
    if (!f.abstract.trim()) return 'Please write the abstract.';
    if (wc > ABSTRACT_MAX_WORDS) return `The abstract is ${wc} words. Please keep it to ${ABSTRACT_MAX_WORDS} words or fewer.`;
    if (!f.keywords.trim()) return 'Please enter the keywords.';
    if (!hasFile) return 'Please upload the full terminal report.';
    if (!signed) return 'Please confirm your signature as Project Leader.';
    return '';
  };

  const submit = async () => {
    const p = problem();
    if (p) { setError(p); return; }
    setSaving(true); setError('');
    try {
      const data = new FormData();
      data.append('form_data', JSON.stringify(f));
      data.append('attest', 'true');
      if (file) data.append('report', file);
      await API.post(`/proposals/${proposal.proposal_id}/terminal-report`, data);
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit the terminal report. Please try again.');
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay tr-overlay" onClick={onClose}>
      <div className="modal tr-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Terminal Report">
        <div className="tr-modal-head">
          <span className="tr-formno">MSIRC Form No. 007</span>
          <h3>{report ? 'Fix and Resubmit the Terminal Report' : 'Submit the Terminal Report'}</h3>
          <p className="tr-sub">{proposal.title}</p>
          <button type="button" className="btn-close tr-x" onClick={onClose} aria-label="Close"><FaXmark /></button>
        </div>
        {report?.status === 'returned' && report.return_reason && (
          <div className="rs-returned"><strong>Returned by the {report.returned_by_label || 'office'}</strong><p>{report.return_reason}</p></div>
        )}
        <p className="tr-hint">Most of this cover form is filled in from your approved Form 005. Check it, then add what is still empty.</p>

        <div className="form-group"><label htmlFor="tr-prop">Proponents</label>
          <input id="tr-prop" value={f.proponents} onChange={set('proponents')} /></div>
        <div className="form-row tr-row3">
          <div className="form-group"><label htmlFor="tr-months">Number of Months</label>
            <input id="tr-months" type="number" min="1" value={f.months} onChange={set('months')} /></div>
          <div className="form-group"><label htmlFor="tr-start">Project Start Date</label>
            <input id="tr-start" type="date" value={f.start_date} max={f.end_date || undefined} onChange={set('start_date')} /></div>
          <div className="form-group"><label htmlFor="tr-end">Project End Date</label>
            <input id="tr-end" type="date" value={f.end_date} min={f.start_date || undefined} onChange={set('end_date')} /></div>
        </div>
        <div className="form-group"><label htmlFor="tr-agency">Funding Agency</label>
          <input id="tr-agency" value={f.agency} onChange={set('agency')} />
          <small className="tr-small">Funded under the MSU-Main Research and Development Grant, so MSIRC is already filled in.</small></div>
        <div className="form-row">
          <div className="form-group"><label htmlFor="tr-amount">Amount of Funds (₱)</label>
            <input id="tr-amount" type="number" min="0" step="0.01" value={f.amount} onChange={set('amount')} /></div>
          <div className="form-group"><label htmlFor="tr-site">Implementation Site(s)</label>
            <input id="tr-site" value={f.site} placeholder="e.g. Barangay Raya Madaya, Marawi City" onChange={set('site')} /></div>
        </div>
        <div className="form-group"><label htmlFor="tr-abs">Abstract <span className={`tr-count ${wc > ABSTRACT_MAX_WORDS ? 'bad' : ''}`}>{wc} / {ABSTRACT_MAX_WORDS} words</span></label>
          <textarea id="tr-abs" rows={6} value={f.abstract} onChange={set('abstract')} /></div>
        <div className="form-group"><label htmlFor="tr-kw">Keywords</label>
          <input id="tr-kw" value={f.keywords} placeholder="e.g. water quality, early warning, Lake Lanao" onChange={set('keywords')} /></div>

        <div className="form-group">
          <label>Full Terminal Report</label>
          <div className={`tr-drop ${hasFile ? 'has' : ''}`} onClick={() => fileRef.current?.click()} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}>
            <FaCloudArrowUp className="tr-drop-ic" />
            {file ? <span><b>{file.name}</b> · {sizeText(file.size)}</span>
              : report?.file_path ? <span><b>{report.file_name}</b> (already uploaded, choose a file to replace it)</span>
                : <span><b>Choose the report file</b> · PDF, DOC or DOCX, up to {FILE_MAX_MB} MB</span>}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" hidden onChange={pick} />
          <small className="tr-small">The report with the 11 sections listed on Form 007, with this form as its cover page. This is the electronic copy; the two hardbound copies are still brought to MSIRC.</small>
        </div>

        <SignConfirm onReady={setSigned} verb="submit" noun="terminal report" roleLabel="Project Leader" disabled={saving} />
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit Terminal Report'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ── on the researcher's approved Internally Funded record ── */
export const TerminalReportBox = ({ proposal }) => {
  const [report, setReport] = useState(undefined);
  const [form, setForm] = useState(false);
  const load = useCallback(() => {
    API.get(`/proposals/${proposal.proposal_id}/terminal-report`)
      .then((res) => setReport(res.data?.report || null))
      .catch(() => setReport(null));
  }, [proposal.proposal_id]);
  useEffect(() => { if (canHaveTerminalReport(proposal)) load(); }, [proposal, load]);
  if (!canHaveTerminalReport(proposal) || report === undefined) return null;

  return (
    <section className={`tr-box ${report?.status === 'accepted' ? 'is-done' : ''}`}>
      <div className="tr-box-head">
        <FaFlagCheckered className="tr-box-ic" />
        <div>
          <span className="tr-cap">Terminal Report</span>
          <b>{!report ? 'Submit it when your project ends' : TR_STATUS[report.status]}</b>
        </div>
        {(!report || report.status === 'returned') && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm(true)}>
            {report ? <><FaRotateLeft className="ic" />Fix and Resubmit</> : 'Submit Terminal Report'}
          </button>
        )}
      </div>
      {!report && (
        <p className="tr-box-text">
          Your research was approved. When the project is finished, submit MSIRC Form No. 007 with your full report.
          It goes to your College Dean, then the MSIRC Special Assistant, then the MSIRC Director. Once accepted, your research is marked <b>Completed</b> and added to the Research Repository.
        </p>
      )}
      {report && (
        <>
          <ReportTracker report={report} />
          {report.status === 'returned' && (
            <div className="rs-returned"><strong>Returned by the {report.returned_by_label}</strong><small>{short(report.returned_at)}</small><p>{report.return_reason}</p>
              <small>After you fix and resubmit it, it starts again from the College Dean.</small></div>
          )}
          {report.status === 'accepted' && (
            <div className="tr-done"><FaCircleCheck /> Accepted by the MSIRC Director on {short(report.decided_at)}. Your research is now <b>Completed</b> and the report is in the Research Repository.</div>
          )}
          <ReportCard proposal={proposal} report={report} />
          <ReportFile report={report} />
          <History report={report} />
        </>
      )}
      {form && <TerminalReportForm proposal={proposal} report={report} onClose={() => setForm(false)} onDone={() => { setForm(false); load(); }} />}
    </section>
  );
};

/* ── the Dean, Special Assistant and Director: Terminal Reports page ── */
const ACTIONS = {
  college_dean:      { verb: 'Endorse',  done: 'Endorsed to MSIRC', note: 'A note is required when you endorse or return.', needNote: true, sign: true },
  special_assistant: { verb: 'Forward to the MSIRC Director', done: 'Forwarded', note: 'Check that the cover form is complete and the report has all 11 sections.', needNote: false, sign: false },
  msric_director:    { verb: 'Accept',   done: 'Accepted', note: 'Accepting marks the research Completed and adds the report to the Research Repository.', needNote: false, sign: false },
};

export const TerminalReportsPage = () => {
  const { user } = useAuth();
  const role = user?.role;
  const A = ACTIONS[role] || ACTIONS.msric_director;
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('waiting');
  const [sel, setSel] = useState(null);
  const [note, setNote] = useState('');
  const [signReady, setSignReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    API.get('/terminal-reports').then((res) => setRows(res.data?.reports || [])).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const mine = ROLE_STATUS[role];
  const waiting = useMemo(() => (rows || []).filter((r) => r.status === mine), [rows, mine]);
  const others = useMemo(() => (rows || []).filter((r) => r.status !== mine), [rows, mine]);
  const list = tab === 'waiting' ? waiting : others;

  const open = (r) => { setSel(r); setNote(''); setErr(''); setSignReady(false); };
  const act = async (decision) => {
    if (decision === 'return' && note.trim().length < 10) { setErr('Please write the reason for returning it (at least 10 characters).'); return; }
    if (decision !== 'return' && A.needNote && note.trim().length < 10) { setErr('Please write a note (at least 10 characters).'); return; }
    if (decision !== 'return' && A.sign && !signReady) { setErr('Please confirm your signature.'); return; }
    setBusy(decision); setErr('');
    try {
      await API.post(`/terminal-reports/${sel.report_id}/decision`, { decision, remarks: note.trim(), ...(A.sign && decision !== 'return' ? { attest: true } : {}) });
      setMsg({ type: 'success', text: decision === 'return' ? 'Returned to the researcher.' : `${A.done}: “${sel.title}”.` });
      setSel(null); load();
    } catch (e) {
      setErr(e.response?.data?.message || 'Could not save. Please try again.');
    } finally { setBusy(''); }
  };

  return (
    <>
      <div className="page-header">
        <h1>Terminal Reports</h1>
        <p>MSIRC Form No. 007 for finished Internally Funded Research{role === 'college_dean' ? ' from your college' : ''}.</p>
      </div>
      {msg && <div className={`alert alert-${msg.type}`} role="status">{msg.text}</div>}
      <div className="panel">
        <div className="panel-header tr-tabs">
          <button type="button" className={tab === 'waiting' ? 'on' : ''} onClick={() => setTab('waiting')}>Waiting for you <span>{waiting.length}</span></button>
          <button type="button" className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All others <span>{others.length}</span></button>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Research</th><th>Researcher</th><th>Submitted</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.report_id}>
                  <td><b>{r.title}</b></td>
                  <td>{personName(r) || '—'}<br /><small className="tr-muted">{r.college}</small></td>
                  <td>{short(r.submitted_at)}</td>
                  <td><span className={`badge ${r.status === 'accepted' ? 'badge-green' : r.status === 'returned' ? 'badge-red' : 'badge-amber'}`}>{TR_STATUS[r.status]}</span></td>
                  <td><button type="button" className="btn btn-outline btn-sm" onClick={() => open(r)}>{r.status === mine ? 'Review' : 'View'}</button></td>
                </tr>
              ))}
              {rows && list.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><p>{tab === 'waiting' ? 'No terminal reports are waiting for you.' : 'Nothing here yet.'}</p></div></td></tr>
              )}
              {!rows && <tr><td colSpan={5}><div className="empty-state loading-state" role="status"><p>Loading…</p></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {sel && createPortal(
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal tr-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={sel.title}>
            <div className="tr-modal-head">
              <span className="tr-formno">Terminal Report · MSIRC Form No. 007</span>
              <h3>{sel.title}</h3>
              <p className="tr-sub">{personName(sel)} · {sel.college}</p>
              <button type="button" className="btn-close tr-x" onClick={() => setSel(null)} aria-label="Close"><FaXmark /></button>
            </div>
            <ReportTracker report={sel} />
            <ReportCard proposal={sel} report={sel} />
            <ReportFile report={sel} />
            <History report={sel} />
            {sel.status === mine && (
              <div className="tr-act">
                <p className="tr-hint">{A.note}</p>
                <div className="form-group"><label htmlFor="tr-note">{A.needNote ? 'Note' : 'Note (optional, required when returning)'}</label>
                  <textarea id="tr-note" rows={3} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></div>
                {A.sign && <SignConfirm key={sel.report_id} onReady={setSignReady} verb="endorse" noun="terminal report" disabled={!!busy} />}
                {err && <div className="alert alert-error" role="alert">{err}</div>}
                <div className="modal-footer">
                  <button type="button" className="btn btn-warning" disabled={!!busy} onClick={() => act('return')}>{busy === 'return' ? 'Returning…' : 'Return to Researcher'}</button>
                  <button type="button" className="btn btn-success" disabled={!!busy} onClick={() => act('approve')}>{busy === 'approve' ? 'Saving…' : A.verb}</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};

export default TerminalReportBox;