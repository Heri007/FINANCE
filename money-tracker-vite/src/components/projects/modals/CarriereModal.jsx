// src/components/projects/modals/CarriereModal.jsx
import React, { useState, useEffect, useCallback } from 'react';
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

  const loadProjectData = useCallback(async () => {
    if (!project?.id) return;

    try {
      console.log('🔄 Rechargement du projet:', project.name, 'ID:', project.id);

      // ✅ 1. Récupérer le projet
      const projects = await projectsService.getAll();
      const currentProject = projects.find((p) => p.id === project.id);

      if (!currentProject) {
        console.error('❌ Projet non trouvé:', project.id);
        return;
      }

      console.log(
        '📦 PROJET COMPLET REÇU:',
        JSON.stringify(currentProject, null, 2).substring(0, 500)
      );
      console.log('📦 expenses brut (type):', typeof currentProject.expenses);
      console.log('📦 expenses brut (valeur):', currentProject.expenses);
      console.log('📦 revenues brut (type):', typeof currentProject.revenues);
      console.log('📦 revenues brut (valeur):', currentProject.revenues);

      // ✅ 2. Charger les champs de base du projet
      setProjectName(currentProject.name || '');
      setDescription(currentProject.description || '');
      setStatus(currentProject.status || 'active');

      if (currentProject.startDate) {
        setStartDate(new Date(currentProject.startDate));
      }
      if (currentProject.endDate) {
        setEndDate(new Date(currentProject.endDate));
      }

      // ✅ 3. Parser le metadata
      if (currentProject.metadata) {
        const meta =
          typeof currentProject.metadata === 'string'
            ? JSON.parse(currentProject.metadata)
            : currentProject.metadata;

        console.log('📦 Metadata parsé:', meta);

        // ✅ Vérifier que c'est un objet et pas un tableau
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
          setLieu(meta.lieu || '');
          setSubstances(meta.substances || '');
          setPerimetre(meta.perimetre || '');
          setNumeroPermis(meta.numeroPermis || '');
          setTypePermis(meta.typePermis || 'PRE');
          setLp1List(Array.isArray(meta.lp1List) ? meta.lp1List : []);
        } else {
          console.warn('⚠️ Metadata invalide (pas un objet):', meta);
        }
      }

      // ✅ 4. Récupérer les transactions pour vérifier les paiements
      const allTransactions = await transactionsService.getAll();
      const projectTransactions = allTransactions.filter((t) => {
        const txProjectId = t.project_id || t.projectid;
        return String(txProjectId) === String(project.id);
      });

      console.log('💳 Transactions du projet:', projectTransactions.length);

      // ✅ 5. Parser les expenses (JSONB qui arrive comme Array JavaScript)
      const expensesRaw = Array.isArray(currentProject.expenses)
        ? currentProject.expenses
        : currentProject.expenses
          ? [currentProject.expenses]
          : [];

      const revenuesRaw = Array.isArray(currentProject.revenues)
        ? currentProject.revenues
        : currentProject.revenues
          ? [currentProject.revenues]
          : [];

      console.log('📦 Expenses brutes:', expensesRaw);
      console.log('📦 Revenues brutes:', revenuesRaw);

      // 6.✅  Fusionner expenses avec expenseLines pour déterminer isPaid
      const parsedExpenses = expensesRaw.map((exp) => {
        // ✅ CORRECTION : Trouver la ligne dans expenseLines
        const expenseLine = currentProject.expenseLines?.find((line) => {
          const descMatch = line.description?.trim() === exp.description?.trim();
          const lineAmount = parseFloat(
            line.projectedAmount || line.projected_amount || 0
          );
          const expAmount = parseFloat(exp.amount || 0);
          const amountMatch = Math.abs(lineAmount - expAmount) < 0.01;
          return descMatch && amountMatch;
        });

        // ✅ RÉCUPÉRER isPaid depuis la BDD (expenseLines)
        const isPaidFromDB = expenseLine ? !!expenseLine.isPaid : false;

        // Chercher transaction pour le compte (optionnel, pour affichage)
        const matchingTx = projectTransactions.find((tx) => {
          const txLineId = tx.project_line_id || tx.projectLineId;
          return (
            expenseLine &&
            String(txLineId) === String(expenseLine.id) &&
            tx.type === 'expense'
          );
        });

        let accountName = 'Inconnu';
        if (matchingTx) {
          const acc = accounts.find(
            (a) => a.id === (matchingTx.account_id || matchingTx.accountId)
          );
          accountName = acc?.name || 'Inconnu';
        } else if (exp.account) {
          accountName = exp.account;
        }

        return {
          id: exp.id || uuidv4(),
          dbLineId: expenseLine?.id, // ✅ Stocker l'ID DB
          description: exp.description || '',
          amount: parseFloat(exp.amount || 0),
          category: exp.category || 'Permis & Admin',
          date: exp.date ? new Date(exp.date) : new Date(),
          account: accountName,
          isPaid: isPaidFromDB, // ✅ CORRECTION : Utiliser la valeur DB
          isRecurring: !!exp.isRecurring,
        };
      });

      // ✅ 7. Fusionner revenues avec transactions
      // ✅ 7. Fusionner revenues avec transactions
      const parsedRevenues = revenuesRaw
        .map((rev) => {
          if (!rev) return null; // sécurité

          const revenueLines = Array.isArray(currentProject.revenueLines)
            ? currentProject.revenueLines
            : [];

          const revDesc = (rev.description || '').trim();
          const revAmount = parseFloat(rev.amount || 0);

          // Chercher la ligne de revenu BDD correspondante
          const revenueLine = revenueLines.find((line) => {
            if (!line) return false;

            const lineDesc = (line.description || '').trim();
            const lineProjectedAmount = parseFloat(
              line.projectedAmount || line.projected_amount || 0
            );

            const descMatch = lineDesc === revDesc;
            const amountMatch = Math.abs(lineProjectedAmount - revAmount) < 0.01;

            return descMatch && amountMatch;
          });

          const isReceivedFromDB = revenueLine
            ? !!(revenueLine.isReceived || revenueLine.is_received)
            : false;

          // Chercher une transaction liée (optionnel)
          let accountName = 'Inconnu';
          const matchingTx = projectTransactions.find((tx) => {
            const txLineId = tx.project_line_id || tx.projectLineId;
            return (
              revenueLine &&
              String(txLineId) === String(revenueLine.id) &&
              tx.type === 'income'
            );
          });

          if (matchingTx) {
            const acc = accounts.find(
              (a) => a.id === (matchingTx.account_id || matchingTx.accountId)
            );
            accountName = acc?.name || 'Inconnu';
          } else if (rev.account) {
            accountName = rev.account;
          }

          const meta = rev.metadata || {};

          return {
            id: rev.id || uuidv4(),
            dbLineId: revenueLine?.id,
            description: rev.description || '',
            amount: revAmount,
            category: rev.category || 'Autre',
            date: rev.date ? new Date(rev.date) : new Date(),
            account: accountName,
            isPaid: isReceivedFromDB,
            isRecurring: !!rev.isRecurring,

            // Champs LP1 “ventes & revenus”
            nombreLP1: meta.nombreLP1 || 1,
            prixUnitaireKg: meta.prixUnitaire || meta.prixUnitaireKg || 0,
            quantiteKg: meta.quantite || 0,
            totalLigne:
              (meta.nombreLP1 || 1) *
                (meta.prixUnitaire || meta.prixUnitaireKg || 0) *
                (meta.quantite || 0) || revAmount,
          };
        })
        .filter(Boolean);

      console.log('📋 Expenses parsées:', parsedExpenses.length, 'lignes');
      console.log('📋 Revenues parsées:', parsedRevenues.length, 'lignes');
      console.log('💰 Expenses payées:', parsedExpenses.filter((e) => e.isPaid).length);
      console.log(
        '💵 Revenues encaissés:',
        parsedRevenues.filter((r) => r.isPaid).length
      );

      // ✅ 8. APPLIQUER au state
      setExpenses(parsedExpenses);
      setRevenues(parsedRevenues);

      console.log('✅ Données appliquées au state');
    } catch (error) {
      console.error('❌ Erreur loadProjectData:', error);
    }
  }, [project, accounts]); // ✅ Dépendances : project ET accounts

  // CHARGEMENT PROJET EXISTANT
  useEffect(() => {
    // ✅ NE PAS recharger si un paiement est en cours
    if (isPaymentInProgress) {
      console.log('⏸️ Rechargement bloqué : paiement en cours');
      return;
    }

    loadProjectData();
  }, [project, isOpen, accounts, isPaymentInProgress]);

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

  // ==================== PAYER DÉPENSE ====================
  const handlePayerDepense = async (expense) => {
  // ✅ PROTECTION: Vérifier si déjà payé AVANT d'envoyer
  if (expense.isPaid === true) {
    alert('⚠️ Cette dépense est déjà payée');
    return;
  }

  // ✅ PROTECTION: Désactiver le bouton pendant le traitement
  if (isProcessingPayment) {
    console.warn('⏳ Paiement en cours, veuillez patienter...');
    return;
  }

  setIsProcessingPayment(true); // État à ajouter

  try {
    const dbLineId = await getOrCreateDbLineId(expense);
    if (!dbLineId) {
      alert('❌ Impossible de trouver/créer la ligne de dépense');
      setIsProcessingPayment(false);
      return;
    }

    const payload = {
      paidexternally: true,
      amount: expense.amount,
      paiddate: expense.date?.toISOString?.()?.split('T')[0] || new Date().toISOString().split('T')[0],
      accountid: expense.account === 'Coffre' ? 5 : 
                 expense.account === 'Mvola Pro' ? 6 : 
                 expense.account === 'BOA' ? 7 : 5
    };

    console.log('📤 Envoi paiement:', { dbLineId, payload });

    const response = await api.patch(
      `/projects/${project.id}/expense-lines/${dbLineId}/mark-paid`,
      payload
    );

    console.log('✅ Réponse:', response);

    // ✅ IMPORTANT: Recharger le projet pour synchroniser
    await loadProject();
    
    alert('✅ Dépense payée avec succès');

  } catch (err) {
    console.error('❌ Erreur paiement:', err);
    
    // ✅ GESTION D'ERREUR AMÉLIORÉE
    if (err.message === 'Déjà payée') {
      alert('⚠️ Cette dépense est déjà payée. Rechargement...');
      await loadProject(); // Resynchroniser
    } else if (err.message === 'Paramètres invalides') {
      alert(`❌ Erreur: ${err.raw?.details || 'Paramètres invalides'}\n\nVérifiez la console pour plus de détails.`);
      console.error('Détails:', err.raw);
    } else {
      alert('❌ Erreur: ' + err.message);
    }
  } finally {
    setIsProcessingPayment(false);
  }
};

  // ==================== ENCAISSER REVENU (MODIFIÉ) ====================
  const handleEncaisser = async (rev, index) => {
    try {
      if (!rev.account) return alert('Choisis un compte !');

      const accountObj = accounts.find((a) => a.name === rev.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!window.confirm(`Encaisser ${formatCurrency(rev.amount)} sur ${rev.account} ?`))
        return;

      if (!project || !project.id) {
        alert('Erreur : Projet introuvable.');
        return;
      }

      // ✅ 1. BLOQUER le rechargement automatique
      setIsPaymentInProgress(true);

      console.log(
        '💰 Création transaction:',
        rev.description,
        formatCurrency(rev.amount)
      );

      // ✅ 2. Créer la transaction
      await createTransaction({
        accountid: parseInt(accountObj.id, 10),
        type: 'income',
        amount: parseFloat(rev.amount),
        category: 'Projet - Revenu',
        description: `${project.name} - ${rev.description} (Revenu)`,
        date: new Date().toISOString().split('T')[0],
        isplanned: false,
        isposted: true,
        projectid: project.id,
        projectlineid: rev.id,
      });

      // ✅ 3. Mettre à jour l'état local
      const updated = revenues.map((r, i) =>
        i === index ? { ...r, isPaid: true, account: accountObj.name } : r
      );
      setRevenues(updated);

      console.log(
        '📝 État local mis à jour:',
        updated.filter((r) => r.isPaid).length,
        'encaissés sur',
        updated.length
      );

      // ✅ 4. Sauvegarder dans la BDD
      await saveProjectState(expenses, updated);

      // ✅ 5. Attendre que la BDD soit bien à jour
      await new Promise((resolve) => setTimeout(resolve, 500));

      // ✅ 6. Rafraîchir la liste des projets
      if (onProjectUpdated) {
        console.log('🔄 Rafraîchissement de la liste des projets');
        onProjectUpdated();
      }

      alert('✅ Revenu encaissé !');
    } catch (error) {
      console.error('❌ Erreur handleEncaisser:', error);
      alert(error?.message || 'Erreur encaissement');
    } finally {
      // ✅ 7. DÉBLOQUER le rechargement
      setIsPaymentInProgress(false);
    }
  };

  // ==================== ANNULER PAIEMENT DÉPENSE ====================
  const handleCancelPayment = async (expenseIdOrObject) => {
    try {
      const frontendExpenseId =
        typeof expenseIdOrObject === 'object' ? expenseIdOrObject.id : expenseIdOrObject;

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

      // 🔐 Appel backend via client API (CSRF + JWT auto)
      const data = await api.patch(
        `/projects/${project.id}/expense-lines/${dbLineId}/cancel-payment`,
        {} // pas de payload spécifique
      );

      console.log('✅ Paiement annulé:', data);

      // Mise à jour optimiste
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === frontendExpenseId ? { ...e, isPaid: false, actualAmount: 0 } : e
        )
      );

      await loadProjectData();
    } catch (error) {
      console.error('❌ Erreur handleCancelPayment:', error);
      alert(`Erreur lors de l'annulation: ${error.message}`);
      await loadProjectData();
    }
  };

  const handleCancelPaymentRevenue = async (rev, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');

      if (!window.confirm(`Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`))
        return;

      // Appel backend via client API (CSRF + JWT gérés automatiquement)
      const result = await api.patch(
        `/projects/${project.id}/revenue-lines/${rev.id}/cancel-receipt`,
        {} // pas de payload spécifique
      );

      const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: false };
      setRevenues(updated);

      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();

      alert(result.message || 'Encaissement annulé');
    } catch (err) {
      console.error('Erreur handleCancelPaymentRevenue:', err);
      alert('Erreur annulation: ' + (err.message || err));
    }
  };

  // ==================== SAUVEGARDER L'ÉTAT DU PROJET ====================
  const saveProjectState = async (currentExpenses, currentRevenues) => {
    if (!project?.id) {
      console.warn('⚠️ saveProjectState: Projet non enregistré');
      return;
    }

    // ✅ MAPPER plannedDate AVANT stringify
    const expensesWithDate = currentExpenses.map((exp) => ({
      ...exp,
      plannedDate: exp.date ? new Date(exp.date).toISOString().split('T')[0] : null,
    }));

    console.log('🔍 EXPENSES WITH DATE:', expensesWithDate[0]); // ✅ Vérifie ici

    const revenuesWithDate = currentRevenues.map((rev) => ({
      ...rev,
      plannedDate: rev.date ? new Date(rev.date).toISOString().split('T')[0] : null,
    }));

    console.log('💾 saveProjectState démarré:', {
      projectId: project.id,
      expensesCount: currentExpenses.length,
      revenuesCount: currentRevenues.length,
      expensesPaid: currentExpenses.filter((e) => e.isPaid).length,
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
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      totalCost: newTotalExpenses,
      totalRevenues: newTotalRevenues,
      netProfit: newNetProfit,
      roi: parseFloat(newRoi),
      expenses: JSON.stringify(expensesWithDate), // ✅ AVEC plannedDate
      revenues: JSON.stringify(revenuesWithDate), // ✅ AVEC plannedDate
      metadata: JSON.stringify({
        lieu,
        substances,
        perimetre,
        numeroPermis,
        typePermis,
        lp1List,
      }),
    };

    // ✅ MAINTENANT on peut utiliser payload
    console.log('📤 PAYLOAD ENVIADO:', payload.expenses);
    console.log('📤 Payload envoyé:', {
      ...payload,
      expenses: `${expensesWithDate.length} lignes`,
      revenues: `${revenuesWithDate.length} lignes`,
    });

    try {
      const result = await projectsService.updateProject(project.id, payload);
      console.log('✅ Projet sauvegardé:', result);
    } catch (error) {
      console.error('❌ Erreur saveProjectState:', error);
      throw error;
    }
  };

  // CALCULS FINANCIERS
  const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalRevenues = revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const netProfit = totalRevenues - totalExpenses;
  const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

  // SAUVEGARDE
  const handleSave = async () => {
    if (!projectName.trim()) {
      alert('Le nom du projet est obligatoire');
      return;
    }

    const expensesWithDate = expenses.map((exp) => ({
      ...exp,
      plannedDate: exp.date ? new Date(exp.date).toISOString().split('T')[0] : null,
    }));

    const revenuesWithDate = revenues.map((rev) => ({
      ...rev,
      plannedDate: rev.date ? new Date(rev.date).toISOString().split('T')[0] : null,
    }));

    setLoading(true);
    try {
      const payload = {
        name: projectName.trim(),
        description: description.trim(),
        type: 'CARRIERE',
        status,
        startDate: startDate.toISOString(),
        endDate: endDate ? endDate.toISOString() : null,
        totalCost: totalExpenses,
        totalRevenues,
        netProfit,
        roi: parseFloat(roi),
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

      if (project?.id) {
        await projectsService.updateProject(project.id, payload);
      } else {
        await projectsService.createProject(payload);
      }

      if (onProjectSaved) onProjectSaved();
      onClose();
    } catch (error) {
      alert(`Erreur lors de la sauvegarde : ${error.message}`);
    } finally {
      setLoading(false);
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
              {expenses.map((exp, idx) => (
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
                  {!exp.isPaid ? (
                    <button
  disabled={isProcessingPayment}
  onClick={async () => {
    await handlePayerDepense(exp.id); // ✅ 'exp' et non 'expense'
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
                      onClick={() => handleCancelPayment(exp.id)}
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
              ))}

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
