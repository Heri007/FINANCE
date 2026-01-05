// src/contexts/UserContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');

  // Sync entre onglets + changements externes (login/logout)
  useEffect(() => {
    const handleLogout = () => {
      console.log('🔓 UserContext: Déconnexion détectée');
      setToken('');
    };

    // ✅ Écouter les événements de login (depuis authService)
    const handleLogin = (event) => {
      const newToken = event.detail?.token || localStorage.getItem('token');
      if (newToken && newToken !== token) {
        console.log('🔐 UserContext: Login détecté via événement, token mis à jour');
        setToken(newToken);
      }
    };

    // ✅ Sync multi-onglets via localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'token') {
        const newToken = e.newValue || '';
        console.log('💾 UserContext: Token changé via localStorage (autre onglet?)');
        setToken(newToken);
      }
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:login', handleLogin);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:login', handleLogin);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [token]);

  const setAuthToken = useCallback((newToken) => {
    console.log(
      '✅ UserContext.setAuthToken appelé avec:',
      newToken ? 'TOKEN_PRÉSENT' : 'NULL'
    );

    if (newToken) {
      localStorage.setItem('token', newToken);
      setToken(newToken);
    } else {
      localStorage.removeItem('token');
      setToken('');
    }
  }, []);

  const clearAuth = useCallback(() => {
    console.log('🧹 UserContext.clearAuth: Nettoyage complet');
    localStorage.removeItem('token');
    setToken('');
    window.dispatchEvent(new Event('auth:logout'));
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      setAuthToken,
      clearAuth,
    }),
    [token, setAuthToken, clearAuth]
  );

  // ✅ LOG pour debug
  useEffect(() => {
    console.log('🔄 UserContext: isAuthenticated =', Boolean(token));
  }, [token]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser doit être utilisé dans un UserProvider');
  return ctx;
}
