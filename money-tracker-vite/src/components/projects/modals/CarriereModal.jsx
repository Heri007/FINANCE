// src/components/projects/modals/CarriereModal.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  FileText,
  Calculator,
  Truck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { v4 as uuidv4 } from 'uuid';
import { formatCurrency } from '../../../utils/formatters';
import { CalculatorInput } from '../../common/CalculatorInput';
import projectsService from '../../../services/projectsService';
import transactionsService from '../../../services/transactionsService';
import { useFinance } from '../../../contexts/FinanceContext';
import api from '../../../services/api';
import { toLocalISODate, toLocalISOString } from '../../../utils/dateUtils';

// Taux selon le Code Minier 2023 (Loi n°2023-007)
const TAUX_RISTOURNE = 0.02; // 2%
const TAUX_REDEVANCE = 0.03; // 3%
const TAUX_TOTAL_DTSPM = TAUX_RISTOURNE + TAUX_REDEVANCE; // 5%

export function CarriereModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction, // ← IMPORTANT : Ajouter cette prop
}) {

  const isMountedRef = useRef(true);

  // VÉRIFICATION SÉCURITÉ
  if (!createTransaction) {
    console.error('createTransaction manquant dans CarriereModal !');
    return null;
  }

  // ÉTATS DE BASE
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);
  const [isPaymentInProgress, setIsPaymentInProgress] = useState(false);
  const { addTransaction } = useFinance();
  // Taux de change USD → MGA (Ariary)
  const [usdToMgaRate, setUsdToMgaRate] = useState(4500);
  const [rateLoadedAt, setRateLoadedAt] = useState(null);

  // ÉTATS SPÉCIFIQUES CARRIÈRE
  const [lieu, setLieu] = useState('');
  const [substances, setSubstances] = useState('');
  const [perimetre, setPerimetre] = useState('');
  const [numeroPermis, setNumeroPermis] = useState('');
  const [typePermis, setTypePermis] = useState('PRE'); // PRE, PE, etc.
  const [isProcessing, setIsProcessing] = useState(false);

  // GESTION DES LP1
  const [lp1List, setLp1List] = useState([]);
  const [showLP1Form, setShowLP1Form] = useState(false);

  // Formulaire LP1
  const [newLP1, setNewLP1] = useState({
    numeroLP1: '',
    substance: '',
    quantiteKg: 0,
    prixUnitaireUSD: 0,
    dateEmission: new Date(),
    numeroOV: '',
    statut: 'En attente', // En attente, Payé, Exporté
  });

  // CHARGES & VENTES
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(false);

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      console.log('🧹 CarriereModal unmounted - cleanup effectué');
    };
  }, []);

  // LISTE DES SUBSTANCES COMMUNES
  const substancesList = [
    'Agate',
    'Quartz',
    'Améthyste',
    'Citrine',
    'Labradorite',
    'Tourmaline',
    'Béryl',
    'Graphite',
    'Mica',
    'Feldspath',
    'Calcaire',
    'Sable',
    'Gravier',
    'Argile',
    'Autre',
  ];

// ==================== RESET QUAND MODAL SE FERME ====================
useEffect(() => {
  if (!isOpen) {
    console.log('🚪 Modal fermée: reset du formulaire');
    resetForm();
  }
}, [isOpen]);

// ==================== CHARGEMENT PROJET ====================
useEffect(() => {
  // Ignorer si paiement en cours
  if (isPaymentInProgress) {
    console.log('⏳ Rechargement bloqué: paiement en cours');
    return;
  }

  // Mode création : reset uniquement
  if (!project?.id) {
    if (isOpen) {
      console.log('📝 Mode création: reset du formulaire');
      resetForm();
    }
    return;
  }

  // Ne pas charger si modal fermée
  if (!isOpen) {
    return;
  }

  // ✅ Mode édition : charger directement (inline, pas useCallback)
  const loadData = async () => {
    if (!isMountedRef.current) return;
    
    try {
      console.log('🔄 Chargement projet:', project.name, 'ID:', project.id);
      
      // 1. Récupérer le projet
      const projects = await projectsService.getAll();
      
      if (!isMountedRef.current) return;
      
      const currentProject = projects.find(p => p.id === project.id);
      
      if (!currentProject) {
        console.error('❌ Projet non trouvé:', project.id);
        return;
      }

      console.log('📦 Projet reçu:', currentProject.name);

      // 2. Charger les champs de base
      if (!isMountedRef.current) return;
      
      setProjectName(currentProject.name || '');
      setDescription(currentProject.description || '');
      setStatus(currentProject.status || 'active');

      if (currentProject.startDate) {
        setStartDate(new Date(currentProject.startDate));
      }
      if (currentProject.endDate) {
        setEndDate(new Date(currentProject.endDate));
      }

      // 3. Parser le metadata avec valeurs par défaut
      if (currentProject.metadata) {
        const meta = typeof currentProject.metadata === 'string' 
          ? JSON.parse(currentProject.metadata) 
          : currentProject.metadata;
        
        console.log('📋 Metadata parsé:', meta);
        
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
          if (!isMountedRef.current) return;
          
          // ✅ CORRECTION CRITIQUE : Utiliser || '' pour éviter undefined
          setLieu(meta.lieu || '');
          setSubstances(meta.substances || '');
          setPerimetre(meta.perimetre || '');
          setNumeroPermis(meta.numeroPermis || '');
          setTypePermis(meta.typePermis || 'PRE');
          setLp1List(Array.isArray(meta.lp1List) ? meta.lp1List : []);
        }
      } else {
        // ✅ Si pas de metadata, initialiser avec valeurs par défaut
        if (!isMountedRef.current) return;
        setLieu('');
        setSubstances('');
        setPerimetre('');
        setNumeroPermis('');
        setTypePermis('PRE');
        setLp1List([]);
      }

      // 4. Récupérer les transactions
      const allTransactions = await transactionsService.getAll();
      
      if (!isMountedRef.current) return;
      
      const projectTransactions = allTransactions.filter(t => {
        const txProjectId = t.project_id || t.projectid;
        return String(txProjectId) === String(project.id);
      });

      console.log('💳 Transactions:', projectTransactions.length);

      // 5. Parser expenses et revenues
      const expensesRaw = Array.isArray(currentProject.expenses) 
        ? currentProject.expenses 
        : (currentProject.expenses ? [currentProject.expenses] : []);
        
      const revenuesRaw = Array.isArray(currentProject.revenues) 
        ? currentProject.revenues 
        : (currentProject.revenues ? [currentProject.revenues] : []);

      // 6. Fusionner expenses avec expenseLines
      const parsedExpenses = expensesRaw.map(exp => {
        const expenseLine = currentProject.expenseLines?.find(line => {
          const descMatch = line.description?.trim() === exp.description?.trim();
          const lineAmount = parseFloat(line.projected_amount || line.projectedamount || 0);
          const expAmount = parseFloat(exp.amount || 0);
          const amountMatch = Math.abs(lineAmount - expAmount) < 0.01;
          return descMatch && amountMatch;
        });

        const isPaidFromDB = expenseLine ? !!expenseLine.is_paid : false;

        const matchingTx = projectTransactions.find(tx => {
          const txLineId = tx.project_line_id || tx.projectLineId;
          return expenseLine && String(txLineId) === String(expenseLine.id) && tx.type === 'expense';
        });

        let accountName = '';
        if (matchingTx) {
          const acc = accounts.find(a => a.id === (matchingTx.account_id || matchingTx.accountId));
          accountName = acc?.name || '';
        } else if (exp.account) {
          accountName = exp.account;
        }

        return {
          id: exp.id || uuidv4(),
          dbLineId: exp.dbLineId || expenseLine?.id, // ✅ Préserver dbLineId
          description: exp.description || '',
          amount: parseFloat(exp.amount || 0),
          category: exp.category || 'Permis Admin',
          date: exp.date ? new Date(exp.date) : new Date(),
          account: accountName,
          isPaid: isPaidFromDB,
          isRecurring: !!exp.isRecurring,
        };
      });

      // 7. Fusionner revenues
      const parsedRevenues = revenuesRaw.map(rev => {
        if (!rev) return null;

        const revenueLines = Array.isArray(currentProject.revenueLines) 
          ? currentProject.revenueLines 
          : [];
        
        const revDesc = rev.description?.trim();
        const revAmount = parseFloat(rev.amount || 0);

        const revenueLine = revenueLines.find(line => {
          if (!line) return false;
          const lineDesc = line.description?.trim();
          const lineProjectedAmount = parseFloat(line.projected_amount || line.projectedamount || 0);
          const descMatch = lineDesc === revDesc;
          const amountMatch = Math.abs(lineProjectedAmount - revAmount) < 0.01;
          return descMatch && amountMatch;
        });

        const isReceivedFromDB = revenueLine ? !!(revenueLine.is_received || revenueLine.isreceived) : false;

        let accountName = '';
        const matchingTx = projectTransactions.find(tx => {
          const txLineId = tx.project_line_id || tx.projectLineId;
          return revenueLine && String(txLineId) === String(revenueLine.id) && tx.type === 'income';
        });

        if (matchingTx) {
          const acc = accounts.find(a => a.id === (matchingTx.account_id || matchingTx.accountId));
          accountName = acc?.name || '';
        } else if (rev.account) {
          accountName = rev.account;
        }

        const meta = rev.metadata;

        return {
          id: rev.id || uuidv4(),
          dbLineId: rev.dbLineId || revenueLine?.id, // ✅ Préserver dbLineId
          description: rev.description || '',
          amount: revAmount,
          category: rev.category || 'Autre',
          date: rev.date ? new Date(rev.date) : new Date(),
          account: accountName,
          isPaid: isReceivedFromDB,
          isRecurring: !!rev.isRecurring,
          nombreLP1: meta?.nombreLP1 || 1,
          prixUnitaireKg: meta?.prixUnitaire || meta?.prixUnitaireKg || 0,
          quantiteKg: meta?.quantite || 0,
          totalLigne: (meta?.nombreLP1 || 1) * (meta?.prixUnitaire || meta?.prixUnitaireKg || 0) * (meta?.quantite || 0) || revAmount,
        };
      }).filter(Boolean);

      console.log('✅ Parsé:', parsedExpenses.length, 'dépenses,', parsedRevenues.length, 'revenus');

      // 8. Appliquer au state
      if (!isMountedRef.current) return;
      
      setExpenses(parsedExpenses);
      setRevenues(parsedRevenues);

    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('❌ Erreur chargement:', error);
    }
  };

  loadData();
  
}, [project?.id, isOpen, isPaymentInProgress]); // ✅ Dépendances stables

  const resetForm = () => {
    setProjectName('');
    setDescription('');
    setStatus('active');
    setStartDate(new Date());
    setEndDate(null);
    setLieu('');
    setSubstances('');
    setPerimetre('');
    setNumeroPermis('');
    setTypePermis('PRE');
    setLp1List([]);
    setExpenses([]);
    setRevenues([]);
  };

  // ==================== HELPER: Obtenir ou créer dbLineId ====================
const getOrCreateDbLineId = async (expense) => {
  // 🛡️ CHECK: Au début
  if (!isMountedRef.current) return null;
  
  // Si le dbLineId existe déjà, le retourner
  if (expense.dbLineId) {
    return expense.dbLineId;
  }

  try {
    // Récupérer le projet frais pour avoir les lignes à jour
    const freshProject = await projectsService.getById(project.id);
    
    // 🛡️ CHECK: Après appel async
    if (!isMountedRef.current) return null;
    
    let expenseLines = freshProject?.expenseLines || freshProject?.expense_lines || [];
    
    if (typeof expenseLines === 'string') {
      try {
        expenseLines = JSON.parse(expenseLines);
      } catch (e) {
        expenseLines = [];
      }
    }

    if (!Array.isArray(expenseLines) || expenseLines.length === 0) {
      alert('Impossible de trouver les lignes de dépenses. Sauvegardez d\'abord le projet.');
      return null;
    }

    // Chercher la ligne correspondante
    const expenseAmount = parseFloat(expense.amount || 0);
    const expenseLine = expenseLines.find((line) => {
      const lineDesc = (line.description || '').trim().toLowerCase();
      const expDesc = (expense.description || '').trim().toLowerCase();
      
      if (lineDesc !== expDesc) return false;
      
      const lineAmount = parseFloat(
        line.projected_amount || line.projectedamount || line.amount || 0
      );
      
      return Math.abs(lineAmount - expenseAmount) < 0.01;
    });

    if (!expenseLine) {
      // Créer la ligne si elle n'existe pas
      const createConfirm = confirm(
        `La ligne "${expense.description}" n'existe pas.\n\nCréer maintenant ?`
      );
      
      if (!createConfirm) return null;

      // 🛡️ CHECK: Avant création
      if (!isMountedRef.current) return null;

      const newLine = await api.post(`/projects/${project.id}/expense-lines`, {
        description: expense.description,
        category: expense.category || 'Projet - Charge',
        projected_amount: parseFloat(expense.amount),
        actual_amount: 0,
        transaction_date: expense.date || new Date().toISOString(),
        is_paid: false,
      });

      // 🛡️ CHECK: Après création
      if (!isMountedRef.current) return null;
      
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      return newLine.id;
    }

    return expenseLine.id;
    
  } catch (err) {
    // 🛡️ CHECK: Avant erreur
    if (!isMountedRef.current) return null;
    
    console.error('❌ Erreur getOrCreateDbLineId:', err);
    alert(`Erreur lors de la récupération de la ligne:\n${err.message}`);
    return null;
  }
};

// ==================== HELPER: Recharger le projet ====================
const loadProject = async () => {
  // 🛡️ CHECK: Au début
  if (!isMountedRef.current) return;
  
  if (!project?.id) return;

  try {
    const freshProject = await projectsService.getById(project.id);
    const allTx = await transactionsService.getAll();
    
    // 🛡️ CHECK: Après appels async
    if (!isMountedRef.current) return;
    
    const projectTx = allTx.filter(
      (t) => String(t.project_id || t.projectid) === String(project.id)
    );

    console.log(`📥 Rechargé: ${projectTx.length} transactions`);

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

    // Fonction de fusion
    const mergeTransactions = (lines, type) => {
      return lines.map((line) => {
        const tx = projectTx.find(
          (t) =>
            t.type === type &&
            String(t.project_line_id || t.projectlineid) === String(line.dbLineId)
        );

        if (tx) {
          const accName = accounts.find((a) => a.id === (tx.account_id || tx.accountid))?.name || 'Inconnu';
          return {
            ...line,
            isPaid: true,
            account: accName,
            realDate: tx.transaction_date ? new Date(tx.transaction_date) : null,
          };
        }
        return line;
      });
    };

    // Parser et fusionner
    let freshExpenses = parseList(freshProject.expenses).map((e) => ({
      ...e,
      id: e.id || uuidv4(),
      date: e.date ? new Date(e.date) : new Date(),
      amount: parseFloat(e.amount) || 0,
    }));

    let freshRevenues = parseList(freshProject.revenues).map((r) => ({
      ...r,
      id: r.id || uuidv4(),
      date: r.date ? new Date(r.date) : new Date(),
      amount: parseFloat(r.amount) || 0,
    }));

    freshExpenses = mergeTransactions(freshExpenses, 'expense');
    freshRevenues = mergeTransactions(freshRevenues, 'income');

    // 🛡️ CHECK: Avant setState
    if (!isMountedRef.current) return;

    setExpenses(freshExpenses);
    setRevenues(freshRevenues);

    console.log('✅ Projet rechargé avec succès');

  } catch (err) {
    // 🛡️ CHECK: Avant log erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur loadProject:', err);
  }
};

  // CALCULS AUTOMATIQUES LP1: résultat en ariary (conversion USD → MGA avec taux)
  const calculateLP1Values = (lp1) => {
    const valeurUSD = lp1.quantiteKg * lp1.prixUnitaireUSD;
    const valeurTotale = valeurUSD * usdToMgaRate; // conversion en Ar

    const ristourne = valeurTotale * TAUX_RISTOURNE;
    const redevance = valeurTotale * TAUX_REDEVANCE;
    const totalDTSPM = valeurTotale * TAUX_TOTAL_DTSPM;

    return { valeurTotale, ristourne, redevance, totalDTSPM };
  };

  // AJOUTER UN LP1
  const handleAddLP1 = () => {
    if (!newLP1.numeroLP1 || !newLP1.substance || newLP1.quantiteKg <= 0) {
      alert('Veuillez remplir tous les champs obligatoires du LP1');
      return;
    }

    const lp1WithCalcs = {
      ...newLP1,
      id: uuidv4(),
      ...calculateLP1Values(newLP1),
    };

    setLp1List([...lp1List, lp1WithCalcs]);

    // Ajouter automatiquement la charge de redevance/ristourne
    addRedevanceRistourneExpense(lp1WithCalcs);

    // Ajouter automatiquement la ligne de revenu (cession LP1)
    addLP1Revenue(lp1WithCalcs);

    // Reset formulaire
    setNewLP1({
      numeroLP1: '',
      substance: '',
      quantiteKg: 0,
      prixUnitaireUSD: 0,
      dateEmission: new Date(),
      numeroOV: '',
      statut: 'En attente',
    });
    setShowLP1Form(false);
  };

  // AJOUTER CHARGE REDEVANCE/RISTOURNE
  const addRedevanceRistourneExpense = (lp1) => {
    const newExpense = {
      id: uuidv4(),
      description: `Redevance + Ristourne LP1 ${lp1.numeroLP1} (${lp1.substance})`,
      amount: lp1.totalDTSPM,
      category: 'Redevances Minières',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false,
      lp1Id: lp1.id, // Lien avec le LP1
      metadata: {
        ristourne: lp1.ristourne,
        redevance: lp1.redevance,
        valeurBase: lp1.valeurTotale,
      },
    };
    setExpenses((prev) => [...prev, newExpense]);
  };

  // AJOUTER REVENU CESSION LP1
  const addLP1Revenue = (lp1) => {
    const newRevenue = {
      id: uuidv4(),
      description: `Cession LP1 ${lp1.numeroLP1} - ${lp1.substance} (${lp1.quantiteKg}kg)`,
      amount: lp1.valeurTotale,
      category: 'Cession LP1',
      date: new Date(),
      account: '',
      isPaid: false,
      isRecurring: false,
      lp1Id: lp1.id,
      metadata: {
        numeroLP1: lp1.numeroLP1,
        numeroOV: lp1.numeroOV,
        quantite: lp1.quantiteKg,
        prixUnitaire: lp1.prixUnitaireUSD,
      },
    };
    setRevenues((prev) => [...prev, newRevenue]);
  };

  // SUPPRIMER LP1
  const handleDeleteLP1 = (lp1Id) => {
    if (!confirm('Supprimer ce LP1 et ses charges/revenus associés ?')) return;

    // Supprimer le LP1
    setLp1List((prev) => prev.filter((lp) => lp.id !== lp1Id));

    // Supprimer les charges liées
    setExpenses((prev) => prev.filter((e) => e.lp1Id !== lp1Id));

    // Supprimer les revenus liés
    setRevenues((prev) => prev.filter((r) => r.lp1Id !== lp1Id));
  };

  // AJOUTER CHARGE MANUELLE
  const addExpense = () => {
    const newExpense = {
      id: `exp-${Date.now()}`,
      description: '',
      category: '',
      amount: 0,
      isPaid: false,
      plannedDate: null, // ✅ NEW
    };
    setExpenses([...expenses, newExpense]);
  };

  const removeExpense = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };
  // AJOUTER VENTE MANUELLE
  const addRevenue = () => {
    const newRevenue = {
      id: `rev-${Date.now()}`,
      description: '',
      category: '',
      amount: 0,
      isPaid: false,
      plannedDate: null, // ✅ NEW
    };
    setRevenues([...revenues, newRevenue]);
  };

  const removeRevenue = (id) => {
    setRevenues(revenues.filter((r) => r.id !== id));
  };

  // ============================================================
  // FONCTIONS DE GESTION DES DÉPENSES AVEC DATE (ADAPTÉ À TES IDs)
  // ============================================================
  const updateExpense = (id, field, value) => {
    // Si c'est un champ date, forcer le format YYYY-MM-DD
    if (field === 'plannedDate') {
      const formattedValue = value && value.length > 0 ? value : null;
      setExpenses(
        expenses.map((e) => (e.id === id ? { ...e, [field]: formattedValue } : e))
      );
    } else {
      setExpenses(expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
    }
  };

  // ============================================================
  // FONCTIONS DE GESTION DES REVENUS AVEC DATE + CALCUL MONTANT
  // ============================================================
  const updateRevenue = (id, field, value) => {
    setRevenues((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        // 1) Gestion spéciale de plannedDate (string ou null)
        if (field === 'plannedDate') {
          const formattedValue = value && value.length > 0 ? value : null;
          return { ...r, plannedDate: formattedValue };
        }

        // 2) Mise à jour standard du champ
        const updated = { ...r, [field]: value };

        // 3) Si l'un des 3 champs change, recalculer le montant
        if (
          field === 'nombreLP1' ||
          field === 'prixUnitaireKg' ||
          field === 'quantiteKg'
        ) {
          const nb = parseFloat(updated.nombreLP1 || 0);
          const pu = parseFloat(updated.prixUnitaireKg || 0);
          const qte = parseFloat(updated.quantiteKg || 0);
          updated.amount = nb * qte * pu;
        }

        return updated;
      })
    );
  };

  // CATÉGORIES
  const expenseCategories = [
    { value: 'Exploitation', label: 'Exploitation' },
    { value: 'Équipements', label: 'Équipements' },
    { value: 'Transport', label: 'Transport' },
    { value: "Main d'œuvre", label: "Main d'œuvre" },
    { value: 'Redevances Minières', label: 'Redevances' },
    { value: 'Permis & Admin', label: 'Permis & Admin' },
    { value: 'Autre', label: 'Autre' },
  ];

  const revenueCategories = [
    { value: 'Cession LP1', label: 'Cession LP1' },
    { value: 'Vente Substance', label: 'Vente Substance' },
    { value: 'Autre', label: 'Autre' },
  ];

// PAYER DÉPENSE - VERSION CORRIGÉE AVEC CHOIX OK/ANNULER
const handlePayerDepense = async (expense) => {
  // CHECK 1: Au début
  if (!isMountedRef.current) return;
  
  if (expense.isPaid === true) {
    alert('Cette dépense est déjà payée');
    return;
  }
  
  if (isProcessingPayment) {
    console.warn('Paiement en cours...');
    return;
  }
  
  setIsProcessingPayment(true);
  
  try {
    // Vérifier le compte
    if (!expense.account) {
      alert('Veuillez choisir un compte');
      if (isMountedRef.current) setIsProcessingPayment(false);
      return;
    }
    
    const accountObj = accounts.find(a => a.name === expense.account);
    if (!accountObj) {
      alert('Compte introuvable');
      if (isMountedRef.current) setIsProcessingPayment(false);
      return;
    }
    
    // Trouver ou créer dbLineId
    let dbLineId = expense.dbLineId;
    
    if (!dbLineId) {
      console.log('Recherche dbLineId pour:', { description: expense.description, amount: expense.amount });
      const freshProject = await projectsService.getById(project.id);
      
      // CHECK 2: Après appel async
      if (!isMountedRef.current) {
        setIsProcessingPayment(false);
        return;
      }
      
      let expenseLines = freshProject?.expenseLines || freshProject?.expenselines;
      if (typeof expenseLines === 'string') {
        try {
          expenseLines = JSON.parse(expenseLines);
        } catch (e) {
          expenseLines = [];
        }
      }
      
      if (!Array.isArray(expenseLines) || expenseLines.length === 0) {
        console.error('Aucune ligne expense trouvée');
        alert('Impossible de trouver les lignes de dépenses.');
        if (isMountedRef.current) setIsProcessingPayment(false);
        return;
      }
      
      const expenseAmount = parseFloat(expense.amount) || 0;
      const expenseLine = expenseLines.find(line => {
        const lineDesc = (line.description || '').trim().toLowerCase();
        const expDesc = (expense.description || '').trim().toLowerCase();
        if (lineDesc !== expDesc) return false;
        
        const lineAmount = parseFloat(line.projectedamount || line.projectedamount || line.amount || 0);
        return Math.abs(lineAmount - expenseAmount) < 0.01;
      });
      
      if (!expenseLine) {
        const createConfirm = confirm(`La ligne "${expense.description}" n'existe pas. Créer maintenant ?\n\n${formatCurrency(expense.amount)}`);
        if (!createConfirm) {
          if (isMountedRef.current) setIsProcessingPayment(false);
          return;
        }
        
        // CHECK 3: Avant création
        if (!isMountedRef.current) {
          setIsProcessingPayment(false);
          return;
        }
        
        try {
          const newLine = await api.post(`projects/${project.id}/expense-lines`, {
            description: expense.description,
            category: expense.category || 'Projet - Charge',
            projectedamount: parseFloat(expense.amount),
            actualamount: 0,
            transactiondate: (expense.date || new Date()).toISOString(),
            ispaid: false,
          });
          dbLineId = newLine.id;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (createError) {
          if (isMountedRef.current) {
            alert(`Impossible de créer la ligne: ${createError.message}`);
            setIsProcessingPayment(false);
          }
          return;
        }
      } else {
        dbLineId = expenseLine.id;
      }
    }
    
    // LOGIQUE INVERSE COMME DANS EXPORTMODAL
    // OK = Déjà payée physiquement (paidexternally: true, PAS de transaction)
    // Annuler = Créer transaction et débiter le compte
    const alreadyPaid = window.confirm(
      `Payer ${formatCurrency(expense.amount)} depuis ${expense.account}.\n\n` +
      `Cette dépense a-t-elle DÉJÀ été payée physiquement ?\n\n` +
      `- OUI (OK): Marquer comme payée, SANS créer de transaction.\n` +
      `- NON (Annuler): Créer une transaction et débiter le compte.`
    );
    
    const payload = alreadyPaid
  ? {
      paid_externally: true,        // ← snake_case!
      amount: expense.amount,
      paid_date: expense.date?.toISOString()?.split('T') || new Date().toISOString().split('T'), // ← snake_case!
      account_id: accountObj.id,    // ← snake_case!
    }
  : {
      create_transaction: true,     // ← snake_case!
      amount: expense.amount,
      paid_date: expense.date?.toISOString()?.split('T') || new Date().toISOString().split('T'), // ← snake_case!
      account_id: accountObj.id,    // ← snake_case!
    };

console.log('📤 Payload:', payload);
    
    console.log('📤 Payload:', payload);
    await api.patch(`projects/${project.id}/expense-lines/${dbLineId}/mark-paid`, payload);
    
    // CHECK 4: Après appel API
    if (!isMountedRef.current) return;
    
    // RECHARGER le projet avec les expenseLines
const freshProject = await projectsService.getById(project.id);

// CHECK 5: Après rechargement
if (!isMountedRef.current) return;

const parseList = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  try { return JSON.parse(data); } catch { return []; }
};

// ✅ FUSION avec expenseLines pour synchroniser isPaid
const freshExpenses = parseList(freshProject.expenses).map(exp => {
  // Chercher la ligne DB correspondante
  const expenseLine = freshProject.expenseLines?.find(line => 
    String(line.id) === String(exp.dbLineId) ||
    (line.description?.trim().toLowerCase() === exp.description?.trim().toLowerCase() &&
     Math.abs(parseFloat(line.projectedamount || 0) - parseFloat(exp.amount || 0)) < 0.01)
  );
  
  // Synchroniser isPaid depuis la DB
  return {
    ...exp,
    id: exp.id || uuidv4(),
    date: exp.date ? new Date(exp.date) : new Date(),
    amount: parseFloat(exp.amount) || 0,
    dbLineId: exp.dbLineId || expenseLine?.id,  // ✅ S'assurer que dbLineId est présent
    isPaid: expenseLine ? !!expenseLine.ispaid : exp.isPaid,  // ✅ SYNC depuis DB
  };
});

setExpenses(freshExpenses);

// ✅ SAUVEGARDER le JSON mis à jour dans la base
await projectsService.update(project.id, {
  expenses: JSON.stringify(freshExpenses.map(e => ({
    id: e.id,
    description: e.description,
    amount: e.amount,
    category: e.category,
    date: e.date,
    account: e.account,
    isPaid: e.isPaid,  // ✅ Le nouveau statut sera sauvegardé
    dbLineId: e.dbLineId,
    isRecurring: e.isRecurring,
    plannedDate: e.plannedDate,
  })))
});

    // CHECK 6: Avant callback
    if (!isMountedRef.current) return;
    
    if (onProjectUpdated) {
      await onProjectUpdated(project.id);
    }
    
    alert('Dépense marquée comme payée !');
    
  } catch (err) {
    // CHECK 7: Avant erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur:', err);
    alert(`Erreur: ${err.message || 'Erreur inconnue'}`);
  } finally {
    // CHECK 8: Dans finally
    if (isMountedRef.current) {
      setIsProcessingPayment(false);
    }
  }
};

  // ==================== ENCAISSER REVENU (MODIFIÉ) ====================
 const handleEncaisser = async (rev, index) => {
  // 🛡️ CHECK 1: Au début
  if (!isMountedRef.current) return;
  
  try {
    if (!rev.account) {
      alert('❌ Choisis un compte !');
      return;
    }
    
    const accountObj = accounts.find(a => a.name === rev.account);
    if (!accountObj) {
      alert('❌ Compte introuvable');
      return;
    }

    if (!window.confirm(`💰 Encaisser ${formatCurrency(rev.amount)} sur ${rev.account} ?`)) {
      return;
    }

    if (!project || !project.id) {
      alert('❌ Erreur : Projet introuvable.');
      return;
    }

    // 1. BLOQUER le rechargement automatique
    setIsPaymentInProgress(true);

    console.log('💰 Création transaction:', rev.description, formatCurrency(rev.amount));

    // 2. Créer la transaction
    await createTransaction({
      account_id: parseInt(accountObj.id, 10),
      type: 'income',
      amount: parseFloat(rev.amount),
      category: 'Projet - Revenu',
      description: `${project.name} - ${rev.description} (Revenu)`,
      date: new Date().toISOString().split('T')[0],
      is_planned: false,
      is_posted: true,
      project_id: project.id,
      project_line_id: rev.id,
    });

    // 🛡️ CHECK 2: Après createTransaction
    if (!isMountedRef.current) {
      setIsPaymentInProgress(false);
      return;
    }

    // 3. Mettre à jour l'état local
    const updated = revenues.map((r, i) => 
      i === index ? { ...r, isPaid: true, account: accountObj.name } : r
    );
    
    setRevenues(updated);

    console.log('✅ État local mis jour:', updated.filter(r => r.isPaid).length, 'encaissés sur', updated.length);

    // 4. Sauvegarder dans la BDD
    await saveProjectState(expenses, updated);

    // 🛡️ CHECK 3: Après sauvegarde
    if (!isMountedRef.current) {
      setIsPaymentInProgress(false);
      return;
    }

    // 5. Attendre que la BDD soit bien à jour
    await new Promise(resolve => setTimeout(resolve, 500));

    // 🛡️ CHECK 4: Après délai
    if (!isMountedRef.current) {
      setIsPaymentInProgress(false);
      return;
    }

    // 6. Rafraîchir la liste des projets
    if (onProjectUpdated) {
      console.log('🔄 Rafrachissement de la liste des projets');
      onProjectUpdated();
    }

    alert('✅ Revenu encaissé !');

  } catch (error) {
    // 🛡️ CHECK 5: Avant traitement d'erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur handleEncaisser:', error);
    alert(error?.message || 'Erreur encaissement');
    
  } finally {
    // 🛡️ CHECK 6: Dans finally
    if (isMountedRef.current) {
      setIsPaymentInProgress(false);
    }
  }
};

  // ==================== ANNULER PAIEMENT DÉPENSE ====================
  const handleCancelPayment = async (expenseIdOrObject) => {
  // 🛡️ AJOUT: Check au début
  if (!isMountedRef.current) return;
  
  try {
    const frontendExpenseId = typeof expenseIdOrObject === 'object' ? expenseIdOrObject.id : expenseIdOrObject;
    
    console.log(`🔄 Annulation paiement pour ligne frontend ID: ${frontendExpenseId}`);

      const expense = expenses.find((e) => e.id === frontendExpenseId);
      if (!expense) {
        console.error('❌ Expense introuvable dans le state');
        alert('Ligne de dépense introuvable');
        return;
      }

      console.log('✅ Expense trouvé dans state:', {
        id: expense.id,
        dbLineId: expense.dbLineId,
        description: expense.description,
        amount: expense.amount,
        isPaid: expense.isPaid,
      });

      // Utiliser dbLineId d'abord
      let dbLineId = expense.dbLineId;

      if (!dbLineId) {
        const expenseLine = project?.expenseLines?.find((line) => {
          const descMatch = line.description?.trim() === expense.description?.trim();

          if (expense.isPaid) {
            return descMatch;
          }

          const lineAmount = parseFloat(
            line.actualamount ||
              line.actual_amount ||
              line.projectedamount ||
              line.projected_amount ||
              0
          );
          const expenseAmount = parseFloat(expense.amount || 0);
          const amountMatch = Math.abs(lineAmount - expenseAmount) < 0.01;

          return descMatch && amountMatch;
        });

        if (!expenseLine) {
          console.error('❌ Ligne expense DB introuvable');
          alert('Impossible de trouver la ligne de dépense dans la base de données.');
          return;
        }

        dbLineId = expenseLine.id;
        console.log('⚠️ dbLineId non stocké, récupéré depuis expenseLines:', dbLineId);
      } else {
        console.log('✅ Utilisation du dbLineId stocké:', dbLineId);
      }
    const data = await api.patch(
      `/projects/${project.id}/expense-lines/${dbLineId}/cancel-payment`,
      {}
    );

    console.log('✅ Paiement annulé:', data);

    // 🛡️ AJOUT: Check après API
    if (!isMountedRef.current) return;

    // Mise à jour optimiste
    setExpenses(prev => prev.map(e => 
      e.id === frontendExpenseId ? { ...e, isPaid: false, actualAmount: 0 } : e
    ));

    await loadProjectData();

  } catch (error) {
    // 🛡️ AJOUT: Check avant erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur handleCancelPayment:', error);
    alert('Erreur lors de l\'annulation: ' + error.message);
    
    // 🛡️ AJOUT: Check avant reload
    if (isMountedRef.current) {
      await loadProjectData();
    }
  }
};

 // ==================== ANNULER PAIEMENT REVENUE ====================
const handleCancelPaymentRevenue = async (rev, index) => {
  // 🛡️ CHECK 1: Au début de la fonction
  if (!isMountedRef.current) {
    console.log('⚠️ handleCancelPaymentRevenue: Composant démonté');
    return;
  }
  
  try {
    if (!project?.id) {
      alert('❌ Projet non enregistré');
      return;
    }

    // ✅ CORRECTION: Vérifier que la ligne a un dbLineId
    if (!rev.dbLineId) {
      alert('❌ Cette ligne n\'a pas encore été enregistrée. Sauvegardez d\'abord le projet.');
      return;
    }

    // ✅ CORRECTION: Vérifier que le revenu est bien payé
    if (!rev.isPaid) {
      alert('⚠️ Ce revenu n\'est pas encore encaissé');
      return;
    }

    if (!window.confirm(`🔄 Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`)) {
      return;
    }

    console.log('🔄 Annulation encaissement:', {
      description: rev.description,
      amount: formatCurrency(rev.amount),
      dbLineId: rev.dbLineId,
    });

    // Appel backend via client API (CSRF + JWT gérés automatiquement)
    // ✅ CORRECTION: Utiliser rev.dbLineId au lieu de rev.id
    const result = await api.patch(
      `/projects/${project.id}/revenue-lines/${rev.dbLineId}/cancel-receipt`,
      {} // pas de payload spécifique
    );

    console.log('✅ Réponse API:', result);

    // 🛡️ CHECK 2: Après l'appel API async
    if (!isMountedRef.current) {
      console.log('⚠️ handleCancelPaymentRevenue: Composant démonté après appel API');
      return;
    }

    // Mise à jour de l'état local
    const updated = [...revenues];
    updated[index] = { 
      ...updated[index], 
      isPaid: false,
      account: '', // ✅ Réinitialiser le compte
      realDate: null, // ✅ Réinitialiser la date réelle
    };
    setRevenues(updated);

    console.log('📝 État local mis à jour');

    // Sauvegarder dans la BDD
    await saveProjectState(expenses, updated);

    // 🛡️ CHECK 3: Après saveProjectState
    if (!isMountedRef.current) {
      console.log('⚠️ handleCancelPaymentRevenue: Composant démonté après sauvegarde');
      return;
    }

    // Notifier le parent pour rafraîchir
    if (onProjectUpdated) {
      onProjectUpdated();
    }

    alert(result.message || '✅ Encaissement annulé');

  } catch (err) {
    // 🛡️ CHECK 4: Avant traitement d'erreur
    if (!isMountedRef.current) {
      console.log('⚠️ handleCancelPaymentRevenue: Composant démonté lors de l\'erreur');
      return;
    }
    
    console.error('❌ Erreur handleCancelPaymentRevenue:', err);
    
    // ✅ Gestion d'erreur améliorée
    if (err.message?.includes('introuvable') || err.status === 404) {
      alert('❌ Ligne de revenu introuvable. Le projet a peut-être été modifié.');
      // Recharger les données
      if (isMountedRef.current) {
        await loadProjectData();
      }
    } else if (err.message?.includes('pas encore encaissé')) {
      alert('⚠️ Ce revenu n\'est pas encore encaissé. Rechargement...');
      // Recharger les données
      if (isMountedRef.current) {
        await loadProjectData();
      }
    } else {
      alert('❌ Erreur annulation: ' + (err.message || err));
    }
  }
};

  // ==================== SAUVEGARDER L'ÉTAT DU PROJET ====================
const saveProjectState = async (currentExpenses, currentRevenues) => {
  // 🛡️ Vérifier si le composant est toujours monté
  if (!isMountedRef.current) {
    console.log('⚠️ saveProjectState: Composant démonté, abandon de la sauvegarde');
    return;
  }
  
  if (!project?.id) {
    console.warn('⚠️ saveProjectState: Projet non enregistré, impossible de sauvegarder');
    return;
  }

  // ✅ Utiliser toLocalISODate pour éviter les bugs de timezone
  const expensesWithDate = currentExpenses.map((exp) => ({
    ...exp,
    plannedDate: exp.date ? toLocalISODate(exp.date) : null,
  }));

  console.log('🔍 EXPENSES WITH DATE:', expensesWithDate[0]);

  const revenuesWithDate = currentRevenues.map((rev) => ({
    ...rev,
    plannedDate: rev.date ? toLocalISODate(rev.date) : null,
  }));

  console.log('💾 saveProjectState démarré:', {
    projectId: project.id,
    expensesCount: currentExpenses.length,
    revenuesCount: currentRevenues.length,
    expensesPaid: currentExpenses.filter((e) => e.isPaid).length,
    revenuesReceived: currentRevenues.filter((r) => r.isPaid).length,
  });

  const newTotalRevenues = revenuesWithDate.reduce(
    (s, r) => s + parseFloat(r.amount || 0),
    0
  );
  const newTotalExpenses = expensesWithDate.reduce(
    (s, e) => s + parseFloat(e.amount || 0),
    0
  );
  const newNetProfit = newTotalRevenues - newTotalExpenses;
  const newRoi =
    newTotalExpenses > 0 ? ((newNetProfit / newTotalExpenses) * 100).toFixed(1) : 0;

  const payload = {
    name: projectName.trim(),
    type: 'CARRIERE',
    description: description || '',
    status: status || 'active',
    startDate: startDate ? toLocalISOString(startDate) : null,
    endDate: endDate ? toLocalISOString(endDate) : null,
    totalCost: newTotalExpenses,
    totalRevenues: newTotalRevenues,
    netProfit: newNetProfit,
    roi: parseFloat(newRoi),
    expenses: JSON.stringify(expensesWithDate),
    revenues: JSON.stringify(revenuesWithDate),
    metadata: JSON.stringify({
      lieu,
      substances,
      perimetre,
      numeroPermis,
      typePermis,
      lp1List,
    }),
  };

  console.log('📤 Payload préparé:', {
    ...payload,
    expenses: `${expensesWithDate.length} lignes`,
    revenues: `${revenuesWithDate.length} lignes`,
  });

  try {
    const result = await projectsService.updateProject(project.id, payload);
    
    // 🛡️ Vérifier si le composant est toujours monté après la sauvegarde
    if (!isMountedRef.current) {
      console.log('⚠️ saveProjectState: Composant démonté après sauvegarde (données sauvegardées mais pas de mise à jour UI)');
      return;
    }
    
    console.log('✅ Projet sauvegardé avec succès:', result);
    
  } catch (error) {
    // 🛡️ Vérifier si le composant est toujours monté avant de gérer l'erreur
    if (!isMountedRef.current) {
      console.log('⚠️ saveProjectState: Composant démonté lors de l\'erreur, erreur ignorée');
      return; // Ne pas throw si le composant est démonté
    }
    
    console.error('❌ Erreur saveProjectState:', error);
    throw error; // Throw seulement si le composant est encore monté
  }
};

  // CALCULS FINANCIERS
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalRevenues = revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const netProfit = totalRevenues - totalExpenses;
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

  const handleSave = async () => {
  if (!isMountedRef.current) return;
  
  if (!projectName.trim()) {
    alert('Le nom du projet est obligatoire');
    return;
  }

  // ✅ DEBUG METADATA
  console.log('🔍 État avant sauvegarde:', {
    lieu,
    substances,
    perimetre,
    numeroPermis,
    typePermis,
    lp1List,
    expensesCount: expenses.length,
    revenuesCount: revenues.length,
  });

  // ✅ DEBUG dbLineId
  console.log('🔍 Dépenses avec dbLineId:', expenses.filter(e => e.dbLineId).length, '/', expenses.length);
  console.log('🔍 Revenus avec dbLineId:', revenues.filter(r => r.dbLineId).length, '/', revenues.length);

  const expensesWithDate = expenses.map((exp) => ({
    ...exp,
    plannedDate: exp.date ? toLocalISODate(exp.date) : null,
  }));

  const revenuesWithDate = revenues.map((rev) => ({
    ...rev,
    plannedDate: rev.date ? toLocalISODate(rev.date) : null,
  }));

  setLoading(true);

  try {
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      type: 'CARRIERE',
      status,
      startDate: toLocalISOString(startDate),
      endDate: endDate ? toLocalISOString(endDate) : null,
      totalCost: totalExpenses,
      totalRevenues,
      netProfit,
      roi: parseFloat(roi),
      expenses: JSON.stringify(expensesWithDate),
      revenues: JSON.stringify(revenuesWithDate),
      metadata: JSON.stringify({
        lieu: lieu || '',
        substances: substances || '',
        perimetre: perimetre || '',
        numeroPermis: numeroPermis || '',
        typePermis: typePermis || 'PRE',
        lp1List: lp1List || [],
      }),
    };

    console.log('📤 Payload expenses:', JSON.parse(payload.expenses).map(e => ({ desc: e.description, dbLineId: e.dbLineId })));

    if (project?.id) {
      await projectsService.update(project.id, payload);
    } else {
      await projectsService.createProject(payload);
    }

    if (!isMountedRef.current) {
      setLoading(false);
      return;
    }

    if (onProjectSaved) {
      onProjectSaved();
    }
    
    onClose();

  } catch (error) {
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur sauvegarde:', error);
    alert('Erreur lors de la sauvegarde: ' + error.message);
    
  } finally {
    if (isMountedRef.current) {
      setLoading(false);
    }
  }
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Truck className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">
                {project ? 'Modifier' : 'Nouveau'} Projet Carrière
              </h2>
              <p className="text-amber-100 text-sm">
                Gestion des LP1, Redevances & Ristournes automatiques
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
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Informations Générales
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom du Projet</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Carrière MAROVOAY"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Statut</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="active">Actif</option>
                  <option value="completed">Terminé</option>
                  <option value="paused">En pause</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={2}
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

          {/* SECTION 2: DONNÉES CARRIÈRE */}
          <div className="bg-amber-50 p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              Données Spécifiques Carrière
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lieu / Zone</label>
                <input
                  type="text"
                  value={lieu}
                  onChange={(e) => setLieu(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Ibity, Antsirabe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Substances Exploitées
                </label>
                <input
                  type="text"
                  value={substances}
                  onChange={(e) => setSubstances(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: Agate, Quartz rose"
                  list="substances-list"
                />
                <datalist id="substances-list">
                  {substancesList.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Périmètre</label>
                <input
                  type="text"
                  value={perimetre}
                  onChange={(e) => setPerimetre(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Ex: 500 ha, Carré 1234"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Type Permis</label>
                  <select
                    value={typePermis}
                    onChange={(e) => setTypePermis(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="PRE">PRE</option>
                    <option value="PE">PE</option>
                    <option value="PER">PER</option>
                    <option value="PR">PR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° Permis</label>
                  <input
                    type="text"
                    value={numeroPermis}
                    onChange={(e) => setNumeroPermis(e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder="N° Permis"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: GESTION DES LP1 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                Laissez-Passer (LP1)
              </h3>
              <button
                onClick={() => setShowLP1Form(!showLP1Form)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter LP1
              </button>
            </div>

            {/* BANDEAU TAUX DE CHANGE */}
            <div className="mt-2 p-3 rounded-lg bg-white border border-blue-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-gray-500">
                  Taux de change du jour (USD → MGA)
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    className="w-28 px-2 py-1 rounded border border-gray-300 bg-white text-sm text-gray-900"
                    value={usdToMgaRate}
                    onChange={(e) => setUsdToMgaRate(parseFloat(e.target.value) || 0)}
                  />
                  <span className="text-gray-700 text-sm">Ar pour 1 USD</span>
                </div>
              </div>
              {rateLoadedAt && (
                <div className="text-xs text-gray-500 text-right">
                  Mis à jour le {new Date(rateLoadedAt).toLocaleDateString()} à{' '}
                  {new Date(rateLoadedAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Formulaire LP1 */}
            {showLP1Form && (
              <div className="bg-white p-4 rounded-lg mb-4 border-2 border-blue-200 mt-4">
                <h4 className="font-semibold mb-3">Nouveau LP1</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">N° LP1 *</label>
                    <input
                      type="text"
                      value={newLP1.numeroLP1}
                      onChange={(e) =>
                        setNewLP1({ ...newLP1, numeroLP1: e.target.value })
                      }
                      className="w-full p-2 border rounded"
                      placeholder="LP1-2025-001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Substance *</label>
                    <input
                      type="text"
                      value={newLP1.substance}
                      onChange={(e) =>
                        setNewLP1({ ...newLP1, substance: e.target.value })
                      }
                      className="w-full p-2 border rounded"
                      placeholder="Agate"
                      list="substances-list"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Quantité (kg) *
                    </label>
                    <CalculatorInput
                      value={newLP1.quantiteKg}
                      onChange={(val) => setNewLP1({ ...newLP1, quantiteKg: val })}
                      placeholder="27000"
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Prix Unitaire (USD/kg) *
                    </label>
                    <CalculatorInput
                      value={newLP1.prixUnitaireUSD}
                      onChange={(val) => setNewLP1({ ...newLP1, prixUnitaireUSD: val })}
                      placeholder="1.5"
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Date Émission
                    </label>
                    <DatePicker
                      selected={newLP1.dateEmission}
                      onChange={(date) => setNewLP1({ ...newLP1, dateEmission: date })}
                      dateFormat="dd/MM/yyyy"
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">N° OV</label>
                    <input
                      type="text"
                      value={newLP1.numeroOV}
                      onChange={(e) => setNewLP1({ ...newLP1, numeroOV: e.target.value })}
                      className="w-full p-2 border rounded"
                      placeholder="OV-2025-001"
                    />
                  </div>
                </div>

                {/* Aperçu calculs */}
                {newLP1.quantiteKg > 0 && newLP1.prixUnitaireUSD > 0 && (
                  <div className="mt-3 p-3 bg-blue-100 rounded text-sm">
                    <p className="font-semibold mb-1">
                      Calculs automatiques (en Ariary) :
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <span className="text-gray-600">Valeur totale:</span>
                        <p className="font-bold">
                          {formatCurrency(
                            newLP1.quantiteKg * newLP1.prixUnitaireUSD * usdToMgaRate
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Ristourne (2%):</span>
                        <p className="font-bold text-orange-600">
                          {formatCurrency(
                            newLP1.quantiteKg *
                              newLP1.prixUnitaireUSD *
                              usdToMgaRate *
                              TAUX_RISTOURNE
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Redevance (3%):</span>
                        <p className="font-bold text-red-600">
                          {formatCurrency(
                            newLP1.quantiteKg *
                              newLP1.prixUnitaireUSD *
                              usdToMgaRate *
                              TAUX_REDEVANCE
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-600">Total DTSPM (5%):</span>
                        <p className="font-bold text-red-800">
                          {formatCurrency(
                            newLP1.quantiteKg *
                              newLP1.prixUnitaireUSD *
                              usdToMgaRate *
                              TAUX_TOTAL_DTSPM
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddLP1}
                    className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer LP1
                  </button>
                  <button
                    onClick={() => setShowLP1Form(false)}
                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Liste des LP1 */}
            <div className="space-y-2 mt-4">
              {lp1List.map((lp1) => (
                <div
                  key={lp1.id}
                  className="bg-white p-3 rounded-lg border flex justify-between items-center"
                >
                  <div className="flex-1 grid grid-cols-6 gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-blue-600">{lp1.numeroLP1}</span>
                      <p className="text-xs text-gray-500">{lp1.substance}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Qt:</span>
                      <p className="font-semibold">{lp1.quantiteKg} kg</p>
                    </div>
                    <div>
                      <span className="text-gray-600">PU (USD):</span>
                      <p className="font-semibold">${lp1.prixUnitaireUSD}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Valeur (Ar):</span>
                      <p className="font-bold text-green-600">
                        {formatCurrency(lp1.valeurTotale)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">DTSPM (Ar):</span>
                      <p className="font-bold text-red-600">
                        {formatCurrency(lp1.totalDTSPM)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                        {lp1.statut}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLP1(lp1.id)}
                    className="text-red-600 hover:bg-red-50 p-2 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {lp1List.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Aucun LP1 enregistré. Cliquez sur "Ajouter LP1" pour commencer.
                </p>
              )}
            </div>
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

            {/* HEADERS EXPLICITES */}
            <div
              className="hidden sm:grid gap-2 px-3 py-2 bg-red-100 rounded-lg mb-2 text-xs font-bold text-gray-700"
              style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
            >
              <div className="col-span-2">Description</div>
              <div className="col-span-2">Catégorie</div>
              <div className="col-span-2">Montant (Ar)</div>
              <div className="col-span-2">📅 Date Réelle</div>
              <div className="col-span-2">🔮 Date Planifiée</div>
              <div className="col-span-1">Compte</div>
              <div className="col-span-1">Action</div>
              <div className="col-span-1">✓</div>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">

  {expenses.map((exp, idx) => {
    // ✅ Chercher la ligne DB
    let expenseLine = project?.expenseLines?.find(
      line => String(line.id) === String(exp.dbLineId)
    );
    
    // Fallback : chercher par description + montant
    if (!expenseLine && exp.description && exp.amount) {
      expenseLine = project?.expenseLines?.find(line => {
        const descMatch = line.description?.trim().toLowerCase() === exp.description?.trim().toLowerCase();
        const amountMatch = Math.abs(parseFloat(line.projectedAmount || line.projectedamount || 0) - parseFloat(exp.amount || 0)) < 0.01;
        return descMatch && amountMatch;
      });
    }
  
    // ✅ Détecter isPaid
    const isPaid = !!(
      expenseLine?.is_paid ||
      expenseLine?.ispaid ||
      exp.isPaid ||
      exp.ispaid
    );

       return (
                <div
                  key={exp.id}
                  className={`bg-white p-3 rounded-lg border-2 grid gap-2 items-center ${
                    exp.isPaid ? 'border-green-300 bg-green-50' : 'border-gray-200'
                  }`}
                  style={{ gridTemplateColumns: 'repeat(13, 1fr)' }}
                >
                  {/* Description */}
                  <input
                    type="text"
                    value={exp.description}
                    onChange={(e) => updateExpense(exp.id, 'description', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                    placeholder="Description"
                    disabled={exp.lp1Id}
                  />

                  {/* Catégorie */}
                  <select
                    value={exp.category}
                    onChange={(e) => updateExpense(exp.id, 'category', e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                    disabled={exp.lp1Id}
                  >
                    {expenseCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  {/* Montant */}
                  <CalculatorInput
                    value={exp.amount}
                    onChange={(val) => updateExpense(exp.id, 'amount', val)}
                    className="col-span-2 p-2 border rounded text-sm font-semibold"
                    disabled={exp.lp1Id}
                  />

                  {/* DATE RÉELLE - Avec titre explicite */}
                  <div className="col-span-2">
                    <DatePicker
                      selected={exp.date}
                      onChange={(date) => updateExpense(exp.id, 'date', date)}
                      dateFormat="dd/MM/yy"
                      className="w-full p-2 border rounded text-sm"
                      placeholderText="Effectuée"
                    />
                  </div>

                  {/* DATE PLANIFIÉE - Avec titre explicite */}
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={exp.plannedDate || ''}
                      onChange={(e) =>
                        updateExpense(exp.id, 'plannedDate', e.target.value)
                      }
                      className="w-full p-2 border border-indigo-300 rounded text-sm bg-indigo-50"
                      placeholder="Prévue"
                      title="Date planifiée du paiement"
                    />
                  </div>

                  {/* Compte */}
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

                  {/* BOUTON PAYER/CANCEL */}
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
                      onClick={() => handleCancelPayment(exp)}
                      className="col-span-1 bg-orange-500 text-white p-2 rounded hover:bg-orange-600 text-xs"
                      title="Annuler paiement"
                    >
                      Annuler
                    </button>
                  )}

                  {/* Supprimer */}
                  <button
                    onClick={() => setExpenses(expenses.filter((e) => e.id !== exp.id))}
                    className="col-span-1 text-red-600 hover:bg-red-50 p-2 rounded"
                    disabled={exp.lp1Id || lp1List.some((lp) => lp.id === exp.lp1Id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
              );
            })}

              {expenses.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Aucune charge. Cliquez sur "Ajouter Charge" pour commencer.
                </p>
              )}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Charges: </span>
              <span className="font-bold text-red-600 text-lg">
                {formatCurrency(totalExpenses)}
              </span>
            </div>
          </div>

          {/* SECTION 5: VENTES/REVENUS */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Ventes & Revenus ({revenues.length})
              </h3>
              <button
                onClick={addRevenue}
                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter Vente
              </button>
            </div>

            {/* HEADERS EXPLICITES */}
            <div
              className="hidden sm:grid gap-2 px-3 py-2 bg-green-100 rounded-lg mb-2 text-xs font-bold text-gray-700"
              style={{
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr 1.2fr 1fr 1fr 0.8fr 0.8fr',
              }}
            >
              <div>Description</div>
              <div>Catégorie</div>
              <div>Nb LP1</div>
              <div>PU (Ar/kg)</div>
              <div>Qté (kg)</div>
              <div>Montant (Ar)</div>
              <div>📅 Date Réelle</div>
              <div>🔮 Date Planifiée</div>
              <div>Compte</div>
              <div>Actions</div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {revenues.map((rev, idx) => (
                <div
                  key={rev.id}
                  className={`bg-white p-3 rounded-lg border-2 grid gap-2 items-center ${
                    rev.isPaid ? 'border-green-500 bg-green-50' : 'border-gray-200'
                  }`}
                  style={{
                    gridTemplateColumns:
                      '2fr 1fr 1fr 1fr 1.2fr 1.2fr 1fr 1fr 0.8fr 0.8fr',
                  }}
                >
                  {/* Description */}
                  <input
                    type="text"
                    value={rev.description}
                    onChange={(e) => updateRevenue(rev.id, 'description', e.target.value)}
                    className="p-2 border rounded text-sm"
                    placeholder="Description"
                    disabled={rev.lp1Id}
                  />

                  {/* Catégorie */}
                  <select
                    value={rev.category}
                    onChange={(e) => updateRevenue(rev.id, 'category', e.target.value)}
                    className="p-2 border rounded text-sm"
                    disabled={rev.lp1Id}
                  >
                    {revenueCategories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>

                  {/* Nb LP1 */}
                  <input
                    type="number"
                    className="p-2 border rounded text-sm bg-white text-gray-900"
                    value={rev.nombreLP1 || 1}
                    placeholder="Nb"
                    onChange={(e) =>
                      updateRevenue(
                        rev.id,
                        'nombreLP1',
                        parseInt(e.target.value || '1', 10)
                      )
                    }
                  />

                  {/* PU (Ar/kg) */}
                  <input
                    type="number"
                    className="p-2 border rounded text-sm bg-white text-gray-900"
                    value={rev.prixUnitaireKg || 0}
                    placeholder="PU"
                    onChange={(e) =>
                      updateRevenue(
                        rev.id,
                        'prixUnitaireKg',
                        parseFloat(e.target.value || '0')
                      )
                    }
                  />

                  {/* Qté (kg) avec calculatrice */}
                  <CalculatorInput
                    value={rev.quantiteKg || 0}
                    onChange={(val) =>
                      updateRevenue(rev.id, 'quantiteKg', parseFloat(val || '0'))
                    }
                    placeholder="Qté"
                    className="p-2 border rounded text-sm bg-white text-gray-900"
                  />

                  {/* Montant (calculé automatiquement) */}
                  <CalculatorInput
                    value={formatCurrency(rev.amount || 0)}
                    onChange={(val) => updateRevenue(rev.id, 'amount', val)}
                    className="p-2 border rounded text-sm font-semibold"
                    disabled={rev.lp1Id}
                  />

                  {/* Date réelle */}
                  <DatePicker
                    selected={rev.date}
                    onChange={(date) => updateRevenue(rev.id, 'date', date)}
                    dateFormat="dd/MM/yy"
                    className="w-full p-2 border rounded text-sm"
                    placeholderText="Encaissée"
                  />

                  {/* Date planifiée */}
                  <input
                    type="date"
                    value={rev.plannedDate || ''}
                    onChange={(e) => updateRevenue(rev.id, 'plannedDate', e.target.value)}
                    className="w-full p-2 border border-green-300 rounded text-sm bg-green-50"
                    placeholder="Prévue"
                    title="Date planifiée de l'encaissement"
                  />

                  {/* Compte */}
                  <select
                    value={rev.account}
                    onChange={(e) => updateRevenue(rev.id, 'account', e.target.value)}
                    className="p-2 border rounded text-sm"
                  >
                    <option value="">Compte</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.name}>
                        {acc.name}
                      </option>
                    ))}
                  </select>

                  {/* Actions: encaisser / annuler + supprimer */}
                  <div className="flex items-center gap-1">
                    {!rev.isPaid ? (
                      <button
                        onClick={() => handleEncaisser(rev, idx)}
                        disabled={!rev.account || !project?.id}
                        className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                        title="Encaisser"
                      >
                        💵
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCancelPaymentRevenue(rev, idx)}
                        className="bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 text-xs"
                        title="Annuler encaissement"
                      >
                        ❌
                      </button>
                    )}

                    <button
                      onClick={() => setRevenues(revenues.filter((r) => r.id !== rev.id))}
                      className="text-red-600 hover:bg-red-50 p-1 rounded"
                      disabled={rev.lp1Id || lp1List.some((lp) => lp.id === rev.lp1Id)}
                      title="Supprimer la ligne"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {revenues.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Aucun revenu. Cliquez sur "Ajouter Vente" pour commencer.
                </p>
              )}
            </div>

            <div className="mt-3 text-right">
              <span className="text-sm text-gray-600">Total Revenus: </span>
              <span className="font-bold text-green-600 text-lg">
                {formatCurrency(totalRevenues)}
              </span>
            </div>
          </div>

          {/* RÉSUMÉ FINANCIER */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg">
            <h3 className="font-bold text-lg mb-3">📊 Résumé Financier</h3>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-blue-100 text-sm">Total Charges</p>
                <p className="text-2xl font-bold">{formatCurrency(totalExpenses)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Total Revenu</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenues)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Bénéfice Net</p>
                <p
                  className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}
                >
                  {formatCurrency(netProfit)}
                </p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">ROI</p>
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
        <div className="bg-gray-100 p-4 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-200"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {loading ? 'Enregistrement...' : 'Enregistrer le Projet'}
          </button>
        </div>
      </div>
    </div>
  );
}
