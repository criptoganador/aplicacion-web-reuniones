import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, History, Camera, Save, ArrowLeft, Video, Link2, Calendar, LayoutGrid, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import './Settings.css';

import { getApiUrl } from '../../context/AuthContext';

function Settings() {
  const navigate = useNavigate();
  const { user, updateProfile, changePassword, authFetch } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // History State
  const [meetingHistory, setMeetingHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Notifications State
  const [notificationPrefs, setNotificationPrefs] = useState({
    instant: true,
    scheduled: true,
    later: true
  });
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(false);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await authFetch('/meetings/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setMeetingHistory(data.history);
      } else {
        setMeetingHistory([]);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      toast.error('No se pudo cargar el historial');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchNotificationPrefs = async () => {
    setIsLoadingPrefs(true);
    try {
      const res = await authFetch('/api/users/settings');
      const data = await res.json();
      if (data.success) {
        setNotificationPrefs(data.preferences);
      }
    } catch (err) {
      console.error('Error fetching prefs:', err);
    } finally {
      setIsLoadingPrefs(false);
    }
  };

  const handleTogglePref = async (key) => {
    const newPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(newPrefs); // Optimistic update

    try {
      await authFetch('/api/users/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_preferences: newPrefs })
      });
      toast.success('Preferencias actualizadas');
    } catch (err) {
      toast.error('Error al guardar cambios');
      setNotificationPrefs(notificationPrefs); // Revert
    }
  };


  useEffect(() => {
    if (activeTab === 'notifications') {
      fetchNotificationPrefs();
    }
  }, [activeTab]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('La imagen debe ser menor a 10MB');
      return;
    }
    
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${getApiUrl()}/upload`, {
        method: 'POST',
        body: formData
      });
      
      const data = await res.json();
      if (data.secure_url) {
        setAvatarUrl(data.secure_url);
        toast.success('¡Foto de perfil preparada!');
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast.error('Error al subir imagen');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsUpdatingProfile(true);
    try {
      const result = await updateProfile({ name, avatarUrl });
      if (result.success) {
        toast.success('Perfil actualizado correctamente');
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error('Error al actualizar perfil');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await changePassword({ currentPassword, newPassword });
      if (result.success) {
        toast.success('Contraseña actualizada');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error('Error al cambiar contraseña');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="settings-page">
      <Header />
      
      <main className="settings-main">
        <div className="settings-container">
          <header className="settings-header">
            <button className="back-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={20} />
              <span>Volver al inicio</span>
            </button>
            <h1>Configuración de Cuenta</h1>
          </header>

          <div className="settings-layout">
            {/* Sidebar Tabs */}
            <aside className="settings-sidebar">
              <button 
                className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <User size={20} />
                <span>Mi Perfil</span>
              </button>
              <button 
                className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                <Shield size={20} />
                <span>Seguridad</span>
              </button>
              <button 
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <History size={20} />
                <span>Historial</span>
              </button>
              <button 
                className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
                onClick={() => setActiveTab('notifications')}
              >
                <Bell size={20} />
                <span>Notificaciones</span>
              </button>
            </aside>

            {/* Content Area */}
            <section className="settings-content">
              {activeTab === 'profile' && (
                <div className="settings-section profile-section animate-fade-in">
                  <h2>Información del Perfil</h2>
                  <p className="section-desc">Gestiona cómo te ven los demás en las reuniones.</p>
                  
                  <form onSubmit={handleUpdateProfile}>
                    <div className="avatar-edit-container">
                      <div className="avatar-edit-circle" onClick={() => avatarInputRef.current?.click()}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Avatar" />
                        ) : (
                          <span className="avatar-placeholder">{name.charAt(0).toUpperCase()}</span>
                        )}
                        <div className="avatar-edit-overlay">
                          <Camera size={20} />
                        </div>
                        {isUploadingAvatar && <div className="avatar-spinner"></div>}
                      </div>
                      <input 
                        type="file" 
                        ref={avatarInputRef} 
                        onChange={handleAvatarUpload} 
                        style={{ display: 'none' }} 
                        accept="image/*" 
                      />
                      <div className="avatar-edit-info">
                        <h3>Foto de perfil</h3>
                        <p>Haz clic para cambiar tu foto. JPG o PNG, máximo 10MB.</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Nombre completo</label>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="Tu nombre" 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label>Correo electrónico</label>
                      <input type="email" value={user?.email} disabled title="El email no se puede cambiar" />
                      <span className="input-hint">El correo electrónico está vinculado a tu cuenta y no se puede modificar.</span>
                    </div>

                    <Button 
                      variant="primary" 
                      type="submit" 
                      icon={Save} 
                      disabled={isUpdatingProfile}
                    >
                      {isUpdatingProfile ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="settings-section security-section animate-fade-in">
                  <h2>Seguridad</h2>
                  <p className="section-desc">Actualiza tu contraseña para mantener tu cuenta segura.</p>

                  <form onSubmit={handleChangePassword}>
                    <div className="form-group">
                      <label>Contraseña actual</label>
                      <input 
                        type="password" 
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                        required 
                      />
                    </div>

                    <div className="form-group">
                      <label>Nueva contraseña</label>
                      <input 
                        type="password" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        required 
                        minLength={6}
                      />
                    </div>

                    <div className="form-group">
                      <label>Confirmar nueva contraseña</label>
                      <input 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                      />
                    </div>

                    <Button 
                      variant="primary" 
                      type="submit" 
                      icon={Shield} 
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword ? 'Cambiando...' : 'Actualizar contraseña'}
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="settings-section history-section animate-fade-in">
                  <h2>Historial de Reuniones</h2>
                  <p className="section-desc">Listado de las reuniones en las que has participado recientemente.</p>

                  {isLoadingHistory ? (
                    <div className="history-loading">
                      {[1, 2, 3].map(i => <div key={i} className="skeleton-history-item"></div>)}
                    </div>
                  ) : (!meetingHistory || meetingHistory.length === 0) ? (
                    <div className="history-empty">
                      <History size={48} />
                      <p>Aún no has participado en ninguna reunión.</p>
                      <Button variant="primary" size="md" onClick={() => navigate('/')}>Comenzar una ahora</Button>
                    </div>
                  ) : (
                    <div className="history-list">
                      {meetingHistory.map(item => (
                        <div key={item.id} className="history-item">
                          <div className="history-item-icon">
                            <Video size={20} />
                          </div>
                          <div className="history-item-info">
                            <h3>{item.title || 'Sala de Video'}</h3>
                            <div className="history-item-meta">
                              <span><Calendar size={14} /> {new Date(item.created_at).toLocaleDateString()}</span>
                              <span className={`type-badge ${item.meeting_type}`}>{item.meeting_type}</span>
                              {item.is_host && <span className="host-badge">Anfitrión</span>}
                            </div>
                          </div>
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            icon={Link2}
                            onClick={() => navigate(`/pre-lobby/${item.link}`)}
                          >
                            Reunirse
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'notifications' && (
                <div className="settings-section notifications-section animate-fade-in">
                  <h2>Preferencias de Notificación</h2>
                  <p className="section-desc">Elige qué tipo de alertas quieres recibir.</p>

                  <div className="prefs-list">
                    <div className="pref-item">
                      <div className="pref-info">
                        <h3>Reuniones Instantáneas</h3>
                        <p>Recibe alertas cada 2 min si hay una reunión activa en tu organización.</p>
                      </div>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={notificationPrefs.instant !== false} 
                          onChange={() => handleTogglePref('instant')}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="pref-item">
                      <div className="pref-info">
                        <h3>Reuniones Programadas</h3>
                        <p>Recordatorios 1 día antes y 10 minutos antes.</p>
                      </div>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={notificationPrefs.scheduled !== false} 
                          onChange={() => handleTogglePref('scheduled')}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="pref-item">
                      <div className="pref-info">
                        <h3>Reuniones "Para Después"</h3>
                        <p>Avisos para reuniones sin fecha fija específica.</p>
                      </div>
                      <label className="toggle-switch">
                        <input 
                          type="checkbox" 
                          checked={notificationPrefs.later !== false} 
                          onChange={() => handleTogglePref('later')}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Settings;
