import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';
import './Account.css';
import API from '../services/authService';
import Avatar from './Avatar';
import ProfileModal from './ProfileModal';
import { FaChevronLeft, FaChevronRight, FaRightFromBracket } from 'react-icons/fa6';

const Layout = ({ children, navItems, role }) => {
  const { user, logout, updateUser } = useAuth();
  const navigate          = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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