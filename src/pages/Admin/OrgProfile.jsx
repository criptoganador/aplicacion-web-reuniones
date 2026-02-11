import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Building, Globe, FileText, Save, Upload, Loader2, Trash2 } from 'lucide-react';
import Button from '../../components/Button';
import './AdminDashboard.css'; // Reusing admin styles

function OrgProfile() {
  const { user, authFetch, refreshAccessToken, logout } = useAuth();
  const [org, setOrg] = useState({
    name: '',
    slug: '',
    description: '',
    website: '',
    logo_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /* State for Ownership Transfer */
  const [potentialOwners, setPotentialOwners] = useState([]);
  const [selectedOwner, setSelectedOwner] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);
  /* State for Organization Deletion */
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchOrgDetails();
    fetchPotentialOwners();
  }, []);

  const fetchPotentialOwners = async () => {
    try {
      // Get users of this organization
      const res = await authFetch('/admin/users');
      const data = await res.json();
      if (data.success) {
        // Filter out current user
        setPotentialOwners(data.users.filter(u => u.id !== user.id));
      }
    } catch (error) {
      console.error("Error fetching owners:", error);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedOwner) return;
    
    // Find selected user name for confirmation
    const targetUser = potentialOwners.find(u => u.id === parseInt(selectedOwner));
    const confirmMsg = `⚠️ PELIGRO: Estás a punto de transferir la propiedad de esta organización a ${targetUser?.name || 'otro usuario'}.
    
Una vez hecho esto:
- Ya NO serás el dueño de la organización.
- Perderás el control exclusivo sobre la misma.
- Esta acción NO se puede deshacer.

¿Estás seguro de continuar?`;

    if (!window.confirm(confirmMsg)) return;

    setTransferring(true);
    try {
      const res = await authFetch(`/admin/organizations/${org.id}/transfer-ownership`, {
        method: 'POST',
        body: JSON.stringify({ newOwnerId: selectedOwner })
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success("Propiedad transferida exitosamente");
        setShowTransferModal(false);
        // Refresh to reflect changes (maybe redirect if permissions lost?)
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error al transferir propiedad");
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteOrganization = async () => {
    const confirmMsg = `⚠️ PELIGRO EXTREMO: Estás a punto de ELIMINAR PERMANENTEMENTE esta organización (${org.name}).

Esto borrará IRREVOCABLEMENTE:
- Todos los usuarios asociados
- Todas las reuniones y archivos
- Todo el historial y configuraciones
- Esta acción NO se puede deshacer

¿Estás ABSOLUTAMENTE seguro de continuar?`;

    if (!window.confirm(confirmMsg)) return;

    // Segunda confirmación
    const secondConfirm = window.prompt(
      `Para confirmar, escribe el nombre exacto de la organización: "${org.name}"`
    );

    if (secondConfirm !== org.name) {
      toast.error('El nombre no coincide. Eliminación cancelada.');
      return;
    }

    setDeleting(true);
    try {
      const res = await authFetch(`/admin/organizations/${org.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        toast.success('Organización eliminada exitosamente');
        // Forzar cierre de sesión ya que la org fue eliminada
        setTimeout(() => {
          logout();
        }, 1500);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al eliminar organización');
    } finally {
      setDeleting(false);
    }
  };

  // ... (existing fetchOrgDetails, handleSave, handleLogoUpload) ...

  const fetchOrgDetails = async () => {
    try {
      const res = await authFetch('/auth/memberships');
      const data = await res.json();
      
      if (data.success) {
        const currentOrg = data.memberships.find(m => m.id === user.organization_id);
        if (currentOrg) {
          setOrg({
            id: currentOrg.id,
            name: currentOrg.name,
            slug: currentOrg.slug,
            description: currentOrg.description || '',
            website: currentOrg.website || '',
            logo_url: currentOrg.logo_url
          });
        }
      }
    } catch (error) {
      console.error(error);
      toast.error("Error cargando perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await authFetch(`/admin/organizations/${org.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: org.name,
          description: org.description,
          website: org.website
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Perfil actualizado");
        refreshAccessToken();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error guardando cambios");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    const toastId = toast.loading('Subiendo logo...');

    try {
      const res = await authFetch(`/admin/organizations/${org.id}/logo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setOrg(prev => ({ ...prev, logo_url: data.logo_url }));
        toast.dismiss(toastId);
        toast.success('Logo actualizado');
        refreshAccessToken();
      } else {
        toast.dismiss(toastId);
        toast.error(data.error);
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('Error de subida');
    }
  };


  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin inline" /></div>;

  return (
    <div className="org-profile-container animate-fade-in" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="glass-panel p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 border-2 border-white/20 shadow-lg">
              {org.logo_url ? (
                <img src={org.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Building size={32} />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white cursor-pointer hover:bg-blue-700 transition-colors shadow-md transform translate-x-1/4 translate-y-1/4">
              <Upload size={16} />
              <input type="file" className="hidden" accept="image/*" onChange={e => handleLogoUpload(e.target.files[0])} />
            </label>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
              {org.name}
            </h2>
            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
              <code className="bg-gray-100 px-2 py-1 rounded text-xs">@{org.slug}</code>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="form-group space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Building size={16} /> Nombre de la Organización
              </label>
              <input
                type="text"
                value={org.name}
                onChange={e => setOrg({...org, name: e.target.value})}
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
            </div>

            <div className="form-group space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Globe size={16} /> Sitio Web
              </label>
              <input
                type="url"
                value={org.website}
                onChange={e => setOrg({...org, website: e.target.value})}
                placeholder="https://ejemplo.com"
                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="form-group space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText size={16} /> Descripción
            </label>
            <textarea
              value={org.description}
              onChange={e => setOrg({...org, description: e.target.value})}
              rows={4}
              placeholder="Describe tu organización..."
              className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={saving} icon={Save} variant="primary">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </form>

        {/* Zona de Peligro - Transferir Propiedad */}
        {user.organization_id !== 1 && (
          <div className="mt-10 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-red-600 mb-4">Zona de Peligro</h3>
            
            {/* Transferir Propiedad */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-red-800">Transferir Propiedad</h4>
                <p className="text-sm text-red-600 mt-1">Transfiere el control absoluto de esta organización a otro miembro.</p>
              </div>
              <Button 
                variant="outline" 
                className="border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => setShowTransferModal(true)}
              >
                Transferir...
              </Button>
            </div>

            {/* Eliminar Organización */}
            <div className="bg-red-100 border-2 border-red-400 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-red-900">Eliminar Organización</h4>
                <p className="text-sm text-red-700 mt-1">
                  Elimina permanentemente esta organización y todos sus datos. <strong>Esta acción no se puede deshacer.</strong>
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-red-600 text-red-900 bg-red-200 hover:bg-red-300 font-bold"
                onClick={handleDeleteOrganization}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        )}
      </div>

       {/* Modal de Transferencia */}
       {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-scale-up" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2 className="text-red-600">Transferir Propiedad</h2>
              <button className="modal-close-icon" onClick={() => setShowTransferModal(false)}>×</button>
            </div>
            <p className="modal-description mb-4">
              Selecciona el nuevo propietario. Esta persona recibirá control total sobre <strong>{org.name}</strong>.
            </p>
            
            <div className="form-group mb-6">
              <label>Nuevo Dueño</label>
              <select 
                value={selectedOwner} 
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 outline-none"
              >
                <option value="">Selecciona un usuario...</option>
                {potentialOwners.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div className="modal-actions flex gap-3">
               <Button 
                variant="secondary" 
                onClick={() => setShowTransferModal(false)}
                fullWidth
              >
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                className="bg-red-600 hover:bg-red-700 text-white"
                fullWidth 
                onClick={handleTransferOwnership}
                disabled={!selectedOwner || transferring}
              >
                {transferring ? <Loader2 className="animate-spin inline mr-2" /> : 'Confirmar Transferencia'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrgProfile;
