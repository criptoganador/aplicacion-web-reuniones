import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, 
  Settings, MoreVertical, Users,
  Copy, Check, Home, Camera, User
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import './PreLobby.css';

import { getApiUrl } from '../../context/AuthContext';

function PreLobby() {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const { user, accessToken, authFetch } = useAuth();
  const videoRef = useRef(null);
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const { clientX, clientY } = e;
    containerRef.current.style.setProperty('--mouse-x', `${clientX}px`);
    containerRef.current.style.setProperty('--mouse-y', `${clientY}px`);
  };

  // Handle avatar upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file is image
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen');
      return;
    }
    
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 10MB');
      return;
    }
    
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (meetingId) {
        formData.append('meeting_id', meetingId);
      }
      
      const res = await authFetch('/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al subir la imagen');
      }

      const data = await res.json();
      if (data.secure_url) {
        setAvatarUrl(data.secure_url);
        toast.success('¡Avatar actualizado!');
      } else {
        throw new Error('No se recibió la URL de la imagen');
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast.error(err.message || 'Error al subir avatar');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Sync with user data if it changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const currentMeetingId = meetingId;

  useEffect(() => {
    const initMedia = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setIsCameraOn(false);
        setIsMicOn(false);
        setIsLoading(false);
      }
    };

    initMedia();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = isCameraOn;
      });
    }
  }, [isCameraOn, stream]);

  useEffect(() => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = isMicOn;
      });
    }
  }, [isMicOn, stream]);

  const [isValidating, setIsValidating] = useState(true);
  const [meetingData, setMeetingData] = useState(null);
  const [error, setError] = useState(null);

  // Validate meeting ID on load
  useEffect(() => {
    if (meetingId) {
      validateMeeting(meetingId);
      
      // 🟢 NUEVO: PREGUNTAR A LA MEMORIA SI SOY EL DUEÑO
      const soyElDueno = localStorage.getItem(`host_${meetingId}`);
      if (soyElDueno === 'true') {
          setIsHost(true);
      } else {
          setIsHost(false);
      }
    } else {
      setIsValidating(false);
      setMeetingData(null);
      setIsHost(true); // Creando nueva -> Soy Host
    }
  }, [meetingId]);

  const validateMeeting = async (id) => {
    try {
      const response = await fetch(`${getApiUrl()}/meetings/${id}`);
      const data = await response.json();
      
      if (data.success) {
        setMeetingData(data.meeting);
      } else {
        // 🟢 NUEVO: Si soy el dueño y la reunión expiró/finalizó, no bloquear.
        // Permitir que handleJoinMeeting la reactive usando /meetings/start.
        if (isHost || localStorage.getItem(`host_${id}`) === 'true') {
            console.log("Reunión inactiva detectada, pero el usuario es el anfitrión. Habilitando reactivación.");
            setMeetingData(null); // No tenemos data activa, pero no bloqueamos con setError
            setIsHost(true);
        } else {
            setError('Este enlace ha superado el tiempo límite de validez (2 horas para reuniones programadas o 5 minutos para instantáneas). Por favor, crea una nueva reunión para continuar.');
        }
      }
    } catch (err) {
      console.error('Error validating meeting:', err);
      setError('No se pudo conectar con el servidor.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleJoinMeeting = async () => {
    if (!name || !email || (!meetingData && !isHost)) {
      alert("Por favor ingresa tu nombre y correo.");
      return;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const idToUse = meetingData ? meetingData.id : null;
      const linkToUse = meetingData ? meetingData.link : currentMeetingId;

      if (isHost && !meetingData) {
        const response = await authFetch('/meetings/start', {
          method: 'POST',
          body: JSON.stringify({ host_id: user?.id, link: linkToUse }),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        localStorage.setItem(`host_${linkToUse}`, 'true');
      }

      // 1. Registrar entrada en BD
      const dbResponse = await fetch(`${getApiUrl()}/meetings/join`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          meeting_id: idToUse || linkToUse,
          name: name,
          email: email
        })
      });

      if (!dbResponse.ok) throw new Error("Error al registrar en la base de datos");

      // 2. Obtener Token de LiveKit
      const tokenResponse = await fetch(`${getApiUrl()}/meetings/get-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName: linkToUse, 
          participantName: name,
          email: email, // Enviar email para el avatar Gravatar
          avatarUrl: avatarUrl, // Avatar personalizado subido
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.token) {
        toast.success("Entrando a la reunión...");
        // 3. NAVEGAR A LA SALA DEDICADA
        navigate(`/meeting/${linkToUse}`, {
          state: {
            token: tokenData.token,
            isMicOn,
            isCameraOn,
            name: name,
            isHost: isHost
          }
        });
      } else {
        toast.error("No se pudo obtener el token de video");
      }

    } catch (err) {
      console.error('Error al unirse:', err);
      toast.error('Hubo un error al intentar unirse a la reunión.');
    }
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/pre-lobby/${currentMeetingId}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div 
      className="pre-lobby"
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      <div className="cursor-spotlight"></div>
      <Header />
      
      <div className="pre-lobby-header-actions">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/')}
          icon={Home}
          className="btn-back-home"
        >
          Volver al Inicio
        </Button>
      </div>

      <main className="pre-lobby-main">
        <div className="pre-lobby-content">
          <div className="pre-lobby-video-section">
            <div className="video-preview-container">
              {isLoading ? (
                <div className="video-loading">
                  <div className="loading-spinner"></div>
                  <p>Accediendo a cámara...</p>
                </div>
              ) : isCameraOn && stream ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="video-preview"
                  />
                  <div className="live-status-badge">
                    <span className="live-dot"></span>
                    LIVE
                  </div>
                </>
              ) : (
                <div className="video-off-placeholder">
                  <div className="avatar-large">
                    {name ? name.charAt(0).toUpperCase() : 'T'}
                  </div>
                </div>
              )}
              
              <div className="video-controls">
                <button 
                  className={`control-btn ${!isMicOn ? 'off' : ''}`}
                  onClick={() => setIsMicOn(!isMicOn)}
                  title={isMicOn ? 'Desactivar micrófono' : 'Activar micrófono'}
                >
                  {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
                </button>
                <button 
                  className={`control-btn ${!isCameraOn ? 'off' : ''}`}
                  onClick={() => setIsCameraOn(!isCameraOn)}
                  title={isCameraOn ? 'Desactivar cámara' : 'Activar cámara'}
                >
                  {isCameraOn ? <Video size={24} /> : <VideoOff size={24} />}
                </button>
                <button className="control-btn" title="Configuración">
                  <Settings size={20} />
                </button>
                <button className="control-btn" title="Más opciones">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>
          </div>
          
          <div className="pre-lobby-info-section">
            <div className="pre-lobby-card">
              <h2>¿Listo para unirte?</h2>
              
                <div className="meeting-info">
                  <div className="meeting-id-display">
                    <div className="meeting-id-header">
                      <span className="meeting-label">Código de reunión:</span>
                      {meetingData && <span className="meeting-status-badge">Activa</span>}
                    </div>
                    <div className="meeting-id-content">
                      <span className="meeting-code">{currentMeetingId}</span>
                      <button 
                        className="copy-icon-btn" 
                        onClick={copyMeetingLink}
                        title="Copiar código"
                      >
                        {isCopied ? <Check size={18} style={{ color: '#10b981' }} /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                  
                  {isValidating && <div className="validation-loading">Verificando reunión...</div>}
                  {error && (
                    <div className="validation-error-container">
                      <div className="validation-error">{error}</div>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => navigate("/")}
                        style={{ marginTop: '10px' }}
                        icon={Home}
                      >
                        Volver al inicio
                      </Button>
                    </div>
                  )}
                </div>
              
               {/* Avatar Picker */}
               <div className="avatar-picker-group">
                 <label>Tu foto de perfil</label>
                 <div className="avatar-picker-container">
                   <div 
                     className="avatar-picker-circle"
                     onClick={() => avatarInputRef.current?.click()}
                   >
                     {avatarUrl ? (
                       <img src={avatarUrl} alt="Avatar" className="avatar-preview-img" />
                     ) : (
                       <User size={32} />
                     )}
                     <div className="avatar-picker-overlay">
                       <Camera size={16} />
                     </div>
                     {isUploadingAvatar && <div className="avatar-loading-spinner"></div>}
                   </div>
                   <input
                     type="file"
                     ref={avatarInputRef}
                     accept="image/*"
                     onChange={handleAvatarUpload}
                     style={{ display: 'none' }}
                   />
                   <span className="avatar-picker-hint">
                     {avatarUrl ? 'Cambiar foto' : 'Agregar foto'}
                   </span>
                 </div>
               </div>

               <div className="name-input-group">
                <label htmlFor="name-input">Tu nombre</label>
                <input
                  id="name-input"
                  name="fullName"
                  type="text"
                  className="name-input"
                  placeholder="Escribe tu nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  autoComplete="name"
                />
              </div>

              <div className="name-input-group" style={{ marginTop: '12px' }}>
                <label htmlFor="email-input">Tu correo electrónico</label>
                <input
                  id="email-input"
                  name="email"
                  type="email"
                  className="name-input"
                  placeholder="ejemplo@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              
              <div className="pre-lobby-actions">
                <Button 
                  variant="primary" 
                  size="lg" 
                  fullWidth
                  onClick={handleJoinMeeting}
                  className="btn-join-main"
                >
                  Unirse ahora
                </Button>
                
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onClick={copyMeetingLink}
                  icon={Users}
                >
                  Copiar enlace de invitación
                </Button>
              </div>
              
              <div className="pre-lobby-tips">
                <p>
                  <strong>Consejo:</strong> Asegúrate de que tu micrófono y cámara 
                  funcionan correctamente antes de unirte.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default PreLobby;
