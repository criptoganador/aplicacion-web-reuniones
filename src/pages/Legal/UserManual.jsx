import React from 'react';
import { ArrowLeft, BookOpen, Video, Mic, Share2, Shield, Settings, Download, Monitor, MessageSquare, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Legal.css';

const UserManual = () => {
  const { accessToken } = useAuth();
  const isAuthenticated = !!accessToken;

  return (
    <div className="legal-page">
      <div className="legal-header">
        <div className="legal-container">
          <Link to={isAuthenticated ? "/" : "/login"} className="back-link">
            <ArrowLeft size={20} /> {isAuthenticated ? "Volver a la aplicación" : "Ir al inicio"}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '20px' }}>
            <BookOpen size={40} color="var(--color-primary)" />
            <h1 style={{ margin: 0 }}>Manual de Usuario</h1>
          </div>
          <p className="legal-subtitle">Todo lo que necesitas saber para dominar ASICME Meet.</p>
        </div>
      </div>

      <div className="legal-container legal-content">
        <section>
          <h2>1. Introducción</h2>
          <p>
            Bienvenido a <strong>ASICME Meet</strong>, la plataforma de videoconferencias diseñada para la colaboración profesional y segura. Este manual te guiará a través de todas las funciones disponibles para que saques el máximo provecho de tus reuniones.
          </p>
        </section>

        <section>
          <h2>2. Empezar una Reunión</h2>
          <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
            <div className="feature-item glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Video size={24} color="#1a73e8" />
                <h3 style={{ margin: 0 }}>Reunión Instantánea</h3>
              </div>
              <p>Haz clic en "Nueva reunión" para crear una sala inmediatamente. Serás redirigido al lobby para configurar tu cámara antes de entrar.</p>
            </div>
            
            <div className="feature-item glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Monitor size={24} color="#10b981" />
                <h3 style={{ margin: 0 }}>Unirse con Código</h3>
              </div>
              <p>Si tienes un código de reunión (ej: abc-defg-hij), introdúcelo en la caja de texto principal y pulsa "Unirse".</p>
            </div>
          </div>
        </section>

        <section>
          <h2>3. Controles de la Sala</h2>
          <p>Una vez dentro de la reunión, encontrarás una barra de herramientas en la parte inferior con las siguientes opciones:</p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
              <strong><Mic size={16} /> Micrófono y Cámara:</strong> Activa o desactiva tu audio y video. Haz clic en la flecha pequeña junto a ellos para cambiar de dispositivo.
            </li>
            <li style={{ marginBottom: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
              <strong><Share2 size={16} /> Compartir Pantalla:</strong> Permite mostrar tu pantalla a los demás participantes. Puedes elegir una ventana específica, toda la pantalla o una pestaña.
            </li>
            <li style={{ marginBottom: '15px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
              <strong><MessageSquare size={16} /> Chat:</strong> Abre el panel lateral para enviar mensajes de texto y emojis al grupo.
            </li>
          </ul>
        </section>

        <section className="highlight-section" style={{ background: 'rgba(26, 115, 232, 0.1)', padding: '30px', borderRadius: '16px', border: '1px solid rgba(26, 115, 232, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <Download size={32} color="#1a73e8" />
            <h2 style={{ margin: 0 }}>4. Cómo Grabar la Reunión</h2>
          </div>
          <p>Grabar tus sesiones es vital para el seguimiento. Sigue estos pasos para una grabación perfecta:</p>
          <ol>
            <li>Haz clic en el botón <strong>"Grabar"</strong> en la barra de herramientas.</li>
            <li>Se abrirá una ventana del navegador para seleccionar qué grabar.</li>
            <li><strong>MUY IMPORTANTE:</strong> Selecciona la opción <strong>"Esta pestaña"</strong> (o "Pestaña de Microsoft Edge/Chrome").</li>
            <li>Asegúrate de marcar la casilla <strong>"Compartir audio de la pestaña"</strong> en la esquina inferior izquierda antes de aceptar.</li>
            <li>Al finalizar, pulsa "Detener grabación" y el archivo se descargará automáticamente en tu dispositivo.</li>
          </ol>
          <div style={{ marginTop: '15px', display: 'flex', alignItems: 'start', gap: '10px', fontSize: '14px', color: '#1a73e8' }}>
            <Info size={18} />
            <p>El formato de descarga es .webm, compatible con todos los navegadores modernos y reproductores como VLC.</p>
          </div>
        </section>

        <section>
          <h2>5. Organización y Administración</h2>
          <p>
            Si eres administrador de una organización, tienes acceso al <strong>Panel de Administración</strong> donde puedes gestionar usuarios, ver estadísticas de uso y revisar los registros de auditoría de tu empresa.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
            <Shield size={20} color="var(--color-primary)" />
            <span>Acceso exclusivo para roles administrativos.</span>
          </div>
        </section>

        <div className="legal-footer">
          <p>© 2026 ASICME Meet. Videoconferencias de grado profesional.</p>
          <div style={{ marginTop: '20px' }}>
            <Link to="/help" className="contact-btn" style={{ textDecoration: 'none' }}>¿Necesitas más ayuda?</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManual;
