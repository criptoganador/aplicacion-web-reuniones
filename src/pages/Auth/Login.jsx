import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Mail, Lock, LogIn, ArrowRight, AlertCircle } from 'lucide-react';
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
      
      <div className="auth-content animate-fade-in">
        <div className="auth-card glass-panel">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-background">
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
            <div className="input-group">
              <label htmlFor="email">Correo corporativo</label>
              <div className="input-field glass-input">
                <Mail size={20} />
                <input
                  id="email"
                  type="email"
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="password">Contraseña</label>
              <div className="input-field glass-input">
                <Lock size={20} />
                <input
                  id="password"
                  type="password"
                  placeholder="Ingrese contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
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
              className="login-btn"
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
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
