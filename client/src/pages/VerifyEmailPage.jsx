import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../services/authService';
import ResendVerification from '../components/ResendVerification';
import logo from '../assets/ayon-logo.png';
import './AuthPages.css';
import { FaArrowLeft, FaCircleCheck, FaTriangleExclamation } from 'react-icons/fa6';

const linkButton = {
  display: 'block', textDecoration: 'none', textAlign: 'center', marginTop: 20,
};

const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token ? '' : 'This verification link is incomplete. Please use the link from your email.'
  );
  const alreadyRan = useRef(false);   // stops React dev mode from calling the API twice

  useEffect(() => {
    if (!token || alreadyRan.current) return;
    alreadyRan.current = true;

    API.post('/auth/verify-email', { token })
      .then(res => { setState('success'); setMessage(res.data.message); })
      .catch(err => {
        setState('error');
        setMessage(
          err.response?.data?.message ||
          'We could not reach the server. It may be waking up. Please wait a minute and refresh this page.'
        );
      });
  }, [token]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <img src={logo} alt="AYON logo" />
          <h1>AYON</h1>
          <p>MSIRC – MSU Main Campus</p>
        </div>

        {state === 'loading' && (
          <>
            <h2>Verifying Your Email...</h2>
            <p style={{ color: '#8a7a7d', fontSize: '0.9rem' }}>Please wait a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 8 }}><FaCircleCheck style={{ color: '#276749' }} /></div>
            <h2>Email Verified</h2>
            <p style={{ color: '#6b5e61', fontSize: '0.9rem', lineHeight: 1.6 }}>{message}</p>
            <Link to="/login" className="auth-btn" style={linkButton}>Go to Sign In</Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 8 }}><FaTriangleExclamation style={{ color: '#b7791f' }} /></div>
            <h2>Verification Failed</h2>
            <p className="auth-error" style={{ textAlign: 'left' }}>{message}</p>
            <p style={{ color: '#6b5e61', fontSize: '0.85rem', marginTop: 16 }}>
              Enter your email to get a new link:
            </p>
            <ResendVerification askForEmail />
            <p className="auth-footer"><Link to="/login"><FaArrowLeft className="ic" />Back to Sign In</Link></p>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;