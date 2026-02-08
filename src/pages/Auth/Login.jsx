import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Mail, Lock, LogIn, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import './Auth.css';
import MeshGradient from '../../components/MeshGradient/MeshGradient';

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(email, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Error al iniciar sesión');
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-container">
      <MeshGradient />
      
      {/* Animated Background Orbs */}
      <div className="auth-bg-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>
      
      <div className="auth-content animate-fade-in-up">
        <div className="auth-card glass-panel-enhanced">
          {/* Decorative glow */}
          <div className="card-glow"></div>
          
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-background pulse-glow">
                <Video size={32} className="logo-icon" />
              </div>
              <h1>ASICME <span>Meet</span></h1>
            </div>
            <p className="auth-subtitle">Bienvenido de nuevo. Accede a tus reuniones profesionales.</p>
          </div>

          {error && (
            <div className="auth-error animate-shake">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Email Field with Floating Label */}
            <div className={`input-group floating ${email || focusedField === 'email' ? 'has-value' : ''}`}>
              <div className={`input-field glass-input ${focusedField === 'email' ? 'focused' : ''}`}>
                <Mail size={20} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="email"
                />
                <label htmlFor="email" className="floating-label">Correo corporativo</label>
              </div>
            </div>

            {/* Password Field with Floating Label and Toggle */}
            <div className={`input-group floating ${password || focusedField === 'password' ? 'has-value' : ''}`}>
              <div className={`input-field glass-input ${focusedField === 'password' ? 'focused' : ''}`}>
                <Lock size={20} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="current-password"
                />
                <label htmlFor="password" className="floating-label">Contraseña</label>
                <button 
                  type="button" 
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="forgot-password-link">
                <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
              </div>
            </div>

            <Button 
              variant="primary" 
              size="lg" 
              fullWidth 
              type="submit" 
              icon={LogIn}
              disabled={isLoading}
              className={`login-btn ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? (
                <span className="btn-loading">
                  <span className="spinner-small"></span>
                  Iniciando sesión...
                </span>
              ) : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="auth-footer">
            <p>¿Aún no tienes cuenta?</p>
            <Link to="/register" className="auth-link">
              Crear cuenta nueva <ArrowRight size={16} />
            </Link>
            <div className="legal-links">
              <Link to="/terms">Términos y Condiciones</Link>
              <span className="separator"> • </span>
              <Link to="/privacy">Política de Privacidad</Link>
              <span className="separator"> • </span>
              <Link to="/cookies">Cookies</Link>
              <span className="separator"> • </span>
              <Link to="/help">Ayuda</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
