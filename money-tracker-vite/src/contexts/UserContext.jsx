// src/contexts/UserContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

/**
 * UserContext minimal:
 * - Source de vérité: présence du token dans localStorage
 * - Permet à FinanceContext (et autres) de savoir si l'utilisateur est "auth"
 *
 * Note: useAuth() continue d'exister et gère le PIN / verifyToken, etc.
 * Ici on ne fait PAS de verifyToken (ça reste dans useAuth).
 */
const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');

  // Sync entre onglets + changements externes (login/logout)
  useEffect(() => {
  const handleLogout = () => {
    setToken(null);
  };
  
  window.addEventListener('auth:logout', handleLogout);
  return () => window.removeEventListener('auth:logout', handleLogout);
}, []);

  const setAuthToken = useCallback((newToken) => {
    if (newToken) localStorage.setItem('token', newToken);
    else localStorage.removeItem('token');
    setToken(newToken || '');
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    setToken('');
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

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser doit être utilisé dans un UserProvider');
  return ctx;
}
