import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import './Auth.css';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const data = await forgotPassword(email);
      if (data.success) {
        setIsSent(true);
        toast.success('Correo de recuperación enviado');
      } else {
        toast.error(data.error || 'Error al procesar la solicitud');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="auth-container">
        <div className="auth-card animate-fade-in">
          <div className="auth-header">
            <CheckCircle size={48} className="success-icon" style={{ color: '#34a853', marginBottom: '16px' }} />
            <h1>¡Correo enviado!</h1>
            <p className="auth-subtitle">
              Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.
            </p>
          </div>
          <div className="auth-actions" style={{ marginTop: '24px' }}>
            <Button variant="primary" fullWidth onClick={() => navigate('/login')}>
              Volver al Inicio de Sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in">
        <Link to="/login" className="back-link">
          <ArrowLeft size={16} />
          <span>Volver al login</span>
        </Link>
        
        <div className="auth-header">
          <h1>¿Olvidaste tu contraseña?</h1>
          <p className="auth-subtitle">
            Ingresa tu correo electrónico y te enviaremos un enlace para que escojas una nueva.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                id="email"
                type="email"
                placeholder="ejemplo@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <Button
            variant="primary"
            type="submit"
            fullWidth
            disabled={isLoading}
            icon={isLoading ? Loader2 : null}
            className={isLoading ? 'btn-loading' : ''}
          >
            {isLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
