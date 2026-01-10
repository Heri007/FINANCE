// src/components/projects/modals/ProductFlipModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Package,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  Percent,
  ShoppingCart,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { v4 as uuidv4 } from 'uuid';
import { projectsService } from '../../../services/projectsService';
import { transactionsService } from '../../../services/transactionsService';
import { formatCurrency } from '../../../utils/formatters';
import { CalculatorInput } from '../../common/CalculatorInput';
import { apiRequest } from '../../../services/api';

export function ProductFlipModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction,
}) {
  // ===== VÉRIFICATION SÉCURITÉ =====
  if (!createTransaction) {
    console.error('❌ createTransaction manquant dans ProductFlipModal !');
    return null;
  }

  // ===== ÉTATS DE BASE =====
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);

  // ===== ÉTATS SPÉCIFIQUES PRODUCT FLIP =====
  const [productName, setProductName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [targetMargin, setTargetMargin] = useState(50); // Marge cible en %

  // ===== CHARGES & VENTES =====
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);


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
          const meta =
            typeof project.metadata === 'string'
              ? JSON.parse(project.metadata)
              : project.metadata;

          setProductName(meta.productName || '');
          setSupplier(meta.supplier || '');
          setPurchasePrice(meta.purchasePrice || 0);
          setQuantity(meta.quantity || 0);
          setSellingPrice(meta.sellingPrice || 0);
          setTargetMargin(meta.targetMargin || 50);
        }

        // Fonction helper pour parser les listes
        const parseList = (data) => {
          if (!data) return [];
          if (Array.isArray(data)) return data;
          try {
            return JSON.parse(data);
          } catch {
            return [];
          }
        };

        let currentExpenses = parseList(project.expenses).map((e) => ({
          ...e,
          id: e.id || uuidv4(),
          date: e.date ? new Date(e.date) : new Date(),
          amount: parseFloat(e.amount) || 0,
        }));

        let currentRevenues = parseList(project.revenues).map((r) => ({
          ...r,
          id: r.id || uuidv4(),
          date: r.date ? new Date(r.date) : new Date(),
          amount: parseFloat(r.amount) || 0,
        }));

        // ✅ RÉCUPÉRER LES TRANSACTIONS RÉELLES LIÉES AU PROJET
        if (project.id) {
          try {
            const allTx = await transactionsService.getAll();
            const projectTx = allTx.filter(
              (t) => String(t.project_id) === String(project.id)
            );
            console.log(
              `📥 Transactions récupérées pour ProductFlip ${project.name}:`,
              projectTx.length
            );

            // Fusionner les transactions réelles avec les lignes budgétaires
            // ✅ NOUVEAU CODE
const mergeTransactions = (lines, type) => {
  return lines.map((line) => {
    const tx = projectTx.find(
      (t) => t.type === type && String(t.projectlineid) === String(line.dbLineId)
    );

    if (tx) {
      const accName = accounts.find((a) => a.id === tx.account_id)?.name || 'Inconnu';
      return {
        ...line,
        isPaid: true,
        account: accName,
        realDate: tx.transactiondate ? new Date(tx.transactiondate) : null,
      };
    }

    return line;  // ✅ Retourner tel quel si pas de transaction
  });
};


            currentExpenses = mergeTransactions(currentExpenses, 'expense');
            currentRevenues = mergeTransactions(currentRevenues, 'income');
          } catch (err) {
            console.error('Erreur synchronisation transactions:', err);
          }
        }

        setExpenses(currentExpenses);
        setRevenues(currentRevenues);
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
    setProductName('');
    setSupplier('');
    setPurchasePrice(0);
    setQuantity(0);
    setSellingPrice(0);
    setTargetMargin(50);
    setExpenses([]);
    setRevenues([]);
  };

  // ===== CALCULS AUTOMATIQUES =====
  const totalPurchaseCost = purchasePrice * quantity;
  const totalRevenue = sellingPrice * quantity;
  const grossProfit = totalRevenue - totalPurchaseCost;
  const grossMarginPercent =
    totalPurchaseCost > 0 ? ((grossProfit / totalPurchaseCost) * 100).toFixed(1) : 0;

  // Prix de vente suggéré basé sur la marge cible
  const suggestedSellingPrice = purchasePrice * (1 + targetMargin / 100);

  // ===== GÉNÉRER LIGNES D'ACHAT ET VENTE =====
  const generatePurchaseAndSale = () => {
    if (!productName || purchasePrice <= 0 || quantity <= 0) {
      alert("Veuillez remplir le nom du produit, prix d'achat et quantité");
      return;
    }

    // Vérifier si les lignes existent déjà
    const hasPurchase = expenses.some(
      (e) => e.category === 'Achat Stock' && e.description.includes(productName)
    );
    const hasSale = revenues.some(
      (r) => r.category === 'Vente' && r.description.includes(productName)
    );

    if (hasPurchase || hasSale) {
      if (!confirm("Des lignes d'achat/vente existent déjà. Les remplacer ?")) {
        return;
      }
      // Supprimer les anciennes lignes
      setExpenses((prev) =>
        prev.filter(
          (e) => !(e.category === 'Achat Stock' && e.description.includes(productName))
        )
      );
      setRevenues((prev) =>
        prev.filter(
          (r) => !(r.category === 'Vente' && r.description.includes(productName))
        )
      );
    }

    // Créer ligne d'achat
    const purchaseExpense = {
      id: uuidv4(),
      description: `Achat ${productName} (${quantity} unités @ ${formatCurrency(purchasePrice)})`,
      amount: totalPurchaseCost,
      category: 'Achat Stock',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false,
      metadata: {
        productName,
        supplier,
        quantity,
        unitPrice: purchasePrice,
      },
    };

    // Créer ligne de vente (si prix de vente défini)
    let saleRevenue = null;
    if (sellingPrice > 0) {
      saleRevenue = {
        id: uuidv4(),
        description: `Vente ${productName} (${quantity} unités @ ${formatCurrency(sellingPrice)})`,
        amount: totalRevenue,
        category: 'Vente',
        date: new Date(),
        account: '',
        isPaid: false,
        isRecurring: false,
        metadata: {
          productName,
          quantity,
          unitPrice: sellingPrice,
          margin: grossMarginPercent,
        },
      };
    }

    setExpenses((prev) => [...prev, purchaseExpense]);
    if (saleRevenue) {
      setRevenues((prev) => [...prev, saleRevenue]);
    }

    alert(
      `✅ Ligne(s) générée(s) :\n- Achat: ${formatCurrency(totalPurchaseCost)}\n${saleRevenue ? `- Vente: ${formatCurrency(totalRevenue)}` : ''}`
    );
  };

  // ===== CALCULER PRIX DE VENTE DEPUIS MARGE =====
  const applyTargetMargin = () => {
    if (purchasePrice <= 0) {
      alert("Définissez d'abord le prix d'achat");
      return;
    }
    setSellingPrice(suggestedSellingPrice);
  };

  // ===== CATÉGORIES =====
  const expenseCategories = [
    { value: 'Achat Stock', label: '🛒 Achat Stock' },
    { value: 'Transport', label: '🚚 Transport' },
    { value: 'Automobile', label: '🚗 Automobile' },
    { value: 'Fonds de roulement', label: '💰 Fonds de Roulmt' },
    { value: 'Équipements', label: '🔧 Équipements' },
    { value: 'Marketing', label: '📣 Marketing' },
    { value: 'Stockage', label: '📦 Stockage' },
    { value: 'Autre', label: '📋 Autre' },
  ];

  const revenueCategories = [
    { value: 'Vente', label: '💵 Vente' },
    { value: 'Vente Partielle', label: '💰 Vente Partielle' },
    { value: 'Autre', label: '💸 Autre' },
  ];

  // ===== GESTION DES LIGNES =====
  const addExpense = () => {
    setExpenses([
      ...expenses,
      {
        id: uuidv4(),
        description: '',
        amount: 0,
        category: 'Autre',
        date: new Date(),
        account: '',
        isPaid: false,
        isRecurring: false,
      },
    ]);
  };

  const addRevenue = () => {
    setRevenues([
      ...revenues,
      {
        id: uuidv4(),
        description: '',
        amount: 0,
        category: 'Vente',
        date: new Date(),
        account: '',
        isPaid: false,
        isRecurring: false,
      },
    ]);
  };

  const updateExpense = (id, field, value) => {
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const updateRevenue = (id, field, value) => {
    setRevenues(revenues.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const removeExpense = (id) => {
    if (confirm('Supprimer cette charge ?')) {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
  };

  const removeRevenue = (id) => {
    if (confirm('Supprimer ce revenu ?')) {
      setRevenues(revenues.filter((r) => r.id !== id));
    }
  };

// ===== PAYER DÉPENSE =====
const handlePayerDepense = async (expense) => {
  if (expense.isPaid === true) {
    alert('⚠️ Cette dépense est déjà payée');
    return;
  }

  if (isProcessingPayment) return;
  setIsProcessingPayment(true);

  try {
    if (!expense.account) {
      alert('❌ Veuillez choisir un compte');
      setIsProcessingPayment(false);
      return;
    }

    const accountObj = accounts.find((a) => a.name === expense.account);
    if (!accountObj) {
      alert('❌ Compte introuvable');
      setIsProcessingPayment(false);
      return;
    }

    let dbLineId = expense.dbLineId;
    
    if (!dbLineId) {
      const freshProject = await projectsService.getById(project.id);
      let expenseLines = freshProject?.expenseLines || freshProject?.expenselines || [];

      if (typeof expenseLines === 'string') {
        try {
          expenseLines = JSON.parse(expenseLines);
        } catch (e) {
          expenseLines = [];
        }
      }

      if (!Array.isArray(expenseLines) || expenseLines.length === 0) {
        alert('Impossible de trouver les lignes de dépenses.');
        setIsProcessingPayment(false);
        return;
      }

      const expenseAmount = parseFloat(expense.amount || 0);

      const expenseLine = expenseLines.find((line) => {
        const lineDesc = (line.description || '').trim().toLowerCase();
        const expDesc = (expense.description || '').trim().toLowerCase();
        if (lineDesc !== expDesc) return false;

        const lineAmount = parseFloat(
          line.projectedamount || line.projected_amount || line.amount || 0
        );

        return Math.abs(lineAmount - expenseAmount) < 0.01;
      });

      if (!expenseLine) {
        const createConfirm = confirm(
          `La ligne "${expense.description}" n'existe pas.\n\nCréer maintenant ?`
        );

        if (!createConfirm) {
          setIsProcessingPayment(false);
          return;
        }

        try {
          const newLine = await apiRequest(`/projects/${project.id}/expense-lines`, {
            method: 'POST',
            body: JSON.stringify({
              description: expense.description,
              category: expense.category || 'Projet - Charge',
              projected_amount: parseFloat(expense.amount),
              actual_amount: 0,
              transaction_date: expense.date || new Date().toISOString(),
              is_paid: false,
            })
          });

          dbLineId = newLine.id;
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (createError) {
          alert(`Impossible de créer la ligne:\n${createError.message}`);
          setIsProcessingPayment(false);
          return;
        }
      } else {
        dbLineId = expenseLine.id;
      }
    }

    const alreadyPaid = window.confirm(
      `💰 Payer ${formatCurrency(expense.amount)} depuis ${expense.account}.\n\n` +
      `Cette dépense a-t-elle DÉJÀ été payée physiquement ?\n\n` +
      `- OUI (OK) → Marquer comme payée, SANS créer de transaction.\n` +
      `- NON (Annuler) → Créer une transaction et débiter le compte.`
    );

    const payload = alreadyPaid
      ? {
          paid_externally: true,
          amount: expense.amount,
          paid_date: expense.date?.toISOString?.()?.split('T')[0] || new Date().toISOString().split('T')[0],
        }
      : {
          create_transaction: true,
          amount: expense.amount,
          paid_date: expense.date?.toISOString?.()?.split('T')[0] || new Date().toISOString().split('T')[0],
          account_id: accountObj.id,
        };

    await apiRequest(`/projects/${project.id}/expense-lines/${dbLineId}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    // RECHARGER
    const freshProject = await projectsService.getById(project.id);
    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try { return JSON.parse(data); } catch { return []; }
    };
    
    const freshExpenses = parseList(freshProject.expenses).map(e => ({
      ...e,
      id: e.id || uuidv4(),
      date: e.date ? new Date(e.date) : new Date(),
      amount: parseFloat(e.amount) || 0,
    }));
    
    setExpenses(freshExpenses);

    if (onProjectUpdated) await onProjectUpdated();
    
    alert('✅ Dépense marquée comme payée !');

  } catch (err) {
    console.error('❌ Erreur:', err);
    alert('❌ Erreur: ' + (err.message || 'Erreur inconnue'));
  } finally {
    setIsProcessingPayment(false);
  }
};


// ✅ ENCAISSER REVENU - VERSION COMPLÈTE
const handleEncaisser = async (rev, index) => {
  try {
    if (!rev.account) return alert('❌ Choisis un compte');
    
    const accountObj = accounts.find((a) => a.name === rev.account);
    if (!accountObj) return alert('❌ Compte introuvable');
    
    if (!project?.id) return alert('❌ Erreur : Projet introuvable.');

    if (!rev.dbLineId) {
      alert('❌ Cette ligne n\'a pas encore été enregistrée. Sauvegardez d\'abord le projet.');
      return;
    }

    const alreadyReceived = window.confirm(
      `💰 Encaisser ${formatCurrency(rev.amount)} sur ${rev.account}.\n\n` +
      `Ce revenu a-t-il DÉJÀ été encaissé physiquement ?\n\n` +
      `- OUI (OK) → Marquer comme reçu, SANS créer de transaction.\n` +
      `- NON (Annuler) → Créer une transaction et créditer le compte.`
    );

    const payload = alreadyReceived
      ? {
          received_externally: true,
          amount: parseFloat(rev.amount),
          received_date: rev.realDate 
            ? new Date(rev.realDate).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
        }
      : {
          create_transaction: true,
          amount: parseFloat(rev.amount),
          received_date: rev.realDate 
            ? new Date(rev.realDate).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
          account_id: accountObj.id,
        };

    await apiRequest(`/projects/${project.id}/revenue-lines/${rev.dbLineId}/mark-received`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    // ✅ RECHARGER COMPLÈTEMENT
    const freshProject = await projectsService.getById(project.id);
    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try { return JSON.parse(data); } catch { return []; }
    };
    
    const freshRevenues = parseList(freshProject.revenues).map(r => ({
      ...r,
      id: r.id || uuidv4(),
      date: r.date ? new Date(r.date) : new Date(),
      amount: parseFloat(r.amount) || 0,
    }));
    
    setRevenues(freshRevenues);

    if (onProjectUpdated) onProjectUpdated();
    
    alert('✅ Revenu marqué comme reçu !');
  } catch (error) {
    console.error('❌ Erreur handleEncaisser:', error);
    alert(error?.message || 'Erreur encaissement');
  }
};

// ✅ ANNULER PAIEMENT DÉPENSE
const handleCancelPaymentExpense = async (exp, index) => {
  try {
    if (!project?.id) return alert('❌ Projet non enregistré');
    if (!exp.dbLineId) {
      alert('❌ Cette ligne n\'a pas encore été enregistrée.');
      return;
    }
    if (!window.confirm(`🔄 Annuler le paiement de ${formatCurrency(exp.amount)} ?`)) return;

    await apiRequest(`/projects/${project.id}/expense-lines/${exp.dbLineId}/cancel-payment`, {
      method: 'PATCH',
    });

    // ✅ RECHARGER COMPLÈTEMENT
    const freshProject = await projectsService.getById(project.id);
    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try { return JSON.parse(data); } catch { return []; }
    };
    
    const freshExpenses = parseList(freshProject.expenses).map(e => ({
      ...e,
      id: e.id || uuidv4(),
      date: e.date ? new Date(e.date) : new Date(),
      amount: parseFloat(e.amount) || 0,
    }));
    
    setExpenses(freshExpenses);

    if (onProjectUpdated) onProjectUpdated();
    
    alert('✅ Paiement annulé');
  } catch (err) {
    console.error('❌ Erreur handleCancelPaymentExpense:', err);
    alert('Erreur annulation : ' + (err.message || err));
  }
};

// ✅ ANNULER ENCAISSEMENT REVENU
const handleCancelPaymentRevenue = async (rev, index) => {
  try {
    if (!project?.id) return alert('❌ Projet non enregistré');
    if (!rev.dbLineId) {
      alert('❌ Cette ligne n\'a pas encore été enregistrée.');
      return;
    }
    if (!window.confirm(`🔄 Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`)) return;

    await apiRequest(`/projects/${project.id}/revenue-lines/${rev.dbLineId}/cancel-receipt`, {
      method: 'PATCH',
    });

    // ✅ RECHARGER COMPLÈTEMENT
    const freshProject = await projectsService.getById(project.id);
    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try { return JSON.parse(data); } catch { return []; }
    };
    
    const freshRevenues = parseList(freshProject.revenues).map(r => ({
      ...r,
      id: r.id || uuidv4(),
      date: r.date ? new Date(r.date) : new Date(),
      amount: parseFloat(r.amount) || 0,
    }));
    
    setRevenues(freshRevenues);

    if (onProjectUpdated) onProjectUpdated();
    
    alert('✅ Encaissement annulé');
  } catch (err) {
    console.error('❌ Erreur handleCancelPaymentRevenue:', err);
    alert('Erreur annulation : ' + (err.message || err));
  }
};

  // ===== CALCULS FINANCIERS =====
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const totalRevenues = revenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const netProfit = totalRevenues - totalExpenses;
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

  const totalAvailable = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  }, [accounts]);

  // ===== SAUVEGARDE FINALE =====
  const handleSave = async () => {
  if (!projectName.trim()) {
    alert('Le nom du projet est obligatoire');
    return;
  }

  setLoading(true);

  // ✅ DÉDUPLIQUER et VALIDER
  const uniqueExpenses = [];
  const seenDbLineIds = new Set();
  
  for (const exp of expenses) {
    // Déduplication par dbLineId
    if (exp.dbLineId) {
      if (seenDbLineIds.has(exp.dbLineId)) {
        console.warn(`⚠️ Doublon ignoré: ${exp.description} (dbLineId: ${exp.dbLineId})`);
        continue;
      }
      seenDbLineIds.add(exp.dbLineId);
    }
    
    // Valider montant positif
    const amount = parseFloat(exp.amount);
    if (amount < 0) {
      console.warn(`⚠️ Montant négatif corrigé pour: ${exp.description}`);
      exp.amount = Math.abs(amount);
    }
    
    uniqueExpenses.push(exp);
  }

  const expensesWithDate = uniqueExpenses.map((exp) => ({
    ...exp,
    plannedDate: exp.date ? new Date(exp.date).toISOString().split('T')[0] : null,
  }));

  const revenuesWithDate = revenues.map((rev) => ({
    ...rev,
    plannedDate: rev.date ? new Date(rev.date).toISOString().split('T')[0] : null,
  }));

  try {
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      type: 'PRODUCTFLIP',
      status,
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      totalCost: parseFloat(totalExpenses) || 0,
      totalRevenues: parseFloat(totalRevenues) || 0,
      netProfit: parseFloat(netProfit) || 0,
      roi: parseFloat(roi) || 0,
      expenses: JSON.stringify(expensesWithDate),
      revenues: JSON.stringify(revenuesWithDate),
      metadata: JSON.stringify({
        productName,
        supplier,
        purchasePrice,
        quantity,
        sellingPrice,
        targetMargin,
      }),
    };

    if (project?.id) {
      await projectsService.updateProject(project.id, payload);
    } else {
      await projectsService.createProject(payload);
    }

    if (onProjectSaved) onProjectSaved();
    onClose();
  } catch (e) {
    console.error('❌ Erreur sauvegarde:', e);
    alert('Erreur sauvegarde: ' + e.message);
  } finally {
    setLoading(false);
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">
                {project ? 'Modifier' : 'Nouveau'} Projet Achat/Revente
              </h2>
              <p className="text-green-100 text-sm">
                Product Flip - Achat de stock pour revente rapide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-lg transition"
          >
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
                  placeholder="Ex: Achat/Revente Produits Électroniques"
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
                  placeholder="Description du projet..."
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
                <label className="block text-sm font-medium mb-1">
                  Date Fin (Optionnelle)
                </label>
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

          {/* SECTION 2: CALCULATEUR ACHAT/VENTE */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Calculator className="w-6 h-6 text-blue-600" />
                Calculateur Achat/Vente
              </h3>
              <button
                onClick={generatePurchaseAndSale}
                disabled={!productName || purchasePrice <= 0 || quantity <= 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-4 h-4" />
                Générer Lignes
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Nom du Produit</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Smartphones Samsung A50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Fournisseur</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Jumia, Alibaba..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Prix d'Achat Unitaire
                </label>
                <CalculatorInput
                  value={purchasePrice}
                  onChange={setPurchasePrice}
                  placeholder="500000"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quantité</label>
                <CalculatorInput
                  value={quantity}
                  onChange={setQuantity}
                  placeholder="10"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Coût Total d'Achat
                </label>
                <input
                  type="text"
                  value={formatCurrency(totalPurchaseCost)}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-100 font-bold text-red-600"
                />
              </div>
            </div>

            <div className="border-t-2 border-blue-300 pt-4 mt-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Marge Cible (%)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="1"
                      value={targetMargin}
                      onChange={(e) => setTargetMargin(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border rounded"
                      placeholder="50"
                    />
                    <button
                      onClick={applyTargetMargin}
                      className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700"
                      title="Appliquer la marge"
                    >
                      <Percent className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Prix de Vente Suggéré
                  </label>
                  <input
                    type="text"
                    value={formatCurrency(suggestedSellingPrice)}
                    readOnly
                    className="w-full p-2 border rounded bg-purple-100 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Prix de Vente Unitaire
                  </label>
                  <CalculatorInput
                    value={sellingPrice}
                    onChange={setSellingPrice}
                    placeholder="750000"
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Revenu Total</label>
                  <input
                    type="text"
                    value={formatCurrency(totalRevenue)}
                    readOnly
                    className="w-full p-2 border rounded bg-gray-100 font-bold text-green-600"
                  />
                </div>
              </div>
            </div>

            {/* Aperçu marges */}
            {totalPurchaseCost > 0 && totalRevenue > 0 && (
              <div className="mt-4 bg-white p-4 rounded-lg border-2 border-green-300">
                <h4 className="font-semibold mb-3 text-green-800">
                  📊 Analyse de Marge :
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Bénéfice Brut</p>
                    <p
                      className={`text-2xl font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(grossProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Marge Brute</p>
                    <p
                      className={`text-2xl font-bold ${grossMarginPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {grossMarginPercent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Marge par Unité</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(sellingPrice - purchasePrice)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* SECTION 3: CHARGES */}
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
    {expenses.map((exp, idx) => {
      // ✅ CALCULER isPaid DEPUIS LA DB (source de vérité)
      const expenseLine = project?.expenseLines?.find(
        line => String(line.id) === String(exp.dbLineId)
      );
      const isPaid = expenseLine?.is_paid || expenseLine?.ispaid || false;

      return (
        <div
          key={exp.id}
          className={`bg-white p-3 rounded-lg border-2 grid grid-cols-12 gap-2 items-center ${isPaid ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
        >
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
            {expenseCategories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
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
            placeholderText="Date planifiée"
          />
          <DatePicker
            selected={exp.realDate || null}
            onChange={(date) => updateExpense(exp.id, 'realDate', date)}
            dateFormat="dd/MM/yy"
            className="col-span-2 p-2 border rounded text-sm bg-amber-50"
            placeholderText="Date réelle"
          />
          <select
            value={exp.account}
            onChange={(e) => updateExpense(exp.id, 'account', e.target.value)}
            className="col-span-2 p-2 border rounded text-sm"
          >
            <option value="">Compte</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.name}>
                {acc.name}
              </option>
            ))}
          </select>
          
          {!isPaid ? (
            <button
              disabled={isProcessingPayment}
              onClick={async () => {
                await handlePayerDepense(exp);
              }}
              className={`col-span-1 ${
                isProcessingPayment 
                  ? 'bg-gray-400 cursor-wait' 
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white p-2 rounded text-xs disabled:opacity-50`}
              title="Marquer comme payé"
            >
              {isProcessingPayment ? '⏳...' : '💳 Payer'}
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
      );
    })}

    {expenses.length === 0 && (
      <p className="text-center text-gray-500 py-8">
        Aucune charge. Utilisez "Générer Lignes" ou ajoutez manuellement.
      </p>
    )}
  </div>

  <div className="mt-3 text-right">
    <span className="text-sm text-gray-600">Total Charges: </span>
    <span className="font-bold text-red-600 text-xl">
      {formatCurrency(totalExpenses)}
    </span>
  </div>
</div>


          {/* SECTION 4: REVENUS */}
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
                <div
                  key={rev.id}
                  className={`bg-white p-3 rounded-lg border-2 grid grid-cols-12 gap-2 items-center ${rev.isPaid ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}
                >
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
                    {revenueCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <CalculatorInput
                    value={rev.amount}
                    onChange={(val) => updateRevenue(rev.id, 'amount', val)}
                    className="col-span-2 p-2 border rounded text-sm font-semibold"
                  />
                  {/* Date planifiée */}
                  <DatePicker
                    selected={rev.date}
                    onChange={(date) => updateRevenue(rev.id, 'date', date)}
                    dateFormat="dd/MM/yy"
                    className="col-span-2 p-2 border rounded text-sm"
                    placeholderText="Date planifiée"
                  />
                  /* Date réelle */
                  <DatePicker
                    selected={rev.realDate || null}
                    onChange={(date) => updateRevenue(rev.id, 'realDate', date)}
                    dateFormat="dd/MM/yy"
                    className="col-span-2 p-2 border rounded text-sm bg-amber-50"
                    placeholderText="Date réelle"
                  />
                  <select
                    value={rev.account}
                    onChange={(e) => updateRevenue(rev.id, 'account', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                  >
                    <option value="">Compte</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name}
                      </option>
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
                  Aucun revenu. Utilisez "Générer Lignes" ou ajoutez manuellement.
                </p>
              )}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Revenus: </span>
              <span className="font-bold text-green-600 text-xl">
                {formatCurrency(totalRevenues)}
              </span>
            </div>
          </div>

          {/* RÉSUMÉ FINANCIER */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Résumé Financier
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-indigo-100 text-sm">Total Charges</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm">Total Revenus</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenues)}</p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm">Bénéfice Net</p>
                <p
                  className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}
                >
                  {formatCurrency(netProfit)}
                </p>
              </div>
              <div>
                <p className="text-indigo-100 text-sm">ROI</p>
                <p
                  className={`text-2xl font-bold ${roi >= 0 ? 'text-green-300' : 'text-red-300'}`}
                >
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
            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Save className="w-5 h-5" />
            {loading
              ? 'Enregistrement...'
              : project
                ? 'Mettre à Jour'
                : 'Créer le Projet'}
          </button>
        </div>
      </div>
    </div>
  );
}
