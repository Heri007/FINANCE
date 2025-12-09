// FICHIER: src/contexts/UserContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../services/api';

const UserContext = createContext(null);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser doit être utilisé dans un UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinStep, setPinStep] = useState('enter');
  const [firstPin, setFirstPin] = useState('');

  // ✅ Vérification de l'authentification au montage
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        const storedPin = localStorage.getItem('userPin');
        
        setHasPin(!!storedPin);
        
        // ✅ Vérifier si le token est valide via votre API
        if (token) {
          try {
            const response = await fetch(`${API_BASE}/auth/verify-token`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.ok) {
              const data = await response.json();
              setIsAuthenticated(data.valid === true);
            } else {
              // Token invalide, le supprimer
              localStorage.removeItem('token');
              setIsAuthenticated(false);
            }
          } catch (error) {
            console.error('Erreur vérification token:', error);
            localStorage.removeItem('token');
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Erreur vérification auth:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // ✅ Configuration initiale du PIN (appelle votre endpoint /auth/setup-pin)
  const setupPin = async (pin) => {
    try {
      const response = await fetch(`${API_BASE}/auth/setup-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la création du PIN');
      }

      const data = await response.json();
      
      // ✅ Sauvegarder le PIN et le token
      localStorage.setItem('userPin', pin);
      localStorage.setItem('token', data.token);
      
      setHasPin(true);
      setIsAuthenticated(true);
      setPinStep('enter');
      setFirstPin('');
    } catch (error) {
      throw error;
    }
  };

  // ✅ Connexion avec PIN (appelle votre endpoint /auth/verify-pin)
  const login = async (pin) => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'PIN incorrect');
      }

      const data = await response.json();
      
      // ✅ Sauvegarder le token retourné par l'API
      localStorage.setItem('token', data.token);
      setIsAuthenticated(true);
    } catch (error) {
      throw error;
    }
  };

  // ✅ Déconnexion (appelle votre endpoint /auth/logout)
  const logout = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    } finally {
      localStorage.removeItem('token');
      setIsAuthenticated(false);
    }
  };

  const value = {
    isAuthenticated,
    isLoading,
    hasPin,
    pinStep,
    firstPin,
    setPinStep,
    setFirstPin,
    setupPin,
    login,
    logout,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
