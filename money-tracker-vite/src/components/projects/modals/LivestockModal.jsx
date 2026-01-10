// src/components/projects/modals/LivestockModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Heart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  Calendar,
  Activity,
  Zap,
  RefreshCw,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { v4 as uuidv4 } from 'uuid';
import { projectsService } from '../../../services/projectsService';
import { transactionsService } from '../../../services/transactionsService';
import { formatCurrency } from '../../../utils/formatters';
import { CalculatorInput } from '../../common/CalculatorInput';
import api from '../../../services/api';
import { PartnersSection } from '../../PartnersSection';
import { ProfitDistributionPanel } from '../../ProfitDistributionPanel';


export function LivestockModal({
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
    console.error('❌ createTransaction manquant dans LivestockModal !');
    return null;
  }

  // ===== ÉTATS DE BASE =====
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);

  // ===== ÉTATS SPÉCIFIQUES ÉLEVAGE =====
  const [animalType, setAnimalType] = useState(''); // Type d'animal
  const [breed, setBreed] = useState(''); // Race
  const [cycleCount, setCycleCount] = useState(0); // Nombre de cycles par an
  const [cycleDuration, setCycleDuration] = useState(0); // Durée d'un cycle (jours)
  const [headsPerCycle, setHeadsPerCycle] = useState(0); // Têtes par cycle
  const [currentCycleNumber, setCurrentCycleNumber] = useState(1); // Cycle actuel

  // Coûts
  const [poussinPrice, setPoussinPrice] = useState(0); // Prix poussin/oison
  const [feedCostPerCycle, setFeedCostPerCycle] = useState(0); // Coût provende/cycle

  // Vente
  const [targetWeight, setTargetWeight] = useState(0); // Poids cible (kg)
  const [sellingPricePerKg, setSellingPricePerKg] = useState(0); // Prix de vente/kg
  const [sellingPricePerUnit, setSellingPricePerUnit] = useState(0); // Prix de vente/unité
  const [mortalityRate, setMortalityRate] = useState(4); // Taux de mortalité %

  // Localisation
  const [farmLocation, setFarmLocation] = useState('');

  // Suivi du cheptel actuel
  const [currentHeadCount, setCurrentHeadCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [deathCount, setDeathCount] = useState(0);

  // ===== CHARGES & VENTES =====
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);


  // ===== TYPES D'ANIMAUX AVEC PARAMÈTRES PAR DÉFAUT =====
  const animalPresets = {
    'Poulets de chair': {
      icon: '🐔',
      defaultBreed: '',
      defaultCycleCount: 8,
      defaultCycleDuration: 45,
      defaultHeadsPerCycle: 500,
      defaultPoussinPrice: 4200,
      defaultFeedCostPerCycle: 5062800,
      defaultTargetWeight: 2.5,
      defaultSellingPricePerKg: 10000,
      defaultMortalityRate: 4,
      defaultLocation: 'Sabotsy Namehana',
    },
    Oies: {
      icon: '🦆',
      defaultBreed: '',
      defaultCycleCount: 4,
      defaultCycleDuration: 84, // 12 semaines
      defaultHeadsPerCycle: 200,
      defaultPoussinPrice: 25000,
      defaultFeedCostPerCycle: 4710000,
      defaultTargetWeight: 4.5,
      defaultSellingPricePerKg: 0, // Vendu à l'unité
      defaultSellingPricePerUnit: 77500,
      defaultMortalityRate: 5,
      defaultLocation: 'Bypass',
    },
    Kuroiler: {
      icon: '🐓',
      defaultBreed: 'Race améliorée',
      defaultCycleCount: 12, // Production d'œufs mensuelle
      defaultCycleDuration: 30,
      defaultHeadsPerCycle: 7,
      defaultPoussinPrice: 0, // Reproduction naturelle
      defaultFeedCostPerCycle: 93750,
      defaultTargetWeight: 4,
      defaultSellingPricePerKg: 0,
      defaultSellingPricePerUnit: 3000, // Prix de l'œuf
      defaultMortalityRate: 2,
      defaultLocation: 'Sabotsy Namehana',
    },
    Bovins: {
      icon: '🐄',
      defaultBreed: '',
      defaultCycleCount: 1,
      defaultCycleDuration: 365,
      defaultMortalityRate: 2,
    },
    Porcins: {
      icon: '🐷',
      defaultBreed: '',
      defaultCycleCount: 2,
      defaultCycleDuration: 180,
      defaultMortalityRate: 3,
    },
    Ovins: {
      icon: '🐑',
      defaultBreed: '',
      defaultCycleCount: 1,
      defaultCycleDuration: 365,
      defaultMortalityRate: 5,
    },
    Caprins: {
      icon: '🐐',
      defaultBreed: '',
      defaultCycleCount: 2,
      defaultCycleDuration: 180,
      defaultMortalityRate: 5,
    },
    Canards: {
      icon: '🦆',
      defaultBreed: '',
      defaultCycleCount: 4,
      defaultCycleDuration: 90,
      defaultMortalityRate: 4,
    },
    Lapins: {
      icon: '🐰',
      defaultBreed: '',
      defaultCycleCount: 6,
      defaultCycleDuration: 60,
      defaultMortalityRate: 10,
    },
    Autre: {
      icon: '🦎',
      defaultBreed: '',
      defaultCycleCount: 1,
      defaultCycleDuration: 365,
      defaultMortalityRate: 5,
    },
  };

  // ===== APPLICATION DES PRESETS =====
  const applyAnimalPreset = (type) => {
    const preset = animalPresets[type];
    if (!preset) return;

    setAnimalType(type);
    setBreed(preset.defaultBreed || '');
    setCycleCount(preset.defaultCycleCount || 1);
    setCycleDuration(preset.defaultCycleDuration || 90);
    setHeadsPerCycle(preset.defaultHeadsPerCycle || 0);
    setPoussinPrice(preset.defaultPoussinPrice || 0);
    setFeedCostPerCycle(preset.defaultFeedCostPerCycle || 0);
    setTargetWeight(preset.defaultTargetWeight || 0);
    setSellingPricePerKg(preset.defaultSellingPricePerKg || 0);
    setSellingPricePerUnit(preset.defaultSellingPricePerUnit || 0);
    setMortalityRate(preset.defaultMortalityRate || 5);
    setFarmLocation(preset.defaultLocation || '');
  };

  // ===== CALCULS AUTOMATIQUES =====
  const headsAfterMortality = Math.round(headsPerCycle * (1 - mortalityRate / 100));
  const totalPoussinCost = headsPerCycle * poussinPrice;
  const costPerCycle = totalPoussinCost + feedCostPerCycle;

  // Revenus par cycle
  const revenuePerCycle =
    sellingPricePerUnit > 0
      ? headsAfterMortality * sellingPricePerUnit
      : headsAfterMortality * targetWeight * sellingPricePerKg;

  const profitPerCycle = revenuePerCycle - costPerCycle;
  const marginPercent =
    costPerCycle > 0 ? ((profitPerCycle / costPerCycle) * 100).toFixed(1) : 0;

  // Projections annuelles
  const annualCost = costPerCycle * cycleCount;
  const annualRevenue = revenuePerCycle * cycleCount;
  const annualProfit = profitPerCycle * cycleCount;
  const annualROI = annualCost > 0 ? ((annualProfit / annualCost) * 100).toFixed(1) : 0;

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

        setAnimalType(meta.animalType || '');
        setBreed(meta.breed || '');
        setCycleCount(meta.cycleCount || 0);
        setCycleDuration(meta.cycleDuration || 0);
        setHeadsPerCycle(meta.headsPerCycle || 0);
        setCurrentCycleNumber(meta.currentCycleNumber || 1);
        setPoussinPrice(meta.poussinPrice || 0);
        setFeedCostPerCycle(meta.feedCostPerCycle || 0);
        setTargetWeight(meta.targetWeight || 0);
        setSellingPricePerKg(meta.sellingPricePerKg || 0);
        setSellingPricePerUnit(meta.sellingPricePerUnit || 0);
        setMortalityRate(meta.mortalityRate || 4);
        setFarmLocation(meta.farmLocation || '');
        setCurrentHeadCount(meta.currentHeadCount || 0);
        setSoldCount(meta.soldCount || 0);
        setDeathCount(meta.deathCount || 0);
      }

      const parseList = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        try { return JSON.parse(data); } catch { return []; }
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

      // ✅ RÉCUPÉRER ET FUSIONNER LES TRANSACTIONS
      if (project.id) {
        try {
          const allTx = await transactionsService.getAll();
          const projectTx = allTx.filter((t) => String(t.projectid) === String(project.id));
          console.log(`📥 Transactions récupérées pour Livestock ${project.name}: ${projectTx.length}`);

          const mergeTransactions = (lines, type) => {
            return lines.map((line) => {
              const tx = projectTx.find(
                (t) => t.type === type && String(t.projectlineid) === String(line.dbLineId)
              );

              if (tx) {
                const accName = accounts.find((a) => a.id === tx.accountid)?.name || 'Inconnu';
                return {
                  ...line,
                  isPaid: true,
                  account: accName,
                  realDate: tx.transactiondate ? new Date(tx.transactiondate) : null,
                };
              }

              return line;
            });
          };

          currentExpenses = mergeTransactions(currentExpenses, 'expense');
          currentRevenues = mergeTransactions(currentRevenues, 'income');
        } catch (err) {
          console.error('❌ Erreur synchronisation:', err);
        }
      }

      setExpenses(currentExpenses);
      setRevenues(currentRevenues);
    } else {
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
    setAnimalType('');
    setBreed('');
    setCycleCount(0);
    setCycleDuration(0);
    setHeadsPerCycle(0);
    setCurrentCycleNumber(1);
    setPoussinPrice(0);
    setFeedCostPerCycle(0);
    setTargetWeight(0);
    setSellingPricePerKg(0);
    setSellingPricePerUnit(0);
    setMortalityRate(4);
    setFarmLocation('');
    setCurrentHeadCount(0);
    setSoldCount(0);
    setDeathCount(0);
    setExpenses([]);
    setRevenues([]);
  };

  // ===== GÉNÉRER UN CYCLE COMPLET =====
  const generateCompleteCycle = () => {
    if (!animalType || headsPerCycle <= 0 || costPerCycle <= 0) {
      alert('Veuillez définir tous les paramètres du cycle');
      return;
    }

    const cycleDate = new Date(startDate);
    const cycleDays = cycleDuration || 45;
    cycleDate.setDate(cycleDate.getDate() + (currentCycleNumber - 1) * cycleDays);

    // Ligne d'achat des poussins/oisons
    if (poussinPrice > 0) {
      const poussinLabel =
        animalType === 'Oies'
          ? 'Oisons'
          : animalType === 'Poulets de chair'
            ? 'Poussins'
            : 'Jeunes';
      const poussinExpense = {
        id: uuidv4(),
        description: `Achat ${headsPerCycle} ${poussinLabel} - Cycle ${currentCycleNumber} (${animalType})`,
        amount: totalPoussinCost,
        category: 'Achat Cheptel',
        date: new Date(cycleDate),
        account: '',
        isPaid: false,
        isRecurring: false,
        metadata: {
          animalType,
          cycleNumber: currentCycleNumber,
          heads: headsPerCycle,
          pricePerHead: poussinPrice,
        },
      };
      setExpenses((prev) => [...prev, poussinExpense]);
    }

    // Ligne d'alimentation du cycle
    const feedExpense = {
      id: uuidv4(),
      description: `Provende ${animalType} - Cycle ${currentCycleNumber} (${cycleDays} jours)`,
      amount: feedCostPerCycle,
      category: 'Alimentation',
      date: new Date(cycleDate),
      account: '',
      isPaid: false,
      isRecurring: false,
      metadata: {
        animalType,
        cycleNumber: currentCycleNumber,
        cycleDuration: cycleDays,
      },
    };
    setExpenses((prev) => [...prev, feedExpense]);

    // Ligne de revenu de vente
    const saleDate = new Date(cycleDate);
    saleDate.setDate(saleDate.getDate() + cycleDays);

    const saleRevenue = {
      id: uuidv4(),
      description: `Vente ${animalType} - Cycle ${currentCycleNumber} (${headsAfterMortality} têtes @ ${sellingPricePerUnit > 0 ? formatCurrency(sellingPricePerUnit) : `${targetWeight}kg x ${formatCurrency(sellingPricePerKg)}/kg`})`,
      amount: revenuePerCycle,
      category: 'Vente Bétail',
      date: saleDate,
      account: '',
      isPaid: false,
      isRecurring: false,
      metadata: {
        animalType,
        cycleNumber: currentCycleNumber,
        headsSold: headsAfterMortality,
        pricePerUnit: sellingPricePerUnit || targetWeight * sellingPricePerKg,
      },
    };
    setRevenues((prev) => [...prev, saleRevenue]);

    setCurrentCycleNumber((prev) => prev + 1);
    alert(
      `✅ Cycle ${currentCycleNumber} généré :\n- Coût: ${formatCurrency(costPerCycle)}\n- Revenu: ${formatCurrency(revenuePerCycle)}\n- Profit: ${formatCurrency(profitPerCycle)}`
    );
  };

  // ===== GÉNÉRER TOUS LES CYCLES DE L'ANNÉE =====
  const generateAllCycles = () => {
    if (!animalType || cycleCount <= 0 || costPerCycle <= 0) {
      alert('Définissez tous les paramètres avant de générer les cycles annuels');
      return;
    }

    if (
      !confirm(
        `Générer ${cycleCount} cycles complets pour ${animalType} ?\n\nCoût total: ${formatCurrency(annualCost)}\nRevenu total: ${formatCurrency(annualRevenue)}\nProfit total: ${formatCurrency(annualProfit)}`
      )
    ) {
      return;
    }

    const cycleDays = cycleDuration || 45;
    const newExpenses = [];
    const newRevenues = [];

    for (let i = 0; i < cycleCount; i++) {
      const cycleDate = new Date(startDate);
      cycleDate.setDate(cycleDate.getDate() + i * cycleDays);

      // Achat poussins
      if (poussinPrice > 0) {
        const poussinLabel =
          animalType === 'Oies'
            ? 'Oisons'
            : animalType === 'Poulets de chair'
              ? 'Poussins'
              : 'Jeunes';
        newExpenses.push({
          id: uuidv4(),
          description: `Achat ${headsPerCycle} ${poussinLabel} - Cycle ${i + 1}`,
          amount: totalPoussinCost,
          category: 'Achat Cheptel',
          date: new Date(cycleDate),
          account: '',
          isPaid: false,
          isRecurring: false,
          metadata: { cycleNumber: i + 1, animalType },
        });
      }

      // Alimentation
      newExpenses.push({
        id: uuidv4(),
        description: `Provende ${animalType} - Cycle ${i + 1}`,
        amount: feedCostPerCycle,
        category: 'Alimentation',
        date: new Date(cycleDate),
        account: '',
        isPaid: false,
        isRecurring: false,
        metadata: { cycleNumber: i + 1, animalType },
      });

      // Vente
      const saleDate = new Date(cycleDate);
      saleDate.setDate(saleDate.getDate() + cycleDays);
      newRevenues.push({
        id: uuidv4(),
        description: `Vente ${animalType} - Cycle ${i + 1} (${headsAfterMortality} têtes)`,
        amount: revenuePerCycle,
        category: 'Vente Bétail',
        date: saleDate,
        account: '',
        isPaid: false,
        isRecurring: false,
        metadata: { cycleNumber: i + 1, animalType, headsSold: headsAfterMortality },
      });
    }

    setExpenses((prev) => [...prev, ...newExpenses]);
    setRevenues((prev) => [...prev, ...newRevenues]);
    setCurrentCycleNumber(cycleCount + 1);

    alert(`✅ ${cycleCount} cycles générés avec succès !`);
  };

  // ===== CATÉGORIES =====
  const expenseCategories = [
    { value: 'CAPEX', label: '🏗️ CAPEX' },
    { value: 'Achat Cheptel', label: '🐣 Achat Cheptel' },
    { value: 'Alimentation', label: '🌾 Alimentation' },
    { value: 'Vétérinaire', label: '💉 Vétérinaire' },
    { value: "Main d'œuvre", label: "👷 Main d'œuvre" },
    { value: 'Loyer & Frais', label: '🏠 Loyer & Frais' },
    { value: 'Équipements', label: '🔧 Équipements' },
    { value: 'Transport', label: '🚚 Transport' },
    { value: 'Autre', label: '📋 Autre' },
  ];

  const revenueCategories = [
    { value: 'Vente Bétail', label: '🐄 Vente Bétail' },
    { value: 'Vente Produits', label: '🥚 Vente Produits' },
    { value: 'Autre', label: '💰 Autre' },
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
        category: 'Vente Bétail',
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

  // ============================================================================
  // PAYER DÉPENSE - MODÈLE CARRIERE ADAPTÉ POUR LIVESTOCK
  // ============================================================================
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
          paid_externally: true,  // ✅ AVEC underscore
          amount: expense.amount,
          paid_date: expense.date?.toISOString?.()?.split('T')[0] || new Date().toISOString().split('T')[0],  // ✅ AVEC underscore
        }
      : {
          create_transaction: true,  // ✅ AVEC underscore
          amount: expense.amount,
          paid_date: expense.date?.toISOString?.()?.split('T')[0] || new Date().toISOString().split('T')[0],  // ✅ AVEC underscore
          account_id: accountObj.id,  // ✅ AVEC underscore
        };

    await apiRequest(`/projects/${project.id}/expense-lines/${dbLineId}/mark-paid`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    // ✅ RECHARGER
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
    
    alert('✅ Dépense marquée comme payée !');

  } catch (err) {
    console.error('❌ Erreur:', err);
    alert('❌ Erreur: ' + (err.message || 'Erreur inconnue'));
  } finally {
    setIsProcessingPayment(false);
  }
};
  /// ===== ENCAISSER REVENU (IDENTIQUE À ProductFlipModal) =====
const handleEncaisser = async (rev, index) => {
  try {
    if (!rev.account) return alert('❌ Choisis un compte');
    
    const accountObj = accounts.find((a) => a.name === rev.account);
    if (!accountObj) return alert('❌ Compte introuvable');
    
    if (!project?.id) return alert('❌ Erreur : Projet introuvable.');

    // ✅ VÉRIFIER QUE dbLineId existe
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

  // ===== ANNULER PAIEMENT DÉPENSE =====
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

    // ✅ RECHARGER COMPLÈTEMENT (au lieu de mise à jour par index)
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

  // ===== ANNULER ENCAISSEMENT REVENU =====
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

  // ✅ SAUVEGARDE FINALE CORRIGÉE - AVEC transaction_date synchronisé
const handleSave = async () => {
  if (!projectName.trim()) {
    alert('Le nom du projet est obligatoire');
    return;
  }

  setLoading(true);

  // ✅ NETTOYER et SYNCHRONISER les dates
  const expensesWithDate = expenses.map((exp) => {
    const { isPaid, actualAmount, transactionDate, realDate, ...cleanExp } = exp;
    return {
      ...cleanExp,
      dbLineId: exp.dbLineId || null,
      plannedDate: exp.date ? new Date(exp.date).toISOString().split('T')[0] : null,
      transaction_date: exp.date ? new Date(exp.date).toISOString() : null, // ✅ AJOUTÉ
    };
  });

  const revenuesWithDate = revenues.map((rev) => {
    const { isPaid, isReceived, actualAmount, transactionDate, ...cleanRev } = rev;
    return {
      ...cleanRev,
      dbLineId: rev.dbLineId || null,
      plannedDate: Array.isArray(rev.date) ? rev.date : // ✅ CORRECTION bug plannedDate array
        (rev.date ? new Date(rev.date).toISOString().split('T')[0] : null),
      transaction_date: Array.isArray(rev.date) ? null : // ✅ CORRECTION
        (rev.date ? new Date(rev.date).toISOString() : null), // ✅ AJOUTÉ
    };
  });

  try {
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      type: 'LIVESTOCK',
      status,
      startDate: startDate.toISOString(),
      endDate: endDate ? endDate.toISOString() : null,
      totalCost: parseFloat(totalExpenses) || 0,
      totalRevenues: parseFloat(totalRevenues) || 0,
      netProfit: parseFloat(netProfit) || 0,
      roi: parseFloat(roi) || 0,
      expenses: JSON.stringify(expensesWithDate), // ✅ AVEC transaction_date
      revenues: JSON.stringify(revenuesWithDate), // ✅ AVEC transaction_date
      metadata: JSON.stringify({
        animalType,
        breed,
        cycleCount,
        cycleDuration,
        headsPerCycle,
        currentCycleNumber,
        poussinPrice,
        feedCostPerCycle,
        targetWeight,
        sellingPricePerKg,
        sellingPricePerUnit,
        mortalityRate,
        farmLocation,
        currentHeadCount,
        soldCount,
        deathCount,
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
    alert('Erreur sauvegarde: ' + e.message);
  } finally {
    setLoading(false);
  }
};

  if (!isOpen) return null;

  const selectedPreset = animalPresets[animalType];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-pink-600 to-rose-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">
                {project ? 'Modifier' : 'Nouveau'} Projet Élevage
              </h2>
              <p className="text-pink-100 text-sm">
                Gestion par cycles - Modèle Natiora Production
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
                  placeholder="Ex: Natiora Production - Poulets de Chair 2026"
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
                  placeholder="Description du projet d'élevage..."
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

          {/* SECTION 2: PARAMÈTRES ÉLEVAGE */}
          <div className="bg-pink-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              {selectedPreset?.icon || '🐄'} Paramètres d'Élevage
            </h3>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Type d'Animal *</label>
                <select
                  value={animalType}
                  onChange={(e) => applyAnimalPreset(e.target.value)}
                  className="w-full p-2 border rounded font-semibold"
                >
                  <option value="">Sélectionner...</option>
                  {Object.entries(animalPresets).map(([type, data]) => (
                    <option key={type} value={type}>
                      {data.icon} {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Race / Variété</label>
                <input
                  type="text"
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Large White..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Lieu d'Élevage</label>
                <input
                  type="text"
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Sabotsy Namehana"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cycle Actuel</label>
                <input
                  type="number"
                  value={currentCycleNumber}
                  onChange={(e) => setCurrentCycleNumber(parseInt(e.target.value) || 1)}
                  className="w-full p-2 border rounded font-bold text-blue-600"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Cycles par An</label>
                <CalculatorInput
                  value={cycleCount}
                  onChange={setCycleCount}
                  placeholder="8"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Durée Cycle (jours)
                </label>
                <CalculatorInput
                  value={cycleDuration}
                  onChange={setCycleDuration}
                  placeholder="45"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Têtes par Cycle</label>
                <CalculatorInput
                  value={headsPerCycle}
                  onChange={setHeadsPerCycle}
                  placeholder="500"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mortalité (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={mortalityRate}
                  onChange={(e) => setMortalityRate(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border rounded"
                  placeholder="4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Prix Poussin/Oison (Ar)
                </label>
                <CalculatorInput
                  value={poussinPrice}
                  onChange={setPoussinPrice}
                  placeholder="4200"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Coût Provende/Cycle (Ar)
                </label>
                <CalculatorInput
                  value={feedCostPerCycle}
                  onChange={setFeedCostPerCycle}
                  placeholder="5062800"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Poids Cible (kg)</label>
                <CalculatorInput
                  value={targetWeight}
                  onChange={setTargetWeight}
                  placeholder="2.5"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Prix Vente/kg (Ar)
                </label>
                <CalculatorInput
                  value={sellingPricePerKg}
                  onChange={setSellingPricePerKg}
                  placeholder="10000"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="col-span-4">
                <label className="block text-sm font-medium mb-1">
                  OU Prix Vente à l'Unité (Ar) - Pour oies, œufs...
                </label>
                <CalculatorInput
                  value={sellingPricePerUnit}
                  onChange={setSellingPricePerUnit}
                  placeholder="77500"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </div>
          
          {/* SECTION 2.5 - ASSOCIÉS DU PROJET */}
{project?.id && (
  <PartnersSection 
    projectId={project.id} 
    totalInvestment={project.total_capital_investment || totalExpenses}
  />
)}

          {/* SECTION 3: CALCULS PAR CYCLE */}
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-6 rounded-lg border-2 border-blue-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Calculator className="w-6 h-6 text-blue-600" />
                Calculs par Cycle
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={generateCompleteCycle}
                  disabled={!animalType || headsPerCycle <= 0 || costPerCycle <= 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  Générer Cycle {currentCycleNumber}
                </button>
                <button
                  onClick={generateAllCycles}
                  disabled={!animalType || cycleCount <= 0 || costPerCycle <= 0}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  Générer {cycleCount} Cycles
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4">
              <div className="bg-white p-3 rounded-lg border-2 border-gray-300">
                <p className="text-sm text-gray-600">Têtes Achetées</p>
                <p className="text-2xl font-bold text-blue-600">{headsPerCycle}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border-2 border-gray-300">
                <p className="text-sm text-gray-600">Têtes Vendues</p>
                <p className="text-2xl font-bold text-green-600">{headsAfterMortality}</p>
                <p className="text-xs text-gray-500">(-{mortalityRate}% mort.)</p>
              </div>
              <div className="bg-white p-3 rounded-lg border-2 border-red-300">
                <p className="text-sm text-gray-600">Coût/Cycle</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(costPerCycle)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border-2 border-green-300">
                <p className="text-sm text-gray-600">Revenu/Cycle</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(revenuePerCycle)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border-2 border-purple-300">
                <p className="text-sm text-gray-600">Profit/Cycle</p>
                <p
                  className={`text-xl font-bold ${profitPerCycle >= 0 ? 'text-purple-600' : 'text-red-600'}`}
                >
                  {formatCurrency(profitPerCycle)}
                </p>
                <p className="text-xs text-gray-500">Marge: {marginPercent}%</p>
              </div>
            </div>

            {/* Projections annuelles */}
            {cycleCount > 0 && (
              <div className="mt-4 bg-white p-4 rounded-lg border-2 border-indigo-300">
                <h4 className="font-semibold mb-3 text-indigo-800 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Projections Annuelles ({cycleCount} cycles)
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Coût Total Annuel</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(annualCost)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Revenu Total Annuel</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(annualRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Profit Total Annuel</p>
                    <p
                      className={`text-2xl font-bold ${annualProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(annualProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">ROI Annuel</p>
                    <p
                      className={`text-2xl font-bold ${annualROI >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {annualROI}%
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
    {expenses.map((exp, idx) => {
      // ✅ CALCULER isPaid DEPUIS LA DB (identique à ProductFlipModal)
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
          />

          <DatePicker
            selected={exp.realDate || null}
            onChange={(date) => updateExpense(exp.id, 'realDate', date)}
            dateFormat="dd/MM/yy"
            placeholderText="Date réelle"
            className="col-span-2 p-2 border rounded text-sm"
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
        Aucune charge. Utilisez "Générer Cycle" pour créer automatiquement.
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
                  />

                  {/* Date réelle */}
                  <DatePicker
                    selected={rev.realDate || null}
                    onChange={(date) => updateRevenue(rev.id, 'realDate', date)}
                    dateFormat="dd/MM/yy"
                    placeholderText="Date réelle"
                    className="col-span-2 p-2 border rounded text-sm"
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
                  Aucun revenu. Utilisez "Générer Cycle" pour créer automatiquement.
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

          {/* SECTION 6 - DISTRIBUTION DES BÉNÉFICES */}
{project?.id && (
  <ProfitDistributionPanel projectId={project.id} />
)}

          {/* RÉSUMÉ FINANCIER */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Résumé Financier du Projet
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
            className="bg-gradient-to-r from-pink-600 to-rose-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
