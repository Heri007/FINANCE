import { useState, useEffect } from 'react';
import { authService } from '../services/authService';

export function useAuth() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
          setIsAuthenticated(true);
          setHasPin(true);
          setIsLoading(false);
          return;
        }

        // 2. Vérifier si un PIN existe dans la base de données
        const pinCheck = await authService.checkPin();
        
        if (pinCheck.exists) {
          // PIN existe, demander la saisie
          setHasPin(true);
          setIsAuthenticated(false);
          setPinStep('enter');
        } else {
          // Aucun PIN, premier accès
          setHasPin(false);
          setIsAuthenticated(false);
          setPinStep('enter');
        }
      } catch (error) {
        console.error('Erreur initialisation auth:', error);
        // En cas d'erreur, considérer comme non authentifié
        setHasPin(false);
        setIsAuthenticated(false);
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
      await authService.setupPin(pin);
      setHasPin(true);
      setIsAuthenticated(true);
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
      await authService.loginWithPin(pin);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      console.error('Erreur login:', error);
      throw error;
    }
  };

  // Déconnexion
  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setFirstPin('');
    setPinStep('enter');
  };

  return {
    isLoading,
    isAuthenticated,
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
