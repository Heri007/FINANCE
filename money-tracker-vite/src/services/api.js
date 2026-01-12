// src/services/api.js

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5002';

// ============================================================================
// 🆕 GESTION DU TOKEN CSRF
// ============================================================================

let csrfToken = null;

/**
 * Récupérer le token CSRF depuis le backend
 */
export const fetchCsrfToken = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/csrf-token`, {
      credentials: 'include', // ✅ IMPORTANT : Envoie les cookies
    });

    if (!response.ok) {
      throw new Error('Impossible de récupérer le token CSRF');
    }

    const data = await response.json();
    csrfToken = data.csrfToken;
    console.log('✅ Token CSRF récupéré');
    return csrfToken;
  } catch (error) {
    console.error('❌ Erreur récupération token CSRF:', error);
    throw error;
  }
};

/**
 * Obtenir le token CSRF (le récupère si nécessaire)
 */
const getCsrfToken = async () => {
  if (!csrfToken) {
    await fetchCsrfToken();
  }
  return csrfToken;
};

// ============================================================================
// AUTH TOKEN (INCHANGÉ)
// ============================================================================

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============================================================================
// HELPERS (INCHANGÉ)
// ============================================================================

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

// ============================================================================
// API REQUEST (AMÉLIORÉ AVEC CSRF + AbortController)
// ============================================================================
export const apiRequest = async (endpoint, options = {}) => {
  // ✅ Normaliser l'endpoint
  let normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (
    !normalizedEndpoint.startsWith('/api/') &&
    !normalizedEndpoint.startsWith('/backup')
  ) {
    normalizedEndpoint = `/api${normalizedEndpoint}`;
  }

  const url = `${API_BASE}${normalizedEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  // ✅ Vérifier si la requête nécessite un token CSRF
  const requiresCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

  // Headers de base
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  // ✅ Ajouter le token CSRF pour les requêtes mutantes
  if (requiresCsrf) {
    try {
      const token = await getCsrfToken();
      headers['X-CSRF-Token'] = token;
    } catch (csrfError) {
      console.warn("⚠️ Impossible d'ajouter le token CSRF, tentative sans...");
    }
  }

  const config = {
    ...options,
    method,
    credentials: 'include', // ✅ IMPORTANT : Envoie les cookies
    headers,
    // ✅ AJOUT : Passer le signal si fourni
    ...(options.signal && { signal: options.signal }),
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await safeJson(response);

      // ✅ GESTION 401 : Session expirée (INCHANGÉ)
      if (response.status === 401) {
        console.warn('🔒 Session expirée - Déconnexion automatique');
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:logout'));
        throw {
          message: 'Session expirée. Veuillez vous reconnecter.',
          status: 401,
          isAuthError: true,
        };
      }

      // ✅ NOUVEAU : GESTION 403 CSRF
      if (response.status === 403 && error.code === 'EBADCSRFTOKEN') {
        console.warn('⚠️ Token CSRF invalide, régénération...');
        // Réinitialiser et réessayer UNE SEULE FOIS
        if (!options._csrfRetry) {
          csrfToken = null; // Reset du token
          return apiRequest(endpoint, { ...options, _csrfRetry: true });
        }
        throw {
          message: 'Erreur de sécurité CSRF. Veuillez recharger la page.',
          status: 403,
          isCsrfError: true,
        };
      }

      // ✅ NOUVEAU : GESTION 429 Rate Limit
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '15';
        throw {
          message: `Trop de requêtes. Réessayez dans ${retryAfter} minutes.`,
          status: 429,
          isRateLimitError: true,
          retryAfter,
        };
      }

      // Autres erreurs HTTP
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
    // ✅ AJOUT : Gérer les AbortError silencieusement
    if (error.name === 'AbortError') {
      console.log('🚫 Requête annulée:', endpoint);
      throw { 
        message: 'Requête annulée', 
        isAborted: true, 
        status: 0 
      };
    }

    // Ne pas logger les erreurs 401 (déjà gérées)
    if (error?.status !== 401) {
      console.error('API Error:', endpoint, error);
    }
    throw error;
  }
};

// ============================================================================
// HELPER FUNCTIONS (INCHANGÉES)
// ============================================================================

export const api = {
  get: (endpoint) => apiRequest(endpoint, { method: 'GET' }),

  post: (endpoint, data) =>
    apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  put: (endpoint, data) =>
    apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  patch: (endpoint, data) =>
    apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (endpoint) => apiRequest(endpoint, { method: 'DELETE' }),
};

export default api;
