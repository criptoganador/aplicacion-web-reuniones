import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

// ✨ HYBRID MODE: Check if Electron injected a local API URL
// This is now a function to always get the latest value
const getApiUrl = () => {
  let url = 'https://asicme-meet-backend.onrender.com'; // Default production API

  // 1. Electron check
  if (typeof window !== 'undefined' && window.electron) {
    if (window.electron.getBackendPort) {
      const port = window.electron.getBackendPort();
      if (port) url = `http://localhost:${port}`;
    } else if (window.electron.getLocalApiUrl) {
      const localUrl = window.electron.getLocalApiUrl();
      if (localUrl) url = localUrl;
    }
    // Note: If no local URL/port is provided by Electron, 
    // it will keep the default production URL defined above.
  } 
  // 2. Development environment check
  else if (import.meta.env.DEV) {
    url = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  }
  // 3. Environment Variable check
  else if (import.meta.env.VITE_API_URL) {
    url = import.meta.env.VITE_API_URL;
  }

  // Debug log
  if (typeof window !== 'undefined' && !window._apiUrlLogged) {
    console.log(`🌐 [API] Using endpoint: ${url}`);
    window._apiUrlLogged = true;
  }

  return url;
};


// Export getApiUrl function for use in other components
export { getApiUrl };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await fetch(`${getApiUrl()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include' // ⚠️ Importante para enviar cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success !== false) {
          // 🚀 Optimización: Solo actualizar si hay cambios para evitar re-renders innecesarios
          if (data.accessToken !== accessToken) {
            setAccessToken(data.accessToken);
          }
          
          // Comparación simple de usuario para evitar re-render si es idéntico
          const userStr = JSON.stringify(data.user);
          const currentUserStr = JSON.stringify(user);
          if (userStr !== currentUserStr) {
            setUser(data.user);
            // Fetch memberships when user data changes (using fresh token)
            if (data.accessToken) {
              fetch(`${getApiUrl()}/auth/memberships`, {
                headers: { 'Authorization': `Bearer ${data.accessToken}` }
              })
              .then(res => res.json())
              .then(mdata => {
                if (mdata.success) setMemberships(mdata.memberships);
              })
              .catch(err => console.error('Error fetching memberships:', err));
            }
          }
          
          return true; // Éxito
        }
      }
      return false; // Fallo silencioso o no autenticado
    } catch (error) {
      console.error('refreshAccessToken error:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [accessToken, user]);

  /**
   * Helper para realizar peticiones autenticadas
   */
  const authFetch = useCallback(async (url, options = {}) => {
    // Si la URL empieza por /, la prefijamos con la base de la API
    const finalUrl = url.startsWith('/') ? `${getApiUrl()}${url}` : url;

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
    };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      let response = await fetch(finalUrl, { ...options, headers });

      // Si el token expiró (401), intentamos refrescar
      if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          logout();
        }
        // Nota: El reintento automático es complejo aquí por el closure del token.
        // Por ahora, dejamos que el error 401 fluya o que el refresh dispare un re-render.
      }

      return response;
    } catch (error) {
      console.error('AuthFetch error:', error);
      throw error;
    }
  }, [accessToken, refreshAccessToken]);

  // --- EFECTOS ---

  // Intentar renovar token al cargar la aplicación
  useEffect(() => {
    refreshAccessToken();
  }, [refreshAccessToken]); // Añadido refreshAccessToken a dependencias para consistencia

  // Poll para cambios de rol/estado cada 60 segundos
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(() => {
      console.log('🔄 Sincronizando datos de usuario...');
      refreshAccessToken();
    }, 60000);

    return () => clearInterval(interval);
  }, [user, refreshAccessToken]);

  // Sincronizar al volver a enfocar la ventana
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        console.log('👀 Ventana activa, refrescando datos...');
        refreshAccessToken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, refreshAccessToken]);

  // --- MÉTODOS ---


  const login = async (email, password) => {
    try {
      const response = await fetch(`${getApiUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Para recibir cookies
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setAccessToken(data.accessToken);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Error de conexión con el servidor' };
    }
  };

  const register = async (name, email, password, role = 'user', orgName = '', joinCode = '') => {
    try {
      const response = await fetch(`${getApiUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password, role, orgName, joinCode })
      });

      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setAccessToken(data.accessToken);
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Error de conexión con el servidor' };
    }
  };

  const logout = async () => {
    try {
      await fetch(`${getApiUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error en logout:', error);
    }

    setUser(null);
    setAccessToken(null);
    setMemberships([]);
  };

  const fetchMemberships = async (token = accessToken) => {
    if (!token) return;
    try {
      const response = await fetch(`${getApiUrl()}/auth/memberships`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setMemberships(data.memberships);
      }
    } catch (error) {
      console.error('Error fetching memberships:', error);
    }
  };

  const switchOrganization = async (organizationId) => {
    try {
      const response = await authFetch('/auth/switch-org', {
        method: 'POST',
        body: JSON.stringify({ organizationId })
      });
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        setAccessToken(data.accessToken);
        // Refresh memberships to get potential role changes
        await fetchMemberships(data.accessToken);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      return { success: false, error: 'Error al cambiar de organización' };
    }
  };

  const createOrganization = async (orgData) => {
    try {
      const response = await authFetch('/admin/organizations', {
        method: 'POST',
        body: JSON.stringify(orgData)
      });
      const data = await response.json();
      if (data.success) {
        await fetchMemberships(); // Actualizar lista
        return { success: true, organization: data.organization };
      }
      return { success: false, error: data.error };
    } catch (error) {
      return { success: false, error: 'Error al crear organización' };
    }
  };

  const deleteAccount = async () => {
    try {
      const response = await authFetch(`${getApiUrl()}/auth/account`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setUser(null);
        setAccessToken(null);
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error al eliminar cuenta:', error);
      return { success: false, error: 'No se pudo eliminar la cuenta. Intente nuevamente.' };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authFetch(`${getApiUrl()}/auth/profile`, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });

      const data = await response.json();

      if (data.success) {
        // Actualizar el estado local del usuario con los nuevos datos
        setUser(prev => ({ ...prev, ...data.user }));
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      return { success: false, error: 'Error de conexión al actualizar perfil' };
    }
  };

  const changePassword = async (passwordData) => {
    try {
      const response = await authFetch(`${getApiUrl()}/auth/change-password`, {
        method: 'PUT',
        body: JSON.stringify(passwordData)
      });

      const data = await response.json();

      if (data.success) {
        return { success: true, message: data.message };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      return { success: false, error: 'Error de conexión al cambiar contraseña' };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await fetch(`${getApiUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      return await response.json();
    } catch (error) {
      console.error('Error en forgotPassword:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  const resetPassword = async (token, newPassword) => {
    try {
      const response = await fetch(`${getApiUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      return await response.json();
    } catch (error) {
      console.error('Error en resetPassword:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };


  return (
    <AuthContext.Provider value={{ 
      user, 
      accessToken,
      login,
      register, 
      logout, 
      deleteAccount, 
      updateProfile, 
      changePassword, 
      forgotPassword, 
      resetPassword, 
      refreshAccessToken,
      authFetch,
      isAuthenticated: !!user, 
      loading,
      memberships,
      fetchMemberships,
      switchOrganization,
      createOrganization
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
