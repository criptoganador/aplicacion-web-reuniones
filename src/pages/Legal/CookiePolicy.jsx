import React from 'react';
import { ArrowLeft, Cookie, Info, Shield, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Legal.css';

const CookiePolicy = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="legal-page">
      <div className="legal-header">
        <div className="legal-container">
          <Link to={isAuthenticated ? "/" : "/login"} className="back-link">
            <ArrowLeft size={20} /> {isAuthenticated ? "Volver a la aplicación" : "Volver al inicio"}
          </Link>
          <h1>Política de Cookies</h1>
          <p className="legal-subtitle">Última actualización: 7 de Febrero, 2026</p>
        </div>
      </div>

      <div className="legal-container legal-content">
        <section>
          <h2>¿Qué son las Cookies?</h2>
          <p>
            Las cookies son pequeños archivos de texto que los sitios web colocan en tu dispositivo mientras navegas. 
            Son procesadas y almacenadas por tu navegador web. En sí mismas, las cookies son inofensivas y cumplen funciones cruciales para los sitios web.
          </p>
        </section>

        <section>
          <h2>¿Cómo usamos las Cookies?</h2>
          <div className="feature-grid">
            <div className="feature-item">
              <Shield className="feature-icon" size={24} />
              <h3>Esenciales</h3>
              <p>Necesarias para que el sitio funcione. Nos permiten mantener tu sesión iniciada de forma segura.</p>
            </div>
            <div className="feature-item">
              <Settings className="feature-icon" size={24} />
              <h3>Preferencias</h3>
              <p>Recuerdan tus ajustes, como el idioma o el tema (claro/oscuro) que has seleccionado.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Tipos de Cookies que utilizamos</h2>
          <div className="faq-grid" style={{ marginTop: '20px' }}>
            <div className="feature-item">
              <h3 style={{ marginBottom: '8px' }}>Cookies de Sesión</h3>
              <p>Son temporales y se borran cuando cierras el navegador. Manejan tu autenticación activa.</p>
            </div>
            <div className="feature-item">
              <h3 style={{ marginBottom: '8px' }}>Cookies Persistentes</h3>
              <p>Permanecen en tu dispositivo hasta que las borras o expiran. Útiles para "recordarme" en el login.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>Control de Cookies</h2>
          <p>
            Tienes el derecho a decidir si aceptas o rechazas las cookies. Puedes configurar o modificar los controles 
            de tu navegador web para aceptar o rechazar cookies.
          </p>
        </section>

        <div className="legal-footer">
          <p>© 2026 ASICME. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
