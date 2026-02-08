import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from './context';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import './App.css';

import TitleBar from './components/TitleBar/TitleBar';
import WindowResizerSimple from './components/WindowResizer/WindowResizer';

// Lazy load pages for code splitting
const Home = lazy(() => import('./pages/Home/Home'));
const PreLobby = lazy(() => import('./pages/PreLobby/PreLobby'));
const MeetingRoom = lazy(() => import('./pages/MeetingRoom/MeetingRoom'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/Auth/VerifyEmail'));
const Terms = lazy(() => import('./pages/Legal/Terms'));
const Privacy = lazy(() => import('./pages/Legal/Privacy'));
const Help = lazy(() => import('./pages/Legal/Help'));
const CookiePolicy = lazy(() => import('./pages/Legal/CookiePolicy'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const AdminDashboard = lazy(() => import('./pages/Admin/AdminDashboard'));

// Loading fallback component
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="app">
            <WindowResizerSimple />
            <TitleBar />
            <div className="app-content" style={{ marginTop: window.electron ? '32px' : '0' }}>
              <Toaster position="top-right" richColors closeButton />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/cookies" element={<CookiePolicy />} />
                <Route path="/help" element={<Help />} />

                {/* Private Routes */}
                <Route path="/" element={
                  <PrivateRoute>
                    <Home />
                  </PrivateRoute>
                } />
                <Route path="/pre-lobby/:meetingId?" element={
                  <PrivateRoute>
                    <PreLobby />
                  </PrivateRoute>
                } />
                <Route path="/meeting/:meetingId" element={
                  <PrivateRoute>
                    <MeetingRoom />
                  </PrivateRoute>
                } />
                <Route path="/settings" element={
                  <PrivateRoute>
                    <Settings />
                  </PrivateRoute>
                } />
                <Route path="/admin" element={
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                } />
              </Routes>
              </Suspense>
            </div>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
