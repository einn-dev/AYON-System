import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import './AdminCatalog.css';
import { errText, Pager } from './adminShared';
import { ConfirmBox, fileHref, cap, fmtDate } from './AdminCatalogShared';

const PAGE_SIZE = 25;

const ACCESS_BADGE = { public: 'badge-green', private: 'badge-amber' };
const SOURCE_LABEL = { proposal: 'Proposal', external: 'Externally Funded' };

/* ─────────── Details + edit pop-up ─────────── */
const ItemModal = ({ item, onSaved, onClose }) => {
  const [title,    setTitle]    = useState(item.title || '');
  const [abstract, setAbstract] = useState(item.abstract || '');
  const [keywords, setKeywords] = useState(item.keywords || '');
  const [access,   setAccess]   = useState(item.access_type || 'private');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const dirty = title.trim() !== (item.title || '')
    || abstract.trim() !== (item.abstract || '')
    || keywords.trim() !== (item.keywords || '')
    || access !== item.access_type;

  const save = async () => {
    if (!title.trim()) { setError('Title cannot be empty.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await API.patch(`/admin/repository/${item.repo_id}`, {
        title: title.trim(), abstract: abstract.trim(), keywords: keywords.trim(), access_type: access,
      });
      onSaved(res.data.changed === false ? 'Nothing changed.' : 'Saved. The change is in the Audit Log.');
    } catch (err) {
      setError(errText(err, 'Could not save the changes.'));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal ac-wide" role="dialog" aria-modal="true" aria-label="Repository item"
        onClick={(e) => e.stopPropagation()}>
        <h3>Repository Item</h3>
        <p className="am-modal-sub">
          {item.source_type === 'external' ? 'Externally funded research' : `From proposal #${item.proposal_id ?? '—'}`}
        </p>

        <dl className="ac-dl">
          <dt>Author</dt><dd>{item.author || '—'}</dd>
          <dt>College</dt><dd>{item.college || '—'}</dd>
          <dt>Department</dt><dd>{item.department || '—'}</dd>
          <dt>Stored</dt><dd>{fmtDate(item.store_date)}</dd>
          <dt>File</dt>
          <dd>{item.file_path
            ? <a href={fileHref(item.file_path)} target="_blank" rel="noreferrer">Open the stored file</a>
            : 'No file attached'}</dd>
        </dl>

        <div className="ac-box">
          <h4>Edit Details</h4>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <div className="form-group">
            <label htmlFor="rp-title">Research Title</label>
            <input id="rp-title" value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="rp-abs">Abstract</label>
            <textarea id="rp-abs" className="ac-textarea" value={abstract}
              onChange={(e) => setAbstract(e.target.value)} disabled={saving} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="rp-kw">Keywords</label>
              <input id="rp-kw" value={keywords} maxLength={255} onChange={(e) => setKeywords(e.target.value)} disabled={saving} />
            </div>
            <div className="form-group">
              <label htmlFor="rp-acc">Access</label>
              <select id="rp-acc" value={access} onChange={(e) => setAccess(e.target.value)} disabled={saving}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Close</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ─────────── The page ─────────── */
const AdminRepositoryPage = () => {
  const [items,      setItems]      = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [message,    setMessage]    = useState('');

  const [search,  setSearch]  = useState('');
  const [access,  setAccess]  = useState('all');
  const [source,  setSource]  = useState('all');
  const [college, setCollege] = useState('all');
  const [page,    setPage]    = useState(1);

  const [selected, setSelected] = useState(null);   // item whose details are open
  const [confirm,  setConfirm]  = useState(null);   // { title, text, reason, confirmLabel, danger, run }

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, cand] = await Promise.allSettled([
        API.get('/admin/repository'),
        API.get('/admin/repository/candidates'),
      ]);
      if (list.status === 'fulfilled') setItems(list.value.data.items || []);
      else setError(errText(list.reason, 'Could not load the repository.'));
      setCandidates(cand.status === 'fulfilled' ? (cand.value.data.candidates || []) : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const colleges = useMemo(
    () => [...new Set(items.map(i => i.college).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (access  === 'all' || i.access_type === access) &&
      (source  === 'all' || i.source_type === source) &&
      (college === 'all' || i.college === college) &&
      (!q || `${i.title} ${i.author || ''} ${i.keywords || ''}`.toLowerCase().includes(q)));
  }, [items, search, access, source, college]);

  useEffect(() => { setPage(1); }, [search, access, source, college]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = {
    total:    items.length,
    pub:      items.filter(i => i.access_type === 'public').length,
    priv:     items.filter(i => i.access_type === 'private').length,
    external: items.filter(i => i.source_type === 'external').length,
  };

  const done = async (text) => {
    setSelected(null);
    setConfirm(null);
    setMessage(text);
    await load();
  };

  const askStore = (c) => setConfirm({
    title: 'Store in the Research Repository?',
    text: `"${c.title}" will be stored as PRIVATE. You can make it public afterwards.`,
    confirmLabel: 'Store',
    run: async () => {
      const res = await API.post('/admin/repository', { proposal_id: c.proposal_id, access_type: 'private' });
      await done(`${res.data.message} The change is in the Audit Log.`);
    },
  });

  const askToggle = (i) => {
    const to = i.access_type === 'public' ? 'private' : 'public';
    setConfirm({
      title: `Make this ${to}?`,
      text: to === 'public'
        ? 'Every researcher will be able to see and open this in their Repository page.'
        : 'Researchers will no longer see this item. MSIRC offices and the Administrator still can.',
      confirmLabel: `Make ${to}`,
      run: async () => {
        await API.patch(`/admin/repository/${i.repo_id}`, { access_type: to });
        await done(`"${i.title}" is now ${to}. The change is in the Audit Log.`);
      },
    });
  };

  const askRemove = (i) => setConfirm({
    title: 'Remove from the Research Repository?',
    text: `"${i.title}" will be taken out of the repository. The proposal itself and its uploaded file are NOT deleted.`,
    reason: true,
    confirmLabel: 'Remove',
    danger: true,
    run: async (reason) => {
      await API.post(`/admin/repository/${i.repo_id}/remove`, { reason });
      await done(`"${i.title}" was removed. The reason is saved in the Audit Log.`);
    },
  });

  const filtersOn = !!(search.trim() || access !== 'all' || source !== 'all' || college !== 'all');

  return (
    <>
      <div className="page-header">
        <h1>Research Repository</h1>
        <p>Every stored research output. Control who can see each one, fix its details, or take it out.</p>
      </div>

      {error   && <div className="alert alert-error" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}

      <div className="stats-grid">
        <div className="stat-card blue"><span className="stat-label">Stored Items</span><span className="stat-value">{counts.total}</span></div>
        <div className="stat-card green"><span className="stat-label">Public</span><span className="stat-value">{counts.pub}</span></div>
        <div className="stat-card amber"><span className="stat-label">Private</span><span className="stat-value">{counts.priv}</span></div>
        <div className="stat-card"><span className="stat-label">Externally Funded Research</span><span className="stat-value">{counts.external}</span></div>
      </div>

      {candidates.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <strong style={{ color: '#5e1420' }}>Approved but not yet stored</strong>
              <div className="ac-note">These proposals were approved but never added to the repository.</div>
            </div>
            <span className="badge badge-amber">{candidates.length} waiting</span>
          </div>
          {candidates.map(c => (
            <div className="ac-cand" key={c.proposal_id}>
              <div className="ac-cand-main">
                <div className="ac-title">{c.title}</div>
                <span className="ac-sub">{[c.author, c.college].filter(Boolean).join(' · ') || '—'}</span>
              </div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => askStore(c)}>
                Store as Private
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search title, author or keywords..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="search-input" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Access">
              <option value="all">All Access</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <select className="search-input" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
              <option value="all">All Sources</option>
              <option value="proposal">Proposal</option>
              <option value="external">Externally Funded Research</option>
            </select>
            <select className="search-input" value={college} onChange={(e) => setCollege(e.target.value)} aria-label="College">
              <option value="all">All Colleges</option>
              {colleges.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {filtersOn && (
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => { setSearch(''); setAccess('all'); setSource('all'); setCollege('all'); }}>
                Clear Filters
              </button>
            )}
          </div>
          <span className="badge badge-blue">{filtered.length} shown</span>
        </div>

        <div className="am-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Research Title</th><th>Source</th><th>Access</th><th>Date Stored</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pageRows.map(i => (
                <tr key={i.repo_id}>
                  <td className="ac-cell-title">
                    <div className="ac-title">{i.title}</div>
                    <span className="ac-sub">{[i.author, i.college].filter(Boolean).join(' · ') || '—'}</span>
                  </td>
                  <td><span className="badge badge-gray">{SOURCE_LABEL[i.source_type] || i.source_type}</span></td>
                  <td><span className={`badge ${ACCESS_BADGE[i.access_type] || 'badge-gray'}`}>{cap(i.access_type)}</span></td>
                  <td className="am-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(i.store_date)}</td>
                  <td>
                    <div className="am-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(i)}>View Details</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => askToggle(i)}>
                        Make {i.access_type === 'public' ? 'Private' : 'Public'}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => askRemove(i)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <p>{items.length === 0 ? 'Nothing has been stored in the repository yet.' : 'No repository items match your filters.'}</p>
                  </div>
                </td></tr>
              )}
              {loading && (
                <tr><td colSpan={5}><div className="empty-state"><p>Loading the repository...</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />

        <div className="am-legend">
          Public = shown to every researcher in their Repository page. Private = only MSIRC offices and the Administrator can see it.
        </div>
      </div>

      {selected && (
        <ItemModal item={selected} onClose={() => setSelected(null)}
          onSaved={(text) => done(text)} />
      )}
      {confirm && (
        <ConfirmBox {...confirm} onClose={() => setConfirm(null)} onConfirm={confirm.run} />
      )}
    </>
  );
};

export default AdminRepositoryPage;