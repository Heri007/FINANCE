import { Trash2 } from 'lucide-react';
import { accountIcons } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

export function AccountCard({ account, onDelete, onClick }) {
  const IconComponent = accountIcons[account.type] || accountIcons.cash;

  // Définition des couleurs par type de compte
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

  // Récupération du style selon le type (normalisé en minuscules)
  const accountType = (account.type || 'cash').toLowerCase();
  const style = typeStyles[accountType] || typeStyles.cash;

  return (
    <div 
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl p-6 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group bg-gradient-to-br ${style.gradient} border-2 ${style.border}`}
      style={{
        boxShadow: `0 10px 40px ${style.shadow}`
      }}
    >
      {/* Overlay brillant */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-white/20 to-transparent opacity-60"></div>
      
      {/* Ligne décorative animée */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.accentLine}`}></div>
      
      {/* Badge type de compte (en haut à droite) */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
        <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${style.iconBg} ${style.iconColor} border ${style.border}`}>
          {account.type}
        </span>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* Icône avec taille augmentée */}
            <div className={`p-4 ${style.iconBg} backdrop-blur-sm rounded-xl border-2 ${style.border} group-hover:scale-110 transition-all duration-300 shadow-md`}>
              <IconComponent className={style.iconColor} size={28} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-xl mb-0.5">{account.name}</h3>
              <p className="text-xs text-gray-500 capitalize font-semibold tracking-wide">{account.type}</p>
            </div>
          </div>
          
          {/* Bouton supprimer */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer le compte "${account.name}" ?`)) {
                onDelete(account.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 transition-all text-red-500 hover:bg-red-50 hover:text-red-700 p-2.5 rounded-xl border-2 border-transparent hover:border-red-200 shadow-sm"
          >
            <Trash2 size={18} />
          </button>
        </div>
        
        {/* Section solde */}
        <div className="pt-4 border-t-2 border-gray-200/40">
          <p className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">Solde Actuel</p>
          <p className={`text-3xl font-extrabold ${
            account.balance >= 0 
              ? 'text-emerald-700' 
              : 'text-red-600'
          }`}>
            {formatCurrency(account.balance)}
          </p>
        </div>
      </div>

      {/* Indicateur visuel de hover (coin bas droit) */}
      <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full ${style.iconBg} opacity-0 group-hover:opacity-20 transition-all duration-500 blur-2xl`}></div>
    </div>
  );
}
