// src/components/accounts/AccountList.jsx
import React from 'react';
import { Wallet, Plus, RefreshCw } from 'lucide-react';
import { AccountCard } from '../common/AccountCard';

export function AccountList({ 
  accounts, 
  onSelectAccount, 
  onAddAccount, 
  onDeleteAccount, 
  onInitDefaults 
}) {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-2 border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
            <h2 className="text-base font-bold text-slate-900">État des Comptes</h2>
          </div>
        </div>
        
        <div className="text-center py-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <p className="text-slate-600 mb-4 font-semibold">
            Vous n'avez aucun compte configuré pour le moment.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={onAddAccount}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-sm"
            >
              <Plus size={16} />
              Nouveau Compte
            </button>
            <button
              onClick={onInitDefaults}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors font-semibold text-sm"
            >
              <RefreshCw size={16} />
              Comptes par défaut
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border-2 border-slate-200 overflow-hidden">
      {/* Header compact */}
      <div className="px-5 py-3 border-b-2 border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-slate-700" strokeWidth={2.5} />
            <h2 className="text-base font-bold text-slate-900">État des Comptes</h2>
            <span className="text-xs font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-md">
              {accounts.length}
            </span>
          </div>
          
          <button
            onClick={onAddAccount}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all font-semibold text-xs shadow-sm"
          >
            <Plus size={14} strokeWidth={3} />
            Nouveau
          </button>
        </div>
      </div>

      {/* Grille compacte avec gap réduit */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {accounts.map(account => (
          <AccountCard
            key={account.id}
            account={account}
            onClick={() => onSelectAccount(account)}
            onDelete={onDeleteAccount}
          />
        ))}
      </div>
    </div>
  );
}
