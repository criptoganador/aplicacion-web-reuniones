import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Video, 
  Activity, 
  Shield, 
  Trash2, 
  UserCheck, 
  Search, 
  Filter,
  MoreVertical,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building,
  Globe,
  Plus,
  Home
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button';
import './AdminDashboard.css';
import { toast } from 'sonner';

function AdminDashboard() {
  const navigate = useNavigate();
  const { user: authUser, authFetch, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [currentTab, setCurrentTab] = useState('users'); // 'users' or 'orgs'
  
  // Orgs specific state
  const [organizations, setOrganizations] = useState([]);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const dashboardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!dashboardRef.current) return;
    const { clientX, clientY } = e;
    dashboardRef.current.style.setProperty('--mouse-x', `${clientX}px`);
    dashboardRef.current.style.setProperty('--mouse-y', `${clientY}px`);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoints = [
        authFetch('/admin/users'),
        authFetch('/admin/stats')
      ];

      // Solo si es Súper Admin pedimos organizaciones
      if (authUser?.organization_id === 1) {
        endpoints.push(authFetch('/admin/organizations'));
      }

      const responses = await Promise.all(endpoints);
      
      const usersData = await responses[0].json();
      const statsData = await responses[1].json();
      
      if (usersData.success) setUsers(usersData.users);
      if (statsData.success) setStats(statsData.stats);

      if (authUser?.organization_id === 1 && responses[2]) {
        const orgsData = await responses[2].json();
        if (orgsData.success) setOrganizations(orgsData.organizations);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Error al cargar datos administrativos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    if (!newOrgName || !newOrgSlug) return;

    setIsCreatingOrg(true);
    try {
      const res = await authFetch('/admin/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Organización "${newOrgName}" creada con éxito`);
        setShowOrgModal(false);
        setNewOrgName('');
        setNewOrgSlug('');
        fetchData();
      } else {
        toast.error(data.error || 'Error al crear organización');
      }
    } catch (error) {
      toast.error('Error de red al crear organización');
    } finally {
      setIsCreatingOrg(false);
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      const res = await authFetch(`/admin/users/${user.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Rol de ${user.name} actualizado`);
        fetchData(); // Recargar
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al cambiar rol');
    }
  };

  const handleDeleteUser = async (userId) => {
    const isSelf = userId === authUser?.id;
    const confirmMsg = isSelf 
      ? '⚠️ ¿Estás COMPLETAMENTE seguro de eliminar TU PROPIA CUENTA? Se cerrará tu sesión y no podrás volver a entrar.'
      : '¿Estás seguro de eliminar este usuario permanentemente? Esta acción borrará todos sus datos.';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await authFetch(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isSelf ? 'Tu cuenta ha sido eliminada' : 'Usuario eliminado');
        
        if (isSelf) {
          // Si se eliminó a sí mismo, cerrar sesión inmediatamente
          logout();
          return; // No intentar recargar datos si ya no hay sesión
        }
        
        fetchData();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al eliminar usuario');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (loading && !users.length) {
    return (
      <div className="admin-loading">
        <Loader2 className="spinner" size={40} />
        <p>Cargando panel de administración...</p>
      </div>
    );
  }

  return (
    <div 
      className="admin-dashboard-container animate-fade-in"
      ref={dashboardRef}
      onMouseMove={handleMouseMove}
    >
      <div className="cursor-spotlight"></div>
      
      <header className="admin-header">
        <div className="header-main">
          <div className="header-title">
            <Shield size={28} className="admin-icon" />
            <h1>Panel de Administración</h1>
          </div>
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
        <p className="header-subtitle">
          {authUser?.organization_id === 1 
            ? "Gestionando todas las organizaciones (Súper Admin)" 
            : `Gestionando Organización #${authUser?.organization_id}`}
        </p>
      </header>

      {/* 🏢 Nueva Tarjeta de Información de Empresa (Solo para Admins de esa Org) */}
      {authUser?.organization_id !== 1 && stats?.join_code && (
        <section className="org-info-card glass-panel animate-slide-up">
          <div className="org-info-content">
            <div className="org-icon-container">
              <Building size={24} />
            </div>
            <div className="org-text">
              <h3>Tu Organización</h3>
              <p>Comparte este código con tu equipo para que se registren en tu empresa.</p>
            </div>
          </div>
          <div className="org-code-container" onClick={() => {
            navigator.clipboard.writeText(stats.join_code);
            toast.success('¡Código copiado al portapapeles!', {
              description: 'Envía este código a los nuevos miembros.'
            });
          }}>
            <div className="code-badge glass-panel">
              <span className="code-label">CÓDIGO DE INVITACIÓN</span>
              <span className="code-value">{stats.join_code}</span>
            </div>
            <div className="copy-hint">Hacer clic para copiar</div>
          </div>
        </section>
      )}

      {/* Admin Tabs */}
      {authUser?.organization_id === 1 && (
        <div className="admin-tabs glass-panel">
          <button 
            className={`admin-tab ${currentTab === 'users' ? 'active' : ''}`}
            onClick={() => setCurrentTab('users')}
          >
            <Users size={20} />
            <span>Usuarios</span>
          </button>
          <button 
            className={`admin-tab ${currentTab === 'orgs' ? 'active' : ''}`}
            onClick={() => setCurrentTab('orgs')}
          >
            <Building size={20} />
            <span>Organizaciones</span>
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <section className="admin-stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon users">
            <Users size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Usuarios Totales</span>
            <span className="stat-value">{stats?.total_users || 0}</span>
          </div>
          <div className="stat-glow"></div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon meetings">
            <Video size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Reuniones Creadas</span>
            <span className="stat-value">{stats?.total_meetings || 0}</span>
          </div>
          <div className="stat-glow"></div>
        </div>
        <div className="stat-card glass-panel">
          <div className="stat-icon active">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <span className="stat-label">Reuniones Activas</span>
            <span className="stat-value">{stats?.active_meetings || 0}</span>
          </div>
          <div className="stat-glow"></div>
        </div>
      </section>

      {/* Users View */}
      {currentTab === 'users' && (
        <section className="admin-content-section animate-fade-in">
          <div className="table-controls">
          <div className="search-box">
            <Search size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-box">
            <Filter size={18} />
            <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">Todos los roles</option>
              <option value="user">Usuarios</option>
              <option value="admin">Administradores</option>
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Org</th>
                <th>Estado</th>
                <th>Fecha Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <tr key={user.id}>
                    <td className="td-user">
                      <div className="user-avatar">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt={user.name} />
                        ) : (
                          <div className="avatar-placeholder">{user.name[0]}</div>
                        )}
                      </div>
                      <div className="user-details">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`role-badge ${user.role}`}>
                        {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      <span className="org-badge">
                        ID: {user.organization_id}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.is_verified ? 'verified' : 'pending'}`}>
                        {user.is_verified ? 'Verificado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="td-date">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="td-actions">
                      <div className="action-buttons">
                        <button 
                          className="btn-action promote" 
                          title={user.role === 'admin' ? 'Degradar a Usuario' : 'Promover a Admin'}
                          onClick={() => handleToggleRole(user)}
                        >
                          <UserCheck size={18} />
                        </button>
                        <button 
                          className="btn-action bdelete" 
                          title="Eliminar usuario"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-table">
                    <AlertCircle size={24} />
                    <p>No se encontraron usuarios que coincidan con la búsqueda.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* Organizations View */}
      {currentTab === 'orgs' && (
        <section className="admin-content-section animate-fade-in">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Listado de Empresas / Organizaciones</h2>
            <Button 
              variant="primary" 
              size="sm" 
              icon={Plus}
              onClick={() => setShowOrgModal(true)}
            >
              Nueva Organización
            </Button>
          </div>

          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Slug / Identificador</th>
                  <th>Fecha Registro</th>
                  <th>Configuración</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={org.id}>
                    <td>
                      <div className="td-org-name">
                        <Building size={18} className="org-icon" />
                        <strong>{org.name}</strong>
                      </div>
                    </td>
                    <td><code>{org.slug}</code></td>
                    <td>{new Date(org.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn-action" title="Próximamente">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Organization Create Modal */}
      {showOrgModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-up" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Registrar Nueva Organización</h2>
              <button className="modal-close-icon" onClick={() => setShowOrgModal(false)}>×</button>
            </div>
            <p className="modal-description">Crea una nueva entidad independiente para gestionar sus propios usuarios y reuniones.</p>
            
            <form onSubmit={handleCreateOrganization}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>Nombre de la Empresa / Org</label>
                <input 
                  type="text" 
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                    }
                  }}
                  placeholder="Ej: Ministerio de Salud"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Slug (Identificador único)</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
                  <input 
                    type="text" 
                    value={newOrgSlug}
                    onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="ej-ministerio-salud"
                    required
                    style={{ paddingLeft: '40px' }}
                  />
                </div>
                <span className="input-hint">Esto se usará internamente para separar los datos. Solo minúsculas y guiones.</span>
              </div>

              <div className="modal-actions">
                <Button 
                  variant="primary" 
                  fullWidth 
                  type="submit" 
                  disabled={isCreatingOrg}
                >
                  {isCreatingOrg ? <Loader2 className="spinner" size={20} /> : 'Crear Organización'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
