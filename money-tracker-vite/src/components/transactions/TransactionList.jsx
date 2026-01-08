import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';

// ✅ FONCTION getCategoryIcon
const getCategoryIcon = (category) => {
  const iconMap = {
    Voiture: '🚗',
    Transport: '🚌',
    Automobile: '🚗',
    Alimentation: '🍽️',
    Restaurant: '🍽️',
    Nourriture: '🍽️',
    Logement: '🏠',
    Maison: '🏠',
    Loyer: '🏠',
    Salaire: '💰',
    Revenu: '💰',
    Cadeau: '🎁',
    Shopping: '🛒',
    Courses: '🛒',
    Loisirs: '🎮',
    Santé: '💊',
    Éducation: '📚',
    Vêtements: '👕',
    Autre: '📝',
    Autres: '📝',
    'PLG FLPT': '⚓',
    Bois: '🔥',
    Transfert: '↔️',
    Carburant: '⛽',
    Frais: '📄',
    Stock: '📦',
    DOIT: '💵',
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

// ✅ FONCTION formatDate
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
      year: 'numeric',
    });
  } catch (error) {
    console.error('Erreur formatage date:', error, dateString);
    return 'N/A';
  }
};

// ✅ FONCTION formatCurrency
const formatCurrency = (amount) => {
  return (
    new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(amount || 0) + ' Ar'
  );
};

// ✅ COMPOSANT TransactionList harmonisé
export default function TransactionList({
  transactions,
  onViewAll,
  onDelete,
  onTransactionClick,
  compact = false,
}) {
  return (
    <div
      className="
      bg-white/90 backdrop-blur-sm
      rounded-2xl shadow-lg 
      border-2 border-slate-200 
      overflow-hidden 
      flex flex-col h-full
      hover:shadow-xl transition-shadow duration-300
    "
    >
      {/* Header fixe avec dégradé slate */}
      <div
        className="
        p-6 pb-4 
        border-b-2 border-slate-200 
        bg-gradient-to-r from-slate-100 to-slate-50
        flex-shrink-0
      "
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              📋 Transactions Récentes
            </h3>
            <p className="text-sm text-slate-600 mt-1 font-semibold">
              {transactions?.length || 0}{' '}
              {transactions?.length > 1 ? 'transactions' : 'transaction'}
            </p>
          </div>
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="
                flex items-center gap-2
                px-4 py-2.5 
                bg-gradient-to-r from-slate-700 to-slate-900
                text-white 
                rounded-lg 
                hover:from-slate-600 hover:to-slate-800
                transition-all duration-200
                text-sm font-bold 
                shadow-md hover:shadow-lg
                uppercase tracking-wide
              "
            >
              Voir tout
              <ArrowUpRight size={16} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* Conteneur scrollable */}
      <div
        className={`overflow-y-auto flex-1 ${compact ? 'max-h-96' : 'max-h-[600px]'} custom-scrollbar`}
      >
        <div className="p-4">
          {!transactions || transactions.length === 0 ? (
            <div
              className="
              flex flex-col items-center justify-center 
              py-12 text-center
            "
            >
              <div
                className="
                bg-slate-100 
                w-20 h-20 
                rounded-full 
                flex items-center justify-center 
                mb-4
                border-2 border-slate-300
              "
              >
                <span className="text-4xl">📭</span>
              </div>
              <p className="text-slate-600 font-semibold mb-1">
                Aucune transaction récente
              </p>
              <p className="text-slate-500 text-sm">Les transactions apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  onClick={() => onTransactionClick?.(tx)} // ✅ Optional chaining
                  className="
        flex justify-between items-center 
        p-4 
        bg-white
        hover:bg-slate-50 
        rounded-xl 
        cursor-pointer 
        transition-all duration-200
        border-2 border-slate-200
        hover:border-blue-400
        hover:shadow-lg
        group
      "
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Icône avec fond coloré */}
                    <div
                      className={`
                      w-12 h-12 
                      rounded-xl 
                      flex items-center justify-center 
                      text-xl 
                      flex-shrink-0
                      border-2
                      transition-transform duration-200
                      group-hover:scale-110
                      ${
                        tx.type === 'income'
                          ? 'bg-gradient-to-br from-emerald-100 to-teal-100 border-emerald-300'
                          : 'bg-gradient-to-br from-rose-100 to-pink-100 border-rose-300'
                      }
                    `}
                    >
                      {getCategoryIcon(tx.category)}
                    </div>

                    {/* Infos transaction */}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 truncate text-base">
                        {tx.description || tx.category}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="
                          text-xs font-semibold 
                          text-slate-600 
                          bg-slate-100 
                          px-2 py-0.5 
                          rounded-md
                          border border-slate-200
                        "
                        >
                          {tx.category}
                        </span>
                        <span className="text-xs text-slate-500 font-semibold">•</span>
                        <span className="text-xs text-slate-500 font-semibold">
                          {formatDate(
                            tx.transactiondate || tx.date || tx.transaction_date
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Montant et badges */}
                  <div className="text-right flex-shrink-0 ml-4">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      {tx.type === 'income' ? (
                        <ArrowUpRight
                          className="text-emerald-600"
                          size={18}
                          strokeWidth={3}
                        />
                      ) : (
                        <ArrowDownRight
                          className="text-rose-600"
                          size={18}
                          strokeWidth={3}
                        />
                      )}
                      <p
                        className={`
                        font-black text-lg tracking-tight
                        ${tx.type === 'income' ? 'text-emerald-700' : 'text-rose-700'}
                      `}
                      >
                        {tx.type === 'income' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </p>
                    </div>

                    {/* Badge "Non validé" */}
                    {!tx.is_posted && !tx.isposted && (
                      <div
                        className="
                        flex items-center gap-1 justify-end
                        bg-amber-100 
                        border border-amber-300
                        px-2 py-1 
                        rounded-md
                      "
                      >
                        <AlertCircle size={12} className="text-amber-700" />
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">
                          Non validé
                        </span>
                      </div>
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
