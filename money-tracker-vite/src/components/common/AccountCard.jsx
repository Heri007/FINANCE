import { Trash2 } from 'lucide-react';
import { accountIcons } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

export function AccountCard({ account, onDelete, onClick }) {
  const IconComponent = accountIcons[account.type] || accountIcons.cash;

  const typeStyles = {
    cash: {
      gradient: 'from-purple-50 via-indigo-50 to-purple-100',
      border: 'border-purple-200',
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      shadow: 'rgba(139, 92, 246, 0.2)',
      accentLine: 'from-purple-400/30 via-indigo-400/40 to-purple-400/30'
    },
    mobile: {
      gradient: 'from-blue-50 via-cyan-50 to-blue-100',
      border: 'border-blue-200',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      shadow: 'rgba(59, 130, 246, 0.2)',
      accentLine: 'from-blue-400/30 via-cyan-400/40 to-blue-400/30'
    },
    bank: {
      gradient: 'from-green-50 via-emerald-50 to-green-100',
      border: 'border-green-200',
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      shadow: 'rgba(34, 197, 94, 0.2)',
      accentLine: 'from-green-400/30 via-emerald-400/40 to-green-400/30'
    },
    digital: {
      gradient: 'from-pink-50 via-rose-50 to-pink-100',
      border: 'border-pink-200',
      iconBg: 'bg-pink-100',
      iconColor: 'text-pink-600',
      shadow: 'rgba(236, 72, 153, 0.2)',
      accentLine: 'from-pink-400/30 via-rose-400/40 to-pink-400/30'
    },
    credit: {
      gradient: 'from-orange-50 via-amber-50 to-orange-100',
      border: 'border-orange-200',
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      shadow: 'rgba(249, 115, 22, 0.2)',
      accentLine: 'from-orange-400/30 via-amber-400/40 to-orange-400/30'
    }
  };

  const accountType = (account.type || 'cash').toLowerCase();
  const style = typeStyles[accountType] || typeStyles.cash;

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl p-4 shadow-md hover:shadow-lg hover:scale-[1.01] transition-all duration-300 cursor-pointer group bg-gradient-to-br ${style.gradient} border ${style.border}`}
      style={{
        boxShadow: `0 4px 12px ${style.shadow}`
      }}
    >
      {/* Overlay brillant */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/30 via-white/10 to-transparent opacity-40"></div>
      
      {/* Ligne décorative */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${style.accentLine}`}></div>
      
      {/* Badge type de compte */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all">
        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-lg ${style.iconBg} ${style.iconColor} border border-opacity-50 ${style.border}`}>
          {account.type}
        </span>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-1">
            {/* Icône compacte */}
            <div className={`p-2.5 ${style.iconBg} backdrop-blur-sm rounded-lg border ${style.border} group-hover:scale-105 transition-all duration-300`}>
              <IconComponent className={style.iconColor} size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm mb-0.5 truncate">{account.name}</h3>
              <p className="text-xs text-gray-500 capitalize font-medium">{account.type}</p>
            </div>
          </div>
          
          {/* Bouton supprimer compact */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer le compte "${account.name}" ?`)) {
                onDelete(account.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 transition-all text-red-500 hover:bg-red-50 hover:text-red-700 p-1.5 rounded-lg border border-transparent hover:border-red-200 flex-shrink-0 ml-1"
          >
            <Trash2 size={16} />
          </button>
        </div>
        
        {/* Section solde compacte */}
        <div className="pt-2.5 border-t border-gray-200/30">
          <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">Solde</p>
          <p className={`text-xl font-extrabold ${
            account.balance >= 0 
              ? 'text-emerald-700' 
              : 'text-red-600'
          }`}>
            {formatCurrency(account.balance)}
          </p>
        </div>
      </div>

      {/* Indicateur visuel subtle */}
      <div className={`absolute -bottom-12 -right-12 w-24 h-24 rounded-full ${style.iconBg} opacity-0 group-hover:opacity-10 transition-all duration-500 blur-xl`}></div>
    </div>
  );
}
