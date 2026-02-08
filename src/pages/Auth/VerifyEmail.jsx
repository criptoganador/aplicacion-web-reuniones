import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowRight, Mail, RefreshCw } from 'lucide-react';
import Button from '../../components/Button';
import { toast } from 'sonner';
import './Auth.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function VerifyEmail() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailParam = searchParams.get('email') || '';

  const [status, setStatus] = useState(token ? 'verifying' : 'idle'); // idle, verifying, success, error
  const [message, setMessage] = useState('');
  const [otp, setOtp] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Verificación automática si hay token en la URL
  useEffect(() => {
    if (token && token.length > 10) { // Si es el token viejo largo, o link directo
      handleVerify(token);
    }
  }, [token]);

  // Manejo del contador para el reenvío
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (tokenToVerify) => {
    const code = tokenToVerify || otp;
    if (!code) return;

    setStatus('verifying');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-email/${code}`);
      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage(data.message);
        toast.success("¡Cuenta verificada!");
      } else {
        setStatus('error');
        setMessage(data.error || "Código inválido");
        toast.error(data.error || "Error de verificación");
      }
    } catch (error) {
      setStatus('error');
      setMessage('Error de conexión al verificar.');
    }
  };

  const handleResend = async () => {
    if (!emailParam) {
      toast.error("No tenemos tu correo. Por favor, intenta registrarte de nuevo.");
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam }),
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success("Nuevo código enviado (revisa la consola si no tienes SMTP)");
        setCountdown(60); // 60 segundos de espera
      } else {
        toast.error(data.error || "Error al reenviar");
      }
    } catch (err) {
      toast.error("Fallo de conexión");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade-in">
        <div className="auth-header">
          {status === 'success' ? (
            <CheckCircle size={48} className="success-icon" style={{ color: '#34a853', marginBottom: '16px' }} />
          ) : status === 'error' ? (
            <XCircle size={48} className="error-icon" style={{ color: '#d93025', marginBottom: '16px' }} />
          ) : (
            <Mail size={48} style={{ color: '#1a73e8', marginBottom: '16px' }} />
          )}

          <h1>
            {status === 'success' ? '¡Cuenta Verificada!' : 
             status === 'verifying' ? 'Verificando...' : 
             'Verifica tu correo'}
          </h1>
          
          <p className="auth-subtitle">
            {status === 'success' ? message : 
             status === 'error' ? message :
             `Hemos enviado un código a ${emailParam || 'tu correo'}.`}
          </p>
        </div>

        {status !== 'success' && (
          <div className="auth-form-content" style={{ marginTop: '24px' }}>
            <div className="input-group">
              <label>Código de 6 dígitos</label>
              <div className="input-field">
                <input
                  type="text"
                  maxLength="6"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px' }}
                />
              </div>
            </div>

            <Button 
              variant="primary" 
              fullWidth 
              onClick={() => handleVerify()}
              disabled={otp.length !== 6 || status === 'verifying'}
            >
              {status === 'verifying' ? <Loader2 className="spinner" /> : 'Verificar Código'}
            </Button>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button 
                className="resend-link" 
                onClick={handleResend}
                disabled={isResending || countdown > 0}
                style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', fontSize: '14px' }}
              >
                {countdown > 0 ? `Reenviar en ${countdown}s` : '¿No recibiste el código? Reenviar'}
              </button>
            </div>
          </div>
        )}

        <div className="auth-actions" style={{ marginTop: '24px' }}>
          {(status === 'success' || status === 'error') && (
            <Button 
              variant="outline" 
              fullWidth 
              onClick={() => navigate('/login')}
            >
              Ir al Inicio de Sesión <ArrowRight size={18} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
