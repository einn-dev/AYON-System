import React, { useState, useEffect, useCallback } from 'react';
import { TerminalReportsPage } from '../../components/TerminalReport';
import { FaFlagCheckered } from 'react-icons/fa6';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useLiveRefresh } from '../../utils/liveRefresh';
import ProposalStats from '../../components/ProposalStats';
import API    from '../../services/authService';
import '../../components/Layout.css';
import { FaBell, FaCircleCheck, FaClipboardList, FaTableCellsLarge, FaGlobe } from 'react-icons/fa6';
import { CollegeExternalPage } from './ExternalShared';
import NotificationsPage from './NotificationsPage';
import { EndorsementQueue, EndorsedHistory, EndorserStats } from '../../components/EndorserPages';
import { statusLabel, statusBadge, TYPE_LABEL } from '../../utils/terms';
import { personName } from '../../utils/names';
import WelcomeBanner from '../../components/WelcomeBanner';

const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/college-dean/dashboard',       label: 'Dashboard',       icon: <FaTableCellsLarge /> },
  { path: '/college-dean/for-endorsement', label: 'For Endorsement', icon: <FaClipboardList /> },
  { path: '/college-dean/endorsed',        label: 'Endorsed', icon: <FaCircleCheck /> },
  { path: '/college-dean/external',       label: 'External Research', icon: <FaGlobe /> },
  { path: '/college-dean/terminal-reports', label: 'Terminal Reports', icon: <FaFlagCheckered /> },
  { path: '/college-dean/notifications',   label: 'Notifications',    icon: <FaBell /> },
];

const Overview = ({ proposals }) => (
  <>
    <WelcomeBanner text="Review and endorse research proposals and applications from your college." />
    <EndorserStats proposals={proposals} role="college_dean" />
    <div className="panel">
      <div className="panel-header"><h2>Recent Submissions</h2></div>
      <table className="data-table">
        <thead><tr><th>Researcher</th><th>Research Title</th><th>Proposal Type</th><th>Status</th></tr></thead>
        <tbody>
          {proposals.slice(0, 6).map(p => (
            <tr key={p.proposal_id}>
              <td><strong>{personName(p)}</strong></td>
              <td>{p.title}</td>
              <td style={{ fontSize: '0.82rem', color: '#718096' }}>{PROPOSAL_TYPES[p.proposal_type]}</td>
              <td><span className={`badge ${statusBadge(p.status)}`}>{statusLabel(p.status)}</span></td>
            </tr>
          ))}
          {proposals.length === 0 && <tr><td colSpan={4}><div className="empty-state"><p>No proposals yet.</p></div></td></tr>}
        </tbody>
      </table>
    </div>
    <ProposalStats proposals={proposals} groupBy="department" externalFrom="/external/college" />
  </>
);

const CollegeDeanDashboard = () => {
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try { const res = await API.get('/proposals'); setProposals(res.data.proposals || []); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);
  useLiveRefresh(fetchProposals);          // reloads by itself when something new happens

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="College Dean">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Overview proposals={proposals} />} />
        <Route path="for-endorsement" element={
          <>
            <div className="page-header"><h1>For Endorsement</h1><p>Review and endorse proposals and applications from your college.</p></div>
            <EndorsementQueue proposals={proposals} role="college_dean" onRefresh={fetchProposals} />
          </>
        } />
        <Route path="endorsed"      element={<EndorsedHistory />} />
        <Route path="external"      element={<CollegeExternalPage />} />
        <Route path="terminal-reports" element={<TerminalReportsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Routes>
    </Layout>
  );
};

export default CollegeDeanDashboard;