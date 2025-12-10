// ProjectPlannerModal.jsx - Version complète avec Bois + PLG 3 phases
import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  Repeat,
  Save,
  Download,
  Flame,
  Anchor,
  AlertCircle,
  CheckCircle,
  Copy,
} from 'lucide-react';
import { formatCurrency } from './utils/formatters';
import { projectsService } from './services/projectsService';
import { CalculatorInput } from './components/common/CalculatorInput';
import { transactionsService } from './services/transactionsService';
import { normalizeDate } from './utils/transactionUtils';


export function ProjectPlannerModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved = null,
  onProjectUpdated = null,
  existingTransactions = []
}) {
  // --- ÉTATS DU FORMULAIRE ---
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectType, setProjectType] = useState('ponctuel');
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [occurrencesCount, setOccurrencesCount] = useState(12);

  const [expenses, setExpenses] = useState([
    { category: '', amount: 0, account: '', isRecurring: false, description: '' },
  ]);

  const [revenues, setRevenues] = useState([
    { description: '', amount: 0, date: '', account: '', isRecurring: false, volume: 0 },
  ]);

  // Phases (pour PLG seulement, sans impacter Bois)
  const [currentPhase, setCurrentPhase] = useState('investissement');
  const phases = ['investissement', 'logistique', 'ventes'];

  const phaseLabels = {
    investissement: 'Investissement (Payé)',
    logistique: 'Logistique Future',
    ventes: 'Ventes Prévisionnelles',
  };

  // --- CHARGEMENT INITIAL (édition projet) ---
  useEffect(() => {
    if (project && project.id) {
      setProjectName(project.name || '');
      setProjectDescription(project.description || '');
      setProjectType(project.type || 'ponctuel');
      setStartDate(
        project.startDate ||
          project.start_date ||
          new Date().toISOString().split('T')[0]
      );
      setEndDate(project.endDate || project.end_date || '');
      setFrequency(project.frequency || 'weekly');
      setOccurrencesCount(
        project.occurrencesCount || project.occurrences_count || 12
      );

      const parseData = (data) => {
        if (!data) return [];
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        }
        if (Array.isArray(data)) return data;
        return [];
      };

      const loadedExpenses = parseData(project.expenses);
      const loadedRevenues = parseData(project.revenues);

      setExpenses(
        loadedExpenses.length > 0
          ? loadedExpenses
          : [{ category: '', amount: 0, account: '', description: '' }]
      );
      setRevenues(
        loadedRevenues.length > 0
          ? loadedRevenues
          : [{ description: '', amount: 0, account: '', volume: 0 }]
      );
    } else {
      // Nouveau projet : reset simple
      setProjectName('');
      setProjectDescription('');
      setProjectType('ponctuel');
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setFrequency('weekly');
      setOccurrencesCount(12);
      setExpenses([
        { category: '', amount: 0, account: '', isRecurring: false, description: '' },
      ]);
      setRevenues([
        { description: '', amount: 0, date: '', account: '', isRecurring: false, volume: 0 },
      ]);
      setCurrentPhase('investissement');
    }
  }, [project]);

  // --- CALCULS GLOBAUX (Basés UNIQUEMENT sur le COFFRE) ---
const totalAvailable = useMemo(() => {
  // On cherche le compte "Coffre" par nom (insensible à la casse) ou par ID si connu (5)
  const coffreAccount = accounts.find(acc => 
    (acc.name && acc.name.toLowerCase().includes('coffre')) || acc.id === 5
  );
  
  return coffreAccount ? parseFloat(coffreAccount.balance || 0) : 0;
}, [accounts]);


  const totalProjectCost = useMemo(() => {
    return expenses.reduce((sum, exp) => {
      const multiplier =
        projectType === 'recurrent' && exp.isRecurring
          ? occurrencesCount
          : 1;
      return sum + (parseFloat(exp.amount || 0) * multiplier);
    }, 0);
  }, [expenses, occurrencesCount, projectType]);

  const totalRevenues = useMemo(() => {
    return revenues.reduce((sum, rev) => {
      const multiplier =
        projectType === 'recurrent' && rev.isRecurring
          ? occurrencesCount
          : 1;
      return sum + (parseFloat(rev.amount || 0) * multiplier);
    }, 0);
  }, [revenues, occurrencesCount, projectType]);

  const netProfit = totalRevenues - totalProjectCost;
  const roi =
    totalProjectCost > 0 ? (netProfit / totalProjectCost) * 100 : 0;
  const remainingBudget = totalAvailable - totalProjectCost;
  const isFeasible = remainingBudget >= 0;

  // --- GESTION LIGNES DÉPENSES ---
  const addExpense = () =>
    setExpenses([
      ...expenses,
      {
        category: '',
        amount: 0,
        account: '',
        isRecurring: false,
        description: '',
      },
    ]);

  const duplicateExpense = (index) =>
    setExpenses([...expenses, { ...expenses[index] }]);

  const removeExpense = (index) =>
    setExpenses(expenses.filter((_, i) => i !== index));

  const updateExpense = (index, field, value) => {
    const updated = [...expenses];
    updated[index][field] = value;
    setExpenses(updated);
  };

  const finalTotalIfCompleted = totalAvailable + (totalRevenues - totalProjectCost);

  // --- GESTION LIGNES REVENUS ---
  const addRevenue = () =>
    setRevenues([
      ...revenues,
      {
        description: '',
        amount: 0,
        date: '',
        account: '',
        isRecurring: false,
        volume: 0,
      },
    ]);

  const removeRevenue = (index) =>
    setRevenues(revenues.filter((_, i) => i !== index));

  const updateRevenue = (index, field, value) => {
    const updated = [...revenues];
    updated[index][field] = value;
    setRevenues(updated);
  };

  const handleEncaisser = async (rev, index) => {
  try {
    if (!rev.account) {
      alert('Choisis un compte pour encaisser ce revenu');
      return;
    }

    const confirmMsg = `Encaisser maintenant ${rev.amount} Ar sur le compte "${rev.account}" ?`;
    if (!window.confirm(confirmMsg)) return;

    const accountObj = accounts.find(a => a.name === rev.account);
    if (!accountObj) {
      alert('Compte introuvable pour ce revenu');
      return;
    }

    const txPayload = {
      type: 'income',
      amount: parseFloat(rev.amount || 0),
      category: 'PLG FLPT - Revenus',
      description: rev.description || `Encaissement projet ${projectName}`,
      date: normalizeDate(rev.date) || new Date().toISOString().split('T')[0],
      accountId: accountObj.id,
      projectId: project?.id ?? null,
      is_posted: true, // ✅ AJOUTER CETTE LIGNE
      is_planned: false // ✅ ET CELLE-CI POUR ÊTRE SÛR
    };

    await transactionsService.createTransaction(txPayload);

    const updated = [...revenues];
    updated[index] = { ...updated[index], isPaid: true };
    setRevenues(updated);

    if (onProjectUpdated) onProjectUpdated(project?.id);
    alert('Revenu encaissé avec succès.');
  } catch (error) {
    console.error('Erreur encaissement:', error);
    alert('Erreur lors de l’encaissement: ' + (error.message || ''));
  }
};

  const handlePayerDepense = async (exp, index) => {
  try {
    if (!exp.account) {
      alert('Choisis un compte pour cette dépense');
      return;
    }

    const confirmMsg = `Payer maintenant ${exp.amount} Ar depuis le compte "${exp.account}" ?`;
    if (!window.confirm(confirmMsg)) return;

    const accountObj = accounts.find(a => a.name === exp.account);
if (!accountObj) {
  alert('Compte introuvable pour cette dépense');
  return;
}

const txPayload = {
  type: 'expense',
  amount: parseFloat(exp.amount || 0),
  category: exp.category || 'Autres',
  description: exp.description || `Dépense projet ${projectName}`,
  date: new Date().toISOString().split('T')[0],
  accountId: accountObj.id,
  projectId: project?.id ?? null,
  is_posted: true, // ✅ AJOUTER CETTE LIGNE
  is_planned: false // ✅ ET CELLE-CI POUR ÊTRE SÛR
};

console.log('📤 TX PAYLOAD DEPENSE:', txPayload);
await transactionsService.createTransaction(txPayload);

    const updated = [...expenses];
    updated[index] = { ...updated[index], isPaid: true };
    setExpenses(updated);

    if (onProjectUpdated) onProjectUpdated(project?.id);
    alert('Dépense enregistrée comme payée.');
  } catch (error) {
    console.error('Erreur paiement dépense:', error);
    alert('Erreur lors de l’enregistrement de la dépense: ' + (error.message || ''));
  }
};


  // 👇 ICI, DANS LE CORPS DU COMPOSANT
  const loadPLGFromJson = async () => {
    try {
      const res = await fetch('/plg/PLG-FLPT-expenses.json', {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error('Impossible de charger le JSON PLG');
      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert('JSON PLG vide ou invalide');
        return;
      }

      setProjectName('PLG FLPT - Campagne Pêche Complete');
      setProjectDescription(
        'Investissements déjà réalisés + logistique future + ventes prévues.'
      );
      setProjectType('ponctuel');
      setFrequency('weekly');
      setOccurrencesCount(1);
      setCurrentPhase('logistique');

      setExpenses(data);

      setRevenues([
        { description: 'Concombres Mer Total', amount: 15000000, phase: 'ventes' },
        { description: 'Poissons Total', amount: 25000000, phase: 'ventes' },
      ]);
    } catch (err) {
      console.error('Erreur chargement JSON PLG:', err);
      alert('Erreur chargement JSON PLG: ' + err.message);
    }
  };

  // --- TEMPLATE ACHAT / REVENTE PRODUIT ---
  const loadProductFlipTemplate = () => {
    if (!window.confirm('Remplacer les données actuelles ?')) return;

    setProjectName('Flip Voiture / Marchandises');
    setProjectDescription(
      "Projet d'achat puis revente d'un produit (voiture, marchandises...) avec calcul du bénéfice."
    );
    setProjectType('ponctuel');
    setFrequency('weekly');
    setOccurrencesCount(1);

    // Exemple générique : à adapter selon ton cas réel
    setExpenses([
      {
        category: 'Achat Produit',
        amount: 15000000,
        account: 'Coffre',
        isRecurring: false,
        description: 'Prix d’achat du produit',
      },
      {
        category: 'Frais Annexes',
        amount: 500000,
        account: '',
        isRecurring: false,
        description: 'Frais de dossier / carte grise / transport',
      },
    ]);

    setRevenues([
      {
        description: 'Revente du produit',
        amount: 19000000,
        date: '',
        account: '',
        isRecurring: false,
        volume: 1,
      },
    ]);
  };

  // --- TEMPLATE BOIS (inchangé) ---
  const loadFirewoodTemplate = () => {
    if (!window.confirm('Remplacer les données actuelles ?')) return;

    setProjectName('Business Bois de Chauffage');
    setProjectDescription(
      'Ventes hebdomadaires de bois de chauffage avec stock initial.'
    );
    setProjectType('recurrent');
    setFrequency('weekly');
    setOccurrencesCount(12);

    setExpenses([
      {
        category: 'Stock',
        amount: 10000000,
        account: 'Coffre',
        isRecurring: false,
        description: 'Achat Stock Initial',
      },
      {
        category: 'Logistique',
        amount: 105000,
        account: '',
        isRecurring: true,
        description: 'Manutention',
      },
      {
        category: 'Carburant',
        amount: 50000,
        account: '',
        isRecurring: true,
        description: 'Gasoil',
      },
      {
        category: "Main d'œuvre",
        amount: 30000,
        account: '',
        isRecurring: true,
        description: 'Chargement',
      },
    ]);

    setRevenues([
      {
        description: 'Vente bois 30 m³',
        amount: 1800000,
        isRecurring: true,
        volume: 30,
      },
    ]);
  };

  // --- IMPORT DES TRANSACTIONS EXISTANTES (PLG déjà payées) ---
  const importExistingTransactions = () => {
    const txs =
      existingTransactions.length > 0
        ? existingTransactions
        : [
            {
              description: '@DELAH',
              amount: 72000,
              category: 'PLG FLPT',
              date: '2025-11-13',
            },
            {
              description: 'Frais M/va -> T/ve @DELAH @ZOKINY',
              amount: 143600,
              category: 'PLG FLPT',
              date: '2025-11-24',
            },
            {
              description: '@TSIKIVY @DELAH',
              amount: 178600,
              category: 'PLG FLPT',
              date: '2025-11-29',
            },
            {
              description: '@DELAH',
              amount: 2150,
              category: 'PLG FLPT',
              date: '2025-12-01',
            },
            {
              description: 'DEPART @DELAH',
              amount: 608200,
              category: 'PLG FLPT',
              date: '2025-12-02',
            },
          ];

    const newExpenses = txs.map((tx) => ({
      category: 'Dépense Réelle',
      description: `${tx.description} (${tx.date})`,
      amount: parseFloat(tx.amount),
      account: 'Déjà Payé',
      isRecurring: false,
      phase: 'investissement',
    }));

    setExpenses((prev) => [...prev, ...newExpenses]);
  };

  // --- SAUVEGARDE ---
  const handleSaveProject = async () => {
  try {
    if (!projectName.trim()) {
      return alert("Nom du projet requis");
    }

    if (expenses.length === 0) {
      return alert("Aucune dépense définie");
    }

    // Allocation dépenses par compte
    const allocation = {};
    expenses.forEach((exp) => {
      const acc = exp.account || "Non spécifié";
      allocation[acc] = (allocation[acc] || 0) + (parseFloat(exp.amount) || 0);
    });

    // Allocation revenus par compte
    const revenueAllocation = {};
    revenues.forEach((rev) => {
      const acc = rev.account || "Non spécifié";
      revenueAllocation[acc] =
        (revenueAllocation[acc] || 0) + (parseFloat(rev.amount) || 0);
    });

    const startISO = startDate || new Date().toISOString().split("T")[0];
    const endISO = endDate || null;

    const payload = {
      // ⚠️ Utiliser les BONNES variables d’état
      name: projectName,
      description: projectDescription,      // ✅ pas `description`
      type: projectType,
      status: "active",

      // dates (double nommage si tu dois gérer legacy)
      startDate: startISO,
      start_date: startISO,
      endDate: endISO,
      end_date: endISO,

      frequency,
      occurrencesCount,
      occurrences_count: occurrencesCount,

      totalCost: totalProjectCost,
      total_cost: totalProjectCost,
      totalRevenues,
      total_revenues: totalRevenues,
      netProfit,
      net_profit: netProfit,
      roi,
      remainingBudget,
      remaining_budget: remainingBudget,
      totalAvailable,
      total_available: totalAvailable,

      // ✅ envoyer des arrays / objets natifs, pas des strings
      expenses,           // tableau d’objets
      revenues,           // tableau d’objets
      allocation,         // objet { compte: montant }
      revenueAllocation,  // idem
      revenue_allocation: revenueAllocation,
    };

    console.log("📤 ENVOI DONNÉES:", payload);

    if (project && project.id) {
      await projectsService.updateProject(project.id, payload);
    } else {
      await projectsService.createProject(payload);
    }

    if (onProjectSaved) onProjectSaved();
    onClose();
  } catch (error) {
    console.error("ERREUR SAUVEGARDE:", error);
    alert("Erreur sauvegarde: " + (error.message || "Inconnue"));
  }
};


  if (!isOpen) {
  return null;
}

useEffect(() => {
  console.log('ProjectPlannerModal monté avec isOpen:', isOpen);
}, [isOpen]);


  // --- RENDER ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh]">
        {/* HEADER */}
        <div className="p-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800">
                Planificateur de Projet
              </h2>
              {project && project.id && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Mode édition
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Simule tes investissements, dépenses réelles, logistique et
              revenus, sans toucher Bois de Chauffage.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Boutons templates */}
            <button
              onClick={loadProductFlipTemplate}
              className="text-xs px-3 py-2 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg hover:bg-sky-100 flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3" />
              Flip Produit
            </button>

            <button
              onClick={loadFirewoodTemplate}
              className="text-xs px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1"
            >
              <Flame className="w-3 h-3" />
              Bois Hebdo
            </button>

            <button
              onClick={loadPLGFromJson}
              className="text-xs px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 rounded-lg hover:shadow-lg flex items-center gap-1"
            >
              <Anchor className="w-3 h-3" />
              PLG 3 Phases
            </button>

            <button
              onClick={importExistingTransactions}
              className="text-xs px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Import Transac.
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Ligne titre + type + dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">
                Nom du projet
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Ex: PLG FLPT - Campagne Pêche Complete"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">
                Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setProjectType('ponctuel')}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                    projectType === 'ponctuel'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700'
                  }`}
                >
                  Ponctuel
                </button>
                <button
                  onClick={() => setProjectType('recurrent')}
                  className={`flex-1 px-3 py-2 text-xs rounded-lg border ${
                    projectType === 'recurrent'
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-700'
                  }`}
                >
                  Récurrent
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">
                Période
              </label>
              <div className="flex gap-2">
                <input
  type="date"
  value={normalizeDate(startDate) || ''}
  onChange={(e) => setStartDate(e.target.value)}
  className="flex-1 border rounded-lg px-2 py-2 text-xs"
/>

<input
  type="date"
  className="flex-1 border rounded-lg px-2 py-2 text-xs"
  value={normalizeDate(endDate) || ''}
  onChange={(e) => setEndDate(e.target.value)}
/>
              </div>
            </div>
          </div>

          {/* Description + récurrence */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-gray-600">
                Description
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2 text-sm min-h-[60px]"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Détaille rapidement l'objectif du projet..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">
                Récurrence
              </label>
              <div className="flex items-center gap-2">
                <select
                  className="flex-1 border rounded-lg px-2 py-2 text-xs"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  disabled={projectType !== 'recurrent'}
                >
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuelle</option>
                  <option value="yearly">Annuelle</option>
                </select>
                <input
                  type="number"
                  min={1}
                  className="w-16 border rounded-lg px-2 py-2 text-xs text-right"
                  value={occurrencesCount}
                  onChange={(e) =>
                    setOccurrencesCount(parseInt(e.target.value || 0))
                  }
                  disabled={projectType !== 'recurrent'}
                />
              </div>
              <p className="text-[11px] text-gray-400">
                Nombre d&apos;occurrences si récurrent (ex: 12 semaines).
              </p>
            </div>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] text-slate-500">
                Solde Actuel (COFFRE)
              </div>
              <div className="text-sm font-bold text-slate-800">
                {formatCurrency(totalAvailable)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <div className="text-[11px] text-red-600">
                Coût Projet (Total)
              </div>
              <div className="text-sm font-bold text-red-700">
                {formatCurrency(totalProjectCost)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[11px] text-emerald-600">
                Revenus Prévisionnels
              </div>
              <div className="text-sm font-bold text-emerald-700">
                {formatCurrency(totalRevenues)}
              </div>
            </div>
  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
    <div className="text-[11px] text-indigo-600">
      Solde total si projet fini (COFFRE)
    </div>
    <div className="text-sm font-bold text-indigo-700">
      {formatCurrency(finalTotalIfCompleted)}
    </div>
  </div>
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
              <div className="text-[11px] text-blue-600">ROI Estimé</div>
              <div className="text-sm font-bold text-blue-700">
                {totalProjectCost > 0 ? `${roi.toFixed(1)}%` : '–'}
              </div>

            </div>
          </div>

          {/* DÉPENSES + REVENUS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* DEPENSES */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Dépenses ({expenses.length})
                </h3>
                <button
                  onClick={addExpense}
                  className="text-[11px] px-2 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Ligne
                </button>
              </div>

              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                {expenses.map((exp, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-2 bg-white flex flex-col gap-1 text-[11px]"
                  >
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded px-2 py-1"
                        placeholder="Description"
                        value={exp.description || ''}
                        onChange={(e) =>
                          updateExpense(index, 'description', e.target.value)
                        }
                      />
                      <input
                        className="w-24 border rounded px-2 py-1"
                        placeholder="Catégorie"
                        value={exp.category || ''}
                        onChange={(e) =>
                          updateExpense(index, 'category', e.target.value)
                        }
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <CalculatorInput
                        value={exp.amount}
                        onChange={(val) =>
                          updateExpense(index, 'amount', val)
                        }
                        className="flex-1"
                        placeholder="Montant"
                      />
                      <select
                        className="w-32 border rounded px-2 py-1"
                        value={exp.account || ''}
                        onChange={(e) =>
                          updateExpense(index, 'account', e.target.value)
                        }
                      >
                        <option value="">Compte ?</option>
                        <option value="Déjà Payé">Déjà Payé</option>
                        <option value="Futur">Futur</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[11px] text-gray-500">
                          <input
                            type="checkbox"
                            checked={!!exp.isRecurring}
                            onChange={(e) =>
                              updateExpense(
                                index,
                                'isRecurring',
                                e.target.checked
                              )
                            }
                          />
                          <span>Récurrent</span>
                        </label>
                        {exp.phase && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px]">
                            {phaseLabels[exp.phase] || exp.phase}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
  <button
  onClick={() => handlePayerDepense(exp, index)}
  disabled={!exp.account || !exp.amount || exp.isPaid}
  className={`text-[11px] px-2 py-1 rounded-lg ${
    exp.isPaid
      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
      : 'bg-red-600 text-white hover:bg-red-700'
  }`}
>
  {exp.isPaid ? 'Payée' : 'Payer'}
</button>
  <button
    onClick={() => duplicateExpense(index)}
    className="p-1 rounded hover:bg-gray-100"
    title="Dupliquer"
  >
    <Copy className="w-3 h-3" />
  </button>
  <button
    onClick={() => removeExpense(index)}
    className="p-1 rounded hover:bg-red-50 text-red-500"
    title="Supprimer"
  >
    <Trash2 className="w-3 h-3" />
  </button>
</div>

                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* REVENUS */}
            <div className="border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Revenus ({revenues.length})
                </h3>
                <button
                  onClick={addRevenue}
                  className="text-[11px] px-2 py-1 rounded-lg border bg-gray-50 hover:bg-gray-100 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Ligne
                </button>
              </div>

              <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1">
                {revenues.map((rev, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-2 bg-white flex flex-col gap-1 text-[11px]"
                  >
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded px-2 py-1"
                        placeholder="Description"
                        value={rev.description || ''}
                        onChange={(e) =>
                          updateRevenue(index, 'description', e.target.value)
                        }
                      />
                      <CalculatorInput
                        value={rev.amount}
                        onChange={(val) =>
                          updateRevenue(index, 'amount', val)
                        }
                        className="w-28"
                        placeholder="Montant"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                     <input
  type="date"
  className="flex-1 border rounded px-2 py-1"
  value={normalizeDate(rev.date) || ''}
  onChange={(e) =>
    updateRevenue(index, 'date', e.target.value)
  }
/>
                      <select
                        className="w-32 border rounded px-2 py-1"
                        value={rev.account || ''}
                        onChange={(e) =>
                          updateRevenue(index, 'account', e.target.value)
                        }
                      >
                        <option value="">Compte ?</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.name}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-between items-center">
                      <label className="flex items-center gap-1 text-[11px] text-gray-500">
                        <input
                          type="checkbox"
                          checked={!!rev.isRecurring}
                          onChange={(e) =>
                            updateRevenue(
                              index,
                              'isRecurring',
                              e.target.checked
                            )
                          }
                        />
                        <span>Récurrent</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEncaisser(rev, index)}
                          disabled={!rev.account || !rev.amount || rev.isPaid}
                          className={`text-[11px] px-2 py-1 rounded-lg ${
                            rev.isPaid
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {rev.isPaid ? 'Encaissé' : 'Encaisser'}
                        </button>

                        <button
                          onClick={() => removeRevenue(index)}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-3 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <div className="text-[11px] text-gray-500 flex flex-col">
            <span>
              Coût projet :{' '}
              <strong>{formatCurrency(totalProjectCost)}</strong> | Revenus :{' '}
              <strong>{formatCurrency(totalRevenues)}</strong>
            </span>
            <span>
              Résultat net :{' '}
              <strong
                className={
                  netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'
                }
              >
                {formatCurrency(netProfit)}
              </strong>{' '}
              | Reste sur comptes :{' '}
              <strong className={isFeasible ? '' : 'text-red-600'}>
                {formatCurrency(remainingBudget)}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-xs rounded-lg border bg-white hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveProject}
              className="px-4 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              Enregistrer le projet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
