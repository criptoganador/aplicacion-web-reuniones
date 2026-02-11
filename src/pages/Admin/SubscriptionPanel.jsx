import { useState } from 'react';
import { Check, CreditCard, Zap, Shield, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import { toast } from 'sonner';
import './SubscriptionPanel.css';

const PLANS = {
  free: {
    name: 'Free',
    price: '$0',
    users: 5,
    features: ['Hasta 5 usuarios', 'Reuniones de 40 min', 'Soporte básico']
  },
  pro: {
    name: 'Pro',
    price: '$15/mes',
    users: 50,
    features: ['Hasta 50 usuarios', 'Reuniones ilimitadas', 'Grabaciones en la nube', 'Soporte prioritario', 'Personalización de marca']
  },
  enterprise: {
    name: 'Enterprise',
    price: 'Contactar',
    users: 'Ilimitados',
    features: ['Usuarios ilimitados', 'Sso Avanzado', 'Gestor de cuenta dedicado', 'SLA 99.9%', 'Auditoría avanzada']
  }
};

function SubscriptionPanel({ stats, refreshStats }) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);

  const currentPlan = stats?.plan || 'free';
  const planInfo = PLANS[currentPlan] || PLANS.free;
  const isPro = currentPlan === 'pro';

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      // Usar un Price ID de prueba si no hay variable de entorno, o el de prod
      // En un caso real, esto vendría del backend o config
      const res = await authFetch('/api/billing/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO }) 
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error('No se pudo iniciar el pago');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/billing/create-portal-session', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        toast.error('No se pudo abrir el portal de facturación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-panel animate-fade-in">
      <div className="current-plan-card glass-panel-enhanced">
        <div className="plan-header">
          <div className="plan-icon">
             {isPro ? <Star size={32} color="#fbbf24" fill="#fbbf24" /> : <Shield size={32} />}
          </div>
          <div className="plan-details">
            <h2>Plan Actual: <span className="text-gradient">{PLANS[currentPlan]?.name}</span></h2>
            <p className="status-badge active">
              {stats?.subscription_status === 'active' ? 'Activo' : 'Inactivo'}
            </p>
          </div>
          {isPro && (
            <Button variant="outline" onClick={handleManage} disabled={loading}>
              Gestionar Suscripción
            </Button>
          )}
        </div>

        <div className="usage-stats">
          <div className="usage-item">
            <span className="label">Usuarios</span>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${planInfo.users === 'Ilimitados' || planInfo.users === 999999 ? 10 : Math.min((stats?.total_users / (planInfo.users || 1)) * 100, 100)}%` }}
              ></div>
            </div>
            <span className="value">{stats?.total_users} / {planInfo.users === 'Ilimitados' || planInfo.users === 999999 ? '∞' : planInfo.users}</span>
          </div>
        </div>
      </div>

      {!isPro && (
        <div className="upgrade-section">
          <h3>Mejora tu plan para desbloquear todo el potencial</h3>
          
          <div className="pricing-grid">
            <div className="pricing-card pro-card glass-panel">
                <div className="card-badge">RECOMENDADO</div>
                <h3>Pro</h3>
                <div className="price">$15<span>/mes</span></div>
                <ul className="features-list">
                    {PLANS.pro.features.map((feat, i) => (
                        <li key={i}><Check size={16} className="check-icon" /> {feat}</li>
                    ))}
                </ul>
                <Button 
                    variant="primary" 
                    fullWidth 
                    size="lg" 
                    icon={Zap} 
                    onClick={handleUpgrade}
                    disabled={loading}
                >
                    {loading ? 'Procesando...' : 'Actualizar a PRO'}
                </Button>
            </div>
            
            <div className="pricing-card enterprise-card glass-panel disabled">
                <h3>Enterprise</h3>
                <div className="price">Personalizado</div>
                <ul className="features-list">
                    {PLANS.enterprise.features.map((feat, i) => (
                        <li key={i}><Check size={16} className="check-icon" /> {feat}</li>
                    ))}
                </ul>
                <Button variant="outline" fullWidth disabled>
                    Contactar Ventas
                </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SubscriptionPanel;
