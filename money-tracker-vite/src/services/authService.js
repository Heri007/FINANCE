const API_URL = 'http://localhost:5002/api/auth';

export const authService = {
  // Vérifier si un PIN existe dans la base de données
  checkPin: async () => {
    try {
      const res = await fetch(`${API_URL}/check-pin`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        throw new Error('Erreur vérification PIN');
      }
      
      const data = await res.json();
      return data; // { exists: true/false }
    } catch (error) {
      console.error('Erreur checkPin:', error);
      throw error;
    }
  },

  // Créer un nouveau PIN (premier accès)
  setupPin: async (pin) => {
    try {
      const res = await fetch(`${API_URL}/setup-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erreur setup PIN');
      }

      const data = await res.json();
      // Sauvegarder le token
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return data;
    } catch (error) {
      console.error('Erreur setupPin:', error);
      throw error;
    }
  },

  // Se connecter avec le PIN
  loginWithPin: async (pin) => {
    try {
      const res = await fetch(`${API_URL}/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'PIN incorrect');
      }

      const data = await res.json();
      // Sauvegarder le token
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      return data;
    } catch (error) {
      console.error('Erreur loginWithPin:', error);
      throw error;
    }
  },

  // Vérifier si le token est valide
  verifyToken: async () => {
    const token = localStorage.getItem('token');
    if (!token) return { valid: false };

    try {
      const res = await fetch(`${API_URL}/verify-token`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        localStorage.removeItem('token');
        return { valid: false };
      }

      return { valid: true };
    } catch (error) {
      console.error('Erreur verifyToken:', error);
      localStorage.removeItem('token');
      return { valid: false };
    }
  },

  // Déconnexion
  logout: () => {
    localStorage.removeItem('token');
  }
};
