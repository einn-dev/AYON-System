import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABEL, STATUS_LABEL, statusBadge, typeLabel } from '../utils/terms';
import { helpIndex } from '../data/helpContent';
import ProposalTracker from './ProposalTracker';
import { ProposalSignatures } from './Signature';
import { ProposalFiles } from './ProposalFiles';
import {
  FaMagnifyingGlass, FaCircleQuestion, FaBell, FaXmark, FaFileLines, FaBoxArchive,
  FaUser, FaArrowRight, FaBookOpen, FaBars,
} from 'react-icons/fa6';
import './TopBar.css';

/* ─────────────────────────────────────────────────────────────
   Top bar on every page: global search (Ctrl K), Help, Notifications.
   The server decides what each role may find (GET /api/search).
   ───────────────────────────────────────────────────────────── */

const MIN = 2;
const fileHref = (fp) => (/^https?:\/\//i.test(fp) ? fp : `http://localhost:5000/${fp}`);
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

/* Where a role acts on a proposal, by status (the page opens with ?open=<id>) */
const actionPage = (role, base, p) => {
  const s = p.status;
  switch (role) {
    case 'researcher': return { path: `${base}/proposals`, label: 'My Proposals' };
    case 'chairperson':
    case 'research_coordinator':
    case 'college_dean':
      return s === 'for_endorsement' && p.endorsement_stage === role
        ? { path: `${base}/for-endorsement`, label: 'For Endorsement' }
        : { path: `${base}/endorsed`, label: 'Endorsed Proposals' };
    case 'special_assistant':
      return s === 'submitted'
        ? { path: `${base}/validate`, label: 'For Validation' }
        : { path: `${base}/submissions`, label: 'All Proposals' };
    case 'msric_director': {
      const m = { under_review: ['for-review', 'For Review'], endorsed: ['endorsed', 'Endorsed to OVCRED'],
                  approved: ['approved', 'Approved Proposals'], rejected: ['rejected', 'Rejected Proposals'] }[s];
      return m ? { path: `${base}/${m[0]}`, label: m[1] } : null;
    }
    case 'ovcred': {
      const m = { endorsed: ['for-endorsement', 'For Final Approval'], approved: ['approved', 'Approved Proposals'],
                  rejected: ['rejected', 'Rejected Proposals'] }[s];
      return m ? { path: `${base}/${m[0]}`, label: m[1] } : null;
    }
    case 'admin': return { path: `${base}/proposals`, label: 'All Proposals' };
    default: return null;
  }
};

/* "Lake" in "Water of Lake Lanao" → highlighted */
const Hi = ({ text, q }) => {
  const t = String(text ?? '');
  const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return t;
  return <>{t.slice(0, i)}<mark>{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
};

/* ── Proposal / repository / user summary window ── */
const Summary = ({ item, role, base, onClose }) => {
  const navigate = useNavigate();
  const [full, setFull] = useState(null);
  const [problem, setProblem] = useState('');
  const isProposal = item.kind === 'proposal';
  const staff = role === 'msric_staff';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!isProposal || staff) return undefined;
    let alive = true;
    API.get(`/proposals/${item.data.proposal_id}`)
      .then((res) => { if (alive) setFull(res.data?.proposal || null); })
      .catch((err) => { if (alive) setProblem(err.response?.data?.message || 'Could not load the details.'); });
    return () => { alive = false; };
  }, [isProposal, staff, item]);

  const go = (path) => { onClose(); navigate(path); };
  const d = item.data;
  const where = isProposal ? actionPage(role, base, d) : null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal tb-sum" role="dialog" aria-modal="true" aria-label="Search result">
        <button type="button" className="tb-x" onClick={onClose} aria-label="Close"><FaXmark /></button>

        {isProposal && (
          <>
            <div className="tb-sum-head">
              <h3>{d.title}</h3>
              <span className={`badge ${statusBadge(d.status)}`}>{STATUS_LABEL[d.status] || d.status}</span>
            </div>
            <p className="tb-sub">Proposal #{d.proposal_id}</p>
            <div className="tb-dl">
              <div><span>Researcher</span><b>{d.researcher || '—'}</b></div>
              <div><span>College</span><b>{d.college || '—'}</b></div>
              <div><span>Type</span><b>{typeLabel(d.proposal_type)}</b></div>
              <div><span>Date Submitted</span><b>{fmt(d.submitted_at)}</b></div>
              {!staff && <div><span>Department</span><b>{d.department || '—'}</b></div>}
            </div>
            {staff && <div className="tb-note">MSIRC Staff can see the list details only, not the proposal contents.</div>}
            {!staff && problem && <div className="alert alert-error">{problem}</div>}
            {!staff && !problem && !full && <p className="tb-sub">Loading the tracker…</p>}
            {full && full.status !== 'draft' && (
              <>
                <ProposalTracker proposal={full} />
                <ProposalSignatures proposal={full} />
              </>
            )}
            {full && <ProposalFiles proposal={full} compact />}
          </>
        )}

        {item.kind === 'repo' && (
          <>
            <div className="tb-sum-head"><h3>{d.title}</h3>
              {d.access_type === 'private' && <span className="badge badge-gray">Private</span>}</div>
            <p className="tb-sub">Research Repository</p>
            <div className="tb-dl">
              <div><span>Author</span><b>{d.author || '—'}</b></div>
              <div><span>College</span><b>{d.college || '—'}</b></div>
              <div><span>Year Stored</span><b>{d.year || '—'}</b></div>
            </div>
            {d.file_path && (
              <a className="btn btn-outline btn-sm" href={fileHref(d.file_path)} target="_blank" rel="noreferrer">
                <FaFileLines className="ic" />Open the File
              </a>
            )}
          </>
        )}

        {item.kind === 'user' && (
          <>
            <div className="tb-sum-head"><h3>{d.name}</h3>
              <span className={`badge ${d.is_active ? 'badge-green' : 'badge-gray'}`}>{d.is_active ? 'Active' : 'Deactivated'}</span></div>
            <p className="tb-sub">{d.email}</p>
            <div className="tb-dl"><div><span>Role</span><b>{d.role_label}</b></div></div>
          </>
        )}

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
          {isProposal && where && !staff && (
            <button type="button" className="btn btn-primary" onClick={() => go(`${where.path}?open=${d.proposal_id}`)}>
              Open in {where.label}<FaArrowRight className="ic-r" />
            </button>
          )}
          {item.kind === 'user' && (
            <button type="button" className="btn btn-primary" onClick={() => go(`${base}/users`)}>
              Go to User Accounts<FaArrowRight className="ic-r" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ── Search window ── */
const SearchPalette = ({ role, base, navItems, onClose, onPick }) => {
  const [q, setQ]           = useState('');
  const [res, setRes]       = useState({ proposals: [], repository: [], users: [] });
  const [loading, setLoad]  = useState(false);
  const [problem, setProb]  = useState('');
  const [sel, setSel]       = useState(0);
  const inputRef = useRef(null);
  const seq = useRef(0);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const term = q.trim();
  const isId = /^#?\d+$/.test(term);
  const ready = isId || term.length >= MIN;

  /* ask the server, 250 ms after typing stops; ignore late answers */
  useEffect(() => {
    if (!ready) { setRes({ proposals: [], repository: [], users: [] }); setProb(''); setLoad(false); return undefined; }
    const my = ++seq.current;
    setLoad(true);
    const t = setTimeout(() => {
      API.get('/search', { params: { q: term } })
        .then((r) => { if (my === seq.current) { setRes(r.data || {}); setProb(''); } })
        .catch((err) => { if (my === seq.current) setProb(err.response?.data?.message || 'Search is not available right now.'); })
        .finally(() => { if (my === seq.current) setLoad(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [term, ready]);

  const pages = useMemo(() => {
    const all = [...navItems.map(n => ({ label: n.label, path: n.path })), { label: 'Help', path: `${base}/help` }];
    if (!term) return all.slice(0, 5);
    return all.filter(p => p.label.toLowerCase().includes(term.toLowerCase()));
  }, [navItems, base, term]);

  const help = useMemo(() => {
    if (!ready || isId) return [];
    const t = term.toLowerCase();
    return helpIndex(role).filter(h => h.title.toLowerCase().includes(t) || h.text.toLowerCase().includes(t)).slice(0, 5);
  }, [role, term, ready, isId]);

  /* one flat list for the arrow keys */
  const groups = [
    ['Proposals',           (res.proposals || []).map(p => ({ kind: 'proposal', data: p }))],
    ['Research Repository', (res.repository || []).map(r => ({ kind: 'repo', data: r }))],
    ['Users',               (res.users || []).map(u => ({ kind: 'user', data: u }))],
    [ready ? 'Pages' : 'Go to a page', (ready && isId ? [] : pages).map(p => ({ kind: 'page', data: p }))],
    ['Help',                help.map(h => ({ kind: 'help', data: h }))],
  ].filter(([, rows]) => rows.length);
  const flat = groups.flatMap(([, rows]) => rows);

  useEffect(() => { setSel(0); }, [term]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${sel}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[sel]) onPick(flat[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  let i = -1;
  const row = (item) => {
    i += 1;
    const n = i;
    const d = item.data;
    let icon; let body; let right = null;
    if (item.kind === 'proposal') {
      icon = <FaFileLines />;
      body = <><b><Hi text={d.title} q={isId ? '' : term} /></b>
        <small>#{d.proposal_id} · <Hi text={d.researcher} q={isId ? '' : term} />{d.college ? <> · <Hi text={d.college} q={isId ? '' : term} /></> : null}</small></>;
      right = <span className={`badge ${statusBadge(d.status)}`}>{STATUS_LABEL[d.status] || d.status}</span>;
    } else if (item.kind === 'repo') {
      icon = <FaBoxArchive />;
      body = <><b><Hi text={d.title} q={term} /></b><small><Hi text={d.author || '—'} q={term} />{d.year ? ` · ${d.year}` : ''}{d.access_type === 'private' ? ' · Private' : ''}</small></>;
    } else if (item.kind === 'user') {
      icon = <FaUser />;
      body = <><b><Hi text={d.name} q={term} /></b><small><Hi text={d.email} q={term} /></small></>;
      right = <span className="tb-muted">{d.role_label}</span>;
    } else if (item.kind === 'page') {
      icon = <FaArrowRight />;
      body = <b><Hi text={d.label} q={term} /></b>;
    } else {
      icon = <FaBookOpen />;
      body = <b><Hi text={d.title} q={term} /></b>;
    }
    return (
      <div key={`${item.kind}-${n}`} data-i={n} role="option" aria-selected={sel === n}
        className={`tb-row${sel === n ? ' on' : ''}`}
        onMouseEnter={() => setSel(n)} onMouseDown={(e) => { e.preventDefault(); onPick(item); }}>
        <span className="tb-ri">{icon}</span>
        <span className="tb-rm">{body}</span>
        {right}
      </div>
    );
  };

  return createPortal(
    <div className="tb-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tb-pal" role="dialog" aria-modal="true" aria-label="Search AYON">
        <div className="tb-pin">
          <FaMagnifyingGlass />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search proposals, research, pages and help…" aria-label="Search" autoComplete="off"
            role="combobox" aria-expanded="true" aria-controls="tb-results" maxLength={100} />
          <kbd>Esc</kbd>
        </div>
        <div className="tb-res" id="tb-results" role="listbox" ref={listRef}>
          {!ready && <div className="tb-empty">Type at least {MIN} letters, or a proposal number like <b>#42</b>.</div>}
          {problem && <div className="tb-empty tb-err">{problem}</div>}
          {groups.map(([name, rows]) => (
            <div key={name}>
              <div className="tb-g">{name}</div>
              {rows.map(row)}
            </div>
          ))}
          {ready && !loading && !problem && !flat.length && (
            <div className="tb-empty">Nothing found for "<b>{term}</b>". Try a shorter word.</div>
          )}
          {ready && loading && !flat.length && <div className="tb-empty">Searching…</div>}
        </div>
        <div className="tb-foot"><span>↑ ↓ to move · Enter to open · Esc to close</span>
          <span>Searching as {ROLE_LABEL[role] || role}</span></div>
      </div>
    </div>,
    document.body,
  );
};

/* ── The bar ── */
const TopBar = ({ navItems, unread = 0, onMenu = null }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;
  const base = `/${String(navItems?.[0]?.path || '').split('/')[1] || ''}`;
  const notifPath = (navItems || []).find(n => /\/notifications$/.test(n.path))?.path;
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);
  const closeSummary = useCallback(() => setSummary(null), []);

  const pick = (item) => {
    setOpen(false);
    if (item.kind === 'page') navigate(item.data.path);
    else if (item.kind === 'help') navigate(`${base}/help#${item.data.id}`);
    else setSummary(item);
  };

  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

  return (
    <>
      <div className="topbar">
        {onMenu && (
          <button type="button" className="tb-icon tb-menu" onClick={onMenu}
            aria-label="Open menu" aria-controls="ayon-menu" title="Menu">
            <FaBars />
          </button>
        )}
        <button type="button" className="tb-search" onClick={() => setOpen(true)} aria-label="Search AYON">
          <FaMagnifyingGlass />
          <span className="tb-ph">Search proposals, research, pages and help…</span>
          <kbd>{mac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>
        <div className="tb-right">
          <button type="button" className="tb-icon" title="Help and User Guide" aria-label="Help and User Guide"
            onClick={() => navigate(`${base}/help`)}>
            <FaCircleQuestion />
          </button>
          {notifPath && (
            <button type="button" className="tb-icon" title="Notifications"
              aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
              onClick={() => navigate(notifPath)}>
              <FaBell />
              {unread > 0 && <i className="tb-badge">{unread > 99 ? '99+' : unread}</i>}
            </button>
          )}
        </div>
      </div>

      {open && <SearchPalette role={role} base={base} navItems={navItems || []} onClose={close} onPick={pick} />}
      {summary && <Summary item={summary} role={role} base={base} onClose={closeSummary} />}
    </>
  );
};

export default TopBar;