import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';
import './Account.css';
import './OfficeNotifications.css';
import API from '../services/authService';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';
import { FaChevronLeft, FaChevronRight, FaRightFromBracket } from 'react-icons/fa6';

const Layout = ({ children, navItems, role }) => {
  const { user, logout, updateUser } = useAuth();
  const navigate          = useNavigate();
  const location          = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  /* unread count for the Notifications item: on each page change, every minute,
     and right away when the Notifications page marks something as read */
  const hasNotifs = navItems.some((i) => /\/notifications$/.test(i.path));
  useEffect(() => {
    if (!hasNotifs) return undefined;
    let alive = true;
    const refresh = () => {
      API.get('/notifications/unread-count')
        .then((res) => { if (alive) setUnread(Number(res.data.count) || 0); })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    window.addEventListener('ayon:notifs-changed', refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('ayon:notifs-changed', refresh);
    };
  }, [hasNotifs, location.pathname]);

  // refresh the profile picture / name once, in case they were changed on another device
  useEffect(() => {
    API.get('/auth/profile')
      .then((res) => {
        const u = res.data.user;
        updateUser({ first_name: u.first_name, last_name: u.last_name, avatar_url: u.avatar_url || null });
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`layout ${collapsed ? 'collapsed' : ''}`}>
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">AYON</span>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        <div className="sidebar-role">{role}</div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
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
            onClick={() => setProfileOpen(true)}>
            <Avatar user={user} size={36} />
            <div className="user-details">
              <p className="user-name">{user?.first_name} {user?.last_name}</p>
              <p className="user-email">{user?.email}</p>
            </div>
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            <FaRightFromBracket className="ic" />Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content">
        {children}
      </main>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
};

export default Layout;