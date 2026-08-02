import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import API    from '../../services/authService';
import '../../components/Layout.css';
import AllProposalsPage from './AllProposalsPage';
import ReportsPage from './ReportsPage';

const NAV_ITEMS = [
  { path: '/admin/dashboard', label: 'Dashboard',    icon: '⊞' },
  { path: '/admin/users',     label: 'User Accounts', icon: '👥' },
  { path: '/admin/roles',     label: 'Role Assignment', icon: '🔑' },
  { path: '/admin/proposals', label: 'All Proposals', icon: '📄' },
  { path: '/admin/reports',   label: 'Reports',       icon: '📊' },
];

const ROLES = [
  'researcher', 'msric_staff', 'research_coordinator',
  'chairperson', 'college_dean', 'special_assistant',
  'msric_director', 'ovcred', 'admin',
];

const ROLE_LABELS = {
  researcher:           'Researcher',
  msric_staff:          'MSRIC Staff',
  research_coordinator: 'Research Coordinator',
  chairperson:          'Chairperson',
  college_dean:         'College Dean',
  special_assistant:    'Special Assistant',
  msric_director:       'MSRIC Director',
  ovcred:               'OVCRED',
  admin:                'Admin',
};

const roleBadge = (role) => {
  const map = {
    admin:                'badge-purple',
    msric_director:       'badge-blue',
    ovcred:               'badge-blue',
    special_assistant:    'badge-amber',
    researcher:           'badge-green',
    msric_staff:          'badge-gray',
    research_coordinator: 'badge-gray',
    chairperson:          'badge-gray',
    college_dean:         'badge-gray',
  };
  return map[role] || 'badge-gray';
};

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
          <span className="stat-value">{users.filter(u => u.is_active).length}</span>
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
            {users.slice(0, 8).map(u => (
              <tr key={u.user_id}>
                <td><strong>{u.first_name} {u.last_name}</strong></td>
                <td style={{ color: '#718096' }}>{u.email}</td>
                <td>
                  <span className={`badge ${roleBadge(u.role_type)}`}>
                    {ROLE_LABELS[u.role_type] || u.role_type}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
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

/* ─────────── Users Page ─────────── */
const UsersPage = ({ users, onRefresh }) => {
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [alert,   setAlert]   = useState(null);
  const [form,    setForm]    = useState({
    first_name: '', last_name: '', email: '',
    password: '', role: 'researcher',
    employee_id: '', department: '', college: '',
  });

  const filtered = users.filter(u => {
    const matchSearch =
      u.first_name.toLowerCase().includes(search.toLowerCase()) ||
      u.last_name.toLowerCase().includes(search.toLowerCase())  ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = filter === 'all' || u.role_type === filter;
    return matchSearch && matchRole;
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await API.post('/admin/users', form);
      setAlert({ type: 'success', msg: 'User created successfully!' });
      setShowAdd(false);
      setForm({ first_name:'',last_name:'',email:'',password:'',role:'researcher',employee_id:'',department:'',college:'' });
      onRefresh();
    } catch (err) {
      setAlert({ type: 'error', msg: err.response?.data?.message || 'Failed to create user.' });
    }
  };

  const toggleStatus = async (userId, current) => {
    try {
      await API.patch(`/admin/users/${userId}/status`, { is_active: current ? 0 : 1 });
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Failed to update status.' });
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>User Accounts</h1>
        <p>Manage all registered users in AYON</p>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`}>{alert.msg}</div>
      )}

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <input className="search-input" placeholder="Search by name or email..."
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="search-input" style={{ minWidth: 180 }}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Roles</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            + Add User
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th>Employee ID</th>
              <th>College</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.user_id}>
                <td style={{ color: '#a0aec0' }}>{i + 1}</td>
                <td><strong>{u.first_name} {u.last_name}</strong></td>
                <td style={{ color: '#718096' }}>{u.email}</td>
                <td>{u.employee_id || '—'}</td>
                <td>{u.college || '—'}</td>
                <td>
                  <span className={`badge ${roleBadge(u.role_type)}`}>
                    {ROLE_LABELS[u.role_type] || u.role_type}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => toggleStatus(u.user_id, u.is_active)}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8}>
                <div className="empty-state"><p>No users found.</p></div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add New User</h3>
            <form onSubmit={handleAdd}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input required value={form.first_name}
                    onChange={e => setForm({...form, first_name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input required value={form.last_name}
                    onChange={e => setForm({...form, last_name: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="text" required value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" required value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={form.employee_id}
                    onChange={e => setForm({...form, employee_id: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role}
                    onChange={e => setForm({...form, role: e.target.value})}>
                    {ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Department</label>
                  <input value={form.department}
                    onChange={e => setForm({...form, department: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>College</label>
                  <input value={form.college}
                    onChange={e => setForm({...form, college: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline"
                  onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

/* ─────────── Role Assignment Page ─────────── */
const RolesPage = ({ users, onRefresh }) => {
  const [search,  setSearch]  = useState('');
  const [alert,   setAlert]   = useState(null);
  const [editing, setEditing] = useState(null);
  const [newRole, setNewRole] = useState('');

  const filtered = users.filter(u =>
    `${u.first_name} ${u.last_name} ${u.email}`
      .toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    try {
      await API.patch(`/admin/users/${editing}/role`, { role_type: newRole });
      setAlert({ type: 'success', msg: 'Role updated successfully!' });
      setEditing(null);
      onRefresh();
    } catch {
      setAlert({ type: 'error', msg: 'Failed to update role.' });
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Role Assignment</h1>
        <p>Assign or change roles for registered users</p>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      <div className="panel">
        <div className="panel-header">
          <input className="search-input" placeholder="Search user..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.user_id}>
                <td><strong>{u.first_name} {u.last_name}</strong></td>
                <td style={{ color: '#718096' }}>{u.email}</td>
                <td>
                  {editing === u.user_id ? (
                    <select value={newRole}
                      onChange={e => setNewRole(e.target.value)}
                      style={{ padding: '5px 8px', borderRadius: 6,
                        border: '1px solid #d1d9e0', fontSize: '0.85rem' }}>
                      {ROLES.map(r => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  ) : (
                    <span className={`badge ${roleBadge(u.role_type)}`}>
                      {ROLE_LABELS[u.role_type] || u.role_type}
                    </span>
                  )}
                </td>
                <td>
                  {editing === u.user_id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-success btn-sm" onClick={handleSave}>Save</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-outline btn-sm"
                      onClick={() => { setEditing(u.user_id); setNewRole(u.role_type); }}>
                      Change Role
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
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
        <Route path="users"     element={<UsersPage users={users} onRefresh={fetchUsers} />} />
        <Route path="roles"     element={<RolesPage users={users} onRefresh={fetchUsers} />} />
        <Route path="proposals" element={<AllProposalsPage />} />
        <Route path="reports"   element={<ReportsPage />} />
      </Routes>
    </Layout>
  );
};

export default AdminDashboard;


