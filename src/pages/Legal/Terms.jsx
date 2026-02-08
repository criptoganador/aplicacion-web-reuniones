import React from 'react';
import { ArrowLeft, Shield, FileText, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Legal.css';

import { useAuth } from '../../context/AuthContext';

const Terms = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="legal-page">
      <div className="legal-header">
        <div className="legal-container">
          <Link to={isAuthenticated ? "/" : "/login"} className="back-link">
            <ArrowLeft size={20} /> {isAuthenticated ? "Volver a la aplicación" : "Volver al inicio"}
          </Link>
          <h1>Términos y Condiciones</h1>
          <p className="legal-subtitle">Última actualización: 7 de Febrero, 2026</p>
        </div>
      </div>

      <div className="legal-container legal-content">
        <section>
          <h2>1. Introducción</h2>
          <p>
            Bienvenido a <strong>ASICME Meet</strong>. Al acceder y utilizar nuestra plataforma de videoconferencias, 
            aceptas cumplir con los siguientes términos y condiciones. Si no estás de acuerdo con alguna parte de estos términos, 
            te rogamos que no utilices nuestros servicios.
          </p>
        </section>

        <section>
          <h2>2. Uso del Servicio</h2>
          <div className="feature-grid">
            <div className="feature-item">
              <Shield className="feature-icon" size={24} />
              <h3>Uso Responsable</h3>
              <p>Te comprometes a utilizar el servicio de manera legal y ética, respetando los derechos de otros usuarios.</p>
            </div>
            <div className="feature-item">
              <Lock className="feature-icon" size={24} />
              <h3>Seguridad de la Cuenta</h3>
              <p>Eres responsable de mantener la confidencialidad de tu cuenta y contraseña. Notifícanos cualquier uso no autorizado.</p>
            </div>
          </div>
          <p>
            ASICME Meet se reserva el derecho de suspender o cancelar cuentas que violen nuestras políticas de uso, 
            incluyendo pero no limitado a la transmisión de contenido ilegal, acoso, o intentos de vulnerar la seguridad de la plataforma.
          </p>
        </section>

        <section>
          <h2>3. Propiedad Intelectual</h2>
          <p>
            El contenido, diseño, logotipos y software de ASICME Meet son propiedad exclusiva de ASICME y están protegidos 
            por las leyes de propiedad intelectual internacionales. No se permite la reproducción, distribución o modificación 
            sin autorización expresa.
          </p>
        </section>

        <section>
          <h2>4. Limitación de Responsabilidad</h2>
          <p>
            ASICME Meet se proporciona "tal cual". No garantizamos que el servicio sea ininterrumpido o libre de errores. 
            En ningún caso ASICME será responsable de daños indirectos, incidentales o consecuentes derivados del uso del servicio.
          </p>
        </section>

        <section>
          <h2>5. Modificaciones</h2>
          <p>
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Las notificaciones sobre cambios importantes 
            se enviarán a través de la plataforma o por correo electrónico. El uso continuado del servicio implica la aceptación de los nuevos términos.
          </p>
        </section>

        <div className="legal-footer">
          <p>¿Tienes preguntas?</p>
          <a href="mailto:soporte@asicme.com" className="contact-btn">
            Contáctanos en soporte@asicme.com
          </a>
        </div>
        <div className="legal-copyright">
          <p>© 2026 ASICME. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
