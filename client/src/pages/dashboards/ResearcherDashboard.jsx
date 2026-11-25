import React, { useState, useEffect, useCallback } from 'react';
import { TerminalReportLink, MyTerminalReportsPage } from '../../components/TerminalReport';
import { Routes, Route, Navigate, Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useLiveRefresh } from '../../utils/liveRefresh';
import API    from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout.css';
import ExternalResearchPage from './ExternalResearchPage';
import NotificationsPage from './NotificationsPage';
import ResubmitModal from '../../components/ResubmitModal';
import { useOpenHighlight } from '../../components/OpenHighlight';
import '../../components/Resubmit.css';
import '../../components/ProposalFiles.css';
import ProposalTracker, { whereNow } from '../../components/ProposalTracker';
import { ProposalSignatures, SignConfirm } from '../../components/Signature';
import { ProposalFiles, FileButtons, DocumentsEditor, docsFromFiles, docsProblem, appendDocs, docsSummary } from '../../components/ProposalFiles';
import { FaArrowLeft, FaArrowRight, FaBell, FaBoxArchive, FaCheck, FaCircleCheck, FaCirclePlus, FaFileLines, FaFlagCheckered, FaGlobe, FaHandHoldingDollar, FaTableCellsLarge, FaTriangleExclamation } from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, statusLabel, statusBadge, ROLE_LABEL, TYPE_LABEL, RESEARCH_TYPES, GRANT_TYPES, isGrantType } from '../../utils/terms';
import { GRANT_FORMS, FORMS_OF_TYPE, formLabel, fieldsIssues, fieldsWarning, titleProblem } from '../../utils/grantForms';
import FormToast, { jumpTo } from '../../components/FormToast';
import { personName } from '../../utils/names';
import { GrantFormFields, SlotDocs, slotDocsProblem, slotDocsSummary, FormGuide, collegeKey } from '../../components/GrantForms';
import StatCard from '../../components/StatCard';
import WelcomeBanner from '../../components/WelcomeBanner';
import MessageToast from '../../components/MessageToast';

/* approved Internally Funded Research whose Terminal Report was accepted shows as Completed */
const statusText = (p) => (p?.completed_at ? 'Completed' : statusLabel(p?.status));

/* Files are stored as full web addresses; older records may hold a server path */

const NAV_ITEMS = [
  { path: '/researcher/dashboard',   label: 'Dashboard',         icon: <FaTableCellsLarge /> },
  { path: '/researcher/proposals',   label: 'My Research',       icon: <FaFileLines /> },
  { path: '/researcher/grants',      label: 'Grants and Incentives', icon: <FaHandHoldingDollar /> },
  { path: '/researcher/terminal-reports', label: 'Terminal Reports', icon: <FaFlagCheckered /> },
  { path: '/researcher/repository',  label: 'Research Repository',        icon: <FaBoxArchive /> },
  { path: '/researcher/external',    label: 'External Research', icon: <FaGlobe /> },
  { path: '/researcher/notifications', label: 'Notifications',   icon: <FaBell /> },
  
];

/* every type, for showing a label */
const PROPOSAL_TYPES = Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }));

/* The two pages that share the same list and the same 3-step form.
   My Research: Research Spotlight, Internally Funded.
   (Externally funded research is uploaded on External Research: Repository only, no office chain.)
   Grants and Incentives: Travel Subsidy, Oral Presentation, Publication Incentive. */
const TYPE_NOTE = {
  research_spotlight:    'Present your research at the MSU Main Campus Research Spotlight. Needed before a travel grant or presentation incentive.',
  internally_funded:     'Research funded by the University through MSIRC, up to ₱50,000 for 5 months (Form 005).',
  externally_funded:     'Research funded by an agency outside the University.',
  travel_subsidy:        'Travel to present a paper (Form 001) or to attend a conference (Form 008).',
  oral_presentation:     'Cash incentive for a paper you presented (Form 003). Needs an approved Research Spotlight.',
  publication_incentive: 'Cash incentive for a journal article (Form 002) or a book or book chapter (Form 004).',
};
const KINDS = {
  research: {
    base: '/researcher/proposals', page: 'My Research', types: RESEARCH_TYPES,
    sub: 'Research Spotlight and Internally Funded research. Track their status and finish your drafts.',
    submit: 'Submit Research', one: 'research', search: 'Search research…', typeHead: 'Research Type',
    formSub: 'Fill in the form below to submit your research to MSIRC. You can save it as a draft at any step and finish it later.',
    pick: 'Select the type of research you want to submit:', steps: ['Research Type', 'Details', 'Documents and Submit'],
    titleLabel: 'Research Title', titleHint: 'Enter your research title',
    descLabel: 'Abstract', descHint: 'Briefly describe your research…',
    docsHint: 'The Main Proposal Document is required to submit. Add up to 4 supporting documents, each with a label.',
    empty: 'Nothing here yet. Click "Submit Research" to get started.',
  },
  grants: {
    base: '/researcher/grants', page: 'Grants and Incentives', types: GRANT_TYPES,
    sub: 'Travel Subsidy, Oral Presentation and Publication Incentive applications. Track their status and finish your drafts.',
    submit: 'Submit Application', one: 'application', search: 'Search applications…', typeHead: 'Application Type',
    formSub: 'Fill in the form below to apply. You can save it as a draft at any step and finish it later.',
    pick: 'Select what you want to apply for:', steps: ['Application Type', 'Details', 'Documents and Submit'],
    titleLabel: 'Title of the Paper or Article', titleHint: 'Title of the paper you will present, presented, or published',
    descLabel: 'Details', descHint: 'For example: the conference, place and dates, or the journal, volume and year published…',
    docsHint: 'Attach each document the form asks for. Those marked * are required to submit.',
    empty: 'No applications yet. Click "Submit Application" to get started.',
  },
};
const kindOf = (type) => (isGrantType(type) ? 'grants' : 'research');
const typeText = (t) => TYPE_LABEL[t] || t;



/* ─────────── Overview ─────────── */
const Overview = ({ proposals: all, user }) => {
  /* drafts are not submitted yet, so they are left out of the numbers */
  const proposals = all.filter(p => p.status !== 'draft');
  const counts = {
    total:       proposals.length,
    in_progress: proposals.filter(p => IN_PROGRESS.includes(p.status)).length,
    returned:    proposals.filter(p => p.status === 'returned').length,
    approved:    proposals.filter(p => p.status === 'approved').length,
    rejected:     proposals.filter(p => p.status === 'rejected').length,
  };
  /* a card opens My Research, or Grants and Incentives when all its records are applications,
     with the list filtered to that status */
  const isOpen = (p) => IN_PROGRESS.includes(p.status);
  const where = (test, status) => {
    const mine = proposals.filter(test);
    const kind = mine.length && mine.every(p => kindOf(p.proposal_type) === 'grants') ? 'grants' : 'research';
    return `${KINDS[kind].base}${status ? `?status=${status}` : ''}`;
  };
  const typeLabelOf = (p) => PROPOSAL_TYPES.find(t => t.value === p.proposal_type)?.label || p.proposal_type;
  /* returned ones first (an office is waiting for the fix), then drafts, newest first */
  const byNewest = (x, y) => String(y.updated_at || y.created_at || '').localeCompare(String(x.updated_at || x.created_at || ''));
  const todo = [
    ...all.filter(p => p.status === 'returned').sort(byNewest),
    ...all.filter(p => p.status === 'draft').sort(byNewest),
  ].slice(0, 6);

  return (
    <>
      <WelcomeBanner text="Here is an overview of your research activities in AYON." />

      <div className="stats-grid">
        <StatCard color="purple" label="Total Submissions" value={counts.total} to={where(() => true, '')} />
        <StatCard color="blue" label="In Progress" value={counts.in_progress} to={where(isOpen, 'in_progress')} />
        <StatCard color="amber" label="Returned for Revision" value={counts.returned} to={where(p => p.status === 'returned', 'returned')} />
        <StatCard color="green" label="Approved" value={counts.approved} to={where(p => p.status === 'approved', 'approved')} />
        <StatCard color="red" label="Rejected" value={counts.rejected} to={where(p => p.status === 'rejected', 'rejected')} />
      </div>

      {/* what the researcher has to do next: returned ones to fix, drafts to finish */}
      <div className="panel">
        <div className="panel-header">
          <h2>Needs Your Attention</h2>
          {todo.length > 0 && <span className="badge badge-amber">{todo.length}</span>}
        </div>
        {todo.length === 0 ? (
          <div className="rd-allset">
            <FaCircleCheck className="rd-allset-ic" aria-hidden="true" />
            <div>
              <b>You are all set.</b>
              <span>Nothing is waiting for you. Start something new:</span>
            </div>
            <div className="rd-allset-btns">
              <Link to="/researcher/proposals/new" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>Submit Research</Link>
              <Link to="/researcher/grants/new" className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}>Submit Application</Link>
            </div>
          </div>
        ) : (
          <ul className="rd-todo">
            {todo.map(p => {
              const returned = p.status === 'returned';
              const K = KINDS[kindOf(p.proposal_type)];
              return (
                <li key={p.proposal_id} className={returned ? 'returned' : 'draft'}>
                  <span className="rd-todo-tag">{returned ? 'Returned' : 'Draft'}</span>
                  <div className="rd-todo-text">
                    <b>{p.title || 'Untitled draft'}</b>
                    <span>
                      {returned
                        ? `${typeLabelOf(p)} · Reason: ${p.return_reason || 'see your notifications'}`
                        : `${typeLabelOf(p)} · last saved ${shortDate(p.updated_at || p.created_at)}`}
                    </span>
                  </div>
                  <Link className="btn btn-outline btn-sm" style={{ textDecoration: 'none' }}
                    to={returned ? `${K.base}?open=${p.proposal_id}` : `${K.base}/${p.proposal_id}/edit`}>
                    {returned ? 'Fix and Resubmit' : 'Continue'}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Recent Submissions</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {proposals.slice(0, 5).map(p => (
              <tr key={p.proposal_id}>
                <td>
                  <Link className="rd-title-link" to={`${KINDS[kindOf(p.proposal_type)].base}?open=${p.proposal_id}`}>{p.title}</Link>
                </td>
                <td style={{ color: '#718096' }}>{typeLabelOf(p)}</td>
                <td>
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusText(p)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>{p.submitted_at ? shortDate(p.submitted_at) : '—'}</td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty-state">
                  <p>Nothing submitted yet. Go to My Research and click "Submit Research" to get started.</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─────────── My Research, and Grants and Incentives (the same list, different types) ─────────── */
const dateOf  = (p) => p.submitted_at || p.created_at || null;
const yearOf  = (p) => (dateOf(p) ? String(new Date(dateOf(p)).getFullYear()) : '');
const shortDate = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const dateTime  = (d) => (d ? new Date(d).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

/* A draft may not have a title yet */
const TitleOf = ({ p }) => (p.title ? <>{p.title}</> : <span className="mp-untitled">Untitled draft</span>);

/* Delete a draft: asks first */
const DeleteDraftModal = ({ proposal, onClose, onDone }) => {
  const [error,  setError]  = useState('');
  const [saving, setSaving] = useState(false);
  const go = async () => {
    setSaving(true); setError('');
    try {
      await API.delete(`/proposals/${proposal.proposal_id}`);
      onDone({ ok: true, message: 'Draft deleted.' });
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not delete the draft. Please try again.';
      if (err.response?.data?.code === 'NOT_DRAFT') { onDone({ ok: false, message: msg }); return; }
      setError(msg);
      setSaving(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-labelledby="del-title">
        <h3 id="del-title" style={{ marginBottom: 6 }}>Delete this draft?</h3>
        <p style={{ margin: '0 0 10px', fontWeight: 600, color: '#3d3235' }}><TitleOf p={proposal} /></p>
        <p style={{ margin: 0, color: '#5e5155', fontSize: '0.88rem' }}>
          The draft and its uploaded files are removed. This cannot be undone.
        </p>
        {error && <div className="alert alert-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={go} disabled={saving}>
            {saving ? 'Deleting…' : 'Yes, Delete It'}
          </button>
        </div>
      </div>
    </div>
  );
};

const EMPTY_FILTERS = { search: '', status: 'all', type: '', year: '', sort: 'new' };
const IN_PROGRESS = ['for_endorsement', 'submitted', 'under_review', 'endorsed'];

const MyProposals = ({ proposals: everything, onRefresh, kind = 'research' }) => {
  const K = KINDS[kind];
  const proposals = everything.filter(p => kindOf(p.proposal_type) === kind);
  const location = useLocation();
  // show the note from the form once; clear it so a page refresh does not show it again
  const [fromForm, setFromForm] = useState(location.state?.notice || (location.state?.submitted ? 'Submitted successfully.' : null));
  useEffect(() => {
    if (fromForm) window.history.replaceState({}, document.title);
  }, [fromForm]);
  /* a dashboard card can open this list already filtered: ?status=approved, ?status=in_progress ... */
  const [f,        setF]        = useState(() => ({ ...EMPTY_FILTERS, status: new URLSearchParams(location.search).get('status') || 'all' }));
  const [selected, setSelected] = useState(null);
  /* the details window shows the newest data after a live update */
  useEffect(() => {
    setSelected((cur) => (cur ? proposals.find((p) => p.proposal_id === cur.proposal_id) || cur : cur));
  }, [proposals]);
  const [editing,  setEditing]  = useState(null);   // the returned proposal being edited
  const [deleting, setDeleting] = useState(null);
  const [notice,   setNotice]   = useState(null);   // { type, msg } after an action
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  /* opened from a notification (?open=<id>): its details window; a grant application opens
     on Grants and Incentives and a research proposal on My Research */
  const navigateTo = useNavigate();
  useOpenHighlight(everything.length > 0, {
    open: (id) => {
      const p = everything.find((x) => String(x.proposal_id) === String(id));
      if (!p) return false;
      const other = kindOf(p.proposal_type);
      if (other !== kind) { navigateTo(`${KINDS[other].base}?open=${id}`, { replace: true }); return 'moved'; }
      setSelected(p);
      return true;
    },
  });

  const years = [...new Set(proposals.map(yearOf).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const q = f.search.trim().toLowerCase();
  const filtered = proposals
    .filter(p => (f.status === 'all' || (f.status === 'in_progress' ? IN_PROGRESS.includes(p.status) : p.status === f.status))
      && (!f.type || p.proposal_type === f.type)
      && (!f.year || yearOf(p) === f.year)
      && (!q || (p.title || 'untitled draft').toLowerCase().includes(q)))
    .sort((a, b) => {
      if (f.sort === 'title') return (a.title || '￿').localeCompare(b.title || '￿');
      const d = String(dateOf(a) || '').localeCompare(String(dateOf(b) || ''));
      return f.sort === 'old' ? d : -d;
    });
  const filtering = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);
  const otherKind = kind === 'grants' ? 'research' : 'grants';
  const otherCount = f.status === 'all' ? 0 : everything.filter(p => kindOf(p.proposal_type) === otherKind
    && (f.status === 'in_progress' ? IN_PROGRESS.includes(p.status) : p.status === f.status)).length;

  const returnedCount = proposals.filter(p => p.status === 'returned').length;
  const draftCount    = proposals.filter(p => p.status === 'draft').length;

  const afterAction = async ({ ok, message }) => {
    setEditing(null); setSelected(null); setDeleting(null);
    setNotice({ type: ok ? 'success' : 'error', msg: message });
    if (onRefresh) await onRefresh();
  };

  const where = (p) => {
    if (p.status === 'draft') return p.updated_at ? `Saved ${dateTime(p.updated_at)}` : 'Not submitted yet';
    if (p.status === 'approved' || p.status === 'rejected') return '';
    return whereNow(p);
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{K.page}</h1>
          <p>{K.sub}</p>
        </div>
        <Link to={`${K.base}/new`} className="btn btn-primary"
          style={{ textDecoration: 'none', display: 'inline-block', padding: '10px 18px' }}>
          <FaCirclePlus className="ic" />{K.submit}
        </Link>
      </div>

      <MessageToast message={notice || (fromForm ? { type: 'success', msg: fromForm } : null)}
        onClose={() => { setNotice(null); setFromForm(null); }} />

      {/* filtered by status: the same status on the other page (research vs applications) */}
      {f.status !== 'all' && otherCount > 0 && (
        <div className="alert alert-info" role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>
            You also have {otherCount} {f.status === 'in_progress' ? 'in progress' : statusLabel(f.status).toLowerCase()}{' '}
            {otherKind === 'grants' ? `application${otherCount === 1 ? '' : 's'} in Grants and Incentives` : `research in My Research`}.
          </span>
          <Link className="btn btn-outline btn-sm" style={{ textDecoration: 'none', marginLeft: 'auto' }}
            to={`${KINDS[otherKind].base}?status=${f.status}`}>
            Open {KINDS[otherKind].page}
          </Link>
        </div>
      )}

      {returnedCount > 0 && (
        <div className="rs-banner">
          <span>
            <FaTriangleExclamation className="ic" />{returnedCount} {returnedCount === 1 ? 'was' : 'were'} returned and
            {returnedCount === 1 ? ' needs' : ' need'} your changes.
          </span>
          {f.status !== 'returned' && (
            <button type="button" className="btn btn-primary btn-sm"
              onClick={() => setF({ ...EMPTY_FILTERS, status: 'returned' })}>
              Show {returnedCount === 1 ? 'it' : 'them'}
            </button>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar" style={{ width: '100%' }}>
            <input className="search-input" placeholder={K.search} aria-label={K.search}
              value={f.search} onChange={set('search')} style={{ flex: '1 1 180px' }} />
            <select className="search-input" aria-label="Status" value={f.status} onChange={set('status')}>
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress (any stage)</option>
              <option value="draft">{STATUS_LABEL.draft}{draftCount ? ` (${draftCount})` : ''}</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select className="search-input" aria-label={K.typeHead} value={f.type} onChange={set('type')}>
              <option value="">All Types</option>
              {K.types.map(t => <option key={t} value={t}>{typeText(t)}</option>)}
            </select>
            <select className="search-input" aria-label="Year" value={f.year} onChange={set('year')}>
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select className="search-input" aria-label="Sort" value={f.sort} onChange={set('sort')}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="title">Title A–Z</option>
            </select>
            <button type="button" className="btn btn-outline btn-sm" disabled={!filtering}
              onClick={() => setF(EMPTY_FILTERS)}>Clear</button>
            <span className="mp-count">Showing {filtered.length} of {proposals.length}</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>{K.typeHead}</th>
              <th>Status</th>
              <th>Date Submitted</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.proposal_id} data-pid={p.proposal_id}>
                <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                <td>
                  <strong><TitleOf p={p} /></strong>
                  {p.spotlight_title && (
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>For Research Spotlight: {p.spotlight_title}</div>
                  )}
                  {Number(p.revision_count) > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#718096' }}>
                      Revision {Number(p.revision_count) + 1}
                    </div>
                  )}
                </td>
                <td style={{ color: '#718096', fontSize: '0.82rem' }}>
                  {PROPOSAL_TYPES.find(t => t.value === p.proposal_type)?.label || p.proposal_type}
                  {GRANT_FORMS[p.form_no] && FORMS_OF_TYPE[p.proposal_type]?.length > 1 && <div style={{ fontSize: '0.74rem' }}>Form {p.form_no}: {GRANT_FORMS[p.form_no].short}</div>}
                </td>
                <td>
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusText(p)}
                  </span>
                  {where(p) && (
                    <div style={{ fontSize: '0.72rem', color: '#718096', marginTop: 3 }}>{where(p)}</div>
                  )}
                </td>
                <td style={{ color: '#718096' }}>
                  {p.status === 'draft'
                    ? <>{shortDate(p.created_at)}<div style={{ fontSize: '0.72rem' }}>created</div></>
                    : shortDate(p.submitted_at)}
                </td>
                <td>
                  {p.status === 'draft' ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Link to={`${K.base}/${p.proposal_id}/edit`} className="btn btn-primary btn-sm"
                        style={{ textDecoration: 'none' }}>Continue Editing</Link>
                      <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => setDeleting(p)}>Delete</button>
                    </div>
                  ) : (
                    <button
                      className={`btn btn-sm ${p.status === 'returned' ? 'btn-primary' : 'btn-outline'}`}
                      onClick={() => setSelected(p)}>
                      {p.status === 'returned' ? 'Edit and Resubmit' : 'View Details'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state">
                  <p>{proposals.length ? 'Nothing matches these filters.' : K.empty}</p>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Proposal Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <h3><TitleOf p={selected} /></h3>
            <ProposalTracker proposal={selected} showReturn={false} />
            {selected.status === 'rejected' && (
              <div className="rs-returned">
                <strong>
                  Rejected{selected.decided_by_role ? ` by the ${ROLE_LABEL[selected.decided_by_role] || 'office'}` : ''}
                </strong>
                {selected.decided_at && (
                  <small>{new Date(selected.decided_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small>
                )}
                <p>{selected.decision_reason || 'No written reason was saved. Please check your Notifications, or contact MSIRC.'}</p>
              </div>
            )}
            {selected.status === 'returned' && (
              <div className="rs-returned">
                <strong>
                  Returned for Revision{selected.returned_by_role ? ` by the ${ROLE_LABEL[selected.returned_by_role] || 'office'}` : ''}
                </strong>
                {selected.returned_at && (
                  <small>{new Date(selected.returned_at).toLocaleString()}</small>
                )}
                <p>{selected.return_reason || 'The office did not leave a written reason. Please check your Notifications, or contact MSIRC.'}</p>
                <small style={{ marginTop: 8 }}>
                  After you edit and resubmit, it starts again from the college level (College Chairperson, College Coordinator, College Dean) and then the office.
                </small>
              </div>
            )}
            {selected.description && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>Abstract</p>
                <p style={{ color: '#2d3748', lineHeight: 1.6, margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{selected.description}</p>
              </div>
            )}
            <ProposalFiles proposal={selected} />
            {/* approved Internally Funded Research: where its Terminal Report stands, with a link to its page */}
            <TerminalReportLink proposal={selected} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 24px', marginBottom: 16 }}>
              {[
                { label: K.typeHead, value: typeText(selected.proposal_type) },
                { label: 'Status',      value: statusText(selected) },
                { label: 'Date Submitted', value: selected.submitted_at ? new Date(selected.submitted_at).toLocaleDateString() : 'Not yet submitted' },
                { label: 'Proposal ID', value: `#${selected.proposal_id}` },
                ...(['approved', 'rejected'].includes(selected.status) && selected.decided_at
                  ? [{ label: 'Decided On', value: new Date(selected.decided_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }]
                  : []),
                ...(Number(selected.revision_count) > 0
                  ? [{ label: 'Revisions Sent', value: String(selected.revision_count) }]
                  : []),
              ].map(item => (
                <div key={item.label}>
                  <p style={{ fontSize: '0.72rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 2px' }}>{item.label}</p>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>
            <ProposalSignatures proposal={selected} />
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
              {selected.status === 'returned' && (
                <button className="btn btn-primary"
                  onClick={() => { setEditing(selected); setSelected(null); }}>
                  Edit and Resubmit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editing && (
        <ResubmitModal proposal={editing}
          onClose={() => setEditing(null)}
          onDone={afterAction} />
      )}
      {deleting && (
        <DeleteDraftModal proposal={deleting} onClose={() => setDeleting(null)} onDone={afterAction} />
      )}
    </>
  );
};

/* ─────────── The 3-step form (new, or continue a draft) for both pages ─────────── */
const TITLE_MAX = 255;
const DESC_MAX  = 10000;

const SubmitProposal = ({ onRefresh, kind = 'research', proposals = [] }) => {
  const K = KINDS[kind];
  const { user } = useAuth();
  const STEPS = K.steps;
  /* Travel Subsidy and Oral Presentation are for a Research Spotlight that is already approved */
  const spotlights = proposals
    .filter(p => p.proposal_type === 'research_spotlight' && p.status === 'approved')
    .sort((x, y) => String(x.title || '').localeCompare(String(y.title || ''), undefined, { sensitivity: 'base' }));   // A to Z
  const navigate = useNavigate();
  const location = useLocation();
  const { id: draftParam } = useParams();
  const [draftId, setDraftId] = useState(draftParam ? Number(draftParam) : null);
  const [step,    setStep]    = useState(location.state?.step || 1);
  const [alert,   setAlert]   = useState(location.state?.savedNote ? { type: 'success', msg: location.state.savedNote } : null);
  const [busy,    setBusy]    = useState('');            // '' | 'draft' | 'submit'
  const [loading, setLoading] = useState(!!draftParam);
  const [blocked, setBlocked] = useState('');           // the draft cannot be edited (already submitted, not found)
  const [savedAt, setSavedAt] = useState(location.state?.savedAt || null);
  const [form,    setForm]    = useState({ proposal_type: '', title: '', description: '', spotlight_id: '', form_no: '', form_data: {} });
  const [docs,    setDocs]    = useState(() => docsFromFiles([]));
  /* a missing or wrong box: a message slides in, the page jumps to the box, and
     after the first Next every box that still needs something is marked in red */
  const [toast,   setToast]   = useState(null);
  const [tried,   setTried]   = useState(false);
  const [signed,  setSigned]  = useState(false);         // Form 005: the box under (15) Submitted by is ticked
  /* the full account (college, department, cellphone): the Project Leader's boxes on Form 005 are filled from it */
  const [me, setMe] = useState(null);
  useEffect(() => {
    let on = true;
    API.get('/auth/profile').then(res => { if (on) setMe(res.data.user || null); }).catch(() => {});
    return () => { on = false; };
  }, []);
  const leaderOf = (u) => ({
    name: personName(u), college: collegeKey(u.college), department: u.department || '',
    email: u.email || '', cellphone: u.contact_number || '',
  });
  /* the account arrived after Form 005 was chosen: fill the Project Leader's empty boxes */
  useEffect(() => {
    if (!me) return;
    setForm(cur => {
      const first = cur.form_no === '005' && (cur.form_data?.proponents || [])[0];
      if (!first || first.contact || first.college || first.department || first.email) return cur;
      const full = leaderOf({ ...user, ...me });
      const filled = Object.fromEntries(Object.entries(full).map(([k, v]) => [k, first[k] || v]));
      return { ...cur, form_data: { ...cur.form_data, proponents: [filled, ...cur.form_data.proponents.slice(1)] } };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  /* continue a draft: load it */
  const loadDraft = useCallback(async (id) => {
    try {
      const res = await API.get(`/proposals/${id}`);
      const p = res.data.proposal;
      if (p.status !== 'draft') {
        setBlocked(`This was already submitted, so it is no longer a draft. You can follow it in ${K.page}.`);
        return;
      }
      if (kindOf(p.proposal_type) !== kind) {           // opened from the other page's address
        navigate(`${KINDS[kindOf(p.proposal_type)].base}/${id}/edit`, { replace: true });
        return;
      }
      setForm({
        proposal_type: K.types.includes(p.proposal_type) ? p.proposal_type : '',
        title: p.title || '', description: p.description || '',
        spotlight_id: p.spotlight_id ? String(p.spotlight_id) : '',
        /* a type with only one form (Internally Funded Research: Form 005) always uses it */
        form_no: p.form_no || ((FORMS_OF_TYPE[p.proposal_type] || []).length === 1 ? FORMS_OF_TYPE[p.proposal_type][0] : ''),
        form_data: p.form_data || {},
      });
      setDocs(docsFromFiles(p.files || []));
      setSavedAt(prev => prev || p.updated_at || null);
    } catch (err) {
      setBlocked(err.response?.status === 404 || err.response?.status === 403
        ? 'This draft was not found. It may have been deleted.'
        : 'Could not load the draft. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [K, kind, navigate]);

  useEffect(() => {
    if (draftParam) { setDraftId(Number(draftParam)); loadDraft(draftParam); }
  }, [draftParam, loadDraft]);

  /* Grants and Incentives: the MSIRC form chosen for this type (utils/grantForms.js) */
  const formChoices = FORMS_OF_TYPE[form.proposal_type] || [];
  const gform = formChoices.includes(form.form_no) ? GRANT_FORMS[form.form_no] : null;
  const needsSpotlight = !!gform?.needsSpotlight;
  const signsForm = gform?.no === '005';
  /* choosing a type or a form: documents that belong to another form are dropped */
  const chooseForm = (type, no) => {
    const f = GRANT_FORMS[no];
    const keep = f ? f.docs.slice(1).map(d => d.label) : null;
    if (keep && no !== form.form_no) {
      setDocs(d => ({
        ...d,
        rows: d.rows.filter(r => keep.includes(r.existing ? r.existing.label : r.choice)),
        removed: [...d.removed, ...d.rows.filter(r => r.existing?.file_id && !keep.includes(r.existing.label)).map(r => r.existing.file_id)],
      }));
    }
    /* Form 005 and the Spotlight entry: the researcher is the first proponent or author */
    const people = f && f.fields.find(x => x.type === 'people');
    const u = user ? { ...user, ...(me || {}) } : null;
    const leader = people && u
      ? { [people.k]: [people.k === 'proponents'
          ? leaderOf(u)
          : { name: personName(u), contact: [u.department, u.college].filter(Boolean).join(', ') }] }
      : {};
    if (no !== form.form_no) setTried(false);
    setForm(cur => ({
      ...cur, proposal_type: type, form_no: no || '',
      form_data: no === cur.form_no ? cur.form_data : leader,
      spotlight_id: f?.needsSpotlight ? (cur.spotlight_id || (spotlights.length === 1 ? String(spotlights[0].proposal_id) : '')) : '',
    }));
    setAlert(null);
  };
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const formWarning = gform ? fieldsWarning(gform, form.form_data) : '';
  /* errors from the server (saving failed, no connection) stay at the top of the page */
  const fail = (msg) => { setAlert({ type: 'error', msg }); return false; };
  /* something the researcher still has to fill in or fix */
  const missing = (msg, box, more = 0) => {
    setAlert(null);
    setToast({ msg, more, n: Date.now() });
    if (box) jumpTo(box);
    return false;
  };
  /* the title box: what is wrong with it, or '' */
  const titleIssue = (needTitle) => {
    const t = form.title.trim();
    if (needTitle && !t) return `Please fill in "${gform ? gform.titleLabel : 'Title'}".`;
    if (gform) { const problem = titleProblem(gform, form.title); if (problem) return problem; }
    if (t.length > TITLE_MAX) return `Title must be ${TITLE_MAX} characters or fewer.`;
    return '';
  };
  /* every box on step 2 that still needs something, in the order of the form */
  const detailIssues = (needTitle) => {
    const title = titleIssue(needTitle);
    return [
      ...(title ? [{ k: 'title', box: 'sp-title', msg: title }] : []),
      ...(needTitle && gform ? fieldsIssues(gform, form.form_data) : []),
      ...(form.description.trim().length > DESC_MAX ? [{ k: 'description', box: 'sp-desc', msg: `${K.descLabel} must be ${DESC_MAX} characters or fewer.` }] : []),
    ];
  };
  const shownIssues = tried ? detailIssues(true) : [];
  const titleShown = shownIssues.find(x => x.k === 'title');
  const descShown = shownIssues.find(x => x.k === 'description');

  const textOk = (needTitle) => {
    if (!form.proposal_type) return missing('Please select a type.');
    if (needTitle && kind === 'grants' && !gform) return missing('Please choose which form applies (step 1).');
    if (needTitle && needsSpotlight && !form.spotlight_id) return missing('Please choose the approved Research Spotlight this application is for (step 1).');
    if (needTitle) setTried(true);
    const list = detailIssues(needTitle);
    if (list.length) {
      if (step !== 2) setStep(2);
      return missing(list[0].msg, list[0].box, list.length - 1);
    }
    return true;
  };

  const payload = (saveAs) => {
    const data = new FormData();
    data.append('save_as',       saveAs);
    data.append('proposal_type', form.proposal_type);
    data.append('title',         form.title.trim());
    /* Form 005: the Executive Summary is also the abstract */
    data.append('description',   gform?.descFrom ? String(form.form_data[gform.descFrom] || '').trim() : form.description.trim());
    data.append('spotlight_id',  needsSpotlight ? form.spotlight_id : '');
    if (FORMS_OF_TYPE[form.proposal_type]) {
      data.append('form_no',   gform ? gform.no : '');
      data.append('form_data', JSON.stringify(gform ? form.form_data : {}));
    }
    appendDocs(data, docs);
    if (saveAs === 'submit' && signsForm) data.append('attest', signed ? 'true' : 'false');
    return data;
  };
  const send = (saveAs) => (draftId
    ? API.put(`/proposals/${draftId}`, payload(saveAs), { headers: { 'Content-Type': 'multipart/form-data' } })
    : API.post('/proposals', payload(saveAs), { headers: { 'Content-Type': 'multipart/form-data' } }));

  const saveDraft = async () => {
    if (busy) return;
    if (!textOk(false)) return;
    const problem = docsProblem(docs, { needMain: false });
    if (problem) return missing(problem);
    setBusy('draft'); setAlert(null);
    try {
      const res = await send('draft');
      const id  = draftId || res.data.proposal_id;
      const at  = new Date().toISOString();
      if (onRefresh) await onRefresh();
      setSavedAt(at);
      setAlert({ type: 'success', msg: `Draft saved. You can finish it later from ${K.page}.` });
      if (!draftId) {
        /* the new draft gets its own address, so a refresh or the back button finds it again */
        navigate(`${K.base}/${id}/edit`, {
          replace: true,
          state: { step, savedAt: at, savedNote: `Draft saved. You can finish it later from ${K.page}.` },
        });
        return;
      }
      await loadDraft(id);                     // the new files now show as saved
    } catch (err) {
      if (err.response?.data?.code === 'NOT_DRAFT') setBlocked(err.response.data.message);
      else fail(err.response?.data?.message || 'Could not save the draft. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!textOk(true)) return;
    const problem = gform ? slotDocsProblem(gform, docs, form.form_data) : docsProblem(docs, { needMain: true });
    if (problem) return missing(problem);
    if (signsForm && !signed) return missing('Please sign (15) Submitted by: tick the box under Your signature.', 'sp-sign');
    setBusy('submit'); setAlert(null);
    try {
      const res = await send('submit');
      if (onRefresh) await onRefresh();
      navigate(K.base, { state: { notice: res.data?.message || 'Submitted successfully.' } });
    } catch (err) {
      if (err.response?.data?.code === 'NOT_DRAFT') setBlocked(err.response.data.message);
      else fail(err.response?.data?.message || 'Submission failed.');
      setBusy('');
    }
  };

  const draftButton = (
    <button type="button" className="btn btn-outline" onClick={saveDraft} disabled={!!busy}>
      {busy === 'draft' ? 'Saving…' : 'Save as Draft'}
    </button>
  );
  const typeLabel = typeText(form.proposal_type);
  const spotlightTitle = spotlights.find(p => String(p.proposal_id) === String(form.spotlight_id))?.title;
  const willHave  = gform ? slotDocsSummary(gform, docs) : docsSummary(docs);

  const back = (
    <Link to={K.base} className="btn btn-outline btn-sm"
      style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 14 }}>
      <FaArrowLeft className="ic" />Back to {K.page}
    </Link>
  );

  if (loading) return <>{back}<div className="empty-state loading-state" role="status"><p>Loading your draft…</p></div></>;
  if (blocked) return <>{back}<div className="alert alert-error" role="alert">{blocked}</div></>;

  return (
    <>
      {back}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>{draftId ? 'Continue Your Draft' : K.submit}</h1>
          <p>{K.formSub}</p>
        </div>
        {savedAt && <span className="saved-at"><FaCheck className="ic" />Draft saved {dateTime(savedAt)}</span>}
      </div>

      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: step > i + 1 ? '#276749' : step === i + 1 ? '#1a3a5c' : '#e8edf2',
                color: step >= i + 1 ? '#fff' : '#a0aec0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.82rem', flexShrink: 0,
                transition: 'background 0.2s'
              }}>
                {step > i + 1 ? <FaCheck /> : i + 1}
              </div>
              <span style={{
                fontSize: '0.82rem', fontWeight: step === i + 1 ? 600 : 400,
                color: step === i + 1 ? '#1a3a5c' : '#a0aec0'
              }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: step > i + 1 ? '#276749' : '#e8edf2', margin: '0 12px', transition: 'background 0.2s' }} />
            )}
          </React.Fragment>
        ))}
      </div>

      <MessageToast message={alert} onClose={() => setAlert(null)} />
      <FormToast toast={toast} onClose={() => setToast(null)} />

      <div className="panel">
        <div className="panel-body">
          <form onSubmit={handleSubmit}>

            {/* Step 1: the type (and, for Travel Subsidy and Oral Presentation, the Research Spotlight) */}
            {step === 1 && (
              <>
                <p style={{ fontWeight: 600, color: '#1a3a5c', marginBottom: 16 }}>{K.pick}</p>
                {kind === 'grants' && spotlights.length === 0 && (
                  <div className="alert alert-info" role="note">
                    Presenting a paper (<strong>Form 001</strong>) and <strong>Oral Presentation</strong> open once you have an
                    approved <strong>Research Spotlight</strong>. Submit one in{' '}
                    <Link to="/researcher/proposals">My Research</Link>. Attending a conference (Form 008) and Publication Incentive are open now.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  {K.types.map(t => {
                    const forms  = FORMS_OF_TYPE[t] || [];
                    /* locked only when every form of this type needs a Research Spotlight and there is none */
                    const locked = forms.length > 0 && spotlights.length === 0 && forms.every(no => GRANT_FORMS[no].needsSpotlight);
                    const on = form.proposal_type === t;
                    const pick = () => {
                      if (locked || on) return;
                      if (forms.length) chooseForm(t, forms.length === 1 ? forms[0] : '');
                      else { setForm({ ...form, proposal_type: t }); setAlert(null); }
                    };
                    return (
                      <div key={t} role="button" tabIndex={locked ? -1 : 0} data-type={t}
                        aria-pressed={on} aria-disabled={locked}
                        onClick={pick}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
                        style={{
                          border: `2px solid ${on ? '#1a3a5c' : '#e8edf2'}`,
                          borderRadius: 10, padding: '16px',
                          cursor: locked ? 'not-allowed' : 'pointer', transition: 'border-color 0.2s',
                          background: locked ? '#f7f7f8' : on ? '#f0f6ff' : '#fff',
                          opacity: locked ? 0.65 : 1,
                        }}>
                        <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 4px', fontSize: '0.9rem' }}>{typeText(t)}</p>
                        <p style={{ color: '#718096', margin: 0, fontSize: '0.78rem', lineHeight: 1.4 }}>{TYPE_NOTE[t]}</p>
                        {locked && <p style={{ color: '#9b2c2c', margin: '6px 0 0', fontSize: '0.76rem', fontWeight: 600 }}>No approved Research Spotlight yet</p>}
                      </div>
                    );
                  })}
                </div>
                {K === KINDS.research && (
                  <p style={{ fontSize: '0.82rem', color: '#4a5568', margin: '10px 0 0' }}>
                    Externally funded research? Upload it on the <Link to="/researcher/external">External Research</Link> page.
                    It goes straight to the Research Repository as private, with no office endorsement.
                  </p>
                )}
                {formChoices.length > 1 && (
                  <fieldset className="spot-list" id="sp-form">
                    <legend>Which one applies?</legend>
                    <p className="spot-hint">Each one follows its own MSIRC form.</p>
                    {formChoices.map(no => {
                      const f = GRANT_FORMS[no];
                      const off = f.needsSpotlight && spotlights.length === 0;
                      const on  = form.form_no === no;
                      return (
                        <label key={no} className={`spot-item${on ? ' on' : ''}${off ? ' off' : ''}`}>
                          <input type="radio" name="form_no" value={no} checked={on} disabled={off}
                            onChange={() => chooseForm(form.proposal_type, no)} />
                          <span className="spot-text">
                            <b>{f.short}</b>
                            <small>{f.note}{off ? ' You have none yet.' : ''}</small>
                          </span>
                          <span className="badge badge-gray">Form {no}</span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
                {needsSpotlight && (
                  <fieldset className="spot-list" id="sp-spot">
                    <legend>Research Spotlight this application is for</legend>
                    <p className="spot-hint">Only your Research Spotlight entries that are already Approved are listed. Choose one.</p>
                    {spotlights.map(p => {
                      const on = String(form.spotlight_id) === String(p.proposal_id);
                      return (
                        <label key={p.proposal_id} className={`spot-item${on ? ' on' : ''}`}>
                          <input type="radio" name="spotlight_id" value={p.proposal_id} checked={on} onChange={(e) => { handleChange(e); setAlert(null); }} />
                          <span className="spot-text">
                            <b>{p.title}</b>
                            <small>Research Spotlight · Approved{p.submitted_at ? ` · Submitted ${shortDate(p.submitted_at)}` : ''}</small>
                          </span>
                          <span className="badge badge-green">Approved</span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
                <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {draftButton}
                  <button type="button" className="btn btn-primary"
                    onClick={() => {
                      if (!form.proposal_type) return missing('Please select a type.');
                      if (kind === 'grants' && !gform) return missing('Please choose which one applies.');
                      if (needsSpotlight && !form.spotlight_id) return missing('Please choose the approved Research Spotlight this application is for.');
                      setAlert(null); setStep(2);
                    }}>
                    Next <FaArrowRight className="ic-r" />
                  </button>
                </div>
              </>
            )}

            {/* Step 2 — Details */}
            {step === 2 && (
              <>
                {gform && (
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 14px' }}>
                    {gform.label ? gform.name : `${formLabel(gform)}: ${gform.name}`}
                  </p>
                )}
                <div className={`form-group${titleShown ? ' gf-has-err' : ''}`}>
                  <label htmlFor="sp-title">{gform ? gform.titleLabel : K.titleLabel}{gform && <span style={{ color: '#b3261e' }}> *</span>}</label>
                  <input id="sp-title" name="title" value={form.title} onChange={handleChange}
                    maxLength={TITLE_MAX + 50} placeholder={gform ? gform.titleHint : K.titleHint}
                    aria-invalid={titleShown ? true : undefined} aria-describedby={titleShown ? 'sp-title-err' : undefined} />
                  {titleShown && <div className="f-err" id="sp-title-err">{titleShown.msg}</div>}
                </div>
                <FormGuide form={gform} />
                {gform && (
                  <GrantFormFields form={gform} value={form.form_data} disabled={!!busy} issues={shownIssues}
                    onChange={(v) => { setForm({ ...form, form_data: v }); setAlert(null); }} />
                )}
                {formWarning && <div className="alert alert-info" role="note">{formWarning}</div>}
                {!gform?.descFrom && (
                  <div className={`form-group${descShown ? ' gf-has-err' : ''}`}>
                    <label htmlFor="sp-desc">{gform ? 'Notes (optional)' : K.descLabel}</label>
                    <textarea id="sp-desc" name="description" value={form.description} onChange={handleChange}
                      rows={gform ? 3 : 5} placeholder={gform ? 'Anything else the offices should know.' : K.descHint}
                      style={{ resize: 'vertical' }} />
                    {descShown && <div className="f-err">{descShown.msg}</div>}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline" onClick={() => { setAlert(null); setStep(1); }}><FaArrowLeft className="ic" />Back</button>
                  {draftButton}
                  <button type="button" className="btn btn-primary"
                    onClick={() => { if (!textOk(true)) return; setAlert(null); setStep(3); }}>
                    Next <FaArrowRight className="ic-r" />
                  </button>
                </div>
              </>
            )}

            {/* Step 3 — Documents and Submit */}
            {step === 3 && (
              <>
                <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 4px' }}>Documents</p>
                <p style={{ fontSize: '0.84rem', color: '#718096', margin: '0 0 12px' }}>
                  {gform ? 'Attach each document the form asks for. Those marked * are required to submit.' : K.docsHint}
                </p>
                {gform ? (
                  <SlotDocs form={gform} value={docs} onChange={setDocs} disabled={!!busy} data={form.form_data}
                    onError={(m) => (m ? missing(m) : setToast(null))} />
                ) : (
                  <DocumentsEditor value={docs} onChange={setDocs} disabled={!!busy}
                    onError={(m) => (m ? missing(m) : setToast(null))} />
                )}

                {/* Review Summary */}
                <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e8edf2', marginBottom: 20 }}>
                  <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 10px' }}>Review your submission:</p>
                  {[
                    { label: K.typeHead,  value: gform && !gform.label ? `${typeLabel} (Form ${gform.no})` : typeLabel },
                    ...(needsSpotlight ? [{ label: 'Research Spotlight', value: spotlightTitle || '—' }] : []),
                    { label: 'Title', value: form.title.trim() || '—' },
                    { label: 'Documents',      value: willHave.length ? willHave.join(', ') : 'No documents attached' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', color: '#718096', minWidth: 110 }}>{item.label}:</span>
                      <span style={{ fontSize: '0.87rem', color: '#2d3748', fontWeight: 500, overflowWrap: 'anywhere', minWidth: 0, flex: 1 }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                {/* Form 005 (15) Submitted by: the Project Leader signs when submitting */}
                {signsForm && (
                  <div className="sp-sign" style={{ marginBottom: 20 }}>
                    <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 4px' }}>(15) Submitted by</p>
                    <p style={{ fontSize: '0.84rem', color: '#718096', margin: '0 0 10px' }}>
                      Your signature is placed on the form as the Project Leader when you submit.
                    </p>
                    <SignConfirm id="sp-sign" verb="submit" noun="proposal" roleLabel="Project Leader"
                      disabled={!!busy} onReady={setSigned} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-outline" onClick={() => { setAlert(null); setStep(2); }}><FaArrowLeft className="ic" />Back</button>
                  {draftButton}
                  <button type="submit" className="btn btn-success" disabled={!!busy}>
                    {busy === 'submit' ? 'Submitting…' : <><FaCheck className="ic" />{K.submit}</>}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
};

/* ─────────── Repository ─────────── */
const Repository = () => {
  const [items,   setItems]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRepo = async () => {
      try {
        const res = await API.get('/repository?access=public');
        setItems(res.data.items || []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRepo();
  }, []);

  const filtered = items.filter(r =>
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>Research Repository</h1>
        <p>Browse and search completed and approved research outputs.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <input className="search-input" placeholder="Search by title or author…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div className="empty-state loading-state" role="status"><p>Loading repository…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No research outputs found.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Research Title</th>
                <th>Author</th>
                <th>College</th>
                <th>Access</th>
                <th>Date Stored</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.repo_id}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.author || '—'}</td>
                  <td>{r.college || '—'}</td>
                  <td>
                    <span className={`badge ${r.access_type === 'public' ? 'badge-green' : 'badge-amber'}`}>
                      {r.access_type === 'public' ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td>{r.store_date ? new Date(r.store_date).toLocaleDateString() : '—'}</td>
                  <td>
                    {r.file_path ? (
                      <FileButtons path={r.file_path} label={r.title} />
                    ) : <span style={{ color: '#a0aec0', fontSize: '0.82rem' }}>No file</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};


/* ─────────── Main Researcher Dashboard ─────────── */
const ResearcherDashboard = () => {
  const { user }              = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await API.get('/proposals/my');
      setProposals(res.data.proposals || []);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);
  useLiveRefresh(fetchProposals);          // reloads by itself when something new happens

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="Researcher">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"  element={<Overview proposals={proposals} user={user} />} />
        <Route path="proposals"  element={<MyProposals key="research" proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="proposals/new" element={<SubmitProposal key="r-new" onRefresh={fetchProposals} proposals={proposals} />} />
        <Route path="proposals/:id/edit" element={<SubmitProposal key="r-edit" onRefresh={fetchProposals} proposals={proposals} />} />
        <Route path="submit"     element={<Navigate to="/researcher/proposals/new" replace />} />
        <Route path="grants"     element={<MyProposals key="grants" kind="grants" proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="grants/new" element={<SubmitProposal key="g-new" kind="grants" onRefresh={fetchProposals} proposals={proposals} />} />
        <Route path="grants/:id/edit" element={<SubmitProposal key="g-edit" kind="grants" onRefresh={fetchProposals} proposals={proposals} />} />
        <Route path="terminal-reports" element={<MyTerminalReportsPage proposals={proposals} onRefresh={fetchProposals} />} />
        <Route path="external"   element={<ExternalResearchPage />} />
        <Route path="repository" element={<Repository />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Routes>
    </Layout>
  );
};

export default ResearcherDashboard;