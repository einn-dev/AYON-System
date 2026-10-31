import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import './AdminCatalog.css';
import { errText } from './adminShared';
import { ConfirmBox } from './AdminCatalogShared';
import { AnnouncementCard, ANN_TYPES, ANN_CHANGED } from '../../components/Announcements';
import { ROLE_LABEL } from '../../utils/terms';
import { FaBullhorn, FaEye, FaEyeSlash, FaPen, FaPlus, FaTrashCan } from 'react-icons/fa6';

/* ─────────────────────────────────────────────────────────────
   Administrator: Announcements
   Post short notices that show at the top of people's dashboards.
   ───────────────────────────────────────────────────────────── */

const ROLES = ['researcher', 'research_coordinator', 'chairperson', 'college_dean',
               'msric_staff', 'special_assistant', 'msric_director', 'ovcred'];
const TITLE_MAX = 100;
const MESSAGE_MAX = 500;

const STATE = {
  showing:   { label: 'Showing now', badge: 'badge-green' },
  scheduled: { label: 'Scheduled',   badge: 'badge-blue'  },
  ended:     { label: 'Ended',       badge: 'badge-gray'  },
  hidden:    { label: 'Hidden',      badge: 'badge-gray'  },
};

const fmt = (v) => (v ? new Date(v).toLocaleString('en-PH', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '');

/* Date → value for <input type="datetime-local"> in local time */
const toLocalInput = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const shownTo = (aud) => (aud && aud.length ? aud.map(r => ROLE_LABEL[r] || r).join(', ') : 'Everyone');

/* ── New / Edit window ── */
const AnnouncementForm = ({ item, onClose, onSaved }) => {
  const [title,   setTitle]   = useState(item?.title || '');
  const [message, setMessage] = useState(item?.message || '');
  const [type,    setType]    = useState(item?.ann_type || 'info');
  const [all,     setAll]     = useState(!(item?.audience || []).length);
  const [roles,   setRoles]   = useState(item?.audience || []);
  const [from,    setFrom]    = useState(toLocalInput(item?.show_from || new Date()));
  const [until,   setUntil]   = useState(toLocalInput(item?.show_until));
  const [notify,  setNotify]  = useState(false);
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const toggleRole = (r) => setRoles(list => (list.includes(r) ? list.filter(x => x !== r) : [...list, r]));

  const save = async () => {
    setError('');
    if (!title.trim())   return setError('Please write a title.');
    if (!message.trim()) return setError('Please write a message.');
    if (!all && !roles.length) return setError('Choose at least one role, or tick Everyone.');
    if (!from) return setError('Please choose when it starts showing.');
    if (until && new Date(until) <= new Date(from)) return setError('"Show until" must be after "Show from".');

    const body = {
      title: title.trim(),
      message: message.trim(),
      ann_type: type,
      audience: all ? [] : ROLES.filter(r => roles.includes(r)),
      show_from: new Date(from).toISOString(),
      show_until: until ? new Date(until).toISOString() : null,
      notify,
    };
    setSaving(true);
    try {
      const res = item
        ? await API.put(`/announcements/${item.announcement_id}`, body)
        : await API.post('/announcements', body);
      onSaved(res.data?.message || 'Saved.');
    } catch (err) {
      setError(errText(err, 'Could not save the announcement.'));
      setSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={() => { if (!saving) onClose(); }}>
      <div className="modal ac-wide" role="dialog" aria-modal="true" aria-label={item ? 'Edit announcement' : 'New announcement'}
        onClick={(e) => e.stopPropagation()}>
        <h3>{item ? 'Edit Announcement' : 'New Announcement'}</h3>
        <p className="am-modal-sub">It shows at the top of the dashboards of the people you choose.</p>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        <div className="form-group">
          <label htmlFor="an-title">Title *</label>
          <input id="an-title" value={title} maxLength={TITLE_MAX} disabled={saving}
            placeholder="Deadline for internally funded proposals"
            onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="an-msg">Message *</label>
          <textarea id="an-msg" className="ac-textarea" rows={4} value={message} maxLength={MESSAGE_MAX} disabled={saving}
            placeholder="The deadline for internally funded proposals is November 30."
            onChange={(e) => setMessage(e.target.value)} />
          <div className="ann-hint">{message.length}/{MESSAGE_MAX}</div>
        </div>

        <div className="form-group">
          <label>Type</label>
          <div className="ann-seg" role="radiogroup" aria-label="Type">
            {Object.entries(ANN_TYPES).map(([k, t]) => (
              <button key={k} type="button" role="radio" aria-checked={type === k}
                className={type === k ? 'on' : ''} onClick={() => setType(k)} disabled={saving}>{t.label}</button>
            ))}
          </div>
          <div className="ann-hint">
            {type === 'urgent' ? 'Urgent cannot be closed by people while it is showing.' : 'People can close it with ×.'}
          </div>
        </div>

        <div className="form-group">
          <label>Shown to</label>
          <label className="ann-check">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} disabled={saving} /> Everyone
          </label>
          {!all && (
            <div className="ann-roles">
              {ROLES.map(r => (
                <label key={r} className="ann-check">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} disabled={saving} />
                  {ROLE_LABEL[r] || r}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="ann-dates">
          <div className="form-group">
            <label htmlFor="an-from">Show from *</label>
            <input id="an-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} disabled={saving} />
          </div>
          <div className="form-group">
            <label htmlFor="an-until">Show until</label>
            <input id="an-until" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} disabled={saving} />
            <div className="ann-hint">Leave empty to show it until you hide it.</div>
          </div>
        </div>

        <label className="ann-check" style={{ marginBottom: 14 }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={saving} />
          Also send as a notification {item ? '(again)' : ''}
        </label>

        <div className="ann-hint" style={{ marginBottom: 6 }}>Preview</div>
        <AnnouncementCard a={{ ann_type: type, title: title.trim() || 'Title', message: message.trim() || 'Your message' }} />

        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : (item ? 'Save Changes' : 'Post Announcement')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/* ── Page ── */
const AdminAnnouncementsPage = () => {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [failed,   setFailed]   = useState('');
  const [filter,   setFilter]   = useState('');
  const [notice,   setNotice]   = useState(null);
  const [editing,  setEditing]  = useState(null);     // null = closed, {} = new, item = edit
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await API.get('/announcements');
      setItems(res.data?.announcements || []);
      setFailed('');
    } catch (err) {
      setFailed(errText(err, 'Could not load the announcements.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changed = async (msg, type = 'success') => {
    setNotice({ type, msg });
    await load();
    window.dispatchEvent(new Event(ANN_CHANGED));
  };

  const setHidden = async (a, hidden) => {
    try {
      const res = await API.patch(`/announcements/${a.announcement_id}/hidden`, { hidden });
      changed(res.data?.message || 'Saved.');
    } catch (err) {
      setNotice({ type: 'error', msg: errText(err, 'That did not work. Please try again.') });
    }
  };

  const shown = items.filter(a => !filter
    || (filter === 'ended' ? ['ended', 'hidden'].includes(a.state) : a.state === filter));

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Announcements</h1>
          <p>Short notices that show at the top of people's dashboards.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setNotice(null); setEditing({}); }}>
          <FaPlus className="ic" />New Announcement
        </button>
      </div>

      {notice && <div className={`alert alert-${notice.type}`} role="status">{notice.msg}</div>}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <select className="search-input" style={{ minWidth: 180 }} value={filter}
              onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
              <option value="">All</option>
              <option value="showing">Showing now</option>
              <option value="scheduled">Scheduled</option>
              <option value="ended">Ended or hidden</option>
            </select>
            <span style={{ fontSize: '0.8rem', color: '#8a7a7d' }}>
              {shown.length} announcement{shown.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Announcement</th>
              <th>Shown To</th>
              <th>Showing</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div className="empty-state"><p>Loading...</p></div></td></tr>
            ) : failed ? (
              <tr><td colSpan={5}><div className="empty-state"><p>{failed}</p></div></td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="empty-state">
                  <FaBullhorn style={{ fontSize: '1.4rem', color: '#c9b9bc' }} />
                  <p>{items.length ? 'No announcements match this filter.' : 'No announcements yet. Post one with "New Announcement".'}</p>
                </div>
              </td></tr>
            ) : shown.map(a => {
              const st = STATE[a.state] || STATE.ended;
              const t  = ANN_TYPES[a.ann_type] || ANN_TYPES.info;
              return (
                <tr key={a.announcement_id}>
                  <td style={{ maxWidth: 360 }}>
                    <span className={`badge ${t.badge}`} style={{ marginRight: 6 }}>{t.label}</span>
                    <strong style={{ overflowWrap: 'anywhere' }}>{a.title}</strong>
                    <div className="ann-row-msg">{a.message}</div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{shownTo(a.audience)}</td>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {fmt(a.show_from)}<br />
                    <span style={{ color: '#8a7a7d' }}>to {a.show_until ? fmt(a.show_until) : 'until hidden'}</span>
                  </td>
                  <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                  <td>
                    <div className="ann-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => { setNotice(null); setEditing(a); }}>
                        <FaPen className="ic" />Edit
                      </button>
                      {a.is_hidden ? (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setHidden(a, false)}>
                          <FaEye className="ic" />Show Again
                        </button>
                      ) : a.state !== 'ended' && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setHidden(a, true)}>
                          <FaEyeSlash className="ic" />Hide
                        </button>
                      )}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setDeleting(a)}>
                        <FaTrashCan className="ic" />Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <AnnouncementForm
          item={editing.announcement_id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); changed(msg); }} />
      )}

      {deleting && (
        <ConfirmBox
          title="Delete this announcement?"
          text={`"${deleting.title}" will be removed for good. To stop showing it but keep it in the list, use Hide instead.`}
          confirmLabel="Yes, Delete It"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const res = await API.delete(`/announcements/${deleting.announcement_id}`);
            setDeleting(null);
            changed(res.data?.message || 'Announcement deleted.');
          }} />
      )}
    </>
  );
};

export default AdminAnnouncementsPage;