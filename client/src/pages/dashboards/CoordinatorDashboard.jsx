import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import { FaBell, FaCircleCheck, FaClipboardList, FaTableCellsLarge } from 'react-icons/fa6';
import { EndorsementQueue, EndorsedHistory, EndorserStats } from '../../components/EndorserPages';
import { statusLabel, statusBadge, TYPE_LABEL } from '../../utils/terms';

const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/coordinator/dashboard',     label: 'Dashboard',        icon: <FaTableCellsLarge /> },
  { path: '/coordinator/for-endorsement', label: 'For Endorsement', icon: <FaClipboardList /> },
  { path: '/coordinator/endorsed',      label: 'Endorsed Proposals', icon: <FaCircleCheck /> },
  { path: '/coordinator/notifications', label: 'Notifications',     icon: <FaBell /> },
];

const Notifications = () => {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/notifications')
      .then(res => setNotifs(res.data.notifications || []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.notif_id === id ? { ...n, is_read: 1 } : n));
    } catch {}
  };

  return (
    <>
      <div className="page-header"><h1>Notifications</h1></div>
      <div className="panel">
        {loading ? <div className="empty-state"><p>Loading...</p></div>
          : notifs.length === 0 ? <div className="empty-state"><p>No notifications yet.</p></div>
          : notifs.map(n => (
            <div key={n.notif_id}
              onClick={() => !n.is_read && markRead(n.notif_id)}
              style={{
                padding: '14px 20px', borderBottom: '1px solid #f0f4f8',
                background: n.is_read ? '#fff' : '#f0f6ff',
                display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer',
              }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                flexShrink: 0, marginTop: 5,
                background: n.is_read ? '#e8edf2' : '#2e6da4',
              }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1a3a5c', margin: '0 0 3px', fontSize: '0.9rem' }}>{n.title}</p>
                <p style={{ color: '#718096', margin: '0 0 4px', fontSize: '0.85rem' }}>{n.message}</p>
                <p style={{ color: '#a0aec0', margin: 0, fontSize: '0.75rem' }}>
                  {new Date(n.date_sent).toLocaleString()}
                </p>
              </div>
              {!n.is_read && <span className="badge badge-blue" style={{ flexShrink: 0 }}>New</span>}
            </div>
          ))}
      </div>
    </>
  );
};

/* ── Overview ── */
const Overview = ({ proposals }) => {
  return (
    <>
      <div className="page-header">
        <h1>Research Coordinator Dashboard</h1>
        <p>Review and endorse research proposals from your college.</p>
      </div>
      <EndorserStats proposals={proposals} role="research_coordinator" />
      <div className="panel">
        <div className="panel-header">
          <h2>Recent Proposals</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Researcher</th><th>Research Title</th><th>Proposal Type</th><th>Status</th></tr>
          </thead>
          <tbody>
            {proposals.slice(0, 6).map(p => (
              <tr key={p.proposal_id}>
                <td><strong>{p.first_name} {p.last_name}</strong></td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr><td colSpan={4}>
                <div className="empty-state"><p>No proposals yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

/* ── Main ── */
const CoordinatorDashboard = () => {
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await API.get('/proposals');
      setProposals(res.data.proposals || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="Research Coordinator">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Overview proposals={proposals} />} />
        <Route path="for-endorsement" element={
          <>
            <div className="page-header">
              <h1>For Endorsement</h1>
              <p>Review and endorse proposals from researchers in your college.</p>
            </div>
            <EndorsementQueue
              proposals={proposals}
              role="research_coordinator"
              onRefresh={fetchProposals}
            />
          </>
        } />
        <Route path="endorsed"      element={<EndorsedHistory />} />
        <Route path="notifications" element={<Notifications />} />
      </Routes>
    </Layout>
  );
};

export default CoordinatorDashboard;