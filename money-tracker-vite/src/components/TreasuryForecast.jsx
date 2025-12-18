import React, { useMemo } from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';

const TreasuryForecast = ({ accounts = [], projects = [] }) => {
  // ✅ Parser JSON de façon sécurisée
  const parseJSONSafe = (data) => {
    if (!data || data === null || data === undefined || data === 'null') return [];
    try {
      if (typeof data === 'string') {
        if (data.trim() === '[]' || data.trim() === '') return [];
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
      if (typeof data === 'object') {
        if (Array.isArray(data)) return data;
        return [data];
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  // 1. Compte Coffre uniquement
  const coffre = useMemo(() => {
    const coffreAccount = accounts.find((a) => a.name === 'Coffre' || a.name === 'COFFRE');
    return parseFloat(coffreAccount?.balance || 0);
  }, [accounts]);

  // 2. Compte Avoir (créances)
  const avoir = useMemo(() => {
    const avoirAccount = accounts.find((a) => a.name === 'Avoir' || a.name === 'AVOIR');
    return parseFloat(avoirAccount?.balance || 0);
  }, [accounts]);

  // 3. Projets actifs uniquement
  const activeProjects = useMemo(() => {
    return projects.filter((p) => {
      const status = (p.status || '').toLowerCase();
      return status === 'active' || status === 'actif' || status.startsWith('phase');
    });
  }, [projects]);

  // 4. Profit net prévu (DB)
  const totalNetProfitDb = useMemo(() => {
    return activeProjects
      .filter((p) => p.name !== 'PLG FLPT - Campagne Pêche Complete')
      .reduce((sum, p) => {
        const rawNet = p.net_profit ?? p.netProfit ?? 0;
        return sum + (Number(rawNet) || 0);
      }, 0);
  }, [activeProjects]);

  // 5. Tous les autres comptes (MVola, Orange Money, Redotpay, BOA, Argent Liquide)
  const autresComptes = useMemo(() => {
    return accounts
      .filter((a) => {
        const name = (a.name || '').toLowerCase();
        return name !== 'coffre' && name !== 'avoir';
      })
      .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  }, [accounts]);

  // 📊 CALCULS DES 4 NIVEAUX DE SOLDES
  const solde1_Coffre = coffre;
  const solde2_CoffreAvoir = coffre + avoir;
  const solde3_CoffreAvoirProjets = coffre + avoir + totalNetProfitDb;
  const solde4_Total = coffre + avoir + totalNetProfitDb + autresComptes;

  // Formatage
  const formatCurrency = (value) => {
    return (
      new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value) + ' Ar'
    );
  };

  return (
    <section
      className="
  mt-6 rounded-xl border-2 border-[#2c2c2c] p-4 
  shadow-[0_10px_30px_-10px_rgba(218,165,32,0.6)]
  relative overflow-hidden
  bg-[#f7eae5]
"
>
  {/* Texture métal brossé subtile */}
  <div
    className="
      pointer-events-none absolute inset-0 opacity-[0.15]
      [background:repeating-linear-gradient(115deg,transparent_0px,transparent_2px,rgba(101,67,33,0.3)_2px,rgba(101,67,33,0.3)_4px)]
      mix-blend-overlay
    "
  />

      {/* Header compact avec effet métallisé */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <div className="bg-slate-400/80 p-1.5 rounded-lg shadow-inner">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide drop-shadow-sm">
            Prévisions Complètes
          </h3>
        </div>
        
        {/* ✅ MODIFICATION ICI : Style rectangle vert discret et font-extrabold */}
        <span className="text-xs font-extrabold text-green-900 bg-green-100/90 border border-green-200/60 px-3 py-1.5 rounded-md shadow-sm backdrop-blur-sm">
          {activeProjects.length} PROJET{activeProjects.length > 1 ? 'S' : ''} ACTIF{activeProjects.length > 1 ? 'S' : ''}
        </span>
      </div>

      {/* Grille compacte 4 colonnes avec effet verre sur métal */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative">
        {/* 1. Solde Actuel (Coffre) */}
        <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-slate-300 shadow-md">
          <p className="text-xs text-slate-600 font-bold mb-1">SOLDE ACTUEL</p>
          <p className="text-sm font-medium text-red-500 mb-0.5">(Coffre)</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(solde1_Coffre)}</p>
        </div>

        {/* 2. Coffre + Avoir */}
        <div className="bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-green-200 shadow-md">
          <p className="text-xs text-slate-600 font-bold mb-1">+ CREANCES</p>
          <p className="text-sm font-medium text-red-500 mb-0.5">(Coffre + Avoir)</p>
          <p className="text-lg font-bold text-green-800">{formatCurrency(solde2_CoffreAvoir)}</p>
        </div>

        {/* 3. Coffre + Avoir + Projets */}
        <div className="bg-gradient-to-br from-purple-100/80 to-pink-100/80 backdrop-blur-sm rounded-lg p-3 border border-purple-300 shadow-md">
          <p className="text-xs text-slate-600 font-bold mb-1">+ PROJETS</p>
          <p className="text-sm font-medium text-red-500 mb-0.5">(Coffre+Avoir+Projets)</p>
          <p className="text-lg font-bold text-purple-800">{formatCurrency(solde3_CoffreAvoirProjets)}</p>
        </div>

        {/* 4. Solde Total (Tous les comptes) */}
        <div className="bg-gradient-to-br from-indigo-100/80 to-blue-100/80 backdrop-blur-sm rounded-lg p-3 border-2 border-indigo-400 shadow-lg">
          <p className="text-xs text-indigo-700 font-bold mb-1">SOLDE TOTAL</p>
          <p className="text-sm font-medium text-red-500 mb-0.5">(+ Autres Comptes)</p>
          <p className="text-xl font-bold text-indigo-900">{formatCurrency(solde4_Total)}</p>
        </div>
      </div>

      {/* Détails des ajouts avec effet verre */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs relative">
        <div className="bg-red-50 backdrop-blur-sm rounded px-2 py-1 flex justify-between border border-slate-200">
          <span className="text-slate-700 font-bold">+ Avoir:</span>
          <span className="font-bold text-green-700">{formatCurrency(avoir)}</span>
        </div>
        <div className="bg-yellow-50 backdrop-blur-sm rounded px-2 py-1 flex justify-between border border-slate-200">
          <span className="text-slate-700 font-bold">+ Projets:</span>
          <span className={`font-bold ${totalNetProfitDb >= 0 ? 'text-purple-700' : 'text-red-700'}`}>
            {formatCurrency(totalNetProfitDb)}
          </span>
        </div>
        <div className="bg-blue-200 backdrop-blur-sm rounded px-2 py-1 flex justify-between border border-slate-200">
          <span className="text-slate-700 font-bold">+ Autres:</span>
          <span className="font-bold text-blue-700">{formatCurrency(autresComptes)}</span>
        </div>
      </div>

      {/* Flèche de progression */}
      <div className="mt-3 flex items-center justify-center gap-2 text-large text-slate-700 relative">
        <span className="font-extrabold text-slate-900">{formatCurrency(solde1_Coffre)}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-extrabold text-green-800">{formatCurrency(solde2_CoffreAvoir)}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-extrabold text-purple-800">{formatCurrency(solde3_CoffreAvoirProjets)}</span>
        <ArrowRight className="w-3 h-3" />
        <span className="font-extrabold text-red-400">{formatCurrency(solde4_Total)}</span>
      </div>
    </section>
  );
};

export default TreasuryForecast;