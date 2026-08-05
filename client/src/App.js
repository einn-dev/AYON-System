import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute   from './components/ProtectedRoute';

import LandingPage      from './pages/LandingPage';
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import Unauthorized     from './pages/Unauthorized';

import ResearcherDashboard      from './pages/dashboards/ResearcherDashboard';
import MsricStaffDashboard      from './pages/dashboards/MsricStaffDashboard';
import CoordinatorDashboard     from './pages/dashboards/CoordinatorDashboard';
import ChairpersonDashboard     from './pages/dashboards/ChairpersonDashboard';
import CollegeDeanDashboard     from './pages/dashboards/CollegeDeanDashboard';
import SpecialAssistantDashboard from './pages/dashboards/SpecialAssistantDashboard';
import DirectorDashboard        from './pages/dashboards/DirectorDashboard';
import OvcredDashboard          from './pages/dashboards/OvcredDashboard';
import AdminDashboard           from './pages/dashboards/AdminDashboard';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login"      element={<LoginPage />} />
          <Route path="/register"   element={<RegisterPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

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

          {/* Research Coordinator */}
          <Route path="/coordinator/*" element={
            <ProtectedRoute allowedRoles={['research_coordinator']}>
              <CoordinatorDashboard />
            </ProtectedRoute>
          } />

          {/* Chairperson */}
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

          {/* Special Assistant */}
          <Route path="/special-assistant/*" element={
            <ProtectedRoute allowedRoles={['special_assistant']}>
              <SpecialAssistantDashboard />
            </ProtectedRoute>
          } />

          {/* MSRIC Director */}
          <Route path="/director/*" element={
            <ProtectedRoute allowedRoles={['msric_director']}>
              <DirectorDashboard />
            </ProtectedRoute>
          } />

          {/* OVCRED */}
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
          <Route path="/" element={<LandingPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;