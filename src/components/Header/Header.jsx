import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, Settings, User, ChevronDown, Sun, Moon, LogOut, Trash2, Shield,
  Leaf, Zap, Snowflake, Grid, Plus, Building, BookOpen, Bell
} from 'lucide-react';
import { useTheme } from '../../context';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import './Header.css';

function Header({ showUserMenu = true }) {
  const { theme, setTheme } = useTheme();
  const { 
    user, isAuthenticated, logout, deleteAccount, 
    memberships, switchOrganization, createOrganization,
    authFetch 
  } = useAuth();
  const navigate = useNavigate();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showOrgSwitcher, setShowOrgSwitcher] = useState(false);

  const themes = [
    { id: 'azure', name: 'Azure Nebula', icon: Zap, color: '#00f2fe' },
    { id: 'midnight', name: 'Midnight OLED', icon: Moon, color: '#000000' },
    { id: 'emerald', name: 'Emerald Royale', icon: Leaf, color: '#00bfa5' },
    { id: 'cyber', name: 'Cyber Amethyst', icon: Zap, color: '#bb86fc' },
    { id: 'arctic', name: 'Arctic Frost', icon: Snowflake, color: '#f0f7ff' },
    { id: 'dark', name: 'Classic Dark', icon: Sun, color: '#202124' },
    { id: 'light', name: 'Classic Light', icon: Moon, color: '#ffffff' },
  ];

  const currentTheme = themes.find(t => t.id === theme) || themes[0];
  const themeMenuRef = useRef(null);
  const userMenuRef = useRef(null);
  const orgSwitcherRef = useRef(null);
  const notificationRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch('/api/notifications');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await authFetch(`/api/notifications/${notif.id}/read`, {
          method: 'PUT'
        });
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }
      setShowNotifications(false);
      navigate(notif.link);
    } catch (err) {
      console.error('Error handling notification:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await authFetch('/api/notifications/read-all', {
        method: 'PUT'
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all read:', err);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setShowThemeMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
      if (orgSwitcherRef.current && !orgSwitcherRef.current.contains(event.target)) {
        setShowOrgSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      setShowUserDropdown(!showUserDropdown);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('❗ ¿Estás seguro de que deseas eliminar tu cuenta? Esta acción borrará permanentemente todas tus reuniones, mensajes y archivos asociados. No se puede deshacer.');
    if (confirmed) {
      try {
        const result = await deleteAccount();
        if (result.success) {
          toast.success(result.message);
          navigate('/login');
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        toast.error('Error al intentar eliminar la cuenta');
      }
    }
  };

  const handleSwitchOrg = async (orgId) => {
    if (orgId === user.organization_id) return;
    
    // Obtener nombres de las organizaciones
    const currentOrg = memberships?.find(m => m.id === user.organization_id);
    const targetOrg = memberships?.find(m => m.id === orgId);
    
    // Confirmación con nombres de organizaciones
    const confirmMessage = `¿Está seguro de cambiar de organización?\n\nDe: ${currentOrg?.name || 'Actual'}\nA: ${targetOrg?.name || 'Nueva'}`;
    
    if (!window.confirm(confirmMessage)) {
      return; // Usuario canceló
    }
    
    toast.loading('Cambiando de organización...');
    const result = await switchOrganization(orgId);
    if (result.success) {
      toast.dismiss();
      toast.success(`Cambiado a: ${targetOrg?.name}`);
      setShowUserDropdown(false);
      navigate('/');
    } else {
      toast.dismiss();
      toast.error(result.error);
    }
  };

  const handleCreateOrg = () => {
    const name = window.prompt('Nombre de la nueva organización:');
    if (!name) return;
    
    const slug = name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    
    toast.promise(createOrganization({ name, slug }), {
      loading: 'Creando organización...',
      success: (data) => {
        if (data.success) {
          return `Organización "${name}" creada con éxito`;
        }
        throw new Error(data.error);
      },
      error: (err) => err.message
    });
  };

  return (
    <header className="header">
      <div className="header-left">
        <a href="/" className="header-logo">
          <Video className="header-logo-icon" />
          <span className="header-logo-text">ASICME</span>
          <span className="header-logo-subtitle">Meet</span>
        </a>

        {isAuthenticated && user && (
          <div className="header-org-switcher" ref={orgSwitcherRef}>
            <button 
              className={`org-switcher-btn ${showOrgSwitcher ? 'active' : ''}`}
              onClick={() => setShowOrgSwitcher(!showOrgSwitcher)}
            >
              <div className="org-btn-icon">
                {user.organization_logo_url ? (
                  <img src={user.organization_logo_url} alt="" />
                ) : (
                  <Building size={16} />
                )}
              </div>
              <div className="org-btn-info">
                <span className="org-btn-label">Organización</span>
                <span className="org-btn-name">{user.organization_name || 'Personal'}</span>
              </div>
              <ChevronDown size={14} className={`org-chevron ${showOrgSwitcher ? 'rotate' : ''}`} />
            </button>

            {showOrgSwitcher && memberships && memberships.length > 0 && (
              <div className="org-switcher-dropdown glass-panel show">
                <div className="org-dropdown-header">
                  <p>Tus Organizaciones</p>
                </div>
                <div className="org-dropdown-list">
                  {memberships.map((org) => (
                    <button 
                      key={org.id} 
                      className={`org-dropdown-item ${user.organization_id === org.id ? 'current' : ''}`}
                      onClick={() => {
                        handleSwitchOrg(org.id);
                        setShowOrgSwitcher(false);
                      }}
                    >
                      <div className="org-item-icon">
                        {org.logo_url ? <img src={org.logo_url} alt="" /> : <Building size={14} />}
                      </div>
                      <div className="org-item-text">
                        <span className="org-item-name">{org.name}</span>
                        <span className="org-item-role">{org.role === 'admin' ? 'Administrador' : 'Miembro'}</span>
                      </div>
                      {user.organization_id === org.id && <div className="current-indicator">Actual</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {showUserMenu && (
        <div className="header-right">
          <div className="notification-container" ref={notificationRef}>
            <button 
              className={`header-icon-btn ${showNotifications ? 'active' : ''}`}
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notificaciones"
            >
              <Bell size={20} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className="notifications-dropdown glass-panel">
                <div className="notifications-header">
                  <span className="notif-title">Notificaciones</span>
                  {unreadCount > 0 && (
                    <button className="mark-read-btn" onClick={markAllRead}>
                      Marcar leídas
                    </button>
                  )}
                </div>
                <div className="notifications-list">
                  {notifications.length === 0 ? (
                    <div className="no-notifications">
                      <Bell size={24} className="empty-icon" />
                      <p>No tienes notificaciones</p>
                    </div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`notification-item ${!notif.is_read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="notif-icon">
                          <Video size={14} />
                        </div>
                        <div className="notif-content">
                          <p className="notif-message">{notif.message}</p>
                          <span className="notif-time">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {!notif.is_read && <div className="unread-dot"></div>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="theme-selector-container" ref={themeMenuRef}>
            <button 
              className={`header-icon-btn theme-toggle-btn ${theme}`} 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              title="Cambiar tema"
            >
              <div className="theme-glow"></div>
              <currentTheme.icon size={20} className="theme-current-icon" />
            </button>

            {showThemeMenu && (
              <div className="theme-menu theme-menu-panel">
                <p className="theme-menu-title">Seleccionar Ambiente</p>
                <div className="theme-options">
                  {themes.map((t) => (
                    <button 
                      key={t.id}
                      className={`theme-option ${theme === t.id ? 'active' : ''}`}
                      onClick={() => {
                        setTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                    >
                      <div className="theme-preview" style={{ background: t.color }}>
                        <t.icon size={14} color={t.id === 'light' ? '#333' : '#fff'} />
                      </div>
                      <span className="theme-name">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button 
            className="header-icon-btn" 
            title="Manual de Usuario"
            onClick={() => navigate('/user-manual')}
          >
            <BookOpen size={20} />
          </button>

          <button 
            className="header-icon-btn" 
            title="Configuración"
            onClick={() => navigate('/settings')}
          >
            <Settings size={20} />
          </button>
          
          <div className="header-time">
            {new Date().toLocaleTimeString('es-ES', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
          
          <div className="header-user-container" ref={userMenuRef}>
            <button 
              className={`header-user-btn ${isAuthenticated ? 'active' : ''} ${showUserDropdown ? 'dropdown-open' : ''}`}
              onClick={handleUserClick}
            >
              <div className="header-avatar-wrapper">
                <div className="header-avatar">
                  {isAuthenticated && user ? (
                    user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="header-avatar-img" />
                    ) : (
                      <span>{user.name ? user.name.charAt(0).toUpperCase() : '?'}</span>
                    )
                  ) : (
                    <User size={18} />
                  )}
                </div>
                {isAuthenticated && <span className="avatar-status-dot"></span>}
              </div>
              {isAuthenticated && user?.name && (
                <span className="header-user-name">{user.name}</span>
              )}
              <ChevronDown size={16} className={`header-chevron ${showUserDropdown ? 'rotate' : ''}`} />
            </button>

            {isAuthenticated && showUserDropdown && (
              <div className="header-user-dropdown glass-panel show">
                <div className="dropdown-profile-header">
                  <div className="dropdown-avatar-large">
                    {user?.avatar_url ? (
                      <img src={user.avatar_url} alt="" />
                    ) : (
                      <span>{user?.name ? user.name.charAt(0).toUpperCase() : '?'}</span>
                    )}
                  </div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-name-row">
                      <p className="user-name">{user?.name || 'Usuario'}</p>
                      <span className={`role-badge ${user?.role || 'user'}`}>
                        {user?.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </div>
                    <p className="user-email">{user?.email || ''}</p>
                  </div>
                </div>
                
                <div className="dropdown-divider"></div>

                {/* --- SECCIÓN DE ORGANIZACIONES --- */}
                <div className="dropdown-section">
                  <p className="section-title">Cambiar Organización</p>
                  <div className="org-list">
                    {memberships.map((org) => (
                      <button 
                        key={org.id} 
                        className={`org-item ${user?.organization_id === org.id ? 'active' : ''}`}
                        onClick={() => handleSwitchOrg(org.id)}
                      >
                        <div className="org-icon">
                          {org.logo_url ? <img src={org.logo_url} alt="" /> : <Building size={14} />}
                        </div>
                        <span className="org-name">{org.name}</span>
                        {user?.organization_id === org.id && <div className="active-dot"></div>}
                      </button>
                    ))}
                    {user?.role === 'admin' && (
                      <button className="org-item add-org" onClick={handleCreateOrg}>
                        <div className="org-icon"><Plus size={14} /></div>
                        <span className="org-name">Nueva Organización</span>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="dropdown-divider"></div>
                
                <div className="dropdown-actions">
                  <button className="dropdown-item" onClick={() => navigate('/settings')}>
                    <div className="item-icon-wrapper"><Settings size={18} /></div>
                    <span>Configuración</span>
                  </button>
                  {user?.role === 'admin' && (
                    <button className="dropdown-item" onClick={() => navigate('/admin')}>
                      <div className="item-icon-wrapper"><Shield size={18} /></div>
                      <span>Panel de Administración</span>
                    </button>
                  )}
                  <button className="dropdown-item" onClick={logout}>
                    <div className="item-icon-wrapper"><LogOut size={18} /></div>
                    <span>Cerrar sesión</span>
                  </button>
                  
                  <div className="dropdown-divider"></div>
                  
                  <button className="dropdown-item danger" onClick={handleDeleteAccount}>
                    <div className="item-icon-wrapper"><Trash2 size={18} /></div>
                    <span>Eliminar cuenta</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;
