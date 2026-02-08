import React from 'react';
import { ArrowLeft, HelpCircle, MessageCircle, Video, User, Mic, Monitor } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Legal.css';

const Help = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="legal-page">
      <div className="legal-header">
        <div className="legal-container">
          <Link to={isAuthenticated ? "/" : "/login"} className="back-link">
            <ArrowLeft size={20} /> {isAuthenticated ? "Volver a la aplicación" : "Volver al inicio"}
          </Link>
          <h1>Centro de Ayuda</h1>
          <p className="legal-subtitle">Encuentra respuestas y soporte para tus reuniones.</p>
        </div>
      </div>

      <div className="legal-container legal-content">
        <section>
          <h2>Preguntas Frecuentes (FAQ)</h2>
          
          <div className="faq-grid">
            <div className="feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Video className="feature-icon" size={20} style={{ marginBottom: 0 }} />
                <h3 style={{ marginBottom: 0 }}>¿Cómo creo una reunión?</h3>
              </div>
              <p>Puedes iniciar una reunión instantánea desde el panel principal o programar una para más tarde. Solo comparte el enlace generado con tus invitados.</p>
            </div>

            <div className="feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <User className="feature-icon" size={20} style={{ marginBottom: 0 }} />
                <h3 style={{ marginBottom: 0 }}>¿Necesito una cuenta para unirme?</h3>
              </div>
              <p>No, los invitados pueden unirse a una reunión simplemente haciendo clic en el enlace de invitación, sin necesidad de registrarse.</p>
            </div>

            <div className="feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <Mic className="feature-icon" size={20} style={{ marginBottom: 0 }} />
                <h3 style={{ marginBottom: 0 }}>Problemas de Audio/Video</h3>
              </div>
              <p>Asegúrate de dar permisos al navegador para usar tu cámara y micrófono. Verifica que estén seleccionados los dispositivos correctos en la configuración.</p>
            </div>

            <div className="feature-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                 <Monitor className="feature-icon" size={20} style={{ marginBottom: 0 }} />
                 <h3 style={{ marginBottom: 0 }}>Compartir Pantalla</h3>
              </div>
              <p>Puedes compartir toda tu pantalla, una ventana o una pestaña del navegador usando el botón "Compartir pantalla" en la barra de controles.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Soporte Técnico</h2>
          <p>
            Si tienes problemas técnicos que no puedes resolver, nuestro equipo de soporte está disponible para ayudarte.
          </p>
          <div className="contact-card" style={{ 
            background: 'var(--bg-secondary)', 
            padding: '30px', 
            borderRadius: '16px', 
            textAlign: 'center',
            border: '1px solid var(--bg-tertiary)',
            marginTop: '20px'
          }}>
            <MessageCircle size={48} color="var(--color-primary)" style={{ marginBottom: '16px' }} />
            <h3>¿Necesitas más ayuda?</h3>
            <p style={{ marginBottom: '24px' }}>Escríbenos y te responderemos lo antes posible.</p>
            <a href="mailto:soporte@asicme.com" className="contact-btn">
              Contactar Soporte
            </a>
          </div>
        </section>

        <div className="legal-footer">
          <p>© 2026 ASICME. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default Help;
