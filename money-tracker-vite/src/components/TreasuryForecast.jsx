import React, { useMemo } from 'react';
import { TrendingUp, Wallet, DollarSign, Target, ArrowRight } from 'lucide-react';

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
      console.error('Erreur parsing JSON:', e);
      return [];
    }
  };

  // 1. Solde actuel total (TOUS les comptes)
  const currentBalance = useMemo(() => {
    if (!accounts || accounts.length === 0) return 0;
    return accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  }, [accounts]);

  // 2. Récupération du compte Avoir
  const avoir = useMemo(() => 
    accounts.find(a => a.name === 'Avoir' || a.name === 'AVOIR')?.balance || 0
  , [accounts]);

  // 3. Récupération du compte Coffre
  const coffre = useMemo(() => 
    accounts.find(a => a.name === 'Coffre' || a.name === 'COFFRE')?.balance || 0
  , [accounts]);

  // 4. Après Règlements (Avoir) - Le solde actuel inclut déjà l'avoir
  const afterSettlements = useMemo(() => {
    return currentBalance; // Déjà inclus l'avoir
  }, [currentBalance]);

  const coffreAfterSettlements = useMemo(() => {
    return parseFloat(coffre) + parseFloat(avoir);
  }, [coffre, avoir]);

  // 5. ✅ CALCULS PROJETS ACTIFS UNIQUEMENT
  const activeProjects = useMemo(() => {
    return projects.filter(p => {
      const status = (p.status || '').toLowerCase();
      return status === 'active' || status === 'actif' || status.startsWith('phase');
    });
  }, [projects]);

  // 6. ✅ Calcul du coût restant (EXCLURE "Déjà Payé" et "Futur")
  const remainingCostSum = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const expenses = parseJSONSafe(p.expenses);
      
      // ✅ Filtrer SEULEMENT les dépenses "Futur" et planifiées
      const futureExpenses = expenses.filter(e => 
        e.account !== 'Déjà Payé' && 
        e.account !== 'Payé' &&
        parseFloat(e.amount || 0) > 0
      );

      const occurrences = parseInt(p.occurrences_count || p.occurrencesCount || 1);
      const isRecurrent = p.type === 'recurrent';

      return sum + futureExpenses.reduce((s, e) => {
        const amount = parseFloat(e.amount || 0);
        const multiplier = (isRecurrent && e.isRecurring) ? occurrences : 1;
        return s + (amount * multiplier);
      }, 0);
    }, 0);
  }, [activeProjects]);

  // 7. ✅ Revenus totaux prévus
  const projectsTotalRevenues = useMemo(() => {
    return activeProjects.reduce((sum, p) => {
      const revenues = parseJSONSafe(p.revenues);
      const occurrences = parseInt(p.occurrences_count || p.occurrencesCount || 1);
      const isRecurrent = p.type === 'recurrent';

      return sum + revenues.reduce((s, r) => {
        const amount = parseFloat(r.amount || 0);
        const multiplier = (isRecurrent && r.isRecurring) ? occurrences : 1;
        return s + (amount * multiplier);
      }, 0);
    }, 0);
  }, [activeProjects]);

  // 8. ✅ Profit net prévu (depuis la DB)
  const totalNetProfitDb = useMemo(() => {
    return activeProjects
      .filter(p => p.name !== 'PLG FLPT - Campagne Pêche Complete') // Exclure si besoin
      .reduce((sum, p) => {
        const rawNet = p.net_profit ?? p.netProfit ?? 0;
        return sum + (Number(rawNet) || 0);
      }, 0);
  }, [activeProjects]);

  // 9. Impact net des projets (Revenus - Coûts restants)
  const projectsNetImpact = projectsTotalRevenues - remainingCostSum;

  // 10. Après Projets (Investissements)
  const afterProjects = useMemo(() => {
    return afterSettlements + totalNetProfitDb;
  }, [afterSettlements, totalNetProfitDb]);

  const coffreAfterProjects = useMemo(() => {
    return coffreAfterSettlements + totalNetProfitDb;
  }, [coffreAfterSettlements, totalNetProfitDb]);

  // Formatage
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' Ar';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-white" />
          <h3 className="text-xl font-bold text-white">Prévisions Complètes</h3>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Solde Actuel */}
        <div className="pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">SOLDE ACTUEL</span>
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold text-gray-800">
                {formatCurrency(currentBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* APRÈS RÈGLEMENTS (Avoir) */}
        <div className="space-y-3 pb-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-semibold text-gray-700 uppercase">
                Après Règlements
              </span>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
              +{formatCurrency(avoir)}
            </span>
          </div>

          {/* Coffre + Avoir */}
          <div className="flex items-center justify-between pl-4">
            <span className="text-sm text-gray-600">COFFRE (+ AVOIR)</span>
            <span className="text-lg font-semibold text-gray-800">
              {formatCurrency(coffreAfterSettlements)}
            </span>
          </div>

          {/* Total tous comptes */}
          <div className="flex items-center justify-between pl-4 bg-blue-50 rounded-lg p-3">
            <span className="text-sm font-medium text-blue-900">
              TOTAL (TOUS LES COMPTES)
            </span>
            <span className="text-2xl font-bold text-blue-600">
              {formatCurrency(afterSettlements)}
            </span>
          </div>
        </div>

        {/* APRÈS PROJETS (Investissements) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-sm font-semibold text-gray-700 uppercase">
                Après Projets (Invest.)
              </span>
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
              {totalNetProfitDb >= 0 ? '+' : ''}{formatCurrency(totalNetProfitDb)}
            </span>
          </div>

          {/* Coffre + Avoir + Projets */}
          <div className="flex items-center justify-between pl-4">
            <span className="text-sm text-gray-600">
              COFFRE (+ AVOIR + PROJETS)
            </span>
            <span className="text-lg font-semibold text-gray-800">
              {formatCurrency(coffreAfterProjects)}
            </span>
          </div>

          {/* Total final */}
          <div className="flex items-center justify-between pl-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 mb-4">
            <span className="text-sm font-medium text-purple-900">
              TOTAL FINAL (TOUS LES COMPTES)
            </span>
            <span className="text-3xl font-bold text-purple-600">
              {formatCurrency(afterProjects)}
            </span>
          </div>

          {/* Badge résultats prévisionnels */}
          <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-700">
                {activeProjects.length} projet{activeProjects.length > 1 ? 's' : ''} actif{activeProjects.length > 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-sm font-bold text-yellow-700">
              Profit Net Prévu: {formatCurrency(totalNetProfitDb)}
            </span>
          </div>

          {/* Détail des projets */}
          {activeProjects.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Détail par projet
              </h4>
              {activeProjects.map(project => {
                const netProfit = Number(project.net_profit || project.netProfit || 0);
                
                return (
                  <div 
                    key={project.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {project.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {project.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${
                        netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Flèche progression */}
          <div className="mt-6 flex items-center justify-center gap-4 text-gray-400">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="text-sm font-medium">{formatCurrency(currentBalance)}</span>
              <ArrowRight className="w-4 h-4" />
              <span className="text-sm font-medium text-blue-600">{formatCurrency(afterSettlements)}</span>
              <ArrowRight className="w-4 h-4" />
              <span className="text-sm font-medium text-purple-600">{formatCurrency(afterProjects)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreasuryForecast;
