import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import './AdminCatalog.css';
import { errText, Pager } from './adminShared';
import { ConfirmBox, cap, fmtDate } from './AdminCatalogShared';
import { FileButtons } from '../../components/ProposalFiles';
import MessageToast from '../../components/MessageToast';
import { repoTypeLabel } from '../../utils/terms';

const PAGE_SIZE = 10;

const ACCESS_BADGE = { public: 'badge-green', private: 'badge-amber' };

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
            ? <FileButtons path={item.file_path} label="the stored file" />
            : 'No file attached'}</dd>
        </dl>

        <div className="ac-box">
          <h4>Edit Details</h4>
          <MessageToast message={error ? { type: 'error', msg: error } : null} onClose={() => setError('')} />
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
              <select id="rp-acc" value={access} onChange={(e) => setAccess(e.target.value)}
                disabled={saving || item.source_type === 'external'}>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
              {item.source_type === 'external' && (
                <small style={{ color: '#718096' }}>Externally funded research always stays private: only the researcher, their college and the MSIRC offices can see it.</small>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Close</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save Changes'}
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
      const res = await API.get('/admin/repository');
      setItems(res.data.items || []);
    } catch (err) {
      setError(errText(err, 'Could not load the repository.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const types = useMemo(() => [...new Set(items.map(repoTypeLabel))].sort(), [items]);
  const colleges = useMemo(
    () => [...new Set(items.map(i => i.college).filter(Boolean))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (access  === 'all' || i.access_type === access) &&
      (source  === 'all' || repoTypeLabel(i) === source) &&
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

  const askToggle = (i) => {
    const to = i.access_type === 'public' ? 'private' : 'public';
    setConfirm({
      title: `Make this ${to}?`,
      text: to === 'public'
        ? 'Every researcher will be able to see and open this in their Repository page.'
        : 'Other researchers will no longer see this item. The owner, their college offices, MSIRC and the Administrator still can.',
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
        <p>Every approved submission is stored here automatically, as Private. Control who can see each one, fix its details, or take it out.</p>
      </div>

      {/* the list did not load: stays on the page; a saved change pops up */}
      {error && (
        <div className="alert alert-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={load}>Try Again</button>
        </div>
      )}
      <MessageToast message={message ? { type: 'success', msg: message } : null} onClose={() => setMessage('')} />

      <div className="stats-grid">
        <div className="stat-card blue"><span className="stat-label">Stored Items</span><span className="stat-value">{counts.total}</span></div>
        <div className="stat-card green"><span className="stat-label">Public</span><span className="stat-value">{counts.pub}</span></div>
        <div className="stat-card amber"><span className="stat-label">Private</span><span className="stat-value">{counts.priv}</span></div>
        <div className="stat-card"><span className="stat-label">Externally Funded Research</span><span className="stat-value">{counts.external}</span></div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search title, author or keywords…"
              value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="search-input" value={access} onChange={(e) => setAccess(e.target.value)} aria-label="Access">
              <option value="all">All Access</option>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <select className="search-input" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Submission Type">
              <option value="all">All Submission Types</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
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
              <tr><th>Research Title</th><th>Submission Type</th><th>Access</th><th>Date Stored</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pageRows.map(i => (
                <tr key={i.repo_id}>
                  <td className="ac-cell-title">
                    <div className="ac-title">{i.title}</div>
                    <span className="ac-sub">{[i.author, i.college].filter(Boolean).join(' · ') || '—'}</span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: '#5e5155' }}>{repoTypeLabel(i)}</td>
                  <td><span className={`badge ${ACCESS_BADGE[i.access_type] || 'badge-gray'}`}>{cap(i.access_type)}</span></td>
                  <td className="am-muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(i.store_date)}</td>
                  <td>
                    <div className="am-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelected(i)}>View Details</button>
                      {i.source_type !== 'external' && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => askToggle(i)}>
                          Make {i.access_type === 'public' ? 'Private' : 'Public'}
                        </button>
                      )}
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
                <tr><td colSpan={5}><div className="empty-state loading-state" role="status"><p>Loading the repository…</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />

        <div className="am-legend">
          Public = shown to every researcher in their Repository page. Private = only the researcher who owns it, the MSIRC offices and the Administrator can see it.
          Only the owner and the Administrator can change it.
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