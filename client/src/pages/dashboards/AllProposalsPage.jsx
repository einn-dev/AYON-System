import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import './ProposalOversight.css';
import { errText, fmtWhen, Pager } from './adminShared';

/* ─────────────────────────────────────────────────────────────
   Admin → All Proposals
   Every submitted proposal, how long it has been waiting, and who it is
   waiting on. The Admin can send a proposal BACK (with a reason) or remind
   the office it is waiting on. The Admin can never approve, reject or endorse.
   ───────────────────────────────────────────────────────────── */

const PAGE_SIZE = 25;

const PROPOSAL_TYPES = {
  research_spotlight:    'Research Spotlight',
  internally_funded:     'Internally Funded',
  publication_incentive: 'Publication Incentive',
  travel_oral:           'Travel / Oral Presentation',
  externally_funded:     'Externally Funded',
};

const STATUS_BADGE = {
  submitted:    'badge-blue',
  under_review: 'badge-amber',
  returned:     'badge-red',
  endorsed:     'badge-purple',
  approved:     'badge-green',
  rejected:     'badge-red',
};

const STATUS_LABELS = {
  submitted:    'Submitted',
  under_review: 'Under review',
  returned:     'Returned',
  endorsed:     'Endorsed',
  approved:     'Approved',
  rejected:     'Rejected',
};

const OFFICE_LABELS = {
  special_assistant: 'Special Assistant',
  msric_director:    'MSRIC Director',
  ovcred:            'OVCRED',
};

/* where an Admin may send a proposal back to */
const MOVE_OPTIONS = [
  { value: 'returned',     label: 'Back to the researcher' },
  { value: 'submitted',    label: 'Special Assistant (document check)' },
  { value: 'under_review', label: 'MSRIC Director (review)' },
];

const STUCK_OPTIONS = [3, 7, 14, 30];
const REASON_MIN = 10;
const REASON_MAX = 500;

const isOpen    = (p) => p.status !== 'approved' && p.status !== 'rejected';
const waitClass = (d) => (d >= 14 ? 'hot' : d >= 7 ? 'warm' : '');
const daysText  = (d) => (d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'}`);
const dateOnly  = (v) => (v ? new Date(v).toLocaleDateString() : '—');

/* ═════════════ the pop-up for one proposal ═════════════ */
const ProposalModal = ({ proposal, officeCounts, onClose, onChanged }) => {
  const [events,  setEvents]  = useState(null);          // null = loading
  const [loadErr, setLoadErr] = useState('');
  const [version, setVersion] = useState(0);             // bump to reload the history
  const [alert,   setAlert]   = useState(null);
  const [busy,    setBusy]    = useState('');            // 'move' | 'remind' | ''

  const options = MOVE_OPTIONS.filter(o => o.value !== proposal.status);
  const [target, setTarget] = useState(options[0]?.value || 'returned');
  const [reason, setReason] = useState('');
  const [ack,    setAck]    = useState(false);

  const decided  = !isOpen(proposal);
  const office   = proposal.with_role;
  const people   = office ? officeCounts?.[office] : null;
  const reasonOk = reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX;
  const canMove  = reasonOk && (!decided || ack) && busy === '';

  // keep the chosen target valid when the status changes after a move
  useEffect(() => {
    if (!options.some(o => o.value === target)) setTarget(options[0]?.value || 'returned');
  }, [proposal.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    setLoadErr('');
    API.get(`/admin/proposals/${proposal.proposal_id}/timeline`)
      .then(res => { if (alive) setEvents(res.data.events || []); })
      .catch(err => { if (alive) { setEvents([]); setLoadErr(errText(err, 'Could not load the history.')); } });
    return () => { alive = false; };
  }, [proposal.proposal_id, version]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const move = async () => {
    setBusy('move');
    setAlert(null);
    try {
      await API.post(`/admin/proposals/${proposal.proposal_id}/move`, {
        status: target, reason: reason.trim(), confirm_reopen: decided ? ack : undefined,
      });
      setReason('');
      setAck(false);
      setAlert({ type: 'success', msg: 'Proposal moved. The researcher was notified and the Audit Log was updated.' });
      await onChanged();
      setVersion(v => v + 1);
    } catch (err) {
      setAlert({ type: 'error', msg: errText(err, 'Could not move the proposal. Please try again.') });
    } finally {
      setBusy('');
    }
  };

  const remind = async () => {
    setBusy('remind');
    setAlert(null);
    try {
      const res = await API.post(`/admin/proposals/${proposal.proposal_id}/remind`);
      setAlert({ type: 'success', msg: res.data.message });
      setVersion(v => v + 1);
    } catch (err) {
      setAlert({ type: 'error', msg: errText(err, 'Could not send the reminder. Please try again.') });
    } finally {
      setBusy('');
    }
  };

  return createPortal(
    <div className="po-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="po-modal" role="dialog" aria-modal="true" aria-labelledby="po-title">
        <div className="po-head">
          <div>
            <h2 id="po-title">{proposal.title}</h2>
            <span className={`badge ${STATUS_BADGE[proposal.status] || 'badge-gray'}`} style={{ marginTop: 6, display: 'inline-block' }}>
              {STATUS_LABELS[proposal.status] || proposal.status}
            </span>
          </div>
          <button type="button" className="po-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="po-body">
          <div className="po-grid">
            <div><small>Researcher</small><b>{proposal.researcher}</b></div>
            <div><small>Email</small><b>{proposal.email || '—'}</b></div>
            <div><small>College</small><b>{proposal.college || '—'}</b></div>
            <div><small>Department</small><b>{proposal.department || '—'}</b></div>
            <div><small>Type</small><b>{PROPOSAL_TYPES[proposal.proposal_type] || proposal.proposal_type}</b></div>
            <div><small>Submitted</small><b>{dateOnly(proposal.submitted_at)}</b></div>
          </div>

          {proposal.description && <p className="po-desc">{proposal.description}</p>}
          {proposal.file_path && (
            <p style={{ margin: '0 0 12px' }}>
              <a className="btn btn-outline btn-sm" href={proposal.file_path} target="_blank" rel="noreferrer"
                style={{ textDecoration: 'none' }}>📄 View file</a>
            </p>
          )}

          {isOpen(proposal) && (
            <div className="po-with">
              {office
                ? <>Waiting on <b>{OFFICE_LABELS[office]}</b> for <b>{daysText(proposal.days_waiting)}</b></>
                : <>Waiting on <b>the researcher</b> for <b>{daysText(proposal.days_waiting)}</b></>}
            </div>
          )}

          <div className="po-sec">What happened so far</div>
          {events === null && <p className="po-muted">Loading…</p>}
          {loadErr && <div className="alert alert-error">{loadErr}</div>}
          {events && events.length > 0 && (
            <ul className="po-tl">
              {events.map((ev, i) => (
                <li key={i} className={ev.admin ? 'admin' : ''}>
                  <b>{ev.text}</b>
                  <small>{fmtWhen(ev.at)}{ev.admin ? ` · Admin${ev.by ? ` (${ev.by})` : ''}` : ''}</small>
                  {ev.reason && <span className="po-why">{ev.admin ? 'Reason: ' : ''}{ev.reason}</span>}
                </li>
              ))}
            </ul>
          )}

          <div className="po-sec">Admin actions</div>
          <div className="po-act">
            <div className="po-rule">
              <span>🔒</span>
              <span>
                Admins can send a proposal back or remind the people it is waiting on. Admins{' '}
                <b>cannot approve, reject or endorse</b> a proposal. Those decisions stay with the reviewers.
              </span>
            </div>

            {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

            {decided && (
              <div className="po-warnbox">
                This proposal was already <b>{(STATUS_LABELS[proposal.status] || '').toLowerCase()}</b>.
                Moving it reopens a finished decision.
                <label>
                  <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />
                  I understand and want to reopen it
                </label>
              </div>
            )}

            <div className="po-field">
              <label htmlFor="po-target">Move to</label>
              <select id="po-target" value={target} onChange={e => setTarget(e.target.value)}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="po-field">
              <label htmlFor="po-reason">Reason (the researcher will see this)</label>
              <textarea id="po-reason" value={reason} maxLength={REASON_MAX}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. The checklist was never finished and the Special Assistant is on leave." />
              <div className={`po-hint${reason.length && reason.trim().length < REASON_MIN ? ' err' : ''}`}>
                <span>At least {REASON_MIN} characters. Saved in the Audit Log.</span>
                <span>{reason.length}/{REASON_MAX}</span>
              </div>
            </div>

            <div className="po-btns">
              <button type="button" className="btn btn-primary" disabled={!canMove} onClick={move}>
                {busy === 'move' ? 'Moving…' : 'Move proposal'}
              </button>
              {office && (
                <button type="button" className="btn btn-outline" disabled={busy !== ''} onClick={remind}>
                  {busy === 'remind'
                    ? 'Sending…'
                    : `Send reminder to ${OFFICE_LABELS[office]}${people != null ? ` (${people} ${people === 1 ? 'person' : 'people'})` : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ═════════════ the page ═════════════ */
const AllProposalsPage = () => {
  const [proposals,    setProposals]    = useState([]);
  const [officeCounts, setOfficeCounts] = useState({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const [search,    setSearch]    = useState('');
  const [status,    setStatus]    = useState('all');
  const [type,      setType]      = useState('all');
  const [stuckOnly, setStuckOnly] = useState(false);
  const [stuckDays, setStuckDays] = useState(7);
  const [page,      setPage]      = useState(1);
  const [openId,    setOpenId]    = useState(null);

  const [params, setParams] = useSearchParams();

  const load = useCallback(async () => {
    try {
      const res = await API.get('/admin/proposals');
      setProposals(res.data.proposals || []);
      setOfficeCounts(res.data.office_counts || {});
      setError('');
    } catch (err) {
      setError(errText(err, 'Could not load the proposals.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // the Dashboard's "Needs attention" list links here with ?open=<proposal id>
  useEffect(() => {
    const wanted = params.get('open');
    if (!wanted || loading) return;
    if (proposals.some(p => String(p.proposal_id) === wanted)) setOpenId(Number(wanted));
    setParams({}, { replace: true });
  }, [params, loading, proposals, setParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proposals.filter(p => {
      if (status !== 'all' && p.status !== status) return false;
      if (type   !== 'all' && p.proposal_type !== type) return false;
      if (stuckOnly && !(isOpen(p) && p.days_waiting >= stuckDays)) return false;
      return !q || `${p.researcher} ${p.title} ${p.college || ''}`.toLowerCase().includes(q);
    });
  }, [proposals, search, status, type, stuckOnly, stuckDays]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(() => ({
    total:      proposals.length,
    inProgress: proposals.filter(isOpen).length,
    stuck:      proposals.filter(p => isOpen(p) && p.days_waiting >= stuckDays).length,
    returned:   proposals.filter(p => p.status === 'returned').length,
  }), [proposals, stuckDays]);

  const opened   = openId ? proposals.find(p => p.proposal_id === openId) : null;
  const filtersOn = search || status !== 'all' || type !== 'all' || stuckOnly;
  const closeModal = useCallback(() => setOpenId(null), []);

  const onFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  return (
    <>
      <div className="page-header">
        <h1>All Proposals</h1>
        <p>System-wide view of every submitted proposal, with oversight tools for the Admin.</p>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <div className="stat-card blue">
          <span className="stat-label">Total proposals</span>
          <span className="stat-value">{counts.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Still in progress</span>
          <span className="stat-value">{counts.inProgress}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Stuck {stuckDays}+ days</span>
          <span className="stat-value">{counts.stuck}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Returned to researcher</span>
          <span className="stat-value">{counts.returned}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="po-toolbar">
            <input className="search-input" placeholder="Search by name, title or college…"
              value={search} onChange={onFilter(setSearch)} />
            <select className="search-input" style={{ minWidth: 140 }} value={status} onChange={onFilter(setStatus)}>
              <option value="all">All status</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="search-input" style={{ minWidth: 170 }} value={type} onChange={onFilter(setType)}>
              <option value="all">All types</option>
              {Object.entries(PROPOSAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="po-stuck">
              <input type="checkbox" checked={stuckOnly}
                onChange={e => { setStuckOnly(e.target.checked); setPage(1); }} />
              Stuck for
              <select value={stuckDays} onChange={e => { setStuckDays(Number(e.target.value)); setPage(1); }}>
                {STUCK_OPTIONS.map(d => <option key={d} value={d}>{d}+</option>)}
              </select>
              days
            </label>
            {filtersOn && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => {
                setSearch(''); setStatus('all'); setType('all'); setStuckOnly(false); setPage(1);
              }}>Clear</button>
            )}
          </div>
          <span className="badge badge-blue">{filtered.length} shown</span>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: 16 }}>
            {error}{' '}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setLoading(true); load(); }}>Try again</button>
          </div>
        )}

        {loading ? (
          <div className="empty-state"><p>Loading proposals…</p></div>
        ) : (
          <div className="am-scroll">
            <table className="data-table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Researcher</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Waiting on</th>
                  <th>Days waiting</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(p => (
                  <tr key={p.proposal_id}>
                    <td>
                      <strong>{p.researcher}</strong>
                      <span className="po-sub">{p.college || '—'}</span>
                    </td>
                    <td className="po-title">
                      {p.title}
                      <span className="po-sub">{PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}</span>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[p.status] || 'badge-gray'}`}>
                        {STATUS_LABELS[p.status] || p.status}
                      </span>
                    </td>
                    <td>
                      {!isOpen(p)
                        ? <span style={{ color: '#8a7a7d' }}>Finished</span>
                        : (p.with_role ? OFFICE_LABELS[p.with_role] : 'Researcher')}
                    </td>
                    <td>
                      {isOpen(p)
                        ? <span className={`po-wait ${waitClass(p.days_waiting)}`}>{daysText(p.days_waiting)}</span>
                        : <span className="po-wait none">—</span>}
                    </td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpenId(p.proposal_id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!error && filtered.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="empty-state">
                      <p>
                        {proposals.length === 0
                          ? 'No proposals have been submitted yet.'
                          : stuckOnly && !search && status === 'all' && type === 'all'
                            ? `Nothing is stuck. Every open proposal has had activity within ${stuckDays} days.`
                            : 'No proposals match your filters.'}
                      </p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
      </div>

      {opened && (
        <ProposalModal
          proposal={opened}
          officeCounts={officeCounts}
          onClose={closeModal}
          onChanged={load}
        />
      )}
    </>
  );
};

export default AllProposalsPage;