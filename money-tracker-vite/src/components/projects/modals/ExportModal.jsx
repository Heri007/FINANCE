// src/components/projects/modals/ExportModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Save, Ship, DollarSign, TrendingUp, TrendingDown, Calculator, AlertCircle, CheckCircle } from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { v4 as uuidv4 } from 'uuid';
import { projectsService } from '../../../services/projectsService';
import { transactionsService } from '../../../services/transactionsService';
import { formatCurrency } from '../../../utils/formatters';
import { CalculatorInput } from '../../common/CalculatorInput';

export function ExportModal({ 
  isOpen, 
  onClose, 
  accounts = [], 
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction 
}) {
  
  // ===== VÉRIFICATION SÉCURITÉ =====
  if (!createTransaction) {
    console.error('❌ createTransaction manquant dans ExportModal !');
    return null;
  }

  // ===== ÉTATS DE BASE =====
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);

  // ===== ÉTATS SPÉCIFIQUES EXPORT =====
  const [pricePerContainer, setPricePerContainer] = useState(0);
  const [containerCount, setContainerCount] = useState(0);
  const [commissionRateProprio, setCommissionRateProprio] = useState(0.20); // 20%
  const [commissionRateRandou, setCommissionRateRandou] = useState(0.10); // 10%
  const [productType, setProductType] = useState(''); // Type de produit exporté
  const [destination, setDestination] = useState(''); // Pays de destination
  const [containerType, setContainerType] = useState('20FT'); // 20FT ou 40FT

  // ===== CHARGES & VENTES =====
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(false);

  // ===== CHARGEMENT PROJET EXISTANT =====
  useEffect(() => {
    const loadProjectData = async () => {
      if (project) {
        setProjectName(project.name || '');
        setDescription(project.description || '');
        setStatus(project.status || 'active');
        
        const start = project.startDate || project.start_date;
        const end = project.endDate || project.end_date;
        setStartDate(start ? new Date(start) : new Date());
        setEndDate(end ? new Date(end) : null);

        // Charger metadata
        if (project.metadata) {
          const meta = typeof project.metadata === 'string' 
            ? JSON.parse(project.metadata) 
            : project.metadata;
          
          setProductType(meta.productType || '');
          setDestination(meta.destination || '');
          setContainerType(meta.containerType || '20FT');
          setCommissionRateProprio(meta.commissionRateProprio || 0.20);
          setCommissionRateRandou(meta.commissionRateRandou || 0.10);
        }

        // Fonction helper pour parser les listes
        const parseList = (data) => {
          if (!data) return [];
          if (Array.isArray(data)) return data;
          try { return JSON.parse(data); } catch { return []; }
        };

        let currentExpenses = parseList(project.expenses).map(e => ({
          ...e,
          id: e.id || uuidv4(),
          date: e.date ? new Date(e.date) : new Date(),
          amount: parseFloat(e.amount) || 0
        }));

        let currentRevenues = parseList(project.revenues).map(r => ({
          ...r,
          id: r.id || uuidv4(),
          date: r.date ? new Date(r.date) : new Date(),
          amount: parseFloat(r.amount) || 0
        }));

        // ✅ RÉCUPÉRER LES TRANSACTIONS RÉELLES LIÉES AU PROJET
        if (project.id) {
          try {
            const allTx = await transactionsService.getAll();
            const projectTx = allTx.filter(t => String(t.project_id) === String(project.id));
            console.log(`📥 Transactions récupérées pour Export ${project.name}:`, projectTx.length);

            // Fusionner les transactions réelles avec les lignes budgétaires
            const mergeTransactions = (lines, type) => {
              const newLines = [...lines];
              
              projectTx.filter(t => t.type === type).forEach(tx => {
                const accName = accounts.find(a => a.id === tx.account_id)?.name || 'Inconnu';
                
                // Chercher si la ligne existe déjà
                const existingIdx = newLines.findIndex(l => 
                  String(l.id) === String(tx.project_line_id) ||
                  (l.amount === parseFloat(tx.amount) && l.description === tx.description && !l.isPaid)
                );

                if (existingIdx >= 0) {
                  // Ligne existante → marquer comme payée
                  newLines[existingIdx] = {
                    ...newLines[existingIdx],
                    isPaid: true,
                    account: accName,
                    date: new Date(tx.transaction_date || tx.date)
                  };
                } else {
                  // Nouvelle ligne depuis transaction
                  newLines.push({
                    id: tx.project_line_id || uuidv4(),
                    description: tx.description,
                    amount: parseFloat(tx.amount),
                    category: tx.category,
                    date: new Date(tx.transaction_date || tx.date),
                    account: accName,
                    isPaid: true,
                    isRecurring: false
                  });
                }
              });

              return newLines;
            };

            currentExpenses = mergeTransactions(currentExpenses, 'expense');
            currentRevenues = mergeTransactions(currentRevenues, 'income');
          } catch (err) {
            console.error("Erreur synchronisation transactions:", err);
          }
        }

        setExpenses(currentExpenses);
        setRevenues(currentRevenues);

        // ✅ DÉTECTER LES PARAMÈTRES EXPORT DEPUIS LES REVENUES
        const containerRevenues = currentRevenues.filter(r => 
          r.category === 'Vente Export Global' || 
          r.description.includes('Export Global')
        );

        if (containerRevenues.length > 0) {
          const matchCount = containerRevenues[0].description.match(/(\d+)\s+Containers/i);
          if (matchCount && matchCount[1]) {
            const count = parseInt(matchCount[1], 10);
            setContainerCount(count);
            if (count > 0) {
              setPricePerContainer(containerRevenues[0].amount / count);
            }
          }
        }
      } else {
        // Reset pour nouveau projet
        resetForm();
      }
    };

    loadProjectData();
  }, [project, isOpen, accounts]);

  const resetForm = () => {
    setProjectName('');
    setDescription('');
    setStatus('active');
    setStartDate(new Date());
    setEndDate(null);
    setPricePerContainer(0);
    setContainerCount(0);
    setCommissionRateProprio(0.20);
    setCommissionRateRandou(0.10);
    setProductType('');
    setDestination('');
    setContainerType('20FT');
    setExpenses([]);
    setRevenues([]);
  };

  // ===== MISE À JOUR AUTOMATIQUE DES COMMISSIONS =====
  useEffect(() => {
    const theoreticalRevenue = pricePerContainer * containerCount;
    
    setExpenses(prevExpenses => {
      return prevExpenses.map(exp => {
        if (!exp.isPaid) {
          if (exp.description === "Commission intermédiaire proprio") {
            return { ...exp, amount: theoreticalRevenue * commissionRateProprio };
          }
          if (exp.description === "Commission intermédiaire @RANDOU") {
            return { ...exp, amount: theoreticalRevenue * commissionRateRandou };
          }
        }
        return exp;
      });
    });
  }, [pricePerContainer, containerCount, commissionRateProprio, commissionRateRandou]);

  // ===== GÉNÉRER LA LIGNE DE REVENU GLOBAL =====
  const generateContainerRevenues = () => {
    if (!pricePerContainer || !containerCount) {
      alert("Veuillez définir le prix par container et le nombre de containers");
      return;
    }

    const totalAmount = pricePerContainer * containerCount;

    // Supprimer l'ancienne ligne globale si elle existe
    const otherRevenues = revenues.filter(r => r.category !== 'Vente Export Global');

    const globalRevenue = {
      id: uuidv4(),
      description: `Export Global (${containerCount} Containers ${containerType} à ${formatCurrency(pricePerContainer)})`,
      amount: totalAmount,
      date: new Date(),
      account: "",
      isPaid: false,
      category: "Vente Export Global",
      isRecurring: false
    };

    setRevenues([...otherRevenues, globalRevenue]);

    // Ajouter les lignes de commissions si elles n'existent pas
    setExpenses(prevExpenses => {
      const newExpenses = [...prevExpenses];

      const addIfNotExists = (desc, rate) => {
        if (!newExpenses.find(e => e.description === desc)) {
          newExpenses.push({
            id: uuidv4(),
            description: desc,
            amount: totalAmount * rate,
            category: "Commissions",
            date: new Date(),
            account: "Coffre",
            isPaid: false,
            isRecurring: false
          });
        }
      };

      addIfNotExists("Commission intermédiaire proprio", commissionRateProprio);
      addIfNotExists("Commission intermédiaire @RANDOU", commissionRateRandou);

      return newExpenses;
    });

    alert(`✅ Ligne de revenu global générée : ${formatCurrency(totalAmount)}`);
  };

  // ===== CATÉGORIES =====
  const expenseCategories = [
    { value: "Droits Bancaires", label: "🏦 Bancaire" },
    { value: "Frais Déplacement", label: "🚗 Déplacement" },
    { value: "Administratif", label: "📄 Administratif" },
    { value: "Commissions", label: "💼 Commissions" },
    { value: "Douanes", label: "🛃 Douanes" },
    { value: "Conteneurs", label: "📦 Location Cont." },
    { value: "Certification", label: "✅ Certifications" },
    { value: "Transport", label: "🚚 Transport" },
    { value: "Assurance", label: "🛡️ Assurance" },
    { value: "Autre", label: "📦 Autre" }
  ];

  const revenueCategories = [
    { value: "Vente Export Global", label: "🌍 Export Global" },
    { value: "Vente Partielle", label: "💰 Vente Partielle" },
    { value: "Autre", label: "💵 Autre" }
  ];

  // ===== GESTION DES LIGNES =====
  const addExpense = () => {
    setExpenses([...expenses, {
      id: uuidv4(),
      description: '',
      amount: 0,
      category: 'Administratif',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false
    }]);
  };

  const addRevenue = () => {
    setRevenues([...revenues, {
      id: uuidv4(),
      description: '',
      amount: 0,
      category: 'Vente Partielle',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false
    }]);
  };

  const updateExpense = (id, field, value) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const updateRevenue = (id, field, value) => {
    setRevenues(revenues.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeExpense = (id) => {
    if (confirm('Supprimer cette charge ?')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const removeRevenue = (id) => {
    if (confirm('Supprimer ce revenu ?')) {
      setRevenues(revenues.filter(r => r.id !== id));
    }
  };

  // ===== PAYER DÉPENSE =====
  const handlePayerDepense = async (exp, index) => {
    try {
      if (!exp.account) return alert('Choisis un compte');
      
      const accountObj = accounts.find(a => a.name === exp.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Payer ${formatCurrency(exp.amount)} depuis ${exp.account} ?`)) {
        return;
      }

      if (!project || !project.id) {
        alert('Erreur: Projet introuvable.');
        return;
      }

      await createTransaction({
        accountid: parseInt(accountObj.id, 10),
        type: 'expense',
        amount: parseFloat(exp.amount),
        category: exp.category || 'Projet - Dépense',
        description: `${project.name} - ${exp.description || 'Dépense'}`,
        date: new Date().toISOString().split('T')[0],
        isplanned: false,
        isposted: true,
        projectid: project.id,
        projectlineid: exp.id,
      });

      const updated = [...expenses];
      updated[index] = { ...updated[index], isPaid: true };
      setExpenses(updated);

      await saveProjectState(updated, revenues);
      if (onProjectUpdated) onProjectUpdated();
      
      alert('✅ Dépense payée !');
    } catch (error) {
      console.error('❌ Erreur handlePayerDepense:', error);
      alert(error?.message || 'Erreur paiement');
    }
  };

  // ===== ENCAISSER REVENU =====
  const handleEncaisser = async (rev, index) => {
    try {
      if (!rev.account) return alert('Choisis un compte');
      
      const accountObj = accounts.find(a => a.name === rev.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Encaisser ${formatCurrency(rev.amount)} sur ${rev.account} ?`)) {
        return;
      }

      if (!project || !project.id) {
        alert('Erreur: Projet introuvable.');
        return;
      }

      await createTransaction({
        accountid: parseInt(accountObj.id, 10),
        type: 'income',
        amount: parseFloat(rev.amount),
        category: 'Projet - Revenu',
        description: `${project.name} - ${rev.description || 'Revenu'}`,
        date: new Date().toISOString().split('T')[0],
        isplanned: false,
        isposted: true,
        projectid: project.id,
        projectlineid: rev.id,
      });

      const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: true };
      setRevenues(updated);

      await saveProjectState(expenses, updated);
      if (onProjectUpdated) onProjectUpdated();
      
      alert('✅ Revenu encaissé !');
    } catch (error) {
      console.error('❌ Erreur handleEncaisser:', error);
      alert(error?.message || 'Erreur encaissement');
    }
  };

  // ===== ANNULER PAIEMENT DÉPENSE =====
  const handleCancelPaymentExpense = async (exp, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');
      if (!window.confirm(`Annuler le paiement de ${formatCurrency(exp.amount)} ?`)) return;

      const allTx = await transactionsService.getAll();
      
      let matches = allTx.filter(t => 
        String(t.project_line_id) === String(exp.id) && t.is_posted === true
      );

      if (matches.length === 0) {
        matches = allTx.filter(t =>
          String(t.project_id) === String(project.id) &&
          t.type === 'expense' &&
          Number(t.amount) === Number(exp.amount) &&
          t.description.includes(exp.description)
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

      alert('✅ Paiement annulé.');
    } catch (err) {
      console.error('Erreur handleCancelPaymentExpense:', err);
      alert('Erreur annulation: ' + (err.message || err));
    }
  };

  // ===== ANNULER PAIEMENT REVENU =====
  const handleCancelPaymentRevenue = async (rev, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');
      if (!window.confirm(`Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`)) return;

      const allTx = await transactionsService.getAll();
      
      let matches = allTx.filter(t =>
        String(t.project_line_id) === String(rev.id) && t.is_posted === true
      );

      if (matches.length === 0) {
        matches = allTx.filter(t =>
          String(t.project_id) === String(project.id) &&
          t.type === 'income' &&
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

      alert('✅ Encaissement annulé.');
    } catch (err) {
      console.error('Erreur handleCancelPaymentRevenue:', err);
      alert('Erreur annulation: ' + (err.message || err));
    }
  };

  // ===== SAUVEGARDER L'ÉTAT DU PROJET =====
  const saveProjectState = async (currentExpenses, currentRevenues) => {
    if (!project?.id) return;

    const newTotalRevenues = currentRevenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const newTotalExpenses = currentExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    const newNetProfit = newTotalRevenues - newTotalExpenses;
    const newRoi = newTotalExpenses > 0 ? ((newNetProfit / newTotalExpenses) * 100).toFixed(1) : 0;

    const payload = {
      name: projectName.trim(),
      type: 'EXPORT',
      description: description || '',
      status: status || 'active',
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      totalCost: newTotalExpenses,
      totalRevenues: newTotalRevenues,
      netProfit: newNetProfit,
      roi: parseFloat(newRoi),
      expenses: JSON.stringify(currentExpenses),
      revenues: JSON.stringify(currentRevenues),
      metadata: JSON.stringify({
        pricePerContainer,
        containerCount,
        commissionRateProprio,
        commissionRateRandou,
        productType,
        destination,
        containerType
      })
    };

    await projectsService.updateProject(project.id, payload);
  };

  // ===== CALCULS FINANCIERS =====
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalRevenues = revenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netProfit = totalRevenues - totalExpenses;
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

  const totalAvailable = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  }, [accounts]);

  const theoreticalRevenue = pricePerContainer * containerCount;

  // ===== SAUVEGARDE FINALE =====
  const handleSave = async () => {
    if (!projectName.trim()) {
      alert("Le nom du projet est obligatoire");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: projectName.trim(),
        description: description.trim(),
        type: 'EXPORT',
        status,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        totalCost: parseFloat(totalExpenses) || 0,
        totalRevenues: parseFloat(totalRevenues) || 0,
        netProfit: parseFloat(netProfit) || 0,
        roi: parseFloat(roi) || 0,
        expenses: JSON.stringify(expenses),
        revenues: JSON.stringify(revenues),
        metadata: JSON.stringify({
          pricePerContainer,
          containerCount,
          commissionRateProprio,
          commissionRateRandou,
          productType,
          destination,
          containerType
        })
      };

      if (project?.id) {
        await projectsService.updateProject(project.id, payload);
      } else {
        await projectsService.createProject(payload);
      }

      if (onProjectSaved) onProjectSaved();
      onClose();
    } catch (e) {
      alert("Erreur sauvegarde: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Ship className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">
                {project ? 'Modifier' : 'Nouveau'} Projet Export
              </h2>
              <p className="text-blue-100 text-sm">
                Gestion des containers, commissions et revenus d'exportation
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* SECTION 1: INFORMATIONS GÉNÉRALES */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4">📋 Informations Générales</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom du Projet *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Export Pierres Industrielles Chine 2025"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="active">🟢 Actif</option>
                  <option value="completed">✅ Terminé</option>
                  <option value="paused">⏸️ En pause</option>
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows="2"
                  placeholder="Description du projet d'exportation..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date Début</label>
                <DatePicker
                  selected={startDate}
                  onChange={setStartDate}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Date Fin (Optionnelle)</label>
                <DatePicker
                  selected={endDate}
                  onChange={setEndDate}
                  dateFormat="dd/MM/yyyy"
                  className="w-full p-2 border rounded"
                  isClearable
                  placeholderText="Non définie"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PARAMÈTRES EXPORT */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4">🌍 Paramètres d'Export</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type de Produit</label>
                <input
                  type="text"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Pierres industrielles, Agate..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Chine, Inde, Europe..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type Container</label>
                <select
                  value={containerType}
                  onChange={(e) => setContainerType(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="20FT">20FT (Standard)</option>
                  <option value="40FT">40FT (High Cube)</option>
                  <option value="40HC">40HC (High Cube)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 3: CALCUL CONTAINERS & COMMISSIONS */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border-2 border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Calculator className="w-6 h-6 text-green-600" />
                Calcul Containers & Commissions
              </h3>
              <button
                onClick={generateContainerRevenues}
                disabled={!pricePerContainer || !containerCount}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Générer Ligne Globale
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prix par Container (USD)</label>
                <CalculatorInput
                  value={pricePerContainer}
                  onChange={setPricePerContainer}
                  placeholder="5000000"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Nombre de Containers</label>
                <CalculatorInput
                  value={containerCount}
                  onChange={setContainerCount}
                  placeholder="3"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Commission Proprio (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={commissionRateProprio * 100}
                  onChange={(e) => setCommissionRateProprio(parseFloat(e.target.value) / 100)}
                  className="w-full p-2 border rounded"
                  placeholder="20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Commission @RANDOU (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={commissionRateRandou * 100}
                  onChange={(e) => setCommissionRateRandou(parseFloat(e.target.value) / 100)}
                  className="w-full p-2 border rounded"
                  placeholder="10"
                />
              </div>
            </div>

            {/* Aperçu calculs */}
            {theoreticalRevenue > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-green-300">
                <h4 className="font-semibold mb-3 text-green-800">📊 Aperçu des calculs :</h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Revenu Total Théorique</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(theoreticalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Commission Proprio ({(commissionRateProprio * 100).toFixed(1)}%)</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(theoreticalRevenue * commissionRateProprio)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Commission @RANDOU ({(commissionRateRandou * 100).toFixed(1)}%)</p>
                    <p className="text-xl font-bold text-purple-600">{formatCurrency(theoreticalRevenue * commissionRateRandou)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Revenu Net Estimé</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(theoreticalRevenue * (1 - commissionRateProprio - commissionRateRandou))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: CHARGES */}
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                Charges ({expenses.length})
              </h3>
              <button
                onClick={addExpense}
                className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter Charge
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {expenses.map((exp, idx) => (
                <div key={exp.id} className={`bg-white p-3 rounded-lg border-2 grid grid-cols-12 gap-2 items-center ${exp.isPaid ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
                  <input
                    type="text"
                    value={exp.description}
                    onChange={(e) => updateExpense(exp.id, 'description', e.target.value)}
                    className="col-span-3 p-2 border rounded text-sm"
                    placeholder="Description"
                  />
                  
                  <select
                    value={exp.category}
                    onChange={(e) => updateExpense(exp.id, 'category', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                  >
                    {expenseCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>

                  <CalculatorInput
                    value={exp.amount}
                    onChange={(val) => updateExpense(exp.id, 'amount', val)}
                    className="col-span-2 p-2 border rounded text-sm font-semibold"
                  />

                  <DatePicker
                    selected={exp.date}
                    onChange={(date) => updateExpense(exp.id, 'date', date)}
                    dateFormat="dd/MM/yy"
                    className="col-span-2 p-2 border rounded text-sm"
                  />

                  <select
                    value={exp.account}
                    onChange={(e) => updateExpense(exp.id, 'account', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                  >
                    <option value="">Compte</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>

                  {!exp.isPaid ? (
                    <button
                      onClick={() => handlePayerDepense(exp, idx)}
                      disabled={!exp.account || !project?.id}
                      className="col-span-1 bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-50 text-xs"
                      title="Payer"
                    >
                      💳
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCancelPaymentExpense(exp, idx)}
                      className="col-span-1 bg-orange-500 text-white p-2 rounded hover:bg-orange-600 text-xs"
                      title="Annuler paiement"
                    >
                      ↩️
                    </button>
                  )}

                  <button
                    onClick={() => removeExpense(exp.id)}
                    className="col-span-1 text-red-600 hover:bg-red-100 p-2 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {expenses.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Aucune charge. Cliquez sur "Ajouter Charge" pour commencer.
                </p>
              )}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Charges: </span>
              <span className="font-bold text-red-600 text-xl">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>

          {/* SECTION 5: REVENUS */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Revenus ({revenues.length})
              </h3>
              <button
                onClick={addRevenue}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter Revenu
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {revenues.map((rev, idx) => (
                <div key={rev.id} className={`bg-white p-3 rounded-lg border-2 grid grid-cols-12 gap-2 items-center ${rev.isPaid ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <input
                    type="text"
                    value={rev.description}
                    onChange={(e) => updateRevenue(rev.id, 'description', e.target.value)}
                    className="col-span-3 p-2 border rounded text-sm"
                    placeholder="Description"
                  />
                  
                  <select
                    value={rev.category}
                    onChange={(e) => updateRevenue(rev.id, 'category', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                  >
                    {revenueCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>

                  <CalculatorInput
                    value={rev.amount}
                    onChange={(val) => updateRevenue(rev.id, 'amount', val)}
                    className="col-span-2 p-2 border rounded text-sm font-semibold"
                  />

                  <DatePicker
                    selected={rev.date}
                    onChange={(date) => updateRevenue(rev.id, 'date', date)}
                    dateFormat="dd/MM/yy"
                    className="col-span-2 p-2 border rounded text-sm"
                  />

                  <select
                    value={rev.account}
                    onChange={(e) => updateRevenue(rev.id, 'account', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                  >
                    <option value="">Compte</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.name}>{acc.name}</option>
                    ))}
                  </select>

                  {!rev.isPaid ? (
                    <button
                      onClick={() => handleEncaisser(rev, idx)}
                      disabled={!rev.account || !project?.id}
                      className="col-span-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                      title="Encaisser"
                    >
                      💰
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCancelPaymentRevenue(rev, idx)}
                      className="col-span-1 bg-orange-500 text-white p-2 rounded hover:bg-orange-600 text-xs"
                      title="Annuler encaissement"
                    >
                      ↩️
                    </button>
                  )}

                  <button
                    onClick={() => removeRevenue(rev.id)}
                    className="col-span-1 text-red-600 hover:bg-red-100 p-2 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {revenues.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Aucun revenu. Utilisez "Générer Ligne Globale" ou ajoutez manuellement.
                </p>
              )}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Revenus: </span>
              <span className="font-bold text-green-600 text-xl">{formatCurrency(totalRevenues)}</span>
            </div>
          </div>

          {/* RÉSUMÉ FINANCIER */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Résumé Financier
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-purple-100 text-sm">Total Charges</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-purple-100 text-sm">Total Revenus</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenues)}</p>
              </div>
              <div>
                <p className="text-purple-100 text-sm">Bénéfice Net</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
              <div>
                <p className="text-purple-100 text-sm">ROI</p>
                <p className={`text-2xl font-bold ${roi >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {roi}%
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="bg-gray-100 p-4 flex justify-between items-center border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-200 transition"
          >
            Annuler
          </button>
          
          <button
            onClick={handleSave}
            disabled={loading || !projectName.trim()}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Enregistrement...' : project ? 'Mettre à Jour' : 'Créer le Projet'}
          </button>
        </div>
      </div>
    </div>
  );
}
