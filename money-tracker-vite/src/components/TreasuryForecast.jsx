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

  // 2. Compte Receivables (créances)
  const receivables = useMemo(() => {
    const receivablesAccount = accounts.find((a) => a.name === 'Receivables' || a.name === 'RECEIVABLES');
    return parseFloat(receivablesAccount?.balance || 0);
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
        return name !== 'coffre' && name !== 'receivables';
      })
      .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  }, [accounts]);

  // 📊 CALCULS DES 4 NIVEAUX DE SOLDES
  const solde1_Coffre = coffre;
  const solde2_CoffreReceivables = coffre + receivables;
  const solde3_CoffreReceivablesProjets = coffre + receivables + totalNetProfitDb;
  const solde4_Total = coffre + receivables + totalNetProfitDb + autresComptes;

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
    <section className="
      mt-6 rounded-xl border-2 border-slate-400 p-5 
      shadow-lg
      relative overflow-hidden
      bg-gradient-to-br from-slate-100 to-slate-200
    ">
      {/* Texture subtile (optionnel - peut être supprimé pour plus de sobriété) */}
      <div className="
        pointer-events-none absolute inset-0 opacity-[0.08]
        [background:repeating-linear-gradient(45deg,transparent_0px,transparent_2px,rgba(71,85,105,0.4)_2px,rgba(71,85,105,0.4)_4px)]
        mix-blend-overlay
      " />

      {/* Header avec icône et badge projets */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-slate-600 p-2 rounded-lg shadow-md">
            <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Prévisions Complètes
          </h3>
        </div>
        
        <span className="
          text-xs font-extrabold 
          text-emerald-900 bg-emerald-100 
          border-2 border-emerald-300 
          px-3 py-1.5 rounded-lg 
          shadow-sm
        ">
          {activeProjects.length} PROJET{activeProjects.length > 1 ? 'S' : ''} ACTIF{activeProjects.length > 1 ? 'S' : ''}
        </span>
      </div>

      {/* Grille 4 colonnes - Soldes progressifs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
        
        {/* 1️⃣ Solde Actuel (Coffre seul) */}
        <div className="
          bg-white/90 backdrop-blur-sm 
          rounded-xl p-4 
          border-2 border-slate-300 
          shadow-md hover:shadow-lg 
          transition-all
        ">
          <p className="text-[10px] text-slate-600 font-bold mb-1 uppercase tracking-widest">
            Solde Actuel
          </p>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">
            (Coffre)
          </p>
          <p className="text-xl font-black text-slate-900">
            {formatCurrency(solde1_Coffre)}
          </p>
        </div>

        {/* 2️⃣ Coffre + Receivables */}
        <div className="
          bg-gradient-to-br from-emerald-50 to-teal-50 
          backdrop-blur-sm 
          rounded-xl p-4 
          border-2 border-emerald-300 
          shadow-md hover:shadow-lg 
          transition-all
        ">
          <p className="text-[10px] text-emerald-700 font-bold mb-1 uppercase tracking-widest">
            + Créances
          </p>
          <p className="text-xs font-semibold text-emerald-600 mb-1.5">
            (Coffre + Receivables)
          </p>
          <p className="text-xl font-black text-emerald-900">
            {formatCurrency(solde2_CoffreReceivables)}
          </p>
        </div>

        {/* 3️⃣ Coffre + Receivables + Projets */}
        <div className="
          bg-gradient-to-br from-blue-50 to-indigo-50 
          backdrop-blur-sm 
          rounded-xl p-4 
          border-2 border-blue-300 
          shadow-md hover:shadow-lg 
          transition-all
        ">
          <p className="text-[10px] text-blue-700 font-bold mb-1 uppercase tracking-widest">
            + Projets
          </p>
          <p className="text-xs font-semibold text-blue-600 mb-1.5">
            (Coffre+Receivables+Projets)
          </p>
          <p className="text-xl font-black text-blue-900">
            {formatCurrency(solde3_CoffreReceivablesProjets)}
          </p>
        </div>

        {/* 4️⃣ Solde Total (Tous comptes) */}
        <div className="
          bg-gradient-to-br from-slate-700 to-slate-900 
          backdrop-blur-sm 
          rounded-xl p-4 
          border-2 border-slate-600 
          shadow-xl hover:shadow-2xl 
          transition-all
        ">
          <p className="text-[10px] text-slate-300 font-bold mb-1 uppercase tracking-widest">
            Solde Total
          </p>
          <p className="text-xs font-semibold text-slate-400 mb-1.5">
            (+ Autres Comptes)
          </p>
          <p className="text-2xl font-black text-white">
            {formatCurrency(solde4_Total)}
          </p>
        </div>
      </div>

      {/* Détails des composants (ligne compacte) */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs relative z-10">
        
        {/* Receivables */}
        <div className="
          bg-gradient-to-r from-pink-100 to-rose-100 
          backdrop-blur-sm 
          rounded-lg px-3 py-2 
          flex justify-between items-center
          border border-pink-200 
          shadow-sm
        ">
          <span className="text-slate-700 font-bold">+ Receivables:</span>
          <span className="font-black text-pink-700">
            {formatCurrency(receivables)}
          </span>
        </div>

        {/* Projets */}
        <div className="
          bg-gradient-to-r from-amber-100 to-yellow-100 
          backdrop-blur-sm 
          rounded-lg px-3 py-2 
          flex justify-between items-center
          border border-amber-200 
          shadow-sm
        ">
          <span className="text-slate-700 font-bold">+ Projets:</span>
          <span className={`font-black ${totalNetProfitDb >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {formatCurrency(totalNetProfitDb)}
          </span>
        </div>

        {/* Autres comptes */}
        <div className="
          bg-gradient-to-r from-cyan-100 to-blue-100 
          backdrop-blur-sm 
          rounded-lg px-3 py-2 
          flex justify-between items-center
          border border-cyan-200 
          shadow-sm
        ">
          <span className="text-slate-700 font-bold">+ Autres:</span>
          <span className="font-black text-cyan-700">
            {formatCurrency(autresComptes)}
          </span>
        </div>
      </div>

      {/* Flèche de progression visuelle */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-700 relative z-10">
        <span className="font-black text-slate-900 px-2 py-1 bg-white/60 rounded-md">
          {formatCurrency(solde1_Coffre)}
        </span>
        <ArrowRight className="w-4 h-4 text-slate-500" strokeWidth={3} />
        
        <span className="font-black text-emerald-800 px-2 py-1 bg-emerald-100/60 rounded-md">
          {formatCurrency(solde2_CoffreReceivables)}
        </span>
        <ArrowRight className="w-4 h-4 text-slate-500" strokeWidth={3} />
        
        <span className="font-black text-blue-800 px-2 py-1 bg-blue-100/60 rounded-md">
          {formatCurrency(solde3_CoffreReceivablesProjets)}
        </span>
        <ArrowRight className="w-4 h-4 text-slate-500" strokeWidth={3} />
        
        <span className="font-black text-white px-2 py-1 bg-slate-800 rounded-md shadow-md">
          {formatCurrency(solde4_Total)}
        </span>
      </div>
    </section>
  );
};

export default TreasuryForecast;
