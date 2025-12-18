import { Trash2 } from 'lucide-react';
import { accountIcons } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatters';

export function AccountCard({ account, onDelete, onClick }) {
  const IconComponent = accountIcons[account.type] || accountIcons.cash;

  // 🎨 Palette de 7 couleurs dans l'ordre
  const colorPalette = [
    {
      name: 'magenta',
      gradient: 'from-[#85005B] to-[#a0006e]',
      border: 'border-[#85005B]',
      iconBg: 'bg-[#85005B]/10',
      iconColor: 'text-[#85005B]',
      textColor: 'text-white',
      shadow: 'rgba(133, 0, 91, 0.3)',
      accentLine: 'from-[#85005B] via-[#a0006e] to-[#85005B]'
    },
    {
      name: 'blue',
      gradient: 'from-[#2091D7] to-[#1a7ab8]',
      border: 'border-[#2091D7]',
      iconBg: 'bg-[#2091D7]/10',
      iconColor: 'text-[#2091D7]',
      textColor: 'text-white',
      shadow: 'rgba(32, 145, 215, 0.3)',
      accentLine: 'from-[#2091D7] via-[#30a1e7] to-[#2091D7]'
    },
    {
      name: 'green',
      gradient: 'from-[#6D9C6D] to-[#5a8a5a]',
      border: 'border-[#6D9C6D]',
      iconBg: 'bg-[#6D9C6D]/10',
      iconColor: 'text-[#6D9C6D]',
      textColor: 'text-white',
      shadow: 'rgba(109, 156, 109, 0.3)',
      accentLine: 'from-[#6D9C6D] via-[#7aaa7a] to-[#6D9C6D]'
    },
    {
      name: 'lavender',
      gradient: 'from-[#D0B3CC] to-[#c4a3bf]',
      border: 'border-[#D0B3CC]',
      iconBg: 'bg-[#D0B3CC]/20',
      iconColor: 'text-[#85005B]',
      textColor: 'text-slate-900',
      shadow: 'rgba(208, 179, 204, 0.3)',
      accentLine: 'from-[#D0B3CC] via-[#dcc3d9] to-[#D0B3CC]'
    },
    {
      name: 'taupe',
      gradient: 'from-[#9A8D8A] to-[#8a7d7a]',
      border: 'border-[#9A8D8A]',
      iconBg: 'bg-[#9A8D8A]/10',
      iconColor: 'text-[#9A8D8A]',
      textColor: 'text-white',
      shadow: 'rgba(154, 141, 138, 0.3)',
      accentLine: 'from-[#9A8D8A] via-[#aa9d9a] to-[#9A8D8A]'
    },
    {
      name: 'bluegray',
      gradient: 'from-[#807D9E] to-[#6f6c8d]',
      border: 'border-[#807D9E]',
      iconBg: 'bg-[#807D9E]/10',
      iconColor: 'text-[#807D9E]',
      textColor: 'text-white',
      shadow: 'rgba(128, 125, 158, 0.3)',
      accentLine: 'from-[#807D9E] via-[#908dae] to-[#807D9E]'
    },
    {
      name: 'gold',
      gradient: 'from-[#C09858] to-[#b08748]',
      border: 'border-[#C09858]',
      iconBg: 'bg-[#C09858]/10',
      iconColor: 'text-[#C09858]',
      textColor: 'text-white',
      shadow: 'rgba(192, 152, 88, 0.3)',
      accentLine: 'from-[#C09858] via-[#d0a868] to-[#C09858]'
    }
  ];

  // 🎯 Attribution selon le NOM du compte (mapping explicite)
  const accountColorMap = {
    'Coffre': 0,           // Magenta
    'COFFRE': 0,
    'MVola': 1,            // Bleu
    'MVOLA': 1,
    'Orange Money': 2,     // Vert
    'ORANGE MONEY': 2,
    'Redotpay': 3,         // Lavande
    'REDOTPAY': 3,
    'Compte BOA': 4,       // Taupe
    'BOA': 4,
    'Receivables': 5,      // Bleu-gris
    'RECEIVABLES': 5,
    'Argent Liquide': 6,   // Or
    'ARGENT LIQUIDE': 6
  };

  // Récupérer l'index de couleur selon le nom du compte
  const colorIndex = accountColorMap[account.name] ?? 0;
  const style = colorPalette[colorIndex];

  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-lg p-3
        shadow-md hover:shadow-xl hover:scale-[1.02] 
        transition-all duration-300 cursor-pointer group 
        bg-gradient-to-br ${style.gradient} 
        border-2 ${style.border}
      `}
      style={{
        boxShadow: `0 4px 12px ${style.shadow}`
      }}
    >
      {/* Overlay brillant */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-white/5 to-transparent"></div>
      
      {/* Ligne accent top */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${style.accentLine} opacity-60`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          {/* Icône + Nom */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`p-1.5 ${style.iconBg} backdrop-blur-sm rounded-lg border ${style.border} flex-shrink-0`}>
              <IconComponent className={style.iconColor} size={16} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-lg truncate leading-tight ${style.textColor}`}>
                {account.name}
              </h3>
              <p className={`text-[9px] uppercase tracking-wider font-semibold ${style.textColor} opacity-70`}>
                {account.type}
              </p>
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
            className="opacity-0 group-hover:opacity-100 transition-all text-white hover:bg-white/20 p-1 rounded flex-shrink-0 ml-1"
          >
            <Trash2 size={12} strokeWidth={2.5} />
          </button>
        </div>
        
        {/* Solde */}
        <div className="pt-2 border-t border-white/20">
          <div className="flex items-baseline justify-between">
            <span className={`text-[10px] uppercase tracking-widest font-bold ${style.textColor} opacity-60`}>
              Solde
            </span>
            <p className={`text-xl font-black leading-none ${
              account.balance >= 0 
                ? style.textColor
                : 'text-red-300'
            }`}>
              {formatCurrency(account.balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Glow effect au hover */}
      <div className="absolute -bottom-12 -right-12 w-24 h-24 rounded-full bg-white/10 opacity-0 group-hover:opacity-20 transition-all duration-500 blur-2xl"></div>
    </div>
  );
}
