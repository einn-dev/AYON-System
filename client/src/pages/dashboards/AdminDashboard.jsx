import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import '../../components/Layout.css';
import AllProposalsPage from './AllProposalsPage';
import ReportsPage from './ReportsPage';
import AdminOverview from './AdminOverview';
import AdminUsersPage from './AdminUsersPage';
import AuditLogPage from './AuditLogPage';
import EmailLogPage from './EmailLogPage';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard',     icon: '⊞'  },
  { path: '/admin/users',     label: 'User Accounts', icon: '👥' },
  { path: '/admin/proposals', label: 'All Proposals', icon: '📄' },
  { path: '/admin/audit',     label: 'Audit Log',     icon: '🛡️' },
  { path: '/admin/emails',    label: 'Email Log',     icon: '✉️' },
  { path: '/admin/reports',   label: 'Reports',       icon: '📊' },
];

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
        <Route path="dashboard" element={<AdminOverview users={users} />} />
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