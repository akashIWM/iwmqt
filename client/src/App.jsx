import React from 'react';
import ForgotPassword from './pages/ForgotPassword';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Authentication Providers and Guards
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import AdminPortal from './pages/AdminPortal';

// Public Pages
import Login from './pages/Login';
import Signup from './pages/Signup';

// Protected Application Shells
import { 
  TraderShell, 
  RMSAdminShell, 
  PMShell, 
  CompanyShell, 
  SuperAdminShell 
} from './pages/Shells';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes by Role */}
          <Route 
            path="/app/trader" 
            element={
              <ProtectedRoute allowedRoles={['TRADER']}>
                <TraderShell />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/app/rms" 
            element={
              <ProtectedRoute allowedRoles={['RMS_ADMIN', 'SUPER_ADMIN']}>
                <RMSAdminShell />
              </ProtectedRoute>
            } 
          />
          
          {/* NEW: Admin & RMS Control Portal */}
          <Route 
            path="/app/admin" 
            element={
              <ProtectedRoute allowedRoles={['RMS_ADMIN', 'SUPER_ADMIN']}>
                <AdminPortal />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/app/pm" 
            element={
              <ProtectedRoute allowedRoles={['PM']}>
                <PMShell />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/app/company" 
            element={
              <ProtectedRoute allowedRoles={['COMPANY_ACCOUNT', 'SUPER_ADMIN']}>
                <CompanyShell />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/app/super-admin" 
            element={
              <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                <SuperAdminShell />
              </ProtectedRoute>
            } 
          />

          {/* Catch-all 404 Route */}
          <Route path="*" element={<div style={{ padding: '20px', color: '#fff' }}>404 - Page Not Found</div>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}