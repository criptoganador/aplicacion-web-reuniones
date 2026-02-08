import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Video, Settings, User, ChevronDown, Sun, Moon, LogOut, Trash2, Shield,
  Leaf, Zap, Snowflake, Grid
} from 'lucide-react';
import { useTheme } from '../../context';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import './Header.css';

function Header({ showUserMenu = true }) {
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

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

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserClick = () => {
    if (!isAuthenticated) {
      navigate('/login');
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

  return (
    <header className="header">
      <div className="header-left">
        <a href="/" className="header-logo">
          {/* Logo Imagen (si existe) */}
          <img 
            src="/asicme_icon_1770541736795.png" 
            alt="ASICME Logo" 
            className="header-logo-image" 
            onError={(e) => e.target.style.display = 'none'} 
          />
          <Video className="header-logo-icon" />
          <span className="header-logo-text">ASICME</span>
          <span className="header-logo-subtitle">Meet</span>
        </a>
      </div>
      
      {showUserMenu && (
        <div className="header-right">
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
          
          <div className="header-user-container">
            <button 
              className={`header-user-btn ${isAuthenticated ? 'active' : ''}`}
              onClick={handleUserClick}
            >
              <div className="header-avatar-wrapper">
                <div className="header-avatar">
                  {isAuthenticated ? (
                    user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="header-avatar-img" />
                    ) : (
                      <span>{user.name.charAt(0).toUpperCase()}</span>
                    )
                  ) : (
                    <User size={18} />
                  )}
                </div>
                {isAuthenticated && <span className="avatar-status-dot"></span>}
              </div>
              {isAuthenticated && (
                <span className="header-user-name">{user.name}</span>
              )}
              <ChevronDown size={16} className="header-chevron" />
            </button>

            {isAuthenticated && (
              <div className="header-user-dropdown glass-panel">
                <div className="dropdown-profile-header">
                  <div className="dropdown-avatar-large">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" />
                    ) : (
                      <span>{user.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="dropdown-user-info">
                    <div className="dropdown-name-row">
                      <p className="user-name">{user.name}</p>
                      <span className={`role-badge ${user.role}`}>
                        {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </div>
                    <p className="user-email">{user.email}</p>
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
