// src/components/accounts/AccountList.jsx
import React from 'react';
import { Wallet, Plus, RefreshCw } from 'lucide-react';
import { AccountCard } from '../common/AccountCard';

export function AccountList({ accounts, onSelectAccount, onAddAccount, onDeleteAccount, onInitDefaults }) {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 text-center">
        <div className="mb-4">
          <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
            <Wallet className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Bienvenue sur votre Money Tracker</h2>
        <p className="text-gray-500 mb-6">Vous n'avez aucun compte configuré pour le moment.</p>
        <div className="flex justify-center space-x-4">
          <button 
            onClick={onInitDefaults} 
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition flex items-center space-x-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Créer les comptes par défaut</span>
          </button>
          <button 
            onClick={onAddAccount} 
            className="bg-white border-2 border-indigo-100 text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Créer un compte vide</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">État des Comptes</h2>
        <button 
          onClick={onAddAccount} 
          className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg font-semibold flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nouveau Compte</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((account) => (
          <AccountCard 
            key={account.id} 
            account={account} 
            onDelete={onDeleteAccount} 
            onClick={() => onSelectAccount && onSelectAccount(account)} 
          />
        ))}
      </div>
    </div>
  );
}

export default AccountList;
