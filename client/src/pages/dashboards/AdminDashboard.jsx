import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout.css';
import AllProposalsPage from './AllProposalsPage';
import ReportsPage from './ReportsPage';
import AdminUsersPage from './AdminUsersPage';
import AuditLogPage from './AuditLogPage';
import EmailLogPage from './EmailLogPage';
import {
  ROLES, ROLE_LABELS, roleBadge, userStatus, STATUS_META,
} from './adminShared';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard',     icon: '⊞'  },
  { path: '/admin/users',     label: 'User Accounts', icon: '👥' },
  { path: '/admin/proposals', label: 'All Proposals', icon: '📄' },
  { path: '/admin/audit',     label: 'Audit Log',     icon: '🛡️' },
  { path: '/admin/emails',    label: 'Email Log',     icon: '✉️' },
  { path: '/admin/reports',   label: 'Reports',       icon: '📊' },
];

/* ─────────── Overview Page ─────────── */
const Overview = ({ users }) => {
  const roleCounts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role_type === r).length;
    return acc;
  }, {});

  return (
    <>
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>System overview and user management for AYON</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{users.length}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Researchers</span>
          <span className="stat-value">{roleCounts.researcher || 0}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">Staff & Officers</span>
          <span className="stat-value">
            {(roleCounts.msric_staff || 0) +
             (roleCounts.special_assistant || 0) +
             (roleCounts.msric_director || 0)}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Accounts</span>
          <span className="stat-value">{users.filter(u => userStatus(u) === 'active').length}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Recent Registered Users</h2></div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.slice(0, 8).map(u => {
              const meta = STATUS_META[userStatus(u)];
              return (
                <tr key={u.user_id}>
                  <td><strong>{u.first_name} {u.last_name}</strong></td>
                  <td style={{ color: '#718096' }}>{u.email}</td>
                  <td>
                    <span className={`badge ${roleBadge(u.role_type)}`}>
                      {ROLE_LABELS[u.role_type] || u.role_type}
                    </span>
                  </td>
                  <td><span className={`badge ${meta.badge}`}>{meta.label}</span></td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty-state"><p>No users found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ─────────── Main Admin Dashboard ─────────── */
const AdminDashboard = () => {
  const { user } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await API.get('/admin/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="Administrator">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Overview users={users} />} />
        <Route path="users"     element={
          <AdminUsersPage users={users} currentUserId={user?.user_id} onRefresh={fetchUsers} />
        } />
        {/* Role Assignment moved into User Accounts → Edit. Old links still work. */}
        <Route path="roles"     element={<Navigate to="/admin/users" replace />} />
        <Route path="proposals" element={<AllProposalsPage />} />
        <Route path="audit"     element={<AuditLogPage />} />
        <Route path="emails"    element={<EmailLogPage />} />
        <Route path="reports"   element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
};

export default AdminDashboard;