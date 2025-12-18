import React from 'react';

// ✅ FONCTION getCategoryIcon (une seule fois)
const getCategoryIcon = (category) => {
  const iconMap = {
    'Voiture': '🚗',
    'Transport': '🚌',
    'Automobile': '🚗',
    'Alimentation': '🍽️',
    'Restaurant': '🍽️',
    'Nourriture': '🍽️',
    'Logement': '🏠',
    'Maison': '🏠',
    'Loyer': '🏠',
    'Salaire': '💰',
    'Revenu': '💰',
    'Cadeau': '🎁',
    'Shopping': '🛒',
    'Courses': '🛒',
    'Loisirs': '🎮',
    'Santé': '💊',
    'Éducation': '📚',
    'Vêtements': '👕',
    'Autre': '📝',
    'Autres': '📝',
    'PLG FLPT': '⚓',
    'Bois': '🔥',
    'Transfert': '↔️',
    'Carburant': '⛽',
    'Frais': '📄',
    'Stock': '📦',
    'DOIT': '💵'
  };

  const normalizedCategory = category?.toLowerCase() || '';
  for (const [key, icon] of Object.entries(iconMap)) {
    if (key.toLowerCase() === normalizedCategory) {
      return icon;
    }
  }

  for (const [key, icon] of Object.entries(iconMap)) {
    if (normalizedCategory.includes(key.toLowerCase())) {
      return icon;
    }
  }

  return '💵';
};

// ✅ FONCTION formatDate (une seule fois, version corrigée)
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    let dateToFormat = dateString;
    
    if (dateString instanceof Date) {
      dateToFormat = dateString;
    } else if (typeof dateString === 'string') {
      dateToFormat = new Date(dateString);
    }
    
    if (isNaN(dateToFormat.getTime())) {
      return 'N/A';
    }
    
    return dateToFormat.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (error) {
    console.error('Erreur formatage date:', error, dateString);
    return 'N/A';
  }
};

// ✅ FONCTION formatCurrency (une seule fois)
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { 
    maximumFractionDigits: 0 
  }).format(amount || 0) + ' Ar';
};

// ✅ COMPOSANT TransactionList avec scroll indépendant
export default function TransactionList({ 
  transactions, 
  onViewAll, 
  onDelete, 
  onTransactionClick,
  compact = false  // Mode compact pour overview
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col h-full">
      {/* Header fixe */}
      <div className="p-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Transactions Récentes
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {transactions?.length || 0} {transactions?.length > 1 ? 'transactions' : 'transaction'}
            </p>
          </div>
          {onViewAll && (
            <button 
              onClick={onViewAll} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
            >
              Voir tout →
            </button>
          )}
        </div>
      </div>
      
      {/* Conteneur scrollable avec hauteur fixe */}
      <div className={`overflow-y-auto flex-1 ${compact ? 'max-h-96' : 'max-h-[600px]'}`}>
        <div className="p-6 pt-4">
          {!transactions || transactions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <p className="text-lg mb-2">📭</p>
              <p>Aucune transaction récente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div 
                  key={tx.id}
                  onClick={() => onTransactionClick && onTransactionClick(tx)}
                  className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-all border-b border-gray-100 last:border-b-0 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 ${
                      tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {getCategoryIcon(tx.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 truncate">
                        {tx.description || tx.category}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {tx.category} • {formatDate(tx.transactiondate || tx.date || tx.transaction_date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`font-bold text-lg ${
                      tx.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    {!tx.is_posted && !tx.isposted && (
                      <span className="text-xs text-orange-500 flex items-center gap-1 justify-end">
                        ⚠ Non validé
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
