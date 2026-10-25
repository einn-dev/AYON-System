import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import API from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { COLLEGES, getDepartments } from '../data/Colleges';
import { checkAvatarFile, prepareAvatar, AVATAR_MAX_MB } from '../utils/avatar';
import Avatar from './Avatar';
import ChangePasswordBox from './ChangePasswordBox';
import { FaCamera, FaTrashCan, FaXmark } from 'react-icons/fa6';
import './Account.css';

/* Contact number: digits only, must start with 09, at most 11 digits. */
const cleanPhone = (raw) => {
  let v = String(raw).replace(/\D/g, '').slice(0, 11);
  if (v.length >= 1 && v[0] !== '0') v = '';
  if (v.length >= 2 && v[1] !== '9') v = v.slice(0, 1);
  return v;
};

const ProfileModal = ({ onClose }) => {
  const { user, updateUser } = useAuth();
  const [form,     setForm]     = useState({ ...user });
  const [alert,    setAlert]    = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [fetching, setFetching] = useState(true);

  // profile picture: nothing changes on the server until "Save Changes"
  const [photo,       setPhoto]       = useState(null);    // { blob, preview } chosen but not saved yet
  const [removePhoto, setRemovePhoto] = useState(false);
  const fileRef  = useRef(null);
  const dialogRef = useRef(null);

  /* Login only remembers name, email and role, so load the full profile. */
  useEffect(() => {
    let alive = true;
    API.get('/auth/profile')
      .then((res) => {
        if (alive) setForm((f) => ({ ...f, ...res.data.user }));
      })
      .catch(() => {
        if (alive) setAlert({ type: 'error', msg: 'Could not load your profile details. Please try again.' });
      })
      .finally(() => { if (alive) setFetching(false); });
    return () => { alive = false; };
  }, []);

  /* Esc closes, the page behind does not scroll, focus starts on the close button. */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  /* free the preview picture from memory */
  useEffect(() => () => { if (photo?.preview) URL.revokeObjectURL(photo.preview); }, [photo]);

  const departments = getDepartments(form.college);

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
      setAlert(null);
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
    if (!form.college)
      return setAlert({ type: 'error', msg: 'Please select your college.' });
    if (!form.department)
      return setAlert({ type: 'error', msg: 'Please select your department.' });
    if (form.contact_number && !/^09\d{9}$/.test(form.contact_number))
      return setAlert({ type: 'error', msg: 'Contact number must be exactly 11 digits, numbers only, starting with 09.' });

    setSaving(true);
    try {
      let avatar_url = form.avatar_url || null;

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
        first_name:     form.first_name.trim(),
        last_name:      form.last_name.trim(),
        college:        form.college,
        department:     form.department,
        contact_number: form.contact_number || null,
      });

      // the sidebar picks these up right away
      updateUser({ first_name: form.first_name.trim(), last_name: form.last_name.trim(), avatar_url });
      setForm((f) => ({ ...f, avatar_url }));
      setPhoto(null);
      setRemovePhoto(false);
      setAlert({ type: 'success', msg: 'Profile updated successfully!' });
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Update failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // what the big picture shows right now
  const shownPhoto = photo ? photo.preview : (removePhoto ? null : form.avatar_url || null);
  const hasPhoto   = !!shownPhoto;

  return createPortal(
    <div className="pm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pm-dialog" ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pm-title">
        <div className="pm-head">
          <div>
            <h2 id="pm-title">My Profile</h2>
            <p>Update your photo, personal information and password.</p>
          </div>
          <button type="button" className="pm-close" onClick={onClose} aria-label="Close">
            <FaXmark />
          </button>
        </div>

        <div className="pm-body">
          {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

          {fetching ? (
            <div className="empty-state"><p>Loading your profile...</p></div>
          ) : (
            <form onSubmit={handleSave} autoComplete="off">
              {/* ── profile picture ── */}
              <div className="pm-photo">
                <button type="button" className="pm-photo-btn" title="Change photo"
                  onClick={() => fileRef.current?.click()}>
                  <Avatar user={form} src={shownPhoto} size={96} />
                  <span className="pm-photo-cam"><FaCamera /></span>
                </button>
                <div className="pm-photo-info">
                  <p className="pm-photo-name">{form.first_name} {form.last_name}</p>
                  <div className="pm-photo-actions">
                    <button type="button" className="btn btn-outline btn-sm"
                      onClick={() => fileRef.current?.click()}>
                      <FaCamera className="ic" />{hasPhoto ? 'Change photo' : 'Upload photo'}
                    </button>
                    {hasPhoto && (
                      <button type="button" className="btn btn-outline btn-sm pm-remove" onClick={handleRemove}>
                        <FaTrashCan className="ic" />Remove
                      </button>
                    )}
                  </div>
                  <p className="pm-photo-hint">
                    {photo || removePhoto
                      ? 'Click Save Changes to keep this.'
                      : `JPG, PNG or WEBP, up to ${AVATAR_MAX_MB}MB.`}
                  </p>
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handlePick} hidden />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input value={form.first_name || ''} autoComplete="off"
                    onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input value={form.last_name || ''} autoComplete="off"
                    onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input value={form.email || ''} disabled
                  style={{ background: '#f0f4f8', color: '#a0aec0' }} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>College</label>
                  <select value={form.college || ''} title={form.college || ''} autoComplete="off"
                    onChange={e => setForm({ ...form, college: e.target.value, department: '' })}>
                    <option value="">— Select your college —</option>
                    {form.college && !COLLEGES.includes(form.college) && (
                      <option value={form.college}>{form.college}</option>
                    )}
                    {COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select value={form.department || ''} title={form.department || ''} autoComplete="off"
                    disabled={!form.college}
                    onChange={e => setForm({ ...form, department: e.target.value })}>
                    <option value="">
                      {form.college ? '— Select your department —' : '— Select a college first —'}
                    </option>
                    {form.department && !departments.includes(form.department) && (
                      <option value={form.department}>{form.department}</option>
                    )}
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input name="contact_number" value={form.contact_number || ''}
                  placeholder="09XXXXXXXXX" inputMode="numeric" maxLength={11} autoComplete="off"
                  onChange={e => setForm({ ...form, contact_number: cleanPhone(e.target.value) })} />
              </div>

              <hr className="pm-sep" />
              <ChangePasswordBox />

              <div className="pm-foot">
                <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProfileModal;