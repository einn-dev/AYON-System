import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { COLLEGES, getDepartments } from '../data/Colleges';
import { checkAvatarFile, prepareAvatar, AVATAR_MAX_MB } from '../utils/avatar';
import Avatar from './Avatar';
import ChangePasswordBox from './ChangePasswordBox';
import { MySignature, SIGNER_ROLES } from './Signature';
import {
  FaCamera, FaTrashCan, FaUser, FaSignature, FaKey, FaPen, FaChevronDown, FaEnvelope,
  FaPhone, FaBuildingColumns, FaSitemap, FaShieldHalved, FaCalendar,
} from 'react-icons/fa6';
import './Account.css';
import './ProfilePage.css';
import { personName } from '../utils/names';

/* ─────────────────────────────────────────────────────────────
   My Profile: its own page (the "My Profile" item in the menu),
   for every role. Tabs: Information, Digital Signature (people
   who sign), Password. The Manage button jumps to each one.
   ───────────────────────────────────────────────────────────── */

/* Contact number: digits only, must start with 09, at most 11 digits. */
const cleanPhone = (raw) => {
  let v = String(raw).replace(/\D/g, '').slice(0, 11);
  if (v.length >= 1 && v[0] !== '0') v = '';
  if (v.length >= 2 && v[1] !== '9') v = v.slice(0, 1);
  return v;
};

/* Offices that serve the whole campus have no college or department.
   The Administrator also has no contact number on the profile. */
const CAMPUS_WIDE = ['msric_staff', 'special_assistant', 'msric_director', 'ovcred'];

const OFFICE = {
  msric_staff: 'MSIRC', special_assistant: 'MSIRC', msric_director: 'MSIRC',
  ovcred: 'Office of the VCRED', admin: 'AYON System Administration',
};

const joined = (d) => (d ? new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');

const Field = ({ icon, label, children, wide }) => (
  <div className={`pp-field${wide ? ' wide' : ''}`}>
    <span className="pp-field-l">{icon}{label}</span>
    <span className="pp-field-v">{children || <em>Not set</em>}</span>
  </div>
);

const ProfilePage = ({ roleLabel }) => {
  const { user, updateUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const signs = SIGNER_ROLES.includes(user?.role);
  const showCollege = !['admin', ...CAMPUS_WIDE].includes(user?.role);
  const showDept    = showCollege && user?.role !== 'college_dean';
  const showContact = user?.role !== 'admin';

  const TABS = [
    { key: 'profile',   label: 'Information',       icon: <FaUser /> },
    ...(signs ? [{ key: 'signature', label: 'Digital Signature', icon: <FaSignature /> }] : []),
    { key: 'password',  label: 'Password',          icon: <FaKey /> },
  ];
  const wanted = new URLSearchParams(location.search).get('tab') || 'profile';
  const tab = TABS.some(t => t.key === wanted) ? wanted : 'profile';
  const setTab = (key) => navigate({ search: key === 'profile' ? '' : `?tab=${key}` }, { replace: true });

  const [saved,    setSaved]    = useState({ ...user });   // what is stored
  const [form,     setForm]     = useState({ ...user });   // what is being edited
  const [editing,  setEditing]  = useState(false);
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [fetching, setFetching] = useState(true);
  const [menu,     setMenu]     = useState(false);

  // profile picture: nothing changes on the server until "Save Changes"
  const [photo,       setPhoto]       = useState(null);    // { blob, preview } chosen but not saved yet
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef = useRef(null);
  const menuRef = useRef(null);

  /* login only remembers name, email and role, so load the full profile */
  useEffect(() => {
    let alive = true;
    API.get('/auth/profile')
      .then((res) => {
        if (!alive) return;
        setSaved((f) => ({ ...f, ...res.data.user }));
        setForm((f) => ({ ...f, ...res.data.user }));
      })
      .catch(() => { if (alive) setAlert({ type: 'error', msg: 'Could not load your profile details. Please try again.' }); })
      .finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, []);

  /* the Manage menu closes on an outside click or Esc */
  useEffect(() => {
    if (!menu) return undefined;
    const out = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [menu]);

  /* free the preview picture from memory */
  useEffect(() => () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); }, [photo]);

  const departments = getDepartments(form.college);

  const startEdit = () => { setTab('profile'); setForm({ ...saved }); setEditing(true); setAlert(null); setMenu(false); };
  const cancelEdit = () => { setForm({ ...saved }); setEditing(false); setPhoto(null); setRemovePhoto(false); setAlert(null); };

  const pickPhoto = () => { setMenu(false); fileRef.current?.click(); };

  const handlePick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';                      // lets the same file be chosen again
    if (!file) return;
    const problem = checkAvatarFile(file);
    if (problem) return setAlert({ type: 'error', msg: problem });
    try {
      const blob = await prepareAvatar(file);
      setPhoto({ blob, preview: URL.createObjectURL(blob) });
      setRemovePhoto(false);
      if (!editing) { setForm({ ...saved }); setEditing(true); setTab('profile'); }
      setAlert({ type: 'info', msg: 'New photo chosen. Click Save Changes to keep it.' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.message || 'Could not use that picture.' });
    }
  };

  const handleRemove = () => { setPhoto(null); setRemovePhoto(true); setAlert(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    setAlert(null);
    if (!form.first_name?.trim() || !form.last_name?.trim())
      return setAlert({ type: 'error', msg: 'First name and last name are required.' });
    if (showCollege && !form.college)
      return setAlert({ type: 'error', msg: 'Please select your college.' });
    if (showDept && !form.department)
      return setAlert({ type: 'error', msg: 'Please select your department.' });
    if (showContact && form.contact_number && !/^09\d{9}$/.test(form.contact_number))
      return setAlert({ type: 'error', msg: 'Contact number must be exactly 11 digits, numbers only, starting with 09.' });

    setSaving(true);
    try {
      let avatar_url = saved.avatar_url || null;
      if (photo) {
        const data = new FormData();
        data.append('avatar', photo.blob, 'avatar.jpg');
        const res = await API.post('/auth/profile/avatar', data);
        avatar_url = res.data.avatar_url;
      } else if (removePhoto && avatar_url) {
        await API.delete('/auth/profile/avatar');
        avatar_url = null;
      }

      await API.patch('/auth/profile', {
        first_name:  form.first_name.trim(),
        middle_name: (form.middle_name || '').trim(),
        last_name:   form.last_name.trim(),
        ...(showCollege ? { college: form.college, department: form.department } : {}),
        ...(showContact ? { contact_number: form.contact_number || null } : {}),
      });

      const next = {
        ...form,
        first_name: form.first_name.trim(), middle_name: (form.middle_name || '').trim() || null,
        last_name: form.last_name.trim(), avatar_url,
      };
      updateUser({ first_name: next.first_name, middle_name: next.middle_name, last_name: next.last_name, avatar_url });
      setSaved(next);
      setForm(next);
      setPhoto(null);
      setRemovePhoto(false);
      setEditing(false);
      setAlert({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Update failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const shown = editing ? form : saved;
  const shownPhoto = photo ? photo.preview : (removePhoto ? null : shown.avatar_url || null);
  const place = showCollege
    ? [shown.college, showDept ? shown.department : null].filter(Boolean).join(' · ')
    : OFFICE[user?.role] || '';

  return (
    <div className="pp">
      <div className="page-header pp-header">
        <div>
          <h1>My Profile</h1>
          <p>Manage your AYON account.</p>
        </div>
        <div className="pp-manage" ref={menuRef}>
          <button type="button" className="btn btn-outline" aria-haspopup="menu" aria-expanded={menu}
            onClick={() => setMenu(m => !m)}>
            <FaPen className="ic" />Manage<FaChevronDown className="pp-caret" aria-hidden="true" />
          </button>
          {menu && (
            <div className="pp-menu" role="menu">
              <button type="button" role="menuitem" onClick={startEdit}><FaUser />Edit Profile</button>
              <button type="button" role="menuitem" onClick={pickPhoto}><FaCamera />Change Photo</button>
              {signs && (
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setTab('signature'); }}>
                  <FaSignature />Digital signature
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => { setMenu(false); setTab('password'); }}>
                <FaKey />Change Password
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── profile card ── */}
      <section className="pp-hero">
        <div className="pp-banner">
          <span className="pp-role-badge"><FaShieldHalved />{roleLabel}</span>
        </div>
        <div className="pp-id">
          <button type="button" className="pp-photo" title="Change photo" onClick={pickPhoto}>
            <Avatar user={shown} src={shownPhoto} size={104} />
            <span className="pp-photo-cam" aria-hidden="true"><FaCamera /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePick} hidden />
          <div className="pp-id-text">
            <h2>{personName(shown) || '—'}</h2>
            {place && <p>{place}</p>}
            <span className="pp-chip"><FaCalendar />Member since {joined(shown.created_at)}</span>
          </div>
        </div>
      </section>

      {/* ── tabs ── */}
      <div className="pp-tabs" role="tablist" aria-label="My Profile sections">
        {TABS.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
            className={`pp-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon}{t.key === 'signature' ? <span><span className="pp-long">Digital </span>Signature</span> : t.label}
          </button>
        ))}
      </div>

      {tab === 'signature' && (
        <section className="panel pp-panel">
          <div className="panel-header"><h2>Digital Signature</h2><small>The signature placed on the forms you sign.</small></div>
          <div className="pp-pad"><MySignature /></div>
        </section>
      )}

      {tab === 'password' && (
        <section className="panel pp-panel">
          <div className="panel-header"><h2>Password</h2><small>Change the password you sign in with.</small></div>
          <div className="pp-pad"><ChangePasswordBox /></div>
        </section>
      )}

      {tab === 'profile' && (
        <section className="panel pp-panel">
          <div className="panel-header">
            <div>
              <h2>{editing ? 'Edit Profile' : 'Personal Information'}</h2>
              <small>{editing ? 'Change your details, then click Save Changes.' : 'Your name, contact details and where you belong.'}</small>
            </div>
            {!editing && !fetching && (
              <button type="button" className="btn btn-outline btn-sm" onClick={startEdit}><FaPen className="ic" />Edit</button>
            )}
          </div>

          <div className="pp-pad">
            {alert && <div className={`alert alert-${alert.type}`} role="status">{alert.msg}</div>}

            {fetching ? (
              <div className="empty-state loading-state" role="status"><p>Loading your profile…</p></div>
            ) : !editing ? (
              <div className="pp-grid">
                <Field icon={<FaUser />} label="Full name">{personName(saved)}</Field>
                <Field icon={<FaEnvelope />} label="Email address">{saved.email}</Field>
                {showContact && <Field icon={<FaPhone />} label="Contact number">{saved.contact_number}</Field>}
                <Field icon={<FaShieldHalved />} label="Role">{roleLabel}</Field>
                {showCollege
                  ? <Field icon={<FaBuildingColumns />} label="College">{saved.college}</Field>
                  : <Field icon={<FaBuildingColumns />} label="Office">{OFFICE[user?.role]}</Field>}
                {showDept && <Field icon={<FaSitemap />} label="Department">{saved.department}</Field>}
              </div>
            ) : (
              <form onSubmit={handleSave} autoComplete="off">
                <div className="pp-photo-edit">
                  <Avatar user={form} src={shownPhoto} size={64} />
                  <div>
                    <div className="pm-photo-actions">
                      <button type="button" className="btn btn-outline btn-sm" onClick={pickPhoto}>
                        <FaCamera className="ic" />{shownPhoto ? 'Change photo' : 'Upload photo'}
                      </button>
                      {shownPhoto && (
                        <button type="button" className="btn btn-outline btn-sm pm-remove" onClick={handleRemove}>
                          <FaTrashCan className="ic" />Remove
                        </button>
                      )}
                    </div>
                    <p className="pm-photo-hint">
                      {photo || removePhoto ? 'Click Save Changes to keep this.' : `JPG, PNG or WEBP, up to ${AVATAR_MAX_MB}MB.`}
                    </p>
                  </div>
                </div>

                <div className="form-row row-3">
                  <div className="form-group">
                    <label htmlFor="pp-first">First Name</label>
                    <input id="pp-first" value={form.first_name || ''} autoComplete="off"
                      onChange={e => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pp-middle">Middle Name</label>
                    <input id="pp-middle" value={form.middle_name || ''} autoComplete="off" maxLength={50}
                      onChange={e => setForm({ ...form, middle_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="pp-last">Last Name</label>
                    <input id="pp-last" value={form.last_name || ''} autoComplete="off"
                      onChange={e => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="pp-email">Email</label>
                  <input id="pp-email" value={form.email || ''} disabled style={{ background: '#f0f4f8', color: '#a0aec0' }} />
                </div>
                {showCollege && (
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="pp-college">College</label>
                      <select id="pp-college" value={form.college || ''} title={form.college || ''}
                        onChange={e => setForm({ ...form, college: e.target.value, department: '' })}>
                        <option value="">— Select your college —</option>
                        {form.college && !COLLEGES.includes(form.college) && <option value={form.college}>{form.college}</option>}
                        {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {showDept && (
                      <div className="form-group">
                        <label htmlFor="pp-dept">Department</label>
                        <select id="pp-dept" value={form.department || ''} title={form.department || ''} disabled={!form.college}
                          onChange={e => setForm({ ...form, department: e.target.value })}>
                          <option value="">{form.college ? '— Select your department —' : '— Select a college first —'}</option>
                          {form.department && !departments.includes(form.department) && <option value={form.department}>{form.department}</option>}
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
                {showContact && (
                  <div className="form-group">
                    <label htmlFor="pp-phone">Contact Number</label>
                    <input id="pp-phone" value={form.contact_number || ''} placeholder="09XXXXXXXXX"
                      inputMode="numeric" maxLength={11} autoComplete="off"
                      onChange={e => setForm({ ...form, contact_number: cleanPhone(e.target.value) })} />
                  </div>
                )}

                <div className="pp-foot">
                  <button type="button" className="btn btn-outline" onClick={cancelEdit} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProfilePage;