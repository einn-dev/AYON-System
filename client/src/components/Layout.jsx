import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';
import './Account.css';
import './OfficeNotifications.css';
import API from '../services/authService';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';
import AnnouncementBanner from './Announcements';
import TopBar from './TopBar';
import HelpPage from '../pages/HelpPage';
import { FaChevronLeft, FaChevronRight, FaRightFromBracket, FaXmark } from 'react-icons/fa6';
import { personName } from '../utils/names';
import { OPEN_PROFILE } from './Signature';
import { LIVE_EVERY, LIVE_UPDATE, OPEN_BELL } from '../utils/liveRefresh';
import { FaBell, FaXmark as FaClose } from 'react-icons/fa6';

/* phones and small tablets: the menu slides in from the left instead of taking up the screen */
const PHONE = '(max-width: 820px)';

const Layout = ({ children, navItems, role }) => {
  const { user, logout, updateUser } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(null);   // null, or the tab to open
  const [unread, setUnread] = useState(0);
  const lastCount = useRef(null);                        // the unread count we saw last time
  const [toast, setToast] = useState(null);              // "something new" message
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  const [menuOpen, setMenuOpen] = useState(false);
  const helpBase = `/${String(navItems?.[0]?.path || '').split('/')[1] || ''}`;

  /* unread count for the Notifications item: on each page change, every minute,
     and right away when the Notifications page marks something as read */
  const hasNotifs = navItems.some((i) => /\/notifications$/.test(i.path));

  /* bigger text while a dashboard is open (see html.ayon-app in Layout.css) */
  useEffect(() => {
    document.documentElement.classList.add('ayon-app');
    return () => document.documentElement.classList.remove('ayon-app');
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const onChange = () => { setPhone(mq.matches); if (!mq.matches) setMenuOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  /* other parts of AYON can open My Profile on a tab, e.g. "Open My Profile" in a signing box */
  useEffect(() => {
    const open = (e) => { setMenuOpen(false); setProfileOpen(e.detail?.tab || 'profile'); };
    window.addEventListener(OPEN_PROFILE, open);
    return () => window.removeEventListener(OPEN_PROFILE, open);
  }, []);

  /* close the menu after moving to another page */
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  /* Esc closes the menu, and the page behind it does not scroll while it is open */
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  /* Live updates: every 15 seconds while this tab is visible (and right away when
     you come back to it). When the count goes UP, the open page reloads its data
     and a small message says what is new. See utils/liveRefresh.js. */
  useEffect(() => {
    if (!hasNotifs) return undefined;
    let alive = true;
    const refresh = () => {
      API.get('/notifications/unread-count')
        .then(async (res) => {
          if (!alive) return;
          const count  = Number(res.data.count) || 0;
          const before = lastCount.current;
          lastCount.current = count;
          setUnread(count);
          if (before === null || count <= before) return;
          window.dispatchEvent(new Event(LIVE_UPDATE));
          try {
            const list = await API.get('/notifications');
            const latest = (list.data.notifications || []).find((n) => !n.is_read);
            if (alive && latest) setToast({ id: latest.notif_id, title: latest.title, message: latest.message, more: count - before - 1 });
          } catch { /* the bell still shows the count */ }
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, LIVE_EVERY);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('ayon:notifs-changed', refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('ayon:notifs-changed', refresh);
    };
  }, [hasNotifs, location.pathname]);

  /* the message goes away by itself after 8 seconds */
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  // refresh the profile picture / name once, in case they were changed on another device
  useEffect(() => {
    API.get('/auth/profile')
      .then((res) => {
        const u = res.data.user;
        updateUser({ first_name: u.first_name, middle_name: u.middle_name || null, last_name: u.last_name, avatar_url: u.avatar_url || null });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={['layout', collapsed && !phone && 'collapsed', phone && 'phone', menuOpen && 'menu-open'].filter(Boolean).join(' ')}>
      {/* ── Sidebar ── */}
      <aside className="sidebar" id="ayon-menu" aria-label="Main menu">
        <div className="sidebar-header">
          <span className="sidebar-logo">AYON</span>
          {phone ? (
            <button type="button" className="collapse-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              <FaXmark />
            </button>
          ) : (
            <button type="button" className="collapse-btn" onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}>
              {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
            </button>
          )}
        </div>

        <div className="sidebar-role">{role}</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {/\/notifications$/.test(item.path) && unread > 0 && (
                <span className="nav-badge" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="user-info user-info-link" title="View my profile"
            onClick={() => setProfileOpen('profile')}>
            <Avatar user={user} size={40} />
            <div className="user-details">
              <p className="user-name">{personName(user)}</p>
              <p className="user-email">{user?.email}</p>
            </div>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <FaRightFromBracket className="ic" />Logout
          </button>
        </div>
      </aside>
      {phone && menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      {/* ── Main Content ── */}
      <main className="main-content">
        <TopBar navItems={navItems} unread={unread} onMenu={phone ? () => setMenuOpen(true) : null} />
        <AnnouncementBanner />
        {/* /<role>/help shows the Help and User Guide (the ? button in the top bar) */}
        {location.pathname.replace(/\/+$/, '') === `${helpBase}/help` ? <HelpPage /> : children}
      </main>

      {toast && (
        <div className="live-toast" role="status" aria-live="polite">
          <span className="live-toast-ic" aria-hidden="true"><FaBell /></span>
          <div className="live-toast-body">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
            {toast.more > 0 && <small>and {toast.more} more new notification{toast.more === 1 ? '' : 's'}</small>}
            <button type="button" className="live-toast-link"
              onClick={() => { setToast(null); window.dispatchEvent(new Event(OPEN_BELL)); }}>
              View notifications
            </button>
          </div>
          <button type="button" className="live-toast-x" onClick={() => setToast(null)} aria-label="Close">
            <FaClose />
          </button>
        </div>
      )}

      {profileOpen && <ProfileModal startTab={profileOpen} onClose={() => setProfileOpen(null)} />}
    </div>
  );
};

export default Layout;