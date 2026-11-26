import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaMagnifyingGlass } from '../utils/icons';

/* Inside a role's pages: an address under /<role>/ that does not exist.
   The sidebar stays, and one button goes back to the dashboard. */
const NotFoundPanel = ({ base }) => {
  /* after the sidebar has set its own tab title */
  useEffect(() => {
    const t = setTimeout(() => { document.title = 'Page Not Found · AYON'; }, 0);
    return () => clearTimeout(t);
  }, []);
  return (
  <>
    <div className="page-header">
      <h1>Page Not Found</h1>
      <p>This page does not exist. The link may be mistyped or out of date.</p>
    </div>
    <div className="panel">
      <div className="empty-state">
        <p style={{ fontSize: '2rem', margin: '0 auto' }}><FaMagnifyingGlass /></p>
        <p>Use the menu on the left, or go back to your dashboard.</p>
        <Link to={`${base}/dashboard`} className="btn btn-primary btn-sm">Go to Dashboard</Link>
      </div>
    </div>
  </>
  );
};

export default NotFoundPanel;