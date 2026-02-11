import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Keyboard, Plus, Link2, Calendar, ChevronDown, List, ExternalLink, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import MeshGradient from '../../components/MeshGradient/MeshGradient';
import './Home.css';

import { getApiUrl } from '../../context/AuthContext';

function Home() {
  const navigate = useNavigate();
  const { accessToken, user, authFetch, memberships } = useAuth();
  const [meetingCode, setMeetingCode] = useState('');
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false); // 📅 Nuevo modal
  const [meetingTitle, setMeetingTitle] = useState(''); // 📝 Título
  const [scheduledDate, setScheduledDate] = useState(''); // ⏰ Fecha/Hora
  const [organizedBy, setOrganizedBy] = useState(''); // 👤 Organizador
  const [showDashboard, setShowDashboard] = useState(false); // 📊 Dashboard
  const [meetingsList, setMeetingsList] = useState([]); // 📋 Lista de reuniones
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [expandedCardId, setExpandedCardId] = useState(null); // 🔼 Para expansión de cards
  const [isAuthenticated, setIsAuthenticated] = useState(!!accessToken);
  const activityRef = useRef(null);
  const [showPreloader, setShowPreloader] = useState(false); // 🎬 Estado del pre-loader

  useEffect(() => {
    // 🧠 Solo mostrar el pre-loader si no se ha visto en esta sesión
    const hasSeenPreloader = sessionStorage.getItem('asicme-preloader-seen');
    if (!hasSeenPreloader) {
      setShowPreloader(true);
      const timer = setTimeout(() => {
        setShowPreloader(false);
        sessionStorage.setItem('asicme-preloader-seen', 'true');
      }, 2500); // 1.5s de animación + margen de desvanecimiento
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    setIsAuthenticated(!!accessToken);
  }, [accessToken]);

  // 🔄 Refresh meetings when organization changes
  useEffect(() => {
    if (isAuthenticated && user?.organization_id) {
      fetchMeetings();
    }
  }, [user?.organization_id, isAuthenticated]);

  // ⏱️ Polling: Refresh live meetings every 10 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const intervalId = setInterval(() => {
      fetchMeetings(true); // Pass true to avoid showing full loader
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, user?.organization_id]);

  // 🖱️ Lógica de Parallax para el Hero
  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    
    // Normalizar valores entre -1 y 1
    const x = (clientX / innerWidth - 0.5) * 2;
    const y = (clientY / innerHeight - 0.5) * 2;
    
    setTilt({ x, y });

    // 🔦 Actualizar variables CSS para el Spotlight (en px)
    const homeEl = e.currentTarget;
    homeEl.style.setProperty('--mouse-x', `${clientX}px`);
    homeEl.style.setProperty('--mouse-y', `${clientY}px`);
  };

  const generateMeetingId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const segments = [3, 4, 3];
    return segments
      .map(len => 
        Array.from({ length: len }, () => 
          chars[Math.floor(Math.random() * chars.length)]
        ).join('')
      )
      .join('-');
  };

  const handleNewMeeting = async () => {
    const meetingId = generateMeetingId();
    
    try {
      // Llamada al backend
      const response = await authFetch('/meetings/start', {
        method: 'POST',
        body: JSON.stringify({
          host_id: user?.id,
          link: meetingId,
          meeting_type: 'instant'
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('¡Reunión instantánea creada!');
        localStorage.setItem(`host_${meetingId}`, 'true');
        navigate(`/pre-lobby/${meetingId}`);
      } else {
        toast.error('Error al crear la reunión: ' + data.error);
      }
    } catch (error) {
      console.error('Error de red:', error);
      alert('Error conectando con el servidor. Asegúrate de que el backend esté corriendo (node server.js).');
    }
  };
  
  const crearParaMasTarde = async () => {
    const meetingId = generateMeetingId();
    
    try {
      const response = await authFetch('/meetings/start', {
        method: 'POST',
        body: JSON.stringify({
          host_id: user?.id,
          link: meetingId,
          meeting_type: 'later'
        }),
      });

      const data = await response.json();

      if (data.success) {
        const urlCompleta = `${window.location.origin}/pre-lobby/${meetingId}`;
        // Guardar que soy el host de esta reunión
        localStorage.setItem(`host_${meetingId}`, 'true');
        setGeneratedLink(urlCompleta);
        setShowModal(true);
        setShowNewMeetingMenu(false);
      } else {
        alert("Error al crear la reunión en el servidor");
      }
    } catch (error) {
      console.error('Error:', error);
      alert("No se pudo crear la reunión. Verifica tu conexión.");
    }
  };

  const crearProgramada = async (e) => {
    e.preventDefault();
    if (!meetingTitle || !scheduledDate) return;

    const meetingId = generateMeetingId();
    
    try {
      const response = await authFetch('/meetings/start', {
        method: 'POST',
        body: JSON.stringify({
          host_id: user?.id,
          link: meetingId,
          meeting_type: 'scheduled',
          title: meetingTitle,
          scheduled_time: scheduledDate,
          organized_by: organizedBy || user?.name
        }),
      });

      const data = await response.json();

      if (data.success) {
        const urlCompleta = `${window.location.origin}/pre-lobby/${meetingId}`;
        localStorage.setItem(`host_${meetingId}`, 'true');
        setGeneratedLink(urlCompleta);
        setShowScheduleModal(false); // Cerramos el de programar
        setShowModal(true); // Abrimos el de éxito/copia
        setMeetingTitle(''); // Limpiamos
        setScheduledDate('');
        setOrganizedBy('');
      } else {
        alert("Error al programar la reunión");
      }
    } catch (error) {
      console.error('Error:', error);
      alert("Error de conexión al programar.");
    }
  };

  const fetchMeetings = async (isRefresh = false) => {
    if (!isRefresh) setLoadingDashboard(true);
    try {
      const response = await authFetch('/meetings/list');
      const data = await response.json();
      if (data.success) {
        setMeetingsList(data.meetings);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      if (!isRefresh) setLoadingDashboard(false);
    }
  };

  const handleOpenDashboard = () => {
    if (activityRef.current) {
      activityRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      fetchMeetings();
      setShowDashboard(true);
    }
  };

  const handleCopyLink = (text) => {
    const fullUrl = text.startsWith('http') ? text : `${window.location.origin}/pre-lobby/${text}`;
    navigator.clipboard.writeText(fullUrl);
    toast.success('¡Enlace copiado al portapapeles!');
  };

  const handleJoinMeeting = () => {
    if (meetingCode.trim()) {
      // Extract meeting ID from code or URL
      const code = meetingCode.includes('/') 
        ? meetingCode.split('/').pop() 
        : meetingCode.trim();
      navigate(`/pre-lobby/${code}`);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinMeeting();
    }
  };

  return (
    <div className={`home ${showPreloader ? 'preloading' : ''}`} onMouseMove={handleMouseMove}>
      {showPreloader && <CinematicPreloader />}
      <div className="cursor-spotlight"></div>
      <MeshGradient />
      <Header />
      
      <main className="home-main">
        <div className="home-content">
          <div className="home-hero">
            <div className="home-hero-content">
              <h1 className="home-title">
                Videoconferencias <span className="highlight">premium</span>
                <br />para equipos profesionales
              </h1>
              <p className="home-subtitle">
                ASICME Meet ofrece videoconferencias seguras y de alta calidad 
                para tu empresa. Comunicación en tiempo real sin complicaciones.
              </p>
              
              {/* 🏢 Indicador de Organización Activa */}
              {user && memberships && memberships.length > 0 && (
                <div className="active-org-badge">
                  <div className="org-avatar">
                    {memberships.find(m => m.id === user.organization_id)?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="org-info">
                    <div className="org-label">Organización activa</div>
                    <div className="org-name">
                      {memberships.find(m => m.id === user.organization_id)?.name || 'Cargando...'}
                    </div>
                    <div className="org-hint">Las reuniones se crearán en esta organización</div>
                  </div>
                </div>
              )}

              <div className="home-actions">
                <div className="home-new-meeting">
                  <Button 
                    variant="primary" 
                    size="lg" 
                    icon={Video}
                    onClick={handleNewMeeting}
                  >
                    Nueva reunión
                  </Button>
                  
                  <button 
                    className="home-dropdown-toggle"
                    onClick={() => setShowNewMeetingMenu(!showNewMeetingMenu)}
                  >
                    <ChevronDown size={20} />
                  </button>
                  
                  {showNewMeetingMenu && (
                    <div className="home-dropdown-menu glass-panel">
                      <button className="home-dropdown-item" onClick={handleNewMeeting}>
                        <Plus size={20} />
                        <div>
                          <span className="dropdown-item-title">Iniciar reunión instantánea</span>
                          <span className="dropdown-item-desc">Comenzar una reunión ahora</span>
                        </div>
                      </button>
                      <button className="home-dropdown-item" onClick={crearParaMasTarde}>
                        <Link2 size={20} />
                        <div>
                          <span className="dropdown-item-title">Crear una reunión para después</span>
                          <span className="dropdown-item-desc">Obtener un enlace para compartir</span>
                        </div>
                      </button>
                      <button className="home-dropdown-item" onClick={() => {
                        setShowScheduleModal(true);
                        setShowNewMeetingMenu(false);
                      }}>
                        <Calendar size={20} />
                        <div>
                          <span className="dropdown-item-title">Programar en calendario</span>
                          <span className="dropdown-item-desc">Añadir a tu agenda interna</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="home-join-meeting">
                  <div className="home-input-wrapper">
                    <label htmlFor="join-meeting-input" className="sr-only">Introduce un código o enlace de reunión</label>
                    <Keyboard size={20} className="home-input-icon" />
                    <input
                      id="join-meeting-input"
                      name="meetingCode"
                      type="text"
                      className="home-input"
                      placeholder="Introduce un código o enlace"
                      value={meetingCode}
                      onChange={(e) => setMeetingCode(e.target.value)}
                      onKeyPress={handleKeyPress}
                    />
                  </div>
                    <Button 
                      variant="primary" 
                      size="md" 
                      onClick={handleJoinMeeting}
                      disabled={!meetingCode.trim()}
                    >
                      Unirse
                    </Button>
                  </div>
                </div>

                <div className="home-dashboard-trigger">
                  <Button 
                    variant="secondary" 
                    size="md" 
                    onClick={handleOpenDashboard}
                    className="btn-history"
                  >
                    <List size={20} style={{ marginRight: '8px' }} />
                    Mis Reuniones
                  </Button>
                </div>
              </div>
            
            <div className="home-hero-visual">
              <HeroVisual tilt={tilt} />
            </div>
          </div>

          {/* --- SECCIÓN DE ACTIVIDAD INTEGRADA (DASHBOARD) --- */}
          {isAuthenticated && (
            <div className="home-activity-section" ref={activityRef}>
              <div className="section-header">
                <div className="status-live-indicator">
                  <span className="dot"></span>
                </div>
                <h2>Reuniones en: {memberships?.find(m => m.id === user.organization_id)?.name || "Cargando..."}</h2>
                <div className="refresh-status">Actualizado ahora</div>
              </div>

              {loadingDashboard && meetingsList.length === 0 ? (
                <div className="activity-loading">
                  <Loader2 size={24} className="animate-spin" />
                  <span>Sincronizando reuniones...</span>
                </div>
              ) : meetingsList.length === 0 ? (
                <div className="activity-empty glass-panel">
                  <p>No hay reuniones activas en este momento.</p>
                  <button className="btn-text-action" onClick={handleNewMeeting}>Iniciar una ahora</button>
                </div>
              ) : (
                <div className="activity-grid">
                  {meetingsList.map((meeting) => (
                    <div 
                      key={meeting.id} 
                      className={`activity-card glass-panel ${expandedCardId === meeting.id ? 'expanded' : ''}`}
                      onClick={() => setExpandedCardId(expandedCardId === meeting.id ? null : meeting.id)}
                    >
                      <div className="card-main-info">
                        <div className="card-badge">
                          <span className="participant-count">{meeting.participant_count}</span>
                          <User size={12} />
                        </div>
                        <div className="card-text">
                          <h3>{meeting.title || "Sala en Vivo"}</h3>
                          <span className="card-id">{meeting.link}</span>
                        </div>
                        <ChevronDown className="expand-icon" size={20} />
                      </div>

                      <div className="card-expanded-content">
                        <div className="divider"></div>
                        <div className="expanded-details">
                          <div className="detail-item">
                            <Calendar size={14} />
                            <span>{meeting.meeting_type === 'scheduled' ? 'Programada' : 'Instantánea'}</span>
                          </div>
                          {meeting.scheduled_time && (
                            <div className="detail-item">
                              <span className="time-val">
                                {new Date(meeting.scheduled_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="card-actions">
                          <button 
                            className="action-btn-secondary" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(meeting.link);
                            }}
                          >
                            <Link2 size={16} />
                            Copiar
                          </button>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/pre-lobby/${meeting.link}`);
                            }}
                          >
                            Entrar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="home-divider">
            <span>o aprende más sobre ASICME Meet</span>
          </div>
          
          <div className="home-features">
            <div className="feature-card">
              <div className="feature-icon">
                <Video size={24} />
              </div>
              <h3>Video HD</h3>
              <p>Calidad de video de alta definición para comunicaciones claras</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon security">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3>Seguridad</h3>
              <p>Cifrado de extremo a extremo para proteger tus reuniones</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon collab">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>Colaboración</h3>
              <p>Herramientas para compartir pantalla y trabajar en equipo</p>
            </div>
          </div>
        </div>
      </main>
      
      <footer className="home-footer">
        <div className="footer-content">
          <span>© 2026 ASICME. Todos los derechos reservados.</span>
          <nav className="footer-links">
            <Link to="/terms">Términos</Link>
            <Link to="/privacy">Privacidad</Link>
            <Link to="/cookies">Cookies</Link>
            <Link to="/help">Ayuda</Link>
          </nav>
        </div>
      </footer>

      {/* --- MODAL DE REUNIÓN PARA DESPUÉS --- */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Aquí tienes el enlace de tu reunión</h2>
              <button className="modal-close-icon" onClick={() => setShowModal(false)}>×</button>
            </div>
            <p className="modal-description">
              Copia este enlace y envíalo a las personas con las que quieras reunirte. 
              Asegúrate de guardarlo para poder usarlo más tarde.
            </p>

            <div className="modal-expiry-warning">
              <p>⚠️ Recuerda: este enlace es válido por 2 horas. Si no se inicia la reunión en este tiempo, el enlace expirará automáticamente.</p>
            </div>
            
            <div className="modal-link-container">
              <span className="modal-link-text">{generatedLink}</span>
              <button 
                className={`modal-copy-btn ${copySuccess ? 'success' : ''}`}
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }}
              >
                {copySuccess ? '¡Copiado!' : <Link2 size={20} />}
              </button>
            </div>

            <div className="modal-actions">
              <Button 
                variant="primary" 
                size="md" 
                fullWidth 
                onClick={() => setShowModal(false)}
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PARA PROGRAMAR (AGENDA) --- */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h2>Programar nueva reunión</h2>
                <p style={{ fontSize: '13px', color: '#1a73e8', margin: '4px 0 0 0', fontWeight: '500' }}>
                  Organización: {memberships?.find(m => m.id === user.organization_id)?.name}
                </p>
              </div>
              <button className="modal-close-icon" onClick={() => setShowScheduleModal(false)}>×</button>
            </div>
            <form onSubmit={crearProgramada}>
              <div className="form-group">
                <label htmlFor="schedule-title" className="form-label">Nombre de la reunión</label>
                <input 
                  id="schedule-title"
                  name="meetingTitle"
                  type="text" 
                  className="home-input schedule-input" 
                  placeholder="Ej: Reunión sobre alimentación"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="schedule-organizer" className="form-label">Organizado por</label>
                <input 
                  id="schedule-organizer"
                  name="organizedBy"
                  type="text" 
                  className="home-input schedule-input" 
                  placeholder="Ej: Jhoan Gavidia"
                  value={organizedBy}
                  onChange={(e) => setOrganizedBy(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label htmlFor="schedule-date" className="form-label">Fecha y Hora</label>
                <input 
                  id="schedule-date"
                  name="scheduledDate"
                  type="datetime-local" 
                  className="home-input schedule-input"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div className="modal-info-note">
                <p>💡 Las reuniones programadas no expiran hasta 24 horas después de su fecha de inicio.</p>
              </div>

              <div className="modal-actions">
                <Button 
                  variant="primary" 
                  size="md" 
                  fullWidth 
                  type="submit"
                >
                  Confirmar y generar link
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DASHBOARD DE REUNIONES --- */}
      {showDashboard && (
        <div className="modal-overlay">
          <div className="modal-content dashboard-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="status-live-indicator">
                  <span className="dot"></span>
                </div>
                <h2>Monitor de Actividad en Vivo</h2>
              </div>
              <button className="modal-close-icon" onClick={() => setShowDashboard(false)}>×</button>
            </div>

            <div className="dashboard-body">
              {loadingDashboard ? (
                <div className="dashboard-loading-skeleton">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-card animate-pulse">
                      <div className="skeleton-badge"></div>
                      <div className="skeleton-title"></div>
                      <div className="skeleton-text"></div>
                    </div>
                  ))}
                </div>
              ) : meetingsList.length === 0 ? (
                <div className="dashboard-empty">
                  <Video size={48} className="empty-icon" />
                  <p>No hay salas con actividad en este momento.</p>
                  <p className="empty-subtext">Las salas aparecerán aquí cuando los participantes se unan.</p>
                </div>
              ) : (
                <div className="dashboard-list">
                  {meetingsList.map((meeting) => (
                    <div key={meeting.id} className="meeting-card">
                      <div className="meeting-card-info">
                        <div className="meeting-card-header">
                          <span className={`meeting-type-badge ${meeting.meeting_type}`}>
                            {meeting.participant_count} {meeting.participant_count === 1 ? 'Participante' : 'Participantes'}
                          </span>
                          <span className="meeting-id-text">ID: {meeting.link}</span>
                        </div>
                        
                        <h3 className="meeting-card-title">
                          {meeting.title || "Sala en Vivo"}
                        </h3>
                        
                        <p className="meeting-card-organizer">🟢 Transmisión activa ahora</p>

                        {meeting.scheduled_time && (
                          <p className="meeting-card-time">
                            📅 {new Date(meeting.scheduled_time).toLocaleString('es-ES', {
                              weekday: 'long',
                              day: 'numeric',
                              month: 'long',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        )}
                      </div>

                      <div className="meeting-card-actions">
                        <button 
                          className="action-icon-btn" 
                          onClick={() => handleCopyLink(meeting.link)}
                          title="Copiar enlace"
                        >
                          <Link2 size={18} />
                        </button>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => navigate(`/pre-lobby/${meeting.link}`)}
                        >
                          Entrar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dashboard-footer">
              <Button 
                variant="secondary" 
                size="md" 
                fullWidth 
                onClick={() => setShowDashboard(false)}
              >
                Cerrar Panel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;

function CinematicPreloader() {
  return (
    <div className="cinematic-preloader">
      <div className="preloader-content">
        <div className="preloader-logo">
          <div className="logo-glow"></div>
          <Video className="header-logo-icon preloader-icon" />
          <div className="preloader-text-group">
            <span className="logo-text header-logo-text">ASICME</span>
            <span className="logo-badge header-logo-subtitle">MEET</span>
          </div>
        </div>
        <div className="preloader-status">Iniciando experiencia premium...</div>
      </div>
    </div>
  );
}

function HeroVisual({ tilt }) {
  // Aplicar transformación 3D basada en el tilt del mouse
  const style = {
    transform: `perspective(1000px) rotateX(${tilt.y * 5}deg) rotateY(${tilt.x * 5}deg)`,
    transition: 'transform 0.1s ease-out'
  };

  const innerStyle = {
    transform: `translate3d(${tilt.x * 20}px, ${tilt.y * 20}px, 0)`,
    transition: 'transform 0.1s ease-out'
  };

  return (
    <div className="hero-parallax-container" style={style}>
      <div className="hero-3d-glass-sphere">
        <div className="sphere-inner" style={innerStyle}>
          <div className="glass-core"></div>
          <div className="orbit orbit-1"></div>
          <div className="orbit orbit-2"></div>
        </div>
      </div>
      
      {/* Elementos flotantes de la cuadrícula como referencia al app */}
      <div className="floating-tiles-grid" style={innerStyle}>
        <div className="f-tile tile-1"></div>
        <div className="f-tile tile-2"></div>
        <div className="f-tile tile-3"></div>
      </div>
    </div>
  );
}
