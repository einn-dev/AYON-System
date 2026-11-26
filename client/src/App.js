import './styles';          // all stylesheets first, in a fixed order
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';
import PageTitle        from './components/PageTitle';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import Unauthorized     from './pages/Unauthorized';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import VerifyEmailPage    from './pages/VerifyEmailPage';

import LandingPage from './pages/LandingPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';

import lazyPage from './utils/lazyPage';

/* Each role's pages are their own download. A user gets only their own role's pages after
   signing in, so the login page opens faster. */
const ResearcherDashboard       = lazyPage(() => import('./pages/dashboards/ResearcherDashboard'));
const MsricStaffDashboard       = lazyPage(() => import('./pages/dashboards/MsricStaffDashboard'));
const CoordinatorDashboard      = lazyPage(() => import('./pages/dashboards/CoordinatorDashboard'));
const ChairpersonDashboard      = lazyPage(() => import('./pages/dashboards/ChairpersonDashboard'));
const CollegeDeanDashboard      = lazyPage(() => import('./pages/dashboards/CollegeDeanDashboard'));
const SpecialAssistantDashboard = lazyPage(() => import('./pages/dashboards/SpecialAssistantDashboard'));
const DirectorDashboard         = lazyPage(() => import('./pages/dashboards/DirectorDashboard'));
const OvcredDashboard           = lazyPage(() => import('./pages/dashboards/OvcredDashboard'));
const AdminDashboard            = lazyPage(() => import('./pages/dashboards/AdminDashboard'));

function App() {
  return (
    <AuthProvider>
      <Router>
        <PageTitle />
        <Suspense fallback={<div className="loading">Loading…</div>}>
        <Routes>
          {/* Public Routes */}
          <Route path="/"           element={<Navigate to="/home" replace />} />
          <Route path="/login"      element={<LoginPage />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/register"   element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Researcher */}
          <Route path="/researcher/*" element={
            <ProtectedRoute allowedRoles={['researcher']}>
              <ResearcherDashboard />
            </ProtectedRoute>
          } />

          {/* MSRIC Staff */}
          <Route path="/msric-staff/*" element={
            <ProtectedRoute allowedRoles={['msric_staff']}>
              <MsricStaffDashboard />
            </ProtectedRoute>
          } />

          {/* College Coordinator */}
          <Route path="/coordinator/*" element={
            <ProtectedRoute allowedRoles={['research_coordinator']}>
              <CoordinatorDashboard />
            </ProtectedRoute>
          } />

          {/* College Chairperson */}
          <Route path="/chairperson/*" element={
            <ProtectedRoute allowedRoles={['chairperson']}>
              <ChairpersonDashboard />
            </ProtectedRoute>
          } />

          {/* College Dean */}
          <Route path="/college-dean/*" element={
            <ProtectedRoute allowedRoles={['college_dean']}>
              <CollegeDeanDashboard />
            </ProtectedRoute>
          } />

          {/* MSIRC Special Assistant */}
          <Route path="/special-assistant/*" element={
            <ProtectedRoute allowedRoles={['special_assistant']}>
              <SpecialAssistantDashboard />
            </ProtectedRoute>
          } />

          {/* MSIRC Director */}
          <Route path="/director/*" element={
            <ProtectedRoute allowedRoles={['msric_director']}>
              <DirectorDashboard />
            </ProtectedRoute>
          } />

          {/* VCRED */}
          <Route path="/ovcred/*" element={
            <ProtectedRoute allowedRoles={['ovcred']}>
              <OvcredDashboard />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin/*" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;