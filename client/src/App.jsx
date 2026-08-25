import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Authentication Providers and Guards
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';

// Code-split by role/page - a Trader session shouldn't download Admin/Super-Admin
// bundles and vice versa (each shell now lives in its own file/chunk).
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const CompleteFirstLogin = lazy(() => import('./pages/CompleteFirstLogin'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const TraderShell = lazy(() => import('./pages/shells/TraderShell'));
const RMSAdminShell = lazy(() => import('./pages/shells/RMSAdminShell'));
const PMShell = lazy(() => import('./pages/shells/PMShell'));
const CompanyShell = lazy(() => import('./pages/shells/CompanyShell'));
const SuperAdminShell = lazy(() => import('./pages/shells/SuperAdminShell'));

const RouteFallback = () => (
  <div style={{ padding: '20px', color: '#627d98', fontFamily: '"Inter", sans-serif' }}>Loading...</div>
);

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/first-login" element={<CompleteFirstLogin />} />
            <Route path="/change-password" element={<ChangePassword />} />

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
                <ProtectedRoute allowedRoles={['RMS_ADMIN', 'SUPER_ADMIN', 'COMPANY_ACCOUNT']}>
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
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
