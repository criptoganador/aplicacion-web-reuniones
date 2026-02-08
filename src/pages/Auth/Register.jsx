import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, User, Mail, Lock, UserPlus, ArrowRight, AlertCircle, Palette } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import './Auth.css';

function Register() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user'); // 'user' or 'admin'
  const [orgName, setOrgName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Si es admin, orgName es obligatorio
    if (role === 'admin' && !orgName.trim()) {
      setError('El nombre de la organización es obligatorio para administradores.');
      setIsLoading(false);
      return;
    }

    // Si es usuario, joinCode es obligatorio
    if (role === 'user' && !joinCode.trim()) {
      setError('Debes ingresar el código de invitación de tu organización.');
      setIsLoading(false);
      return;
    }

    const result = await registerUser(name, email, password, role, orgName, joinCode);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Error al crear la cuenta');
    }

    setIsLoading(false);
  };

  return (
    <div className="auth-container register">
      <div className="auth-overlay"></div>
      <div className="auth-card animate-fade-in">
        <div className="auth-header">
          <div className="auth-logo">
            <Video size={40} className="logo-icon" />
            <h1>ASICME <span>Meet</span></h1>
          </div>
          <p className="auth-subtitle">Crea tu cuenta profesional para empezar a colaborar.</p>
        </div>
 
        {isRegistered ? (
          <div className="auth-success-view animate-fade-in" style={{ textAlign: 'center', padding: '20px 0' }}>
            <div className="success-icon-container" style={{ marginBottom: '20px' }}>
              <Mail size={60} className="success-icon" style={{ color: '#34a853' }} />
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#202124' }}>¡Registro completado!</h2>
            <p style={{ color: '#5f6368', marginBottom: '24px', lineHeight: '1.5' }}>
              Tu cuenta ha sido creada con éxito. 
              Ya puedes iniciar sesión para empezar a usar ASICME Meet.
            </p>
            <Button 
              variant="primary" 
              fullWidth 
              onClick={() => navigate('/login')}
            >
              Ir a Iniciar Sesión
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-error animate-shake">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
 
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="role-selector-container">
                <label>¿Qué tipo de cuenta deseas crear?</label>
                <div className="role-options">
                  <button 
                    type="button"
                    className={`role-option ${role === 'user' ? 'active' : ''}`}
                    onClick={() => setRole('user')}
                  >
                    <User size={20} />
                    <span>Usuario</span>
                  </button>
                  <button 
                    type="button"
                    className={`role-option ${role === 'admin' ? 'active' : ''}`}
                    onClick={() => setRole('admin')}
                  >
                    <Palette size={20} />
                    <span>Administrador</span>
                  </button>
                </div>
              </div>

              {role === 'user' && (
                <div className="input-group animate-slide-up">
                  <label htmlFor="joinCode">Código de Invitación (de tu empresa)</label>
                  <div className="input-field highlight">
                    <Lock size={20} />
                    <input
                      id="joinCode"
                      type="text"
                      placeholder="Ej: ASICME-X123"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      required={role === 'user'}
                    />
                  </div>
                  <p className="input-hint">Solicita este código al administrador de tu organización.</p>
                </div>
              )}

              {role === 'admin' && (
                <div className="input-group animate-slide-up">
                  <label htmlFor="orgName">Nombre de tu Organización / Empresa</label>
                  <div className="input-field highlight">
                    <Video size={20} />
                    <input
                      id="orgName"
                      type="text"
                      placeholder="Ej: Innova Corp"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required={role === 'admin'}
                    />
                  </div>
                </div>
              )}

              <div className="input-group">
                <label htmlFor="name">Nombre completo</label>
                <div className="input-field">
                  <User size={20} />
                  <input
                    id="name"
                    type="text"
                    placeholder="Tu nombre completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="email">Correo electrónico</label>
                <div className="input-field">
                  <Mail size={20} />
                  <input
                    id="email"
                    type="email"
                    placeholder="ejemplo@asicme.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password">Contraseña</label>
                <div className="input-field">
                  <Lock size={20} />
                  <input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                variant="primary" 
                size="lg" 
                fullWidth 
                type="submit" 
                icon={UserPlus}
                disabled={isLoading}
              >
                {isLoading ? 'Procesando registro...' : 'Registrarme'}
              </Button>
            </form>

            <div className="auth-footer">
              <p>¿Ya tienes una cuenta?</p>
              <Link to="/login" className="auth-link">
                Inicia sesión aquí <ArrowRight size={16} />
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
          </>
        )}
      </div>
    </div>
  );
}

export default Register;
