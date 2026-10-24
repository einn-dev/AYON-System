import React, { useState, useEffect } from 'react';
import API from '../../services/authService';
import '../../components/Layout.css';

const TYPE_ICONS = {
  submission:  '📤',
  review:      '📋',
  endorsement: '✍️',
  approval:    '✅',
  rejection:   '❌',
  general:     '🔔',
};

const NotificationsPage = () => {
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    API.get('/notifications')
      .then(res => setNotifs(res.data.notifications || []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    try {
      await API.patch(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n =>
        n.notif_id === id ? { ...n, is_read: true } : n
      ));
    } catch {}
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.is_read);
    for (const n of unread) {
      try { await API.patch(`/notifications/${n.notif_id}/read`); } catch {}
    }
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;
  const filtered = filter === 'all'
    ? notifs
    : filter === 'unread'
      ? notifs.filter(n => !n.is_read)
      : notifs.filter(n => n.notif_type === filter);

  return (
    <>
      <div className="page-header">
        <h1>Notifications</h1>
        <p>Updates on your proposals, endorsements, grants, and approvals.</p>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div className="toolbar">
            <select className="search-input" style={{ minWidth: 160 }}
              value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Notifications</option>
              <option value="unread">Unread Only</option>
              <option value="submission">Submissions</option>
              <option value="review">Reviews</option>
              <option value="endorsement">Endorsements</option>
              <option value="approval">Approvals</option>
              <option value="rejection">Rejections</option>
            </select>
            {unreadCount > 0 && (
              <span className="badge badge-blue">{unreadCount} unread</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button className="btn btn-outline btn-sm" onClick={markAllRead}>
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading notifications...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p style={{ fontSize: '2rem', margin: 0 }}>🔔</p>
            <p>No notifications {filter !== 'all' ? 'matching this filter' : 'yet'}.</p>
          </div>
        ) : (
          filtered.map(n => (
            <div key={n.notif_id}
              onClick={() => !n.is_read && markRead(n.notif_id)}
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f0f4f8',
                background: n.is_read ? '#fff' : '#f0f6ff',
                display: 'flex', alignItems: 'flex-start',
                gap: 14, cursor: n.is_read ? 'default' : 'pointer',
                transition: 'background 0.2s',
              }}>
              <div style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1.2 }}>
                {TYPE_ICONS[n.notif_type] || '🔔'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1a3a5c',
                  margin: '0 0 3px', fontSize: '0.9rem' }}>
                  {n.title}
                </p>
                <p style={{ color: '#718096', margin: '0 0 4px',
                  fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {n.message}
                </p>
                <p style={{ color: '#a0aec0', margin: 0, fontSize: '0.75rem' }}>
                  {new Date(n.date_sent).toLocaleString()}
                </p>
              </div>
              {!n.is_read && (
                <span className="badge badge-blue" style={{ flexShrink: 0 }}>New</span>
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
};

export default NotificationsPage;