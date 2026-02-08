import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include' // ⚠️ Importante para enviar cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success !== false) {
          setAccessToken(data.accessToken);
          setUser(data.user);
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
  }, []);

  /**
   * Helper para realizar peticiones autenticadas
   */
  const authFetch = useCallback(async (url, options = {}) => {
    // Si la URL empieza por /, la prefijamos con la base de la API
    const finalUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
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
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error en logout:', error);
    }

    setUser(null);
    setAccessToken(null);
  };

  const deleteAccount = async () => {
    try {
      const response = await authFetch(`${API_BASE_URL}/auth/account`, {
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
      const response = await authFetch(`${API_BASE_URL}/auth/profile`, {
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
      const response = await authFetch(`${API_BASE_URL}/auth/change-password`, {
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
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
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
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
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
      loading 
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
