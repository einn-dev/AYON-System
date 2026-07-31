import React, { useState } from 'react';

/**
 * Password input with a show/hide (reveal) toggle button.
 * Drop-in replacement for <input type="password" />.
 *
 * Usage:
 *   <PasswordInput
 *     name="password"
 *     value={form.password}
 *     onChange={handleChange}
 *     placeholder="••••••••"
 *   />
 */
const PasswordInput = ({ name, value, onChange, placeholder, autoComplete }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={visible ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder || '••••••••'}
        autoComplete={autoComplete || 'current-password'}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #d1d9e0',
          borderRadius: 8,
          padding: '10px 44px 10px 14px',   /* extra right padding for the button */
          fontSize: '0.95rem',
          color: '#2d3748',
          background: '#f8fafc',
          outline: 'none',
          transition: 'border-color 0.2s',
          fontFamily: 'inherit',
        }}
        onFocus={e => { e.target.style.borderColor = '#2e6da4'; e.target.style.background = '#fff'; }}
        onBlur={e =>  { e.target.style.borderColor = '#d1d9e0'; e.target.style.background = '#f8fafc'; }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#718096',
        }}
      >
        {visible ? (
          /* Eye-off icon */
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          /* Eye icon */
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
};

export default PasswordInput;