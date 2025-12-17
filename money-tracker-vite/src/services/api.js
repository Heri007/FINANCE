// src/services/api.js

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5002';

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

export const apiRequest = async (endpoint, options = {}) => {
  // ✅ CORRECTION: Normaliser l'endpoint pour ajouter /api/ si absent
  let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Si l'endpoint ne commence pas par /api/ et n'est pas /backup
  if (!normalizedEndpoint.startsWith('/api/') && !normalizedEndpoint.startsWith('/backup')) {
    normalizedEndpoint = `/api${normalizedEndpoint}`;
  }
  
  const url = `${API_BASE}${normalizedEndpoint}`;

  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await safeJson(response);

      // ✅ COMMIT 3: Gestion centralisée 401
      if (response.status === 401) {
        console.warn('🔒 Session expirée - Déconnexion automatique');
        
        // 1. Supprimer le token
        localStorage.removeItem('token');
        
        // 2. Notifier les autres composants (UserContext écoute cet événement)
        window.dispatchEvent(new Event('auth:logout'));
        
        // 3. Throw une erreur standardisée
        throw {
          message: 'Session expirée. Veuillez vous reconnecter.',
          status: 401,
          isAuthError: true, // ✅ Flag pour identifier les erreurs d'auth
        };
      }

      // Autres erreurs HTTP (400, 403, 404, 500, etc.)
      const serverMessage = error.message || error.error || error.msg || null;
      const details = error.errors || null;

      throw {
        message: serverMessage || `Erreur HTTP ${response.status}`,
        status: response.status,
        details,
        raw: error,
      };
    }

    // Succès (200-299)
    return await safeJson(response);

  } catch (error) {
    // ✅ Ne pas logger les erreurs 401 (déjà gérées)
    if (error?.status !== 401) {
      console.error('API Error:', endpoint, error);
    }
    throw error;
  }
};

// ✅ BONUS: Helper functions pour simplifier l'utilisation
export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),
  
  post: (endpoint, data) => apiRequest(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  
  put: (endpoint, data) => apiRequest(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  
  patch: (endpoint, data) => apiRequest(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  
  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};

export default api;
