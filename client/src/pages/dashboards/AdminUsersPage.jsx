import React, { useState, useEffect, useMemo } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';
import './AdminModule.css';
import { COLLEGES, getDepartments } from '../../data/Colleges';
import {
  ROLES, ROLE_LABELS, ROLES_NEED_COLLEGE, ROLES_NEED_DEPARTMENT,
  LOCKED_STYLE, roleBadge, userStatus, STATUS_META, errText,
} from './adminShared';

const EMPTY_ADD = {
  first_name: '', last_name: '', email: '',
  password: '', role: 'researcher',
  department: '', college: '',
};

/* ───────────────── Add User pop-up (same fields as before) ───────────────── */
const AddUserModal = ({ onClose, onCreated, notify }) => {
  const [form, setForm]     = useState(EMPTY_ADD);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const needsCollege    = ROLES_NEED_COLLEGE.includes(form.role);
  const needsDepartment = ROLES_NEED_DEPARTMENT.includes(form.role);
  const departments     = getDepartments(form.college);

  // changing the role clears the boxes that no longer apply to it
  const handleRoleChange = (role) => {
    setForm({
      ...form,
      role,
      college:    ROLES_NEED_COLLEGE.includes(role)    ? form.college    : '',
      department: ROLES_NEED_DEPARTMENT.includes(role) ? form.department : '',
    });
  };

  // a different college has different departments, so the old one is cleared
  const handleCollegeChange = (college) => setForm({ ...form, college, department: '' });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (form.password.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      await API.post('/admin/users', form);
      notify('success', 'User created successfully!');
      onCreated();
      onClose();
    } catch (error) {
      setErr(errText(error, 'Failed to create user.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Add New User</h3>
        <form onSubmit={submit}>
          {err && <div className="alert alert-error">{err}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input required value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input required value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="text" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Password (at least 8 characters)</label>
              <input type="password" required value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={e => handleRoleChange(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>College{needsCollege ? ' *' : ''}</label>
            <select required={needsCollege} disabled={!needsCollege}
              value={form.college} title={form.college}
              style={needsCollege ? undefined : LOCKED_STYLE}
              onChange={e => handleCollegeChange(e.target.value)}>
              <option value="">
                {needsCollege ? '— Select a college —' : '— Not needed for this role —'}
              </option>
              {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Department{needsDepartment ? ' *' : ''}</label>
            <select required={needsDepartment} disabled={!needsDepartment || !form.college}
              value={form.department} title={form.department}
              style={(!needsDepartment || !form.college) ? LOCKED_STYLE : undefined}
              onChange={e => setForm({ ...form, department: e.target.value })}>
              <option value="">
                {!needsDepartment
                  ? '— Not needed for this role —'
                  : form.college ? '— Select a department —' : '— Select a college first —'}
              </option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ───────────────── Deactivate pop-up (asks for an optional reason) ───────────────── */
const DeactivateModal = ({ user, onClose, onDone, notify }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const confirm = async () => {
    setSaving(true);
    setErr('');
    try {
      await API.patch(`/admin/users/${user.user_id}/status`, { is_active: 0, reason });
      notify('success', `${user.first_name} ${user.last_name} was deactivated.`);
      onDone();
      onClose();
    } catch (error) {
      setErr(errText(error, 'Failed to update status.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Deactivate {user.first_name} {user.last_name}?</h3>
        <p className="am-modal-sub" style={{ margin: '-8px 0 16px' }}>
          They will no longer be able to sign in. You can activate the account again at any time.
        </p>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="form-group">
          <label>Reason (optional — saved in the Audit Log)</label>
          <input value={reason} maxLength={200} placeholder="e.g. Left the university"
            onChange={e => setReason(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={saving} onClick={confirm}>
            {saving ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────── Edit User pop-up ───────────────── */
const EditUserModal = ({ user, isSelf, isLastAdmin, onClose, onChanged, notify }) => {
  const [form, setForm] = useState(() => ({
    first_name: user.first_name || '',
    last_name:  user.last_name  || '',
    email:      user.email      || '',
    role:       user.role_type  || 'researcher',
    active:     user.is_active ? 'active' : 'inactive',
    college:    user.college    || '',
    department: user.department || '',
    reason:     '',
  }));
  const [saving,       setSaving]       = useState(false);
  const [err,          setErr]          = useState('');
  const [busy,         setBusy]         = useState('');   // which account tool is running
  const [confirmReset, setConfirmReset] = useState(false);
  const [tempPw,       setTempPw]       = useState('');
  const [copied,       setCopied]       = useState(false);

  const locked        = isSelf || isLastAdmin;
  const status        = userStatus(user);
  const roleChanged   = form.role !== (user.role_type || 'researcher');
  const nowActive     = form.active === 'active';
  const statusChanged = nowActive !== !!user.is_active;

  const needsCollege    = ROLES_NEED_COLLEGE.includes(form.role);
  const needsDepartment = ROLES_NEED_DEPARTMENT.includes(form.role);
  const departments     = getDepartments(form.college);

  const dirty =
    form.first_name.trim() !== (user.first_name || '') ||
    form.last_name.trim()  !== (user.last_name  || '') ||
    form.email.trim().toLowerCase() !== String(user.email || '').toLowerCase() ||
    roleChanged || statusChanged ||
    (needsCollege    && form.college    !== (user.college    || '')) ||
    (needsDepartment && form.department !== (user.department || ''));

  const handleRoleChange = (role) => {
    setForm({
      ...form,
      role,
      college:    ROLES_NEED_COLLEGE.includes(role)    ? form.college    : '',
      department: ROLES_NEED_DEPARTMENT.includes(role) ? form.department : '',
    });
  };

  const handleCollegeChange = (college) => setForm({ ...form, college, department: '' });

  const save = async (e) => {
    e.preventDefault();
    setErr('');

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setErr('First name and last name cannot be empty.');
      return;
    }
    if (roleChanged && needsCollege && !form.college) {
      setErr('Please choose a college for this role.');
      return;
    }
    if (roleChanged && needsDepartment && !form.department) {
      setErr('Please choose a department for this role.');
      return;
    }

    const payload = {
      first_name: form.first_name.trim(),
      last_name:  form.last_name.trim(),
      email:      form.email.trim(),
    };
    if (roleChanged)   payload.role_type = form.role;
    if (statusChanged) { payload.is_active = nowActive; payload.reason = form.reason; }
    if (needsCollege)    payload.college    = form.college;
    if (needsDepartment) payload.department = form.department;

    setSaving(true);
    try {
      await API.patch(`/admin/users/${user.user_id}`, payload);
      notify('success', 'Changes saved.');
      onChanged();
      onClose();
    } catch (error) {
      setErr(errText(error, 'Could not save the changes.'));
    } finally {
      setSaving(false);
    }
  };

  /* ── account tools ── */
  const runTool = async (key, request, successText) => {
    setBusy(key);
    setErr('');
    try {
      const res = await request();
      notify('success', successText);
      onChanged();
      return res;
    } catch (error) {
      setErr(errText(error, 'That did not work. Please try again.'));
      return null;
    } finally {
      setBusy('');
    }
  };

  const markVerified = () =>
    runTool('verify', () => API.post(`/admin/users/${user.user_id}/verify-email`), 'Email marked as verified.');

  const resendVerification = () =>
    runTool('resend', () => API.post(`/admin/users/${user.user_id}/resend-verification`), 'Verification email sent.');

  const resetPassword = async () => {
    setConfirmReset(false);
    const res = await runTool(
      'reset',
      () => API.post(`/admin/users/${user.user_id}/reset-password`),
      'A temporary password was created.'
    );
    if (res?.data?.temporary_password) {
      setTempPw(res.data.temporary_password);
      setCopied(false);
    }
  };

  const copyTemp = async () => {
    try {
      await navigator.clipboard.writeText(tempPw);
      setCopied(true);
    } catch {
      setCopied(false);   // the code box is selectable, so it can still be copied by hand
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal am-wide" onClick={e => e.stopPropagation()}>
        <h3>Edit user</h3>
        <p className="am-modal-sub">
          {status === 'pending' ? 'Email not verified yet' : 'Email verified'}
          {status === 'deactivated' ? ' · Account deactivated' : ''}
        </p>

        {isSelf && (
          <div className="am-note">
            This is your own account. You can edit your name and email, but you can't
            change your own role or deactivate yourself.
          </div>
        )}
        {!isSelf && isLastAdmin && (
          <div className="am-note">
            This is the last active Admin account, so its role and status are locked.
            Create or activate another Admin first.
          </div>
        )}
        {err && <div className="alert alert-error">{err}</div>}

        <form onSubmit={save}>
          <div className="form-row">
            <div className="form-group">
              <label>First name</label>
              <input required value={form.first_name} maxLength={50}
                onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Last name</label>
              <input required value={form.last_name} maxLength={50}
                onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input type="text" required value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} disabled={locked}
                style={locked ? LOCKED_STYLE : undefined}
                onChange={e => handleRoleChange(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.active} disabled={locked}
                style={locked ? LOCKED_STYLE : undefined}
                onChange={e => setForm({ ...form, active: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
          </div>

          {statusChanged && !nowActive && (
            <div className="form-group">
              <label>Reason (optional — saved in the Audit Log)</label>
              <input value={form.reason} maxLength={200} placeholder="e.g. Left the university"
                onChange={e => setForm({ ...form, reason: e.target.value })} />
            </div>
          )}

          <div className="form-group">
            <label>College{needsCollege && roleChanged ? ' *' : ''}</label>
            <select disabled={!needsCollege}
              value={form.college} title={form.college}
              style={needsCollege ? undefined : LOCKED_STYLE}
              onChange={e => handleCollegeChange(e.target.value)}>
              <option value="">
                {needsCollege ? '— Select a college —' : '— Not needed for this role —'}
              </option>
              {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
              {form.college && !COLLEGES.includes(form.college) && (
                <option value={form.college}>{form.college}</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Department{needsDepartment && roleChanged ? ' *' : ''}</label>
            <select disabled={!needsDepartment || !form.college}
              value={form.department} title={form.department}
              style={(!needsDepartment || !form.college) ? LOCKED_STYLE : undefined}
              onChange={e => setForm({ ...form, department: e.target.value })}>
              <option value="">
                {!needsDepartment
                  ? '— Not needed for this role —'
                  : form.college ? '— Select a department —' : '— Select a college first —'}
              </option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
              {form.department && !departments.includes(form.department) && (
                <option value={form.department}>{form.department}</option>
              )}
            </select>
          </div>

          <div className="am-tools">
            <h4>Account tools</h4>
            <div className="am-actions">
              <button type="button" className="btn btn-outline btn-sm"
                disabled={!!busy} onClick={() => { setConfirmReset(true); setTempPw(''); }}>
                Reset password
              </button>
              <button type="button" className="btn btn-outline btn-sm"
                disabled={!!busy || status !== 'pending'} onClick={markVerified}>
                {busy === 'verify' ? 'Working…' : 'Mark email as verified'}
              </button>
              <button type="button" className="btn btn-outline btn-sm"
                disabled={!!busy || status !== 'pending'} onClick={resendVerification}>
                {busy === 'resend' ? 'Sending…' : 'Resend verification'}
              </button>
            </div>

            {confirmReset && (
              <div className="am-confirm">
                Create a new temporary password for <strong>{user.first_name} {user.last_name}</strong>?
                Their current password will stop working right away.
                <div className="am-actions">
                  <button type="button" className="btn btn-primary btn-sm"
                    disabled={!!busy} onClick={resetPassword}>Yes, reset it</button>
                  <button type="button" className="btn btn-outline btn-sm"
                    onClick={() => setConfirmReset(false)}>Cancel</button>
                </div>
              </div>
            )}

            {tempPw && (
              <div className="am-temp">
                <strong>Temporary password</strong> — shown only this once. Give it to the user
                in person or through a channel you trust; it is not emailed.
                <div className="am-temp-row">
                  <code>{tempPw}</code>
                  <button type="button" className="btn btn-outline btn-sm" onClick={copyTemp}>
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              {tempPw ? 'Close' : 'Cancel'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ───────────────── The page ───────────────── */
const AdminUsersPage = ({ users, currentUserId, onRefresh }) => {
  const [search,       setSearch]       = useState('');
  const [roleFilter,   setRoleFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAdd,      setShowAdd]      = useState(false);
  const [editingId,    setEditingId]    = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [alert,        setAlert]        = useState(null);

  const notify = (type, msg) => setAlert({ type, msg });

  // messages disappear by themselves
  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(() => setAlert(null), 6000);
    return () => clearTimeout(t);
  }, [alert]);

  const activeAdmins = useMemo(
    () => users.filter(u => u.role_type === 'admin' && u.is_active).length,
    [users]
  );

  const counts = useMemo(() => ({
    all:         users.length,
    active:      users.filter(u => userStatus(u) === 'active').length,
    pending:     users.filter(u => userStatus(u) === 'pending').length,
    deactivated: users.filter(u => userStatus(u) === 'deactivated').length,
  }), [users]);

  const filtered = users.filter(u => {
    const s = search.trim().toLowerCase();
    const matchSearch = !s ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(s) ||
      String(u.email).toLowerCase().includes(s);
    const matchRole   = roleFilter === 'all'   || u.role_type === roleFilter;
    const matchStatus = statusFilter === 'all' || userStatus(u) === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const isSelf      = (u) => String(u.user_id) === String(currentUserId);
  const isLastAdmin = (u) => u.role_type === 'admin' && u.is_active && activeAdmins <= 1;

  const activate = async (u) => {
    try {
      await API.patch(`/admin/users/${u.user_id}/status`, { is_active: 1 });
      notify('success', `${u.first_name} ${u.last_name} was activated.`);
      onRefresh();
    } catch (error) {
      notify('error', errText(error, 'Failed to update status.'));
    }
  };

  const editingUser = users.find(u => u.user_id === editingId) || null;

  return (
    <>
      <div className="page-header">
        <h1>User Accounts</h1>
        <p>Create, edit, and manage every account and its role in one place.</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">All accounts</span>
          <span className="stat-value">{counts.all}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Active</span>
          <span className="stat-value">{counts.active}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Pending verification</span>
          <span className="stat-value">{counts.pending}</span>
        </div>
        <div className="stat-card red">
          <span className="stat-label">Deactivated</span>
          <span className="stat-value">{counts.deactivated}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 170 }}
              value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <select className="search-input" style={{ minWidth: 170 }}
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending verification</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add User
          </button>
        </div>

        <div className="am-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>College</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const st   = userStatus(u);
                const meta = STATUS_META[st];
                const self = isSelf(u);
                const lock = self || isLastAdmin(u);
                const lockWhy = self
                  ? 'You cannot deactivate your own account'
                  : 'This is the last active Admin';

                return (
                  <tr key={u.user_id}>
                    <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                    <td>
                      <strong>{u.first_name} {u.last_name}</strong>
                      {self && <span className="am-you">YOU</span>}
                    </td>
                    <td style={{ color: '#718096' }}>{u.email}</td>
                    <td>{u.department || '—'}</td>
                    <td>{u.college || '—'}</td>
                    <td>
                      <span className={`badge ${roleBadge(u.role_type)}`}>
                        {ROLE_LABELS[u.role_type] || u.role_type || '—'}
                      </span>
                    </td>
                    <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                    <td>
                      <div className="am-actions">
                        <button className="btn btn-outline btn-sm"
                          onClick={() => setEditingId(u.user_id)}>Edit</button>
                        {u.is_active ? (
                          <button className="btn btn-danger btn-sm"
                            disabled={lock} title={lock ? lockWhy : 'Deactivate this account'}
                            onClick={() => setDeactivating(u)}>Deactivate</button>
                        ) : (
                          <button className="btn btn-success btn-sm"
                            onClick={() => activate(u)}>Activate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state"><p>No users found.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="am-legend">
          🔒 A greyed-out Deactivate button is blocked on purpose: you can't deactivate or demote
          your own account, and the last active Admin can't be removed.
        </div>
      </div>

      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onCreated={onRefresh} notify={notify} />
      )}

      {deactivating && (
        <DeactivateModal user={deactivating} onClose={() => setDeactivating(null)}
          onDone={onRefresh} notify={notify} />
      )}

      {editingUser && (
        <EditUserModal
          key={editingUser.user_id}
          user={editingUser}
          isSelf={isSelf(editingUser)}
          isLastAdmin={isLastAdmin(editingUser)}
          onClose={() => setEditingId(null)}
          onChanged={onRefresh}
          notify={notify}
        />
      )}
    </>
  );
};

export default AdminUsersPage;