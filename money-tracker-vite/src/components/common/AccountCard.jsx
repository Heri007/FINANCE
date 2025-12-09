import { Trash2 } from 'lucide-react';
import { accountIcons } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

export function AccountCard({ account, onDelete, onClick }) {
  const IconComponent = accountIcons[account.type] || accountIcons.cash;

  return (
    <div 
      onClick={onClick}
      className="relative overflow-hidden rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
      style={{
        background: 'linear-gradient(135deg, #f6fbf2 1%, #f6fbf2 1%)',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)'
      }}
    >
      {/* Overlay brillant */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/5 to-transparent"></div>
      
      {/* Ligne décorative */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent"></div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 backdrop-blur-sm rounded-xl border border-indigo-200/50 group-hover:bg-indigo-100 transition-all">
              <IconComponent className="text-indigo-600" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{account.name}</h3>
              <p className="text-sm text-gray-600 capitalize font-medium">{account.type}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Supprimer le compte "${account.name}" ?`)) {
                onDelete(account.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 transition-all text-red-500 hover:bg-red-50 hover:text-red-600 p-2 rounded-lg"
          >
            <Trash2 size={18} />
          </button>
        </div>
        <div className="pt-4 border-t border-gray-200/50">
          <p className="text-sm text-gray-600 mb-1 font-medium">Solde</p>
          <p className="text-2xl font-extrabold text-gray-900">
            {formatCurrency(account.balance)}
          </p>
        </div>
      </div>
    </div>
  );
}
