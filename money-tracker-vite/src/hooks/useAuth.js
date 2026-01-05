// src/hooks/useAuth.js
import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { authService } from '../services/authService';

export function useAuth() {
  const { isAuthenticated, setAuthToken, clearAuth } = useUser();

  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [pinStep, setPinStep] = useState('enter'); // 'enter' ou 'confirm'
  const [firstPin, setFirstPin] = useState('');

  // Vérification au boot de l'application
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        // 1. Vérifier si un token existe et est valide
        const tokenCheck = await authService.verifyToken();
        if (tokenCheck.valid) {
          // ✅ Token valide trouvé au démarrage
          // UserContext a déjà le token depuis localStorage
          setHasPin(true);
          setIsLoading(false);
          return;
        }

        // 2. Vérifier si un PIN existe dans la base de données
        const pinCheck = await authService.checkPin();
        if (pinCheck.exists) {
          // PIN existe, demander la saisie
          setHasPin(true);
          setPinStep('enter');
        } else {
          // Aucun PIN, premier accès
          setHasPin(false);
          setPinStep('enter');
        }
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
        // En cas d'erreur, considérer comme non authentifié
        setHasPin(false);
        setPinStep('enter');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Créer un nouveau PIN
  const setupPin = async (pin) => {
    try {
      const response = await authService.setupPin(pin);

      // ✅ CORRECTION: Utiliser setAuthToken de UserContext
      if (response.token) {
        setAuthToken(response.token);
        console.log('✅ useAuth.setupPin: Token défini via UserContext');
      }

      setHasPin(true);
      setFirstPin('');
      setPinStep('enter');
      return { success: true };
    } catch (error) {
      console.error('Erreur setupPin:', error);
      throw error;
    }
  };

  // Se connecter avec le PIN
  const login = async (pin) => {
    try {
      const response = await authService.loginWithPin(pin);

      // ✅ CORRECTION: Utiliser setAuthToken de UserContext
      if (response.token) {
        setAuthToken(response.token);
        console.log('✅ useAuth.login: Token défini via UserContext');
      }

      return { success: true };
    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  };

  // Déconnexion
  const logout = () => {
    console.log('🔓 useAuth.logout: Déconnexion demandée');
    clearAuth(); // ✅ Utilise clearAuth qui émet 'auth:logout'
    setFirstPin('');
    setPinStep('enter');
  };

  return {
    isLoading,
    isAuthenticated, // ✅ Vient de UserContext maintenant
    hasPin,
    pinStep,
    firstPin,
    setPinStep,
    setFirstPin,
    setupPin,
    login,
    logout,
  };
}
