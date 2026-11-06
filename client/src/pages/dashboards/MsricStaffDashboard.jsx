import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import OfficeNotifications from '../../components/OfficeNotifications';
import { useOpenHighlight, OpenNotice } from '../../components/OpenHighlight';
import { FaBell, FaBoxArchive, FaInbox, FaTableCellsLarge } from 'react-icons/fa6';
import { STATUS_LABEL, STATUS_ORDER, statusLabel, statusBadge, TYPE_LABEL } from '../../utils/terms';

const PROPOSAL_TYPES = TYPE_LABEL;

const NAV_ITEMS = [
  { path: '/msric-staff/dashboard',      label: 'Dashboard',       icon: <FaTableCellsLarge /> },
  { path: '/msric-staff/submissions',    label: 'All Proposals',     icon: <FaInbox /> },
  { path: '/msric-staff/repository',     label: 'Research Repository', icon: <FaBoxArchive /> },
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
      <div className="page-header">
        <h1>MSIRC Staff Dashboard</h1>
        <p>Proposals that passed the college level and reached the Special Assistant.</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card blue">
          <span className="stat-label">Total Proposals</span>
          <span className="stat-value">{counts.total}</span>
        </div>
        <div className="stat-card amber">
          <span className="stat-label">{STATUS_LABEL.submitted}</span>
          <span className="stat-value">{counts.submitted}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">{STATUS_LABEL.under_review}</span>
          <span className="stat-value">{counts.under_review}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Approved</span>
          <span className="stat-value">{counts.approved}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header"><h2>Recent Proposals</h2></div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Researcher</th>
              <th>Research Title</th>
              <th>Proposal Type</th>
              <th>Status</th>
              <th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {proposals.slice(0, 8).map(p => (
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
    </>
  );
};

const AllSubmissions = ({ proposals }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const hl = useOpenHighlight(proposals.length > 0);   // "Open" from a notification

  const filtered = proposals.filter(p => {
    const matchStatus = filter === 'all' || p.status === filter;
    const matchSearch = `${p.first_name} ${p.last_name} ${p.title}`
      .toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <>
      <div className="page-header">
        <h1>All Proposals</h1>
        <p>Proposals that passed the college level and reached the Special Assistant.</p>
      </div>
      <OpenNotice state={hl} where="this list" />
      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search by name or title..."
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
              <th>#</th><th>Researcher</th><th>Research Title</th>
              <th>Proposal Type</th><th>Status</th><th>Date Submitted</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.proposal_id} data-pid={p.proposal_id}>
                <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                <td>
                  <strong>{p.first_name} {p.last_name}</strong>
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
                <div className="empty-state"><p>No proposals found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

const Repository = () => {
  const [items,   setItems]   = useState([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    API.get('/repository').then(res => {
      setItems(res.data.items || []);
    }).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(r =>
    `${r.title} ${r.author}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>Research Repository</h1>
        <p>Browse all archived research outputs in MSIRC.</p>
      </div>
      <div className="panel">
        <div className="panel-header">
          <input className="search-input" placeholder="Search by title or author..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Research Title</th><th>Author</th><th>College</th>
                <th>Access</th><th>Date Stored</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.repo_id}>
                  <td><strong>{r.title}</strong></td>
                  <td>{r.author || '—'}</td>
                  <td>{r.college || '—'}</td>
                  <td>
                    <span className={`badge ${r.access_type === 'public' ? 'badge-green' : 'badge-amber'}`}>
                      {r.access_type === 'public' ? 'Public' : 'Private'}
                    </span>
                  </td>
                  <td style={{ color: '#718096' }}>
                    {r.store_date ? new Date(r.store_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5}>
                  <div className="empty-state"><p>No research found.</p></div>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
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

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <Layout navItems={NAV_ITEMS} role="MSIRC Staff">
      <Routes>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard"     element={<Overview proposals={proposals} />} />
        <Route path="submissions"   element={<AllSubmissions proposals={proposals} />} />
        <Route path="repository"    element={<Repository />} />
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