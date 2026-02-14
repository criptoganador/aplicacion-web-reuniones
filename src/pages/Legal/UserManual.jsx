import React from 'react';
import { 
  ArrowLeft, BookOpen, Video, Mic, Share2, Shield, Settings, 
  Download, Monitor, MessageSquare, Info, User, LogIn, 
  Plus, Users, Layout, Clock, CheckCircle2
} from 'lucide-react';
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
            <h1 style={{ margin: 0 }}>Centro de Aprendizaje ASICME</h1>
          </div>
          <p className="legal-subtitle">Tu guía completa para dominar la plataforma de videoconferencias más segura.</p>
        </div>
      </div>

      <div className="legal-container legal-content">
        {/* SECCIÓN 1: INTRODUCCIÓN */}
        <section>
          <h2><Info size={24} color="var(--color-primary)" /> 1. Introducción</h2>
          <p>
            Bienvenido a <strong>ASICME Meet</strong>. Esta plataforma ha sido diseñada para ofrecer una experiencia de colaboración fluida, segura y profesional. Ya sea que estés organizando un seminario web o una reunión de equipo rápida, aquí encontrarás todo lo necesario para tener éxito.
          </p>
        </section>

        {/* SECCIÓN 2: PRIMEROS PASOS */}
        <section>
          <h2><LogIn size={24} color="#1a73e8" /> 2. Primeros Pasos</h2>
          <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="feature-item glass-panel">
              <h3>Registro e Ingreso</h3>
              <p>Para acceder a todas las funciones, crea una cuenta con tu correo profesional. Una vez registrado, usa tus credenciales para iniciar sesión de forma segura.</p>
            </div>
            <div className="feature-item glass-panel">
              <h3>Suscripciones</h3>
              <p>Dependiendo de tu plan, podrás organizar reuniones con más participantes y funciones avanzadas como grabaciones en la nube.</p>
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: PANEL PRINCIPAL (DASHBOARD) */}
        <section>
          <h2><Layout size={24} color="#10b981" /> 3. Tu Panel de Control</h2>
          <p>Al entrar, verás tres acciones principales que definen tu flujo de trabajo:</p>
          <div className="steps-container">
            <div className="manual-step">
              <Plus className="step-icon" size={20} />
              <div>
                <strong>Nueva Reunión:</strong> Crea una sala instantánea. Obtendrás un enlace único que podrás copiar y compartir con otros.
              </div>
            </div>
            <div className="manual-step">
              <Monitor className="step-icon" size={20} />
              <div>
                <strong>Unirse con Código:</strong> Pega el código de 10 caracteres (ej: abc-defg-hij) para entrar a una reunión ya existente.
              </div>
            </div>
            <div className="manual-step">
              <Clock className="step-icon" size={20} />
              <div>
                <strong>Historial:</strong> En la parte inferior verás tus reuniones recientes para volver a entrar rápidamente o revisar estadísticas.
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 4: EL PRE-LOBBY */}
        <section className="highlight-section" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: '#10b981' }}>
          <h2><Shield size={24} color="#10b981" /> 4. Configuración antes de entrar (Lobby)</h2>
          <p>Antes de unirte a cualquier reunión, pasarás por el Pre-Lobby para asegurar que todo esté perfecto:</p>
          <ul>
            <li><strong>Verificación de Cámara:</strong> Asegúrate de que tu iluminación sea adecuada y la cámara esté seleccionada.</li>
            <li><strong>Prueba de Micrófono:</strong> Verás una barra de nivel que se mueve cuando hablas.</li>
            <li><strong>Nombre de Pantalla:</strong> Puedes cambiar cómo te verán los demás antes de pulsar "Unirse".</li>
          </ul>
        </section>

        {/* SECCIÓN 5: LA SALA DE REUNIÓN */}
        <section>
          <h2><Video size={24} color="#e53935" /> 5. Dominando la Sala de Reunión</h2>
          <p>La barra de herramientas inferior es tu centro de mando:</p>
          
          <div className="controls-guide" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="control-desc">
              <div className="icon-badge"><Mic size={18} /></div>
              <div><strong>Silenciar/Activar Micro:</strong> Controla tu audio. Usa la flecha para elegir entre tus micrófonos conectados.</div>
            </div>
            <div className="control-desc">
              <div className="icon-badge"><Video size={18} /></div>
              <div><strong>Video:</strong> Enciende o apaga tu cámara.</div>
            </div>
            <div className="control-desc">
              <div className="icon-badge"><Share2 size={18} /></div>
              <div><strong>Compartir Pantalla:</strong> Presenta diapositivas o documentos. Puedes compartir toda la pantalla o solo una ventana.</div>
            </div>
            <div className="control-desc">
              <div className="icon-badge"><MessageSquare size={18} /></div>
              <div><strong>Chat Lateral:</strong> Envía mensajes, enlaces y reacciones. No pierdas el hilo de la conversación.</div>
            </div>
            <div className="control-desc" style={{ background: 'rgba(26, 115, 232, 0.1)' }}>
              <div className="icon-badge" style={{ background: '#1a73e8' }}><Download size={18} color="white" /></div>
              <div><strong>Grabación (Host):</strong> Activa la captura de la sesión. <i>Recuerda marcar "Compartir audio de la pestaña" en el navegador para capturar el sonido.</i></div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 6: ADMINISTRACIÓN */}
        <section>
          <h2><Shield size={24} color="var(--color-primary)" /> 6. Funciones de Administrador</h2>
          <p>Si gestionas un equipo u organización, el panel de administración te permite:</p>
          <div className="admin-features-list">
            <div className="admin-feat">
              <Users size={18} /> <strong>Gestión de Usuarios:</strong> Añade o remueve miembros de tu organización.
            </div>
            <div className="admin-feat">
              <CheckCircle2 size={18} /> <strong>Control de Suscripciones:</strong> Gestiona los pagos y límites de tu plan empresarial.
            </div>
            <div className="admin-feat">
              <Info size={18} /> <strong>Logs de Auditoría:</strong> Revisa quién y cuándo se realizaron las reuniones por seguridad.
            </div>
          </div>
        </section>

        {/* SECCIÓN 7: PERFIL Y AJUSTES */}
        <section>
          <h2><Settings size={24} color="#6366f1" /> 7. Personalización</h2>
          <p>Haz clic en tu avatar en la esquina superior derecha para:</p>
          <ul>
            <li><strong>Editar Perfil:</strong> Cambia tu nombre, correo o foto de perfil.</li>
            <li><strong>Preferencias:</strong> Ajusta temas visuales (Claro/Oscuro) si están disponibles.</li>
            <li><strong>Cerrar Sesión:</strong> Asegura tu cuenta al terminar en equipos compartidos.</li>
          </ul>
        </section>

        <div className="legal-footer">
          <p>© 2026 ASICME Meet. Guía versión 2.0</p>
          <div style={{ marginTop: '20px' }}>
            <Link to="/help" className="contact-btn" style={{ textDecoration: 'none' }}>¿Problemas técnicos? Contactar Soporte</Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .manual-step {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border-left: 4px solid var(--color-primary);
        }
        .step-icon {
          background: var(--color-primary);
          padding: 5px;
          border-radius: 6px;
          color: white;
          flex-shrink: 0;
        }
        .control-desc {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 12px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
        }
        .icon-badge {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          flex-shrink: 0;
        }
        .admin-features-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 15px;
        }
        .admin-feat {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 15px;
          background: rgba(var(--color-primary-rgb), 0.1);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};

export default UserManual;

