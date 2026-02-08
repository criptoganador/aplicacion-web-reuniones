import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from './context';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Home from './pages/Home/Home';
import PreLobby from './pages/PreLobby/PreLobby';
import MeetingRoom from './pages/MeetingRoom/MeetingRoom';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import VerifyEmail from './pages/Auth/VerifyEmail';
import Terms from './pages/Legal/Terms';
import Privacy from './pages/Legal/Privacy';
import Help from './pages/Legal/Help';
import CookiePolicy from './pages/Legal/CookiePolicy';
import Settings from './pages/Settings/Settings';
import AdminDashboard from './pages/Admin/AdminDashboard';
import './App.css';

import TitleBar from './components/TitleBar/TitleBar';
import WindowResizerSimple from './components/WindowResizer/WindowResizer';

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
            </div>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
