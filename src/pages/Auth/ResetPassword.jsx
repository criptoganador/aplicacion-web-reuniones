import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Lock, ArrowLeft, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import './Auth.css';

import { getApiUrl } from '../../context/AuthContext';

function ResetPassword() {
  const { token } = useParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return;

    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${getApiUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setTimeout(() => navigate('/login'), 2000);
      } else {
        toast.error(data.error || 'Error al restablecer la contraseña');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in">
        <div className="auth-header">
          <KeyRound size={40} className="header-icon" style={{ color: '#1a73e8', marginBottom: '16px' }} />
          <h1>Nueva Contraseña</h1>
          <p className="auth-subtitle">
            Crea una contraseña segura para volver a acceder a tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <label htmlFor="newPassword">Nueva contraseña</label>
            <div className="input-field glass-input">
              <Lock size={18} className="input-icon" />
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="confirmPassword">Confirmar contraseña</label>
            <div className="input-field glass-input">
              <Lock size={18} className="input-icon" />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
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
            {isLoading ? 'Restableciendo...' : 'Cambiar Contraseña'}
          </Button>
        </form>

        <Link to="/login" className="back-link center" style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <span>Volver al login</span>
        </Link>
      </div>
    </div>
  );
}

export default ResetPassword;
