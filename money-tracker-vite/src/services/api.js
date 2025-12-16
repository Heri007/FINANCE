// src/services/api.js

export const API_BASE =
  import.meta.env.VITE_API_URL || 'http://localhost:5002/api';

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

export const apiRequest = async (endpoint, options) => {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await safeJson(response);

      if (response.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:logout')); // optionnel
      }

      const serverMessage = error.message || error.error || error.msg || null;
      const details = error.errors || null;

      throw {
        message: serverMessage || `Erreur HTTP ${response.status}`,
        status: response.status,
        details,
        raw: error,
      };
    }

    // ✅ Une seule lecture JSON
    return await safeJson(response);
  } catch (error) {
    console.error('API Error:', endpoint, error);
    throw error;
  }
};

