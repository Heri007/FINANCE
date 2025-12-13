// src/ProjectPlannerModal.jsx - VERSION CORRIGÉE FINALE

import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Plus, Trash2, DollarSign, TrendingUp, TrendingDown,
  Save, FileText, CheckCircle, Zap, Copy, Flame, Anchor, Download
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { v4 as uuidv4 } from 'uuid';

// Services & Utils
import { projectsService } from './services/projectsService';
import { operatorService } from './services/operatorService';
import { transactionsService } from './services/transactionsService';
import { formatCurrency } from './utils/formatters';
import { CalculatorInput } from './components/common/CalculatorInput';
import { normalizeDate } from './utils/transactionUtils';

export function ProjectPlannerModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved = null,
  onProjectUpdated = null
}) {
  // --- ÉTATS DU FORMULAIRE ---
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('PRODUCTFLIP');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);
  
  // Financier (Lignes détaillées)
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  
  // États EXPORT
  const [pricePerContainer, setPricePerContainer] = useState(0);
  const [containerCount, setContainerCount] = useState(0);
  
  // États Operator
  const [relatedSOPs, setRelatedSOPs] = useState([]);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [showSOPSection, setShowSOPSection] = useState(true);
  const [showTaskSection, setShowTaskSection] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [loadingOperational, setLoadingOperational] = useState(false);

  // --- CHARGEMENT INITIAL ---
  useEffect(() => {
    if (project) {
      setProjectName(project.name || '');
      setDescription(project.description || '');
      setProjectType(project.type || 'PRODUCTFLIP');
      setStatus(project.status || 'active');
      setStartDate(project.startDate ? new Date(project.startDate) : new Date());
      setEndDate(project.endDate ? new Date(project.endDate) : null);
      
      const parseList = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        try { return JSON.parse(data); } catch { return []; }
      };

      const loadedExpenses = parseList(project.expenses).map(e => ({
        ...e, 
        id: e.id || uuidv4(),
        date: e.date ? new Date(e.date) : new Date(),
        amount: parseFloat(e.amount) || 0
      }));
      
      const loadedRevenues = parseList(project.revenues).map(r => ({
        ...r,
        id: r.id || uuidv4(),
        date: r.date ? new Date(r.date) : new Date(),
        amount: parseFloat(r.amount) || 0
      }));

      setExpenses(loadedExpenses);
      setRevenues(loadedRevenues);

      // Chargement Operator
      if (project.id) {
        loadOperationalData(project.id);
      }
    } else {
      // Reset
      setProjectName('');
      setDescription('');
      setProjectType('PRODUCTFLIP');
      setStatus('active');
      setStartDate(new Date());
      setExpenses([]);
      setRevenues([]);
      setPricePerContainer(0);
      setContainerCount(0);
      setRelatedSOPs([]);
      setRelatedTasks([]);
    }
  }, [project, isOpen]);

  // ✅ CHARGEMENT ROBUSTE DES SOPs ET TÂCHES (CORRIGÉ)
  const loadOperationalData = async (projectId) => {
    setLoadingOperational(true);
    try {
      const [allSOPs, allTasks] = await Promise.all([
        operatorService.getSOPs(),
        operatorService.getTasks()
      ]);

      console.log("Données brutes chargées:", allSOPs.length, "SOPs,", allTasks.length, "Tâches");

      // 1. Filtrer les Tâches liées au projet
      const linkedTasks = allTasks.filter(task => 
        String(task.projectid || task.projectId) === String(projectId)
      );
      setRelatedTasks(linkedTasks);

      // 2. Filtrer les SOPs UNIQUEMENT par projectid (CORRECTION MAJEURE)
      const linkedSOPs = allSOPs.filter(s => 
        String(s.projectid || s.projectId) === String(projectId)
      );

      console.log(`Résultat pour projet ${projectId}:`, linkedTasks.length, "tâches,", linkedSOPs.length, "SOPs");
      
      setRelatedSOPs(linkedSOPs);

      // Forcer l'affichage des sections si des données existent
      if (linkedSOPs.length > 0) setShowSOPSection(true);
      if (linkedTasks.length > 0) setShowTaskSection(true);

    } catch (error) {
      console.error("Erreur chargement données opérationnelles:", error);
    } finally {
      setLoadingOperational(false);
    }
  };

  // --- CATÉGORIES DE DÉPENSES (FONCTION) ---
  const getExpenseCategories = () => {
    const baseCategories = [
      { value: "CAPEX", label: "🏗️ CAPEX / Investissement", types: ["LIVESTOCK", "REALESTATE", "FISHING"] },
      { value: "Équipements", label: "🔧 Équipements", types: ["LIVESTOCK", "FISHING", "PRODUCTFLIP"] },
      { value: "Fonds de roulement", label: "💰 Fonds de roulement", types: ["LIVESTOCK", "FISHING", "PRODUCTFLIP"] },
      { value: "Transport", label: "🚚 Transport", types: ["PRODUCTFLIP", "FISHING", "LIVESTOCK"] },
      { value: "Automobile", label: "🚗 Automobile", types: ["PRODUCTFLIP"] },
      { value: "Clôture", label: "🚧 Clôture/Sécurité", types: ["LIVESTOCK", "REALESTATE"] },
      { value: "Achat", label: "🛒 Achat Stock", types: ["PRODUCTFLIP"] }
    ];

    const exportCategories = [
      { value: "Droits Bancaires", label: "🏦 Domiciliation Bancaire", types: ["EXPORT"] },
      { value: "Frais Déplacement", label: "🚗 Déplacements/Transport", types: ["EXPORT"] },
      { value: "Administratif", label: "📄 Administratif (Frais)", types: ["EXPORT"] },
      { value: "Commissions", label: "💼 Commissions Agents", types: ["EXPORT"] },
      { value: "Douanes", label: "🛃 Frais Douaniers", types: ["EXPORT"] },
      { value: "Conteneurs", label: "📦 Location Conteneurs", types: ["EXPORT"] },
      { value: "Certification", label: "✅ Certifications Export", types: ["EXPORT"] }
    ];

    const allCategories = [...baseCategories, ...exportCategories];
    
    // Filtrer selon le type de projet
    return allCategories.filter(cat => 
      !cat.types || cat.types.includes(projectType)
    );
  };

  // --- GESTION LIGNES ---
  const updateExpense = (id, field, value) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const updateRevenue = (id, field, value) => {
    setRevenues(revenues.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeExpense = (id) => setExpenses(expenses.filter(e => e.id !== id));
  const removeRevenue = (id) => setRevenues(revenues.filter(r => r.id !== id));

  const duplicateExpense = (idx) => {
    const item = expenses[idx];
    setExpenses([...expenses, { ...item, id: uuidv4(), isPaid: false }]);
  };

  const duplicateRevenue = (idx) => {
    const item = revenues[idx];
    setRevenues([...revenues, { ...item, id: uuidv4(), isPaid: false }]);
  };

  // NOUVEAU: Générer automatiquement les revenus par container (EXPORT)
  const generateContainerRevenues = () => {
    if (!pricePerContainer || !containerCount) {
      alert("Veuillez définir le prix par container et le nombre de containers");
      return;
    }
    
    const newRevenues = [];
    for (let i = 1; i <= containerCount; i++) {
      newRevenues.push({
        id: uuidv4(),
        description: `Container #${i} - Export Pierres`,
        amount: pricePerContainer,
        date: new Date(),
        account: "",
        isPaid: false,
        category: "Export Container"
      });
    }
    
    setRevenues([...revenues, ...newRevenues]);
    alert(`${containerCount} lignes de revenus générées!`);
  };

// NOUVEAU: Mise à jour automatique des commissions selon le nombre de containers
const updateCommissionsForContainers = (count) => {
  if (projectType !== "EXPORT") return; // Uniquement pour projets EXPORT
  
  setExpenses(expenses.map(exp => {
    // Commission proprio: 1M Ar par container
    if (exp.description === "Commission intermédiaire proprio") {
      return { ...exp, amount: 1000000 * count };
    }
    // Commission RANDOU: 500K Ar par container
    if (exp.description === "Commission intermédiaire @RANDOU") {
      return { ...exp, amount: 500000 * count };
    }
    return exp;
  }));
};

  // --- ACTIONS FINANCIÈRES (Payer / Encaisser) ---
  const handlePayerDepense = async (exp, index) => {
    try {
      if (!exp.account) return alert('Choisis un compte pour cette dépense');
      
      const accountObj = accounts.find(a => a.name === exp.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Payer ${formatCurrency(exp.amount)} depuis ${exp.account} ?`)) return;

      await transactionsService.createTransaction({
        type: 'expense',
        amount: parseFloat(exp.amount),
        category: exp.category || 'Projet',
        description: `${projectName} - ${exp.description}`,
        date: new Date().toISOString().split('T')[0],
        account_id: accountObj.id,
        project_id: project?.id || null,
        project_line_id: exp.id,
        is_posted: true,
        is_planned: false
      });

      const updated = [...expenses];
      updated[index] = { ...updated[index], isPaid: true };
      setExpenses(updated);

      await saveProjectState(updated, revenues);

      if (onProjectUpdated) onProjectUpdated();
      alert('Dépense payée et enregistrée !');

    } catch (error) {
      console.error('Erreur handlePayerDepense:', error);
      const msg = error?.message || error?.raw?.message || 'Erreur paiement';
      alert(msg);
    }
  };

  const handleCancelPaymentExpense = async (exp, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');
      if (!window.confirm(`Annuler le paiement de ${formatCurrency(exp.amount)} ?`)) return;

      const allTx = await transactionsService.getAll();
      let matches = allTx.filter(t => String(t.project_line_id || '') === String(exp.id) && t.is_posted === true);
      if (matches.length === 0) {
        matches = allTx.filter(t =>
          String(t.project_id) === String(project.id) &&
          t.type === 'expense' &&
          t.is_posted === true &&
          Number(t.amount) === Number(exp.amount)
        );
      }

      for (const tx of matches) {
        try {
          await transactionsService.deleteTransaction(tx.id);
        } catch (e) {
          console.warn('Impossible de supprimer transaction', tx.id, e);
        }
      }

      const updated = [...expenses];
      updated[index] = { ...updated[index], isPaid: false };
      setExpenses(updated);
      await saveProjectState(updated, revenues);

      if (onProjectUpdated) onProjectUpdated();
      alert('Paiement annulé.');
    } catch (err) {
      console.error('Erreur handleCancelPaymentExpense:', err);
      alert('Erreur annulation paiement: ' + (err.message || err));
    }
  };

  const handleEncaisser = async (rev, index) => {
    try {
      if (!rev.account) return alert('Choisis un compte pour encaisser');
      
      const accountObj = accounts.find(a => a.name === rev.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Encaisser ${formatCurrency(rev.amount)} sur ${rev.account} ?`)) return;

      await transactionsService.createTransaction({
        type: 'income',
        amount: parseFloat(rev.amount),
        category: 'Projet - Revenu',
        description: `${projectName} - ${rev.description}`,
        date: new Date().toISOString().split('T')[0],
        account_id: accountObj.id,
        project_id: project?.id || null,
        project_line_id: rev.id,
        is_posted: true,
        is_planned: false
      });

            const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: true };
      setRevenues(updated);

      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();
      alert('Revenu encaissé !');

    } catch (error) {
      console.error('Erreur handleEncaisser:', error);
      const msg = error?.message || error?.raw?.message || 'Erreur encaissement';
      alert(msg);
    }
  };

  const handleCancelPaymentRevenue = async (rev, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');
      if (!window.confirm(`Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`)) return;

      const allTx = await transactionsService.getAll();
      let matches = allTx.filter(t => String(t.project_line_id || '') === String(rev.id) && t.is_posted === true);
      if (matches.length === 0) {
        matches = allTx.filter(t =>
          String(t.project_id) === String(project.id) &&
          t.type === 'income' &&
          t.is_posted === true &&
          Number(t.amount) === Number(rev.amount)
        );
      }

      for (const tx of matches) {
        try {
          await transactionsService.deleteTransaction(tx.id);
        } catch (e) {
          console.warn('Impossible de supprimer transaction', tx.id, e);
        }
      }

      const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: false };
      setRevenues(updated);
      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();
      alert('Encaissement annulé.');
    } catch (err) {
      console.error('Erreur handleCancelPaymentRevenue:', err);
      alert('Erreur annulation encaissement: ' + (err.message || err));
    }
  };

  // Fonction utilitaire pour sauvegarder l'état sans fermer le modal
  const saveProjectState = async (currentExpenses, currentRevenues) => {
    if (!project?.id) return;

    try {
      const existing = await projectsService.getById(project.id);

      const payload = {
        name: existing.name || projectName,
        description: existing.description || description,
        type: existing.type || projectType,
        status: existing.status || status,
        startDate: existing.startDate || (startDate ? startDate.toISOString() : null),
        endDate: existing.endDate || (endDate ? endDate.toISOString() : null),
        totalCost: existing.totalCost || totalExpenses,
        totalRevenues: existing.totalRevenues || totalRevenues,
        netProfit: existing.netProfit || netProfit,
        roi: existing.roi || roi,
        remainingBudget: existing.remainingBudget || remainingBudget,
        totalAvailable: existing.totalAvailable || totalAvailable,
        expenses: JSON.stringify(currentExpenses),
        revenues: JSON.stringify(currentRevenues)
      };

      await projectsService.updateProject(project.id, payload);
    } catch (err) {
      console.error('Erreur saveProjectState:', err);
      throw err;
    }
  };

  // --- TEMPLATES ---
  const applyTemplate = (template) => {
    if (expenses.length > 0 && !window.confirm("Écraser les données actuelles ?")) return;
    setProjectName(template.name);
    setProjectType(template.type);
    setDescription(template.description);
    setExpenses(template.expenses);
    setRevenues(template.revenues);
    
    if (template.pricePerContainer) setPricePerContainer(template.pricePerContainer);
    if (template.containerCount) setContainerCount(template.containerCount);
  };

  const templates = {
    productFlip: {
      name: "Achat/Revente Rapide",
      type: "PRODUCTFLIP",
      description: "Achat de stock pour revente immédiate.",
      expenses: [
        { id: uuidv4(), description: "Achat Stock", amount: 500000, category: "Achat", date: new Date(), account: "Coffre" }
      ],
      revenues: [
        { id: uuidv4(), description: "Vente Client", amount: 750000, category: "Vente", date: new Date(), account: "Coffre" }
      ]
    },
    
    mineralExport: {
      name: "Export Pierres Industrielles",
      type: "EXPORT",
      description: "Exportation de pierres industrielles en containers.",
      pricePerContainer: 5000000,
      containerCount: 3,
      expenses: [
        { id: uuidv4(), description: "Domiciliation bancaire BOA", amount: 500000, category: "Droits Bancaires", date: new Date(), account: "Compte BOA" },
        { id: uuidv4(), description: "Frais déplacement préparation", amount: 300000, category: "Frais Déplacement", date: new Date(), account: "Coffre" },
        { id: uuidv4(), description: "Frais administratifs (Création, Impression/Copie dos...)", amount: 150000, category: "Administratif", date: new Date(), account: "Coffre" },
        { id: uuidv4(), description: "Commission agent mines", amount: 800000, category: "Commissions", date: new Date(), account: "Coffre" },
        // ✅ Commission proprio: 1M Ar × 3 containers = 3M Ar
        { id: uuidv4(), description: "Commission intermédiaire proprio", amount: 1000000 * 3, category: "Commissions", date: new Date(), account: "Coffre" },
        // ✅ Commission RANDOU: 500K Ar × 3 containers = 1.5M Ar
        { id: uuidv4(), description: "Commission intermédiaire @RANDOU", amount: 500000 * 3, category: "Commissions", date: new Date(), account: "Coffre" }
      ],
      revenues: []
    },

    livestockNatiora: {
      name: "Élevage Mixte",
      type: "LIVESTOCK",
      description: "Projet d'élevage combinant poulets, oies et kuroilers.",
      expenses: [
        { id: uuidv4(), description: "Bâtiment Poulets (40m²)", amount: 1785000, category: "CAPEX", date: new Date(), account: "Coffre" },
        { id: uuidv4(), description: "Équipements durables", amount: 1200000, category: "Équipements", date: new Date(), account: "Coffre" },
        { id: uuidv4(), description: "Fonds de roulement", amount: 500000, category: "Fonds de roulement", date: new Date(), account: "Coffre" }
      ],
      revenues: [
        { id: uuidv4(), description: "Vente poulets Cycle 1", amount: 3000000, category: "Vente Animaux", date: new Date(), account: "Coffre" }
      ]
    },

    fishingPLG: {
      name: "Campagne Pêche PLG",
      type: "FISHING",
      description: "Investissements pêche + logistique + ventes.",
      expenses: [
        { id: uuidv4(), description: "Achat filets", amount: 800000, category: "Équipements", date: new Date(), account: "Coffre" },
        { id: uuidv4(), description: "Location camion frigorifique", amount: 500000, category: "Transport", date: new Date(), account: "Coffre" }
      ],
      revenues: [
        { id: uuidv4(), description: "Vente poissons Marché", amount: 2500000, category: "Vente", date: new Date(), account: "Coffre" }
      ]
    }
  };


// --- CALCULS (VERSION CORRIGÉE SANS USEMEMO) ---
const totalRevenues = revenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
const netProfit = totalRevenues - totalExpenses;
const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

const totalAvailable = useMemo(() => {
  return accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
}, [accounts]);

const remainingBudget = totalAvailable - totalExpenses;


  // --- SAUVEGARDE FINALE ---
const handleSave = async () => {
  if (!projectName) return alert("Le nom est obligatoire");
  if (!projectType) return alert("Le type de projet est obligatoire");
  if (!status) return alert("Le statut est obligatoire");
  
  // ✅ Validation des dates
  if (!startDate) {
    setStartDate(new Date());
  }
  
  setLoading(true);
  try {
    const payload = {
      name: projectName.trim(),
      description: description.trim() || '',
      type: projectType,
      status,
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      totalCost: parseFloat(totalExpenses) || 0,
      totalRevenues: parseFloat(totalRevenues) || 0,
      netProfit: parseFloat(netProfit) || 0,
      roi: parseFloat(roi) || 0,
      remainingBudget: parseFloat(remainingBudget) || 0,
      totalAvailable: parseFloat(totalAvailable) || 0,
      expenses: JSON.stringify(expenses),
      revenues: JSON.stringify(revenues)
    };

    console.log('💾 Payload sauvegarde:', payload); // DEBUG

    if (project?.id) {
      await projectsService.updateProject(project.id, payload);
    } else {
      await projectsService.createProject(payload);
    }

    if (onProjectSaved) onProjectSaved();
    onClose();
  } catch (e) {
    console.error('Erreur détaillée:', e);
    alert("Erreur sauvegarde: " + (e.message || JSON.stringify(e.details || e)));
  } finally {
    setLoading(false);
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 to-pink-600 p-6 flex justify-between items-center sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {project ? `Édition : ${project.name}` : "Nouveau Projet"}
            </h2>
            <p className="text-purple-100 text-sm">Planification Financière & Opérationnelle</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => applyTemplate(templates.productFlip)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs transition">
              Template Flip
            </button>
            <button onClick={() => applyTemplate(templates.mineralExport)} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs transition">
              Template Export
            </button>
            <button onClick={onClose} className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1">
          
          {/* Info Principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <input 
                type="text" 
                value={projectName} 
                onChange={e => setProjectName(e.target.value)} 
                className="w-full border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 font-bold text-lg"
                placeholder="Nom du Projet"
              />
              <div className="grid grid-cols-2 gap-4">
                <select value={projectType} onChange={e => setProjectType(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5">
                  <option value="PRODUCTFLIP">💰 Achat/Revente</option>
                  <option value="LIVESTOCK">🐓 Élevage</option>
                  <option value="FISHING">🎣 Pêche</option>
                  <option value="REALESTATE">🏠 Immobilier</option>
                  <option value="EXPORT">📦 Exportation</option>
                </select>
                <select value={status} onChange={e => setStatus(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5">
                  <option value="active">Actif</option>
                  <option value="draft">Brouillon</option>
                  <option value="completed">Terminé</option>
                </select>
              </div>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                rows={2}
                className="w-full border-gray-300 rounded-lg p-2.5 text-sm"
                placeholder="Description..."
              />
            </div>

            {/* KPI Live */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs text-red-600 font-bold uppercase">Coût Total</div>
                <div className="text-xl font-bold text-red-700">{formatCurrency(totalExpenses)}</div>
              </div>
              {/* KPI Revenus - AVEC INDICATEUR */}
<div className="p-3 bg-green-50 rounded-xl border border-green-100">
  <div className="text-xs text-green-600 font-bold uppercase flex items-center justify-between">
    <span>Revenus</span>
    {projectType === "EXPORT" && containerCount > 0 && revenues.length === 0 && (
      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
        Prévisionnel
      </span>
    )}
  </div>
  <div className="text-xl font-bold text-green-700">{formatCurrency(totalRevenues)}</div>
  {projectType === "EXPORT" && containerCount > 0 && revenues.length === 0 && (
    <div className="text-xs text-green-600 mt-1">
      {containerCount} × {formatCurrency(pricePerContainer)}
    </div>
  )}
</div>

              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-xs text-indigo-600 font-bold uppercase">Marge Nette</div>
                <div className={`text-xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  {formatCurrency(netProfit)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-bold uppercase">Solde après projet</div>
                <div className="text-xl font-bold text-slate-700">
                  {formatCurrency(totalAvailable + netProfit)}
                </div>
              </div>
            </div>
          </div>

                    {/* Section Operator (SOPs/Tasks) */}
          {project && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <FileText size={16} /> Procédures ({relatedSOPs.length})
                </h3>
                <ul className="text-sm space-y-1">
                  {relatedSOPs.map(s => <li key={s.id} className="bg-white px-2 py-1 rounded border">• {s.title}</li>)}
                  {relatedSOPs.length === 0 && <li className="text-slate-400 italic">Aucune SOP liée</li>}
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <CheckCircle size={16} /> Tâches ({relatedTasks.length})
                </h3>
                <ul className="text-sm space-y-1">
                  {relatedTasks.map(t => <li key={t.id} className="bg-white px-2 py-1 rounded border">• {t.title}</li>)}
                  {relatedTasks.length === 0 && <li className="text-slate-400 italic">Aucune tâche liée</li>}
                </ul>
              </div>
            </div>
          )}

          {/* ✅ SECTION EXPORT: Configuration Containers */}
          {projectType === "EXPORT" && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                📦 Configuration Export - Revenus par Container
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Prix unitaire par container */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prix par Container (Ar)
                  </label>
                  <CalculatorInput
                    value={pricePerContainer}
                    onChange={(val) => setPricePerContainer(val)}
                    className="w-full text-right font-mono border-gray-300 rounded-lg p-2.5"
                    placeholder="0 Ar"
                  />
                </div>

                {/* Nombre de containers */}
                {/* Nombre de containers - AVEC MISE À JOUR AUTO */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Nombre de Containers
  </label>
  <input
    type="number"
    value={containerCount}
    onChange={(e) => {
      const count = parseInt(e.target.value) || 0;
      setContainerCount(count);
      updateCommissionsForContainers(count); // ✅ Mise à jour auto des commissions
    }}
    className="w-full border-gray-300 rounded-lg p-2.5 text-right font-mono"
    placeholder="0"
    min="0"
  />
  <p className="text-xs text-gray-500 mt-1">
    💡 Les commissions se mettront à jour automatiquement
  </p>
</div>


                {/* Revenu total calculé */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Revenu Total Prévu
                  </label>
                  <div className="bg-green-100 border-2 border-green-300 rounded-lg p-2.5 text-right">
                    <span className="text-xl font-bold text-green-700">
                      {formatCurrency(pricePerContainer * containerCount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-3">
                <button
                  onClick={generateContainerRevenues}
                  disabled={!pricePerContainer || !containerCount}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  Générer {containerCount} lignes de revenus
                </button>

                <button
                  onClick={() => applyTemplate(templates.mineralExport)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
                >
                  <Zap size={16} />
                  Template Export Standard
                </button>
              </div>

              {/* Info box */}
              <div className="mt-4 bg-blue-100 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>💡 Info:</strong> Le bouton ci-dessus génère automatiquement une ligne de revenu par container. 
                Vous pourrez ensuite les encaisser individuellement quand chaque container sera payé.
              </div>
            </div>
          )}

          {/* TABLEAU DES DÉPENSES */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-red-800 flex items-center gap-2">
                <TrendingDown size={20} /> Dépenses & Investissements
              </h3>
              <button 
                onClick={() => setExpenses([...expenses, { id: uuidv4(), description: '', amount: 0, category: '', date: new Date(), account: '', isPaid: false }])}
                className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm hover:bg-red-100 transition flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {expenses.map((exp, idx) => (
                <div key={exp.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${exp.isPaid ? 'bg-gray-50 border-gray-200' : 'bg-white border-red-100'}`}>
                  
                  {/* Catégorie + Description */}
                  <div className="col-span-4">
                    <div className="flex gap-2">
                      {/* Sélecteur de catégorie */}
                      <select
                        value={exp.category || ""}
                        onChange={(e) => updateExpense(exp.id, "category", e.target.value)}
                        className="w-48 text-sm border-gray-300 rounded focus:ring-red-500"
                        disabled={exp.isPaid}
                      >
                        <option value="">-- Catégorie --</option>
                        {getExpenseCategories().map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>

                      {/* Champ description */}
                      <input 
                        type="text" 
                        value={exp.description} 
                        onChange={e => updateExpense(exp.id, 'description', e.target.value)}
                        placeholder="Description"
                        className="flex-1 text-sm border-gray-300 rounded focus:ring-red-500"
                        disabled={exp.isPaid}
                      />
                    </div>
                  </div>
                  
                  {/* Montant */}
                  <div className="col-span-3">
                    <CalculatorInput 
                      value={exp.amount} 
                      onChange={val => updateExpense(exp.id, 'amount', val)}
                      className="w-full text-sm border-gray-300 rounded text-right font-mono"
                      placeholder="0 Ar"
                      disabled={exp.isPaid}
                    />
                  </div>

                  {/* Compte */}
                  <div className="col-span-3">
                    <select 
                      value={exp.account || ''} 
                      onChange={e => updateExpense(exp.id, 'account', e.target.value)}
                      className="w-full text-sm border-gray-300 rounded"
                      disabled={exp.isPaid}
                    >
                      <option value="">-- Compte --</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-1">
                    {exp.isPaid ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center">
                          <CheckCircle size={12} className="mr-1"/> Payé
                        </span>
                        <button
                          onClick={() => handleCancelPaymentExpense(exp, idx)}
                          className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handlePayerDepense(exp, idx)}
                          disabled={!exp.account || !exp.amount}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          Payer
                        </button>

                        {!exp.isPaid && (
                          <button onClick={() => removeExpense(exp.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TABLEAU DES REVENUS */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-green-800 flex items-center gap-2">
                <TrendingUp size={20} /> Revenus Prévisionnels
              </h3>
              <button 
                onClick={() => setRevenues([...revenues, { id: uuidv4(), description: '', amount: 0, category: '', date: new Date(), account: '', isPaid: false }])}
                className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm hover:bg-green-100 transition flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter une ligne
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {revenues.map((rev, idx) => (
                <div key={rev.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${rev.isPaid ? 'bg-gray-50 border-gray-200' : 'bg-white border-green-100'}`}>
                  <div className="col-span-4">
                    <input 
                      type="text" 
                      value={rev.description} 
                      onChange={e => updateRevenue(rev.id, 'description', e.target.value)}
                      placeholder="Source du revenu"
                      className="w-full text-sm border-gray-300 rounded focus:ring-green-500"
                      disabled={rev.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <CalculatorInput 
                      value={rev.amount} 
                      onChange={val => updateRevenue(rev.id, 'amount', val)}
                      className="w-full text-sm border-gray-300 rounded text-right font-mono"
                      placeholder="0 Ar"
                      disabled={rev.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <select 
                      value={rev.account || ''} 
                      onChange={e => updateRevenue(rev.id, 'account', e.target.value)}
                      className="w-full text-sm border-gray-300 rounded"
                      disabled={rev.isPaid}
                    >
                      <option value="">-- Compte --</option>
                      {accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    {rev.isPaid ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center">
                          <CheckCircle size={12} className="mr-1"/> Reçu
                        </span>
                        <button
                          onClick={() => handleCancelPaymentRevenue(rev, idx)}
                          className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleEncaisser(rev, idx)}
                          disabled={!rev.account || !rev.amount}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition"
                        >
                          Encaisser
                        </button>
                        {!rev.isPaid && (
                          <button onClick={() => removeRevenue(rev.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

                {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white p-6 border-t border-gray-200 flex justify-between items-center rounded-b-2xl">
          <button onClick={onClose} className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">
            Annuler
          </button>
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="bg-purple-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-purple-700 shadow-lg hover:shadow-purple-200 transition flex items-center gap-2 disabled:opacity-70"
          >
            <Save size={18} />
            {loading ? 'Enregistrement...' : 'Enregistrer le Projet'}
          </button>
        </div>

      </div>
    </div>
  );
}

export default ProjectPlannerModal;
