import React, { useState, useEffect, useCallback } from 'react';
import { OfficeExternalPage } from './ExternalShared';
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
import AdminRepositoryPage from './AdminRepositoryPage';
import AdminGrantsPage from './AdminGrantsPage';
import AdminAnnouncementsPage from './AdminAnnouncementsPage';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useLiveRefresh } from '../../utils/liveRefresh';
import { notifTarget, isEmailFail, isNewAccount } from '../../utils/notifLinks';
import { FaBell, FaBoxArchive, FaBullhorn, FaChartColumn, FaEnvelope, FaFileLines, FaGlobe, FaHandHoldingDollar, FaShieldHalved, FaTableCellsLarge, FaUsers } from '../../utils/icons';

const NAV_ITEMS = [
  { path: '/admin/dashboard',  label: 'Dashboard',             icon: <FaTableCellsLarge /> },
  { path: '/admin/users',      label: 'User Accounts',         icon: <FaUsers /> },
  { path: '/admin/proposals',  label: 'All Proposals',         icon: <FaFileLines /> },
  { path: '/admin/grants',     label: 'Grants and Incentives', icon: <FaHandHoldingDollar /> },
  { path: '/admin/external',   label: 'External Research', icon: <FaGlobe /> },
  { path: '/admin/repository', label: 'Research Repository',   icon: <FaBoxArchive /> },
  { path: '/admin/announcements', label: 'Announcements',      icon: <FaBullhorn /> },
  { path: '/admin/reports',    label: 'Reports',               icon: <FaChartColumn /> },
  { path: '/admin/audit',      label: 'Audit Log',             icon: <FaShieldHalved /> },
  { path: '/admin/emails',     label: 'Email Log',             icon: <FaEnvelope /> },
  { path: '/admin/notifications', label: 'Notifications',      icon: <FaBell /> },
];

/* the Administrator's notices: new verified accounts and emails that did not send */
const ADMIN_FILTERS = [
  ['all',      'All Notifications', () => true],
  ['unread',   'Unread Only',       (n) => !n.is_read],
  ['accounts', 'New Accounts',      isNewAccount],
  ['emails',   'Failed Emails',     isEmailFail],
];
const adminTarget = (n) => notifTarget(n, 'admin');

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
  useLiveRefresh(fetchUsers);              // a newly verified account shows up without a reload

  if (loading) return <div className="loading">Loading…</div>;

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
        <Route path="repository" element={<AdminRepositoryPage />} />
        <Route path="external" element={<OfficeExternalPage />} />
        <Route path="grants"     element={<AdminGrantsPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="audit"     element={<AuditLogPage />} />
        <Route path="emails"    element={<EmailLogPage />} />
        <Route path="notifications" element={
          <OfficeNotifications queuePath="/admin/proposals" filters={ADMIN_FILTERS} targetOf={adminTarget}
            intro="New accounts that are ready to use, and emails that did not send." />
        } />
        <Route path="reports"   element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
};

export default AdminDashboard;