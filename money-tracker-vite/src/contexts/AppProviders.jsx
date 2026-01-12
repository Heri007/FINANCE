// FICHIER: src/contexts/AppProviders.jsx
import React from 'react';
import { UserProvider } from './UserContext';
import { FinanceProvider } from './FinanceContext';

export const AppProviders = ({ children }) => {
  return (
    <UserProvider>
      <FinanceProvider>
        {children}
      </FinanceProvider>
    </UserProvider>
  );
};
