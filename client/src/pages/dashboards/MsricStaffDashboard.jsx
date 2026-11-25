import React, { useState, useEffect, useCallback } from 'react';
import { OfficeExternalPage } from './ExternalShared';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useLiveRefresh } from '../../utils/liveRefresh';
import ProposalStats from '../../components/ProposalStats';
import API    from '../../services/authService';
import '../../components/Layout.css';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useOpenHighlight, OpenNotice } from '../../components/OpenHighlight';
import { FaBell, FaBoxArchive, FaGlobe, FaInbox, FaTableCellsLarge } from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, statusLabel, statusBadge, TYPE_LABEL } from '../../utils/terms';
import { personName } from '../../utils/names';
import StatCard from '../../components/StatCard';
import WelcomeBanner from '../../components/WelcomeBanner';
import RepositoryBrowser from '../../components/RepositoryBrowser';

const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/msric-staff/dashboard',      label: 'Dashboard',       icon: <FaTableCellsLarge /> },
  { path: '/msric-staff/submissions',    label: 'All Submissions',     icon: <FaInbox /> },
  { path: '/msric-staff/repository',     label: 'Research Repository', icon: <FaBoxArchive /> },
  { path: '/msric-staff/external',   label: 'External Research', icon: <FaGlobe /> },
  { path: '/msric-staff/notifications',  label: 'Notifications',    icon: <FaBell /> },
];

const Overview = ({ proposals }) => {
  const counts = {
    total:       proposals.length,
    submitted:   proposals.filter(p => p.status === 'submitted').length,
    under_review:proposals.filter(p => p.status === 'under_review').length,
    approved:    proposals.filter(p => p.status === 'approved').length,
  };

  return (
    <>
      <WelcomeBanner text="Proposals and applications that passed the college level and reached the MSIRC Special Assistant." />
      <div className="stats-grid">
        <StatCard color="blue" label="Total Submissions" value={counts.total} to="/msric-staff/submissions" />
        <StatCard color="amber" label={STATUS_LABEL.submitted} value={counts.submitted} to="/msric-staff/submissions?status=submitted" />
        <StatCard color="purple" label={STATUS_LABEL.under_review} value={counts.under_review} to="/msric-staff/submissions?status=under_review" />
        <StatCard color="green" label="Approved" value={counts.approved} to="/msric-staff/submissions?status=approved" />
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Recent Submissions</h2></div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {proposals.slice(0, 8).map(p => (
              <tr key={p.proposal_id}>
                <td><strong>{personName(p)}</strong></td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.82rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {proposals.length === 0 && (
              <tr><td colSpan={5}>
                <div className="empty-state"><p>No proposals yet.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ProposalStats proposals={proposals} groupBy="college" externalFrom="/external" />
    </>
  );
};

const AllSubmissions = ({ proposals }) => {
  const [search, setSearch] = useState('');
  /* a dashboard card can open this list already filtered (?status=approved) */
  const [filter, setFilter] = useState(() => new URLSearchParams(window.location.search).get('status') || 'all');
  const hl = useOpenHighlight(proposals.length > 0);   // "Open" from a notification

  const filtered = proposals.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch = `${personName(p)} ${p.title}`
      .toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <>
      <div className="page-header">
        <h1>All Submissions</h1>
        <p>Proposals and applications that passed the college level and reached the MSIRC Special Assistant.</p>
      </div>
      <OpenNotice state={hl} where="this list" />
      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search by name or title…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 160 }}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {STATUS_ORDER.filter(s => s !== 'for_endorsement').map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Researcher</th><th>Title</th>
              <th>Type</th><th>Status</th><th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.proposal_id} data-pid={p.proposal_id}>
                <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                <td>
                  <strong>{personName(p)}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#718096' }}>{p.college || '—'}</div>
                </td>
                <td>{p.title}</td>
                <td style={{ fontSize: '0.8rem', color: '#718096' }}>
                  {PROPOSAL_TYPES[p.proposal_type] || p.proposal_type}
                </td>
                <td>
                  <span className={`badge ${statusBadge(p.status)}`}>
                    {statusLabel(p.status)}
                  </span>
                </td>
                <td style={{ color: '#718096' }}>
                  {p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6}>
                <div className="empty-state"><p>Nothing found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};


/* What MSIRC Staff are told about (in AYON only): proposals arriving at MSIRC,
   final decisions, and new research in the Repository. */
const STAFF_FILTERS = [
  ['all',       'All Notifications',  () => true],
  ['unread',    'Unread Only',        (n) => !n.is_read],
  ['arrived',   'Arrived at MSIRC',   (n) => n.notif_type === 'submission' && !!n.proposal_id],
  ['decisions', 'Decisions',          (n) => n.notif_type === 'approval' || n.notif_type === 'rejection'],
  ['repository','Repository',         (n) => /^new research in the repository/i.test(n.title || '')],
];

const MsricStaffDashboard = () => {
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchProposals = useCallback(async () => {
    try {
      const res = await API.get('/proposals');
      setProposals(res.data.proposals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);
  useLiveRefresh(fetchProposals);          // reloads by itself when something new happens

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="MSIRC Staff">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"     element={<Overview proposals={proposals} />} />
        <Route path="submissions"   element={<AllSubmissions proposals={proposals} />} />
        <Route path="repository"    element={<RepositoryBrowser endpoint="/repository" />} />
        <Route path="external" element={<OfficeExternalPage />} />
        <Route path="notifications" element={
          <OfficeNotifications
            queuePath="/msric-staff/submissions"
            repoPath="/msric-staff/repository"
            openLabel="Open"
            filters={STAFF_FILTERS}
            intro="Proposals arriving at MSIRC, final decisions, and new research in the Repository." />
        } />
      </Routes>
    </Layout>
  );
};

export default MsricStaffDashboard;