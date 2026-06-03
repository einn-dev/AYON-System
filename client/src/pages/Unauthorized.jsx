import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Unauthorized = () => {
  const { logout } = useAuth();
  const navigate   = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f0f4f8', fontFamily: 'Segoe UI, sans-serif'
    }}>
      <h1 style={{ fontSize: '4rem', color: '#1a3a5c', margin: 0 }}>403</h1>
      <h2 style={{ color: '#2d3748', margin: '8px 0' }}>Access Denied</h2>
      <p style={{ color: '#718096', marginBottom: 24 }}>
        You don't have permission to view this page.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => navigate(-1)}
          style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d9e0',
            background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#2d3748' }}>
          Go Back
        </button>
        <button onClick={() => { logout(); navigate('/login'); }}
          style={{ padding: '10px 20px', borderRadius: 8, border: 'none',
            background: '#1a3a5c', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;