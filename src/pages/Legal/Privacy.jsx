import React from 'react';
import { ArrowLeft, Lock, Eye, Shield, Database, Cookie } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Legal.css'; // Reusing the same CSS

const Privacy = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="legal-page">
      <div className="legal-header">
        <div className="legal-container">
          <Link to={isAuthenticated ? "/" : "/login"} className="back-link">
            <ArrowLeft size={20} /> {isAuthenticated ? "Volver a la aplicación" : "Volver al inicio"}
          </Link>
          <h1>Política de Privacidad</h1>
          <p className="legal-subtitle">Última actualización: 7 de Febrero, 2026</p>
        </div>
      </div>

      <div className="legal-container legal-content">
        <section>
          <h2>1. Información que Recopilamos</h2>
          <p>
            En <strong>ASICME Meet</strong>, nos tomamos muy en serio tu privacidad. Solo recopilamos la información necesaria 
            para proporcionarte un servicio de videoconferencias seguro y eficiente.
          </p>
          <div className="feature-grid">
            <div className="feature-item">
              <Eye className="feature-icon" size={24} />
              <h3>Datos de Cuenta</h3>
              <p>Nombre, correo electrónico y contraseña (encriptada) para gestionar tu acceso e identificación.</p>
            </div>
            <div className="feature-item">
              <Database className="feature-icon" size={24} />
              <h3>Datos de Uso</h3>
              <p>Registros de conexión y duración de reuniones para mejorar la calidad del servicio y detectar problemas.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>2. Uso de la Información</h2>
          <p>
            Utilizamos tu información personal exclusivamente para:
          </p>
          <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            <li>Proporcionar, operar y mantener nuestra plataforma.</li>
            <li>Mejorar, personalizar y expandir nuestros servicios.</li>
            <li>Entender y analizar cómo utilizas nuestra plataforma.</li>
            <li>Desarrollar nuevos productos, servicios, características y funcionalidades.</li>
            <li>Comunicarnos contigo para fines de servicio al cliente o actualizaciones.</li>
          </ul>
        </section>

        <section>
          <h2>3. Seguridad de los Datos</h2>
          <div className="feature-grid">
             <div className="feature-item">
              <Shield className="feature-icon" size={24} />
              <h3>Encriptación</h3>
              <p>Todas las comunicaciones de video y audio están encriptadas de extremo a extremo durante su transmisión.</p>
            </div>
            <div className="feature-item">
              <Lock className="feature-icon" size={24} />
              <h3>Acceso Restringido</h3>
              <p>Solo el personal autorizado tiene acceso a los sistemas de infraestructura, y nunca a tus contraseñas.</p>
            </div>
          </div>
        </section>


        <section>
          <h2>4. Cookies y Tecnologías Similares</h2>
          <div className="feature-item" style={{display: 'flex', gap: '16px', alignItems: 'flex-start'}}>
             <Cookie className="feature-icon" size={24} style={{marginTop: '4px'}}/>
             <div>
                <h3>Uso de Cookies</h3>
                <p>Utilizamos cookies esenciales para mantener tu sesión activa y recordar tus preferencias. No utilizamos cookies de terceros para publicidad.</p>
             </div>
          </div>
        </section>

        <section>
          <h2>5. Tus Derechos</h2>
          <p>
            Tienes derecho a acceder, rectificar o eliminar tus datos personales en cualquier momento. 
            Puedes gestionar tu cuenta desde la sección de configuración o contactarnos para solicitar la eliminación completa de tus datos.
          </p>
        </section>

        <div className="legal-footer">
          <p>¿Dudas sobre tu privacidad?</p>
          <a href="mailto:privacidad@asicme.com" className="contact-btn">
            Contáctanos en privacidad@asicme.com
          </a>
        </div>
        <div className="legal-copyright">
          <p>© 2026 ASICME. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
