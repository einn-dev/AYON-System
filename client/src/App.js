import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import Unauthorized     from './pages/Unauthorized';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage  from './pages/ResetPasswordPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

import ResearcherDashboard      from './pages/dashboards/ResearcherDashboard';
import MsricStaffDashboard      from './pages/dashboards/MsricStaffDashboard';
import CoordinatorDashboard     from './pages/dashboards/CoordinatorDashboard';
import ChairpersonDashboard     from './pages/dashboards/ChairpersonDashboard';
import CollegeDeanDashboard     from './pages/dashboards/CollegeDeanDashboard';
import SpecialAssistantDashboard from './pages/dashboards/SpecialAssistantDashboard';
import DirectorDashboard        from './pages/dashboards/DirectorDashboard';
import OvcredDashboard          from './pages/dashboards/OvcredDashboard';
import LandingPage from './pages/LandingPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import AdminDashboard           from './pages/dashboards/AdminDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/"           element={<Navigate to="/home" replace />} />
          <Route path="/login"      element={<LoginPage />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/register"   element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
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
      </Router>
    </AuthProvider>
  );
}

export default App;