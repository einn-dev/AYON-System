import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/* ─────────────────────────────────────────────────────────────
   The browser tab title of the pages outside the dashboards.
   Each dashboard page sets its own title in Layout.jsx ("My Research · AYON"),
   and the Terms and Privacy pages in LegalLayout.jsx.
   ───────────────────────────────────────────────────────────── */
const TITLES = {
  '/home':            'AYON · Research Management for MSIRC, MSU Main Campus',
  '/login':           'Sign In · AYON',
  '/register':        'Register · AYON',
  '/forgot-password': 'Forgot Password · AYON',
  '/reset-password':  'Reset Password · AYON',
  '/verify-email':    'Verify Email · AYON',
  '/change-password': 'Change Password · AYON',
  '/unauthorized':    'No Access · AYON',
};

const PageTitle = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = TITLES[pathname.replace(/\/+$/, '') || '/home'];
    if (t) document.title = t;
  }, [pathname]);
  return null;
};

export default PageTitle;