// src/services/api.js

// URL de base configurable (env → prod/dev)
export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
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
      const error = await response.json().catch(() => ({}));
      // Fournir le message retourné par le serveur si présent (message ou error)
      const serverMessage = error.message || error.error || error.msg || null;
      const details = error.errors || null;
      throw {
        message: serverMessage || `Erreur HTTP ${response.status}`,
        status: response.status,
        details,
        raw: error
      };
    }

    return response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
};
