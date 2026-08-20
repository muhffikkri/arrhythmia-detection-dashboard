import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';

// Landing Pages
import { HomePage } from './presentation/pages/landing/HomePage';
import { HowItWorksPage } from './presentation/pages/landing/HowItWorksPage';
import { FaqPage } from './presentation/pages/landing/FaqPage';

// Auth Pages
import { SplashPage } from './presentation/pages/auth/SplashPage';
import { LoginPage } from './presentation/pages/auth/LoginPage';
import { RegisterPage } from './presentation/pages/auth/RegisterPage';

import { SidebarProvider } from './application/context/SidebarContext';
import { ConnectionProvider } from './application/context/ConnectionContext';
import { PreferencesProvider } from './application/context/PreferencesContext';
import { SecurityProvider } from './application/context/SecurityContext';
import { DevToolsBlocker } from './presentation/components/DevToolsBlocker';

// Admin Pages
import { ErrorBoundary } from './presentation/components/ErrorBoundary';
import { AdminDashboardPage } from './presentation/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from './presentation/pages/admin/AdminUsersPage';
import { AdminDevicesPage } from './presentation/pages/admin/AdminDevicesPage';
import { AdminSessionsPage } from './presentation/pages/admin/AdminSessionsPage';
import { AdminAnalyticsPage } from './presentation/pages/admin/AdminAnalyticsPage';

// Doctor Pages
import { DashboardPage } from './presentation/pages/doctor/DashboardPage';
// import { MonitorPage } from './presentation/pages/doctor/MonitorPage';
import { AnalyticsPage } from './presentation/pages/doctor/AnalyticsPage';
import { QrScannerPage } from './presentation/pages/doctor/QrScannerPage';
import { ProfilePage } from './presentation/pages/doctor/ProfilePage';

// Patient Pages
import { PatientDashboardPage } from './presentation/pages/patient/PatientDashboardPage';
import { PatientQrSyncPage } from './presentation/pages/patient/PatientQrSyncPage';
import { PatientHistoryPage } from './presentation/pages/patient/PatientHistoryPage';
import { PatientHistoryDetailPage } from './presentation/pages/patient/PatientHistoryDetailPage';
import { PatientProfilePage } from './presentation/pages/patient/PatientProfilePage';
import { PatientSettingsPage } from './presentation/pages/patient/PatientSettingsPage';
import { PatientMonitorPage } from './presentation/pages/patient/PatientMonitorPage';
import { PatientDeviceScannerPage } from './presentation/pages/patient/PatientDeviceScannerPage';

const TitleSetter: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const titles: Record<string, string> = {
      '/': 'Home',
      '/how-it-works': 'How It Works',
      '/faq': 'FAQ',
      '/auth': 'Auth',
      '/auth/login': 'Login',
      '/auth/register': 'Register',
      '/admin/dashboard': 'Admin Dashboard',
      '/admin/monitor': 'Live Stream Monitor',
      '/admin/users': 'User Management',
      '/admin/devices': 'Device Fleet',
      '/admin/sessions': 'Session Management',
      '/admin/analytics': 'Admin Analytics',
      '/doctor/dashboard': 'Doctor Dashboard',
      '/doctor/analytics': 'Analytics',
      '/doctor/qr-scanner': 'QR Scanner',
      '/doctor/profile': 'Profile',
      '/patient/dashboard': 'Patient Dashboard',
      '/patient/qr-sync': 'QR Sync',
      '/patient/history': 'History',
      '/patient/device-guide': 'Device Guide',
      '/patient/profile': 'Profil & Keamanan',
      '/patient/settings': 'Patient Settings',
      '/patient/monitor': 'Live Monitor',
    };

    const pageName = titles[location.pathname] || 'App';
    document.title = `ecgrhythmia | ${pageName}`;
  }, [location]);

  return null;
};

const SessionRestorer: React.FC = () => {
  useEffect(() => {
    const isImpersonating = sessionStorage.getItem('is_impersonating');
    if (!isImpersonating) {
      const adminToken = localStorage.getItem('admin_auth_token');
      const adminId = localStorage.getItem('admin_user_id');
      const docToken = localStorage.getItem('doctor_auth_token');
      const docId = localStorage.getItem('doctor_user_id');
      const originalRole = localStorage.getItem('original_role');

      if (adminToken && adminId && originalRole === 'admin') {
        localStorage.setItem('auth_token', adminToken);
        localStorage.setItem('user_id', adminId);
        localStorage.setItem('user_role', 'admin');
        localStorage.removeItem('admin_auth_token');
        localStorage.removeItem('admin_user_id');
        localStorage.removeItem('original_role');
      } else if (docToken && docId && originalRole === 'dokter') {
        localStorage.setItem('auth_token', docToken);
        localStorage.setItem('user_id', docId);
        localStorage.setItem('user_role', 'dokter');
        localStorage.removeItem('doctor_auth_token');
        localStorage.removeItem('doctor_user_id');
        localStorage.removeItem('original_role');
      }
    }
  }, []);
  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SecurityProvider>
      <PreferencesProvider>
      <ConnectionProvider>
      <SidebarProvider>
      <TitleSetter />
      <SessionRestorer />
      <DevToolsBlocker />
      <ErrorBoundary>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/faq" element={<FaqPage />} />

        {/* Auth Routes */}
        <Route path="/auth" element={<SplashPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/devices" element={<AdminDevicesPage />} />
        <Route path="/admin/sessions" element={<AdminSessionsPage />} />
        <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />

        {/* Doctor Routes */}
        <Route path="/doctor/dashboard" element={<DashboardPage />} />
        <Route path="/doctor/analytics" element={<AnalyticsPage />} />
        <Route path="/doctor/qr-scanner" element={<QrScannerPage />} />
        <Route path="/doctor/profile" element={<ProfilePage />} />

        <Route path="/patient/dashboard" element={<PatientDashboardPage />} />
        <Route path="/patient/qr-sync" element={<PatientQrSyncPage />} />
        <Route path="/patient/device-scanner" element={<PatientDeviceScannerPage />} />
        <Route path="/patient/history" element={<PatientHistoryPage />} />
        <Route path="/patient/history/:sessionId" element={<PatientHistoryDetailPage />} />
        <Route path="/patient/profile" element={<PatientProfilePage />} />
        <Route path="/patient/settings" element={<PatientSettingsPage />} />
        <Route path="/patient/monitor" element={<PatientMonitorPage />} />
      </Routes>
      </ErrorBoundary>
      </SidebarProvider>
      </ConnectionProvider>
      </PreferencesProvider>
      </SecurityProvider>
    </BrowserRouter>
  );
};