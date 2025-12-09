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

// ✅ COMPOSANT TransactionList
export default function TransactionList({ transactions, onViewAll, onDelete, onTransactionClick }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Transactions Récentes</h3>
        {onViewAll && (
          <button onClick={onViewAll} className="text-blue-600 hover:underline text-sm">
            Voir tout
          </button>
        )}
      </div>
      
      <div className="space-y-2">
        {transactions.map(tx => (
          <div 
            key={tx.id}
            onClick={() => onTransactionClick && onTransactionClick(tx)}
            className="flex justify-between items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-all border-b last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${
                tx.type === 'income' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {getCategoryIcon(tx.category)}
              </div>
              <div>
                <p className="font-semibold text-gray-800">{tx.description || tx.category}</p>
                <p className="text-sm text-gray-500">
                  {tx.category} • {formatDate(tx.transactiondate || tx.date || tx.transaction_date)}
                </p>
              </div>
            </div>
            <div className="text-right">
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
    </div>
  );
}
