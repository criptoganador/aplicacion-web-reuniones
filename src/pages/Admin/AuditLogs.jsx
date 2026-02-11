import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader2, Shield, Calendar, User, Activity } from 'lucide-react';
import './AdminDashboard.css';

function AuditLogs() {
  const { authFetch } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await authFetch('/admin/audit-logs?limit=100');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getActionLabel = (action) => {
    const map = {
      'USER_CREATED': 'Usuario Creado',
      'USER_DELETED': 'Usuario Eliminado',
      'USER_ROLE_UPDATED': 'Rol Actualizado',
      'ORG_PROFILE_UPDATED': 'Perfil de Empresa Actualizado',
      'ORG_OWNERSHIP_TRANSFERRED': 'Propiedad Transferida',
      'ORG_DELETED': 'Organización Eliminada',
      'ORG_LOGO_UPDATED': 'Logo Actualizado'
    };
    return map[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('DELETED')) return 'text-red-500 bg-red-50';
    if (action.includes('CREATED')) return 'text-green-500 bg-green-50';
    if (action.includes('UPDATED')) return 'text-blue-500 bg-blue-50';
    if (action.includes('TRANSFERRED')) return 'text-orange-500 bg-orange-50';
    return 'text-gray-500 bg-gray-50';
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>;

  return (
    <div className="audit-logs-container animate-fade-in p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="text-blue-500" size={24} />
        <h2 className="text-xl font-bold text-gray-800">Registro de Auditoría</h2>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr>
                <th className="text-left p-4"><div className="flex items-center gap-2"><Calendar size={16}/> Fecha</div></th>
                <th className="text-left p-4"><div className="flex items-center gap-2"><User size={16}/> Usuario</div></th>
                <th className="text-left p-4"><div className="flex items-center gap-2"><Activity size={16}/> Acción</div></th>
                <th className="text-left p-4">Detalles</th>
                <th className="text-left p-4">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center p-8 text-gray-500">
                    No hay registros de actividad recientes.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 text-sm text-gray-600 font-mono">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{log.user_name || 'Desconocido'}</span>
                        <span className="text-xs text-gray-500">{log.user_email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-600 max-w-xs truncate" title={JSON.stringify(log.details)}>
                        {(() => {
                          if (!log.details) return '-';
                          try {
                            const detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                            const detailsStr = JSON.stringify(detailsObj);
                            return detailsStr.length > 50 ? detailsStr.slice(0, 50) + '...' : detailsStr;
                          } catch (e) {
                            return String(log.details).slice(0, 50);
                          }
                        })()}
                    </td>
                    <td className="p-4 text-xs text-gray-400 font-mono">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;
