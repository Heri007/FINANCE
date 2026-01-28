// src/components/projects/modals/CarriereModal.jsx
import { useEffect, useCallback, useRef, useReducer } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  FileText,
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
import api from '../../../services/api';
import { toLocalISODate, toLocalISOString } from '../../../utils/dateUtils';

// Valeurs marchandes par substance (prix en USD/kg)
const SUBSTANCE_PRICES = {
  'Agate': [
    { 
      label: 'Agate (Calcédoine)', 
      categories: [
        { grade: 'A', price: 4 },
        { grade: 'B', price: 2 },
        { grade: 'C', price: 1.5 }
      ]
    },
    { 
      label: 'Agate géode', 
      categories: [
        { grade: 'A', price: 6 },
        { grade: 'B', price: 4 },
        { grade: 'C', price: 2.7 }
      ]
    }
  ],
  'Jaspe': [
    { 
      label: 'Jaspe standard', 
      categories: [
        { grade: 'A', price: 3 },
        { grade: 'B', price: 2 },
        { grade: 'C', price: 1.5 }
      ]
    }
  ],
  'Améthyste': [
    { 
      label: 'Agate géode améthyste', 
      categories: [
        { grade: 'A', price: 8 },
        { grade: 'B', price: 5.5 },
        { grade: 'C', price: 3 }
      ]
    }
  ],
  'Quartz rose': [
    { 
      label: '< 5kg', 
      categories: [
        { grade: 'A', price: 5.5 },
        { grade: 'B', price: 3.2 },
        { grade: 'C', price: 1.3 }
      ]
    },
    { 
      label: '5kg - 30kg', 
      categories: [
        { grade: 'A', price: 12 },
        { grade: 'B', price: 5 },
        { grade: 'C', price: 2 }
      ]
    }
  ],
  'Cristal (Quartz cristal géode)': [
    { 
      label: '< 500g', 
      categories: [
        { grade: 'A', price: 5 },
        { grade: 'B', price: 3.4 },
        { grade: 'C', price: 2 }
      ]
    },
    { 
      label: '500g - 5kg', 
      categories: [
        { grade: 'A', price: 9 },
        { grade: 'B', price: 7 },
        { grade: 'C', price: 4.5 }
      ]
    },
    { 
      label: '5kg - 30kg', 
      categories: [
        { grade: 'A', price: 20 },
        { grade: 'B', price: 9 },
        { grade: 'C', price: 6 }
      ]
    }
  ]
};

// Taux pour le calcul RedRist
const TAUX_REDRIST = 0.05; // 5%

const makeEmptyLP1 = () => ({
  numeroLP1: '',
  substance: '',
  typeSubstance: '', // Ex: "Agate (Calcédoine)" ou "< 5kg"
  qualiteSubstance: '', // Catégorie: A, B ou C
  quantiteKg: 0,
  prixUnitaireUSD: 0, // Prix en USD/kg selon la catégorie choisie
  dateEmission: new Date(),
  numeroOV: '',
  statut: 'En attente',
});

const initialState = {
  // BASE
  projectName: "",
  description: "",
  status: "active",
  startDate: new Date(),
  endDate: null,

  isPaymentInProgress: false,
  usdToMgaRate: 4500,
  rateLoadedAt: null,

  // CARRIERE
  lieu: "",
  substances: "",
  perimetre: "",
  numeroPermis: "",
  typePermis: "PRE",
  isProcessing: false,

  // LP1
  lp1List: [],
  showLP1Form: false,
  newLP1: makeEmptyLP1(),

  // CHARGES & VENTES
  expenses: [],
  revenues: [],
  loading: false,
  isProcessingPayment: false,
};

const ACTIONS = {
  RESET: "RESET",
  PATCH: "PATCH",
  SET_EXPENSES: "SET_EXPENSES",
  SET_REVENUES: "SET_REVENUES",
  SET_LP1_LIST: "SET_LP1_LIST",
};

function reducer(state, action) {
  switch (action.type) {
    case ACTIONS.RESET:
      return { ...initialState, startDate: new Date(), newLP1: makeEmptyLP1() };
    case ACTIONS.PATCH:
      return { ...state, ...(action.payload || {}) };
    case ACTIONS.SET_EXPENSES:
      return { ...state, expenses: Array.isArray(action.payload) ? action.payload : [] };
    case ACTIONS.SET_REVENUES:
      return { ...state, revenues: Array.isArray(action.payload) ? action.payload : [] };
    case ACTIONS.SET_LP1_LIST:
      return { ...state, lp1List: Array.isArray(action.payload) ? action.payload : [] };
    default:
      return state;
  }
}

// Calcul des Redevances et Ristournes
const calculateRedRist = (quantiteKg, valeurMarchande, usdToMgaRate) => {
  // RedRist = Quantité × Prix unitaire (valeur marchande) × Cours de change × 5%
  return quantiteKg * valeurMarchande * usdToMgaRate * TAUX_REDRIST;
};


export function CarriereModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction,
}) {
  const isMountedRef = useRef(true);

  // VÉRIFICATION SÉCURITÉ
  if (!createTransaction) {
    console.error("createTransaction manquant dans CarriereModal !");
    return null;
  }

  const [state, dispatch] = useReducer(reducer, initialState);

  // helpers demandés
  const patch = useCallback((payload) => dispatch({ type: ACTIONS.PATCH, payload }), []);
  const setExpenses = useCallback((rows) => dispatch({ type: ACTIONS.SET_EXPENSES, payload: rows }), []);
  const setRevenues = useCallback((rows) => dispatch({ type: ACTIONS.SET_REVENUES, payload: rows }), []);
  const setLp1List = useCallback((rows) => dispatch({ type: ACTIONS.SET_LP1_LIST, payload: rows }), []);
  const resetForm = useCallback(() => dispatch({ type: ACTIONS.RESET }), []);
  
  // ✅ aliases (pour limiter les changements partout)
  const {
    projectName,
    description,
    status,
    startDate,
    endDate,
    isPaymentInProgress,
    usdToMgaRate,
    rateLoadedAt,
    lieu,
    substances,
    perimetre,
    numeroPermis,
    typePermis,
    isProcessing,
    lp1List,
    showLP1Form,
    newLP1,
    expenses,
    revenues,
    loading,
    isProcessingPayment,
  } = state;
	
// ==================== HELPERS DATE ====================
const toYYYYMMDD = (d) => {
  try {
    if (!d) return new Date().toISOString().split("T")[0];
    const dateObj = d instanceof Date ? d : new Date(d);
    return dateObj.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
};

const parseList = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      console.log("🧹 CarriereModal unmounted - cleanup effectué");
    };
  }, []);

  // ==================== RESET QUAND MODAL SE FERME ====================
  useEffect(() => {
    if (!isOpen) {
      console.log("🚪 Modal fermée: reset du formulaire");
      resetForm();
    }
  }, [isOpen, resetForm]);
  
  // ==================== HELPER: Obtenir ou créer dbLineId (STRICT controller) ====================
const getOrCreateDbLineId = async (expense) => {
  if (!isMountedRef.current) return null;
  if (!project?.id) return null;

  // UI: dbLineId peut être string ou number -> on le retourne si présent
  if (expense?.dbLineId != null && String(expense.dbLineId).length > 0) {
    return String(expense.dbLineId);
  }

  try {
    const freshProject = await projectsService.getById(project.id);
    if (!isMountedRef.current) return null;

    // Le controller renvoie expenseLines (camelCase) [file:10]
    let expenseLines = freshProject?.expenseLines || freshProject?.expenselines || [];
    if (typeof expenseLines === "string") {
      try {
        expenseLines = JSON.parse(expenseLines);
      } catch {
        expenseLines = [];
      }
    }

    if (!Array.isArray(expenseLines) || expenseLines.length === 0) {
      alert("Impossible de trouver les lignes de dépenses. Sauvegardez d'abord le projet.");
      return null;
    }

    const expenseAmount = parseFloat(expense?.amount || 0);
    const expDesc = (expense?.description || "").trim().toLowerCase();

    // Chercher une ligne existante (description + montant)
    const expenseLine = expenseLines.find((line) => {
      const lineDesc = (line?.description || "").trim().toLowerCase();
      if (!lineDesc || lineDesc !== expDesc) return false;

      // Le controller expose projectedAmount (camel), mais on garde les fallbacks [file:10]
      const lineAmount = parseFloat(
        line?.projectedAmount ?? line?.projectedamount ?? line?.amount ?? 0
      );

      return Math.abs(lineAmount - expenseAmount) < 0.01;
    });

    if (expenseLine?.id != null) {
      // Sécurité: l'id doit être un entier (backend parseInt sur params.lineId) [file:10]
      if (!/^\d+$/.test(String(expenseLine.id))) {
        console.error("❌ expenseLine.id invalide (non numérique):", expenseLine);
        return null;
      }
      return String(expenseLine.id);
    }

    // Sinon: proposer la création
    const createConfirm = window.confirm(
      `La ligne "${expense?.description || ""}" n'existe pas.\n\nCréer maintenant ?`
    );
    if (!createConfirm) return null;
    if (!isMountedRef.current) return null;

    // createExpenseLine attend projectedamount/actualamount/transactiondate/ispaid [file:10]
    const created = await api.post(`/projects/${project.id}/expense-lines`, {
      description: expense?.description || "",
      category: expense?.category || "Projet - Charge",
      projectedamount: Number(expense?.amount || 0),
      actualamount: 0,
      transactiondate: toYYYYMMDD(expense?.date),
      ispaid: false,
    });

    if (!isMountedRef.current) return null;

    // Ton wrapper api.post retourne directement le JSON (pas {data: ...}) [file:14]
    const id = created?.id;

    // Sécurité: id doit être numérique pour /mark-paid [file:10]
    if (!/^\d+$/.test(String(id))) {
      console.error("❌ createExpenseLine: id invalide", created);
      return null;
    }

    return String(id);
  } catch (err) {
    if (!isMountedRef.current) return null;
    console.error("❌ Erreur getOrCreateDbLineId:", err);
    alert(`Erreur lors de la récupération/création de la ligne:\n${err?.message || err}`);
    return null;
  }
};

  // ==================== CHARGEMENT PROJET ====================
  useEffect(() => {
    if (isPaymentInProgress) {
      console.log("⏳ Rechargement bloqué: paiement en cours");
      return;
    }

    if (!project?.id) {
      if (isOpen) {
        console.log("📝 Mode création: reset du formulaire");
        resetForm();
      }
      return;
    }

    if (!isOpen) return;

    const loadData = async () => {
  if (!isMountedRef.current) return;

  try {
    console.log("🔄 Chargement projet:", project.name, "ID:", project.id);

    const projects = await projectsService.getAll();
    if (!isMountedRef.current) return;

    const currentProject = projects.find((p) => String(p.id) === String(project.id));
    if (!currentProject) {
      console.error("❌ Projet non trouvé:", project.id);
      return;
    }

    console.log("📦 Projet reçu:", currentProject.name);

    // 1) Champs de base (1 seul patch)
    patch({
      projectName: currentProject.name || "",
      description: currentProject.description || "",
      status: currentProject.status || "active",
      startDate: currentProject.startDate ? new Date(currentProject.startDate) : new Date(),
      endDate: currentProject.endDate ? new Date(currentProject.endDate) : null,
    });

    // 2) Metadata (avec try/catch)
    let meta = null;
    if (currentProject.metadata) {
      try {
        meta =
          typeof currentProject.metadata === "string"
            ? JSON.parse(currentProject.metadata)
            : currentProject.metadata;
      } catch (e) {
        console.warn("⚠️ Metadata JSON invalide:", e);
        meta = null;
      }
    }

    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      patch({
        lieu: meta.lieu || "",
        substances: meta.substances || "",
        perimetre: meta.perimetre || "",
        numeroPermis: meta.numeroPermis || "",
        typePermis: meta.typePermis || "PRE",
      });
      setLp1List(Array.isArray(meta.lp1List) ? meta.lp1List : []);
    } else {
      patch({
        lieu: "",
        substances: "",
        perimetre: "",
        numeroPermis: "",
        typePermis: "PRE",
      });
      setLp1List([]);
    }

    // 3) Transactions
    const allTransactions = await transactionsService.getAll();
    if (!isMountedRef.current) return;

    const projectTransactions = allTransactions.filter((t) => {
      const txProjectId = t.project_id || t.projectid;
      return String(txProjectId) === String(project.id);
    });

    // 4) Expenses/Revenues parsing (STRICT controller)
    const expensesRaw = parseList(currentProject.expenses);
    const revenuesRaw = parseList(currentProject.revenues);

    // ---------------- EXPENSES ----------------
    const parsedExpenses = (expensesRaw || []).map((exp) => {
      // bonus robust: match d’abord dbLineId si présent
      const expenseLines = Array.isArray(currentProject.expenseLines) ? currentProject.expenseLines : [];

      let expenseLine =
        exp?.dbLineId != null
          ? expenseLines.find((line) => String(line?.id) === String(exp.dbLineId))
          : null;

      if (!expenseLine) {
        expenseLine = expenseLines.find((line) => {
          const descMatch =
            (line?.description || "").trim().toLowerCase() ===
            (exp?.description || "").trim().toLowerCase();

          const lineAmount = parseFloat(line?.projectedAmount ?? line?.projectedamount ?? 0);
          const expAmount = parseFloat(exp?.amount ?? 0);

          return descMatch && Math.abs(lineAmount - expAmount) < 0.01;
        });
      }

      const ispaid =
        typeof exp?.ispaid === "boolean"
          ? exp.ispaid
          : typeof exp?.isPaid === "boolean"
            ? exp.isPaid
            : !!(expenseLine?.ispaid ?? expenseLine?.isPaid);

      const matchingTx = projectTransactions.find((tx) => {
        const txLineId = tx.project_line_id || tx.projectLineId;
        return expenseLine && String(txLineId) === String(expenseLine.id) && tx.type === "expense";
      });

      let accountName = "";
      if (matchingTx) {
        const acc = accounts.find(
          (a) => String(a.id) === String(matchingTx.account_id || matchingTx.accountId)
        );
        accountName = acc?.name || "";
      } else if (exp?.account) {
        accountName = exp.account;
      }

      return {
        id: exp?.id || uuidv4(),
        dbLineId: exp?.dbLineId || expenseLine?.id || null,
        description: exp?.description || "",
        amount: parseFloat(exp?.amount ?? 0),
        category: exp?.category || "Permis Admin",
        date: exp?.date ? new Date(exp.date) : new Date(),
        plannedDate: exp?.plannedDate ?? null,
        account: accountName,
        ispaid,        // on garde ton champ historique
        isPaid: ispaid, // bonus: stable côté UI
        isRecurring: !!exp?.isRecurring,
      };
    });

    // ---------------- REVENUES ----------------
    const parsedRevenues = (revenuesRaw || [])
      .map((rev) => {
        if (!rev) return null;

        const revenueLines = Array.isArray(currentProject.revenueLines)
          ? currentProject.revenueLines
          : [];

        const revDesc = (rev?.description || "").trim().toLowerCase();
        const revAmount = parseFloat(rev?.amount ?? 0);

        // match d’abord dbLineId si présent
        let revenueLine =
          rev?.dbLineId != null
            ? revenueLines.find((line) => String(line?.id) === String(rev.dbLineId))
            : null;

        if (!revenueLine) {
          revenueLine = revenueLines.find((line) => {
            if (!line) return false;

            const lineDesc = (line.description || "").trim().toLowerCase();
            const lineProjectedAmount = parseFloat(line.projectedAmount ?? line.projectedamount ?? 0);

            return lineDesc === revDesc && Math.abs(lineProjectedAmount - revAmount) < 0.01;
          });
        }

        // snake/camel
        const isReceived = !!(revenueLine?.isreceived ?? revenueLine?.isReceived);

        // FIX CRITIQUE: définir ispaid ici (au lieu de référencer une variable inexistante)
        const ispaid =
          typeof rev?.ispaid === "boolean"
            ? rev.ispaid
            : typeof rev?.isPaid === "boolean"
              ? rev.isPaid
              : isReceived;

        const matchingTx = projectTransactions.find((tx) => {
          const txLineId = tx.project_line_id || tx.projectLineId;
          return revenueLine && String(txLineId) === String(revenueLine.id) && tx.type === "income";
        });

        let accountName = "";
        if (matchingTx) {
          const acc = accounts.find(
            (a) => String(a.id) === String(matchingTx.account_id || matchingTx.accountId)
          );
          accountName = acc?.name || "";
        } else if (rev?.account) {
          accountName = rev.account;
        }

        const meta = rev?.metadata;

        return {
          id: rev?.id || uuidv4(),
          dbLineId: rev?.dbLineId || revenueLine?.id || null,
          description: rev?.description || "",
          amount: revAmount,
          category: rev?.category || "Autre",
          date: rev?.date ? new Date(rev.date) : new Date(),
          plannedDate: rev?.plannedDate ?? null,
          account: accountName,

          ispaid,         // FIX: plus jamais undefined
          isPaid: ispaid, // bonus UI

          isRecurring: !!rev?.isRecurring,
          isReceived,

          nombreLP1: meta?.nombreLP1 || 1,
          prixUnitaireKg: meta?.prixUnitaire || meta?.prixUnitaireKg || 0,
          quantiteKg: meta?.quantite || 0,
          totalLigne:
            (meta?.nombreLP1 || 1) *
              (meta?.prixUnitaire || meta?.prixUnitaireKg || 0) *
              (meta?.quantite || 0) ||
            revAmount,
        };
      })
      .filter(Boolean);

    if (!isMountedRef.current) return;

    console.log("✅ Parsé:", parsedExpenses.length, "dépenses,", parsedRevenues.length, "revenus");
    setExpenses(parsedExpenses);
    setRevenues(parsedRevenues);
  } catch (error) {
    if (!isMountedRef.current) return;
    console.error("❌ Erreur chargement:", error);
  }
  };
    loadData();
    }, [project?.id, isOpen, isPaymentInProgress, accounts, patch, resetForm, setExpenses, setRevenues, setLp1List]);

  // Utils
const normalizePlannedDate = (value) => {
  const v = value && String(value).length > 0 ? String(value) : null;
  return v; // "YYYY-MM-DD" ou null
};

const normalizeNumber = (value) => {
  const n = parseFloat(value || 0);
  return Number.isFinite(n) ? n : 0;
};

const handleAddLP1 = () => {
  if (!newLP1.numeroLP1.trim()) {
    alert('Le numéro LP1 est obligatoire');
    return;
  }
  
  if (!newLP1.substance || !newLP1.qualiteSubstance) {
    alert('Veuillez choisir une substance et sa qualité');
    return;
  }
  
  if (newLP1.quantiteKg <= 0) {
    alert('La quantité doit être supérieure à 0');
    return;
  }

  const redRist = calculateRedRist(
    newLP1.quantiteKg,
    newLP1.valeurMarchande,
    usdToMgaRate
  );

  const newLP1Entry = {
    id: uuidv4(),
    ...newLP1,
    redRist, // Ajouter le montant RedRist calculé
  };

  setLp1List([...lp1List, newLP1Entry]);
  
  patch({
    newLP1: makeEmptyLP1(),
    showLP1Form: false
  });
};


// AJOUTER CHARGE MANUELLE (useReducer/patch)
const addExpense = () => {
  const newExpense = {
    id: uuidv4(),
    description: "",
    category: "",
    amount: 0,
    date: new Date(),
    plannedDate: null, // IMPORTANT: le backend ignore si plannedDate absent [file:6]
    account: "",
    isPaid: false,
    isRecurring: false,

    // champs utiles pour la synchro normalisée (si tu les utilises)
    dbLineId: null,
    lp1Id: null,
  };

  patch({ expenses: [...expenses, newExpense] });
};

//const removeExpense = (id) => {
  //patch({ expenses: expenses.filter((e) => e.id !== id) });
//};

// AJOUTER VENTE MANUELLE (useReducer/patch)
const addRevenue = () => {
  const newRevenue = {
    id: uuidv4(),
    description: "",
    category: "",
    amount: 0,
    date: new Date(),
    plannedDate: null, // IMPORTANT: le backend ignore si plannedDate absent [file:6]
    account: "",
    isPaid: false,
    isRecurring: false,

    // champs de calcul
    nombreLP1: 1,
    prixUnitaireKg: 0,
    quantiteKg: 0,

    // synchro normalisée
    dbLineId: null,
    lp1Id: null,
  };

  patch({ revenues: [...revenues, newRevenue] });
};

//const removeRevenue = (id) => {
  //patch({ revenues: revenues.filter((r) => r.id !== id) });
//};

// UPDATE EXPENSE (plannedDate string YYYY-MM-DD ou null)
const updateExpense = (id, field, value) => {
  const next = expenses.map((e) => {
    if (e.id !== id) return e;

    if (field === "plannedDate") {
      return { ...e, plannedDate: normalizePlannedDate(value) };
    }

    if (field === "amount") {
      return { ...e, amount: normalizeNumber(value) };
    }

    if (field === "date") {
      return { ...e, date: value ? new Date(value) : new Date() };
    }

    return { ...e, [field]: value };
  });

  patch({ expenses: next });
};

// UPDATE REVENUE (plannedDate + recalcul amount)
const updateRevenue = (id, field, value) => {
  const next = revenues.map((r) => {
    if (r.id !== id) return r;

    // 1) plannedDate
    if (field === "plannedDate") {
      return { ...r, plannedDate: normalizePlannedDate(value) };
    }

    // 2) date réelle
    if (field === "date") {
      return { ...r, date: value ? new Date(value) : new Date() };
    }

    // 3) amount manuel
    if (field === "amount") {
      return { ...r, amount: normalizeNumber(value) };
    }

    // 4) update standard
    const updated = { ...r, [field]: value };

    // 5) recalcul auto si champs “LP1-like”
    if (field === "nombreLP1" || field === "prixUnitaireKg" || field === "quantiteKg") {
      const nb = normalizeNumber(updated.nombreLP1);
      const pu = normalizeNumber(updated.prixUnitaireKg);
      const qte = normalizeNumber(updated.quantiteKg);
      updated.amount = nb * qte * pu;
    }

    return updated;
  });

  patch({ revenues: next });
};

const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
const totalRevenues = revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
const netProfit = totalRevenues - totalExpenses;
const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

const handleSave = async () => {
  if (!isMountedRef.current) return;

  if (!(projectName || "").trim()) {
    alert("Le nom du projet est obligatoire");
    return;
  }

  const expensesWithDate = expenses.map((exp) => ({
    ...exp,
    plannedDate: exp.plannedDate ?? (exp.date ? toLocalISODate(exp.date) : null),

  }));

  const revenuesWithDate = revenues.map((rev) => ({
    ...rev,
    plannedDate: rev.plannedDate ?? (rev.date ? toLocalISODate(rev.date) : null),
  }));

  patch({ loading: true });

  try {
    const payload = {
      name: (projectName || "").trim(),
      description: (description || "").trim(),
      type: "CARRIERE",
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
        lieu: lieu || "",
        substances: substances || "",
        perimetre: perimetre || "",
        numeroPermis: numeroPermis || "",
        typePermis: typePermis || "PRE",
        lp1List: lp1List || [],
      }),
    };

    if (project?.id) {
      await projectsService.update(project.id, payload);
    } else {
      await projectsService.create(payload);
    }

    if (!isMountedRef.current) {
      patch({ loading: false });
      return;
    }

    if (onProjectSaved) onProjectSaved();
    onClose();
  } catch (error) {
    if (!isMountedRef.current) return;

    console.error("❌ Erreur sauvegarde:", error);
    alert("Erreur lors de la sauvegarde: " + error.message);
  } finally {
    if (isMountedRef.current) {
      patch({ loading: false });
    }
  }
};

// ==================== REFRESH LOCAL (STRICT controller) ====================
const refreshFromProject = async () => {
  if (!project?.id) return;

  const freshProject = await projectsService.getById(project.id);
  if (!isMountedRef.current) return;

  const expenseLines = freshProject?.expenseLines || freshProject?.expense_lines || [];
  const revenueLines = freshProject?.revenueLines || freshProject?.revenue_lines || [];

  const freshExpenses = parseList(freshProject.expenses).map((exp) => {
    const expAmount = parseFloat(exp?.amount || 0);
    const expDesc = (exp?.description || "").trim().toLowerCase();

    const matchedLine = (Array.isArray(expenseLines) ? expenseLines : []).find((line) => {
      const lineIdMatch = exp?.dbLineId && String(line.id) === String(exp.dbLineId);
      const descMatch = (line?.description || "").trim().toLowerCase() === expDesc;
      const lineAmount = parseFloat(line?.projectedAmount ?? line?.projectedamount ?? 0);
      const amountMatch = Math.abs(lineAmount - expAmount) < 0.01;
      return lineIdMatch || (descMatch && amountMatch);
    });

    const dateObj = exp?.date ? new Date(exp.date) : new Date();
    const paidFromDb = matchedLine ? !!(matchedLine.ispaid ?? matchedLine.isPaid) : null;

    return {
      ...exp,
      id: exp.id || uuidv4(),
      date: dateObj,
      plannedDate: exp?.plannedDate ?? (dateObj ? toLocalISODate(dateObj) : null),
      amount: expAmount,
      dbLineId: exp.dbLineId || matchedLine?.id,
      isPaid: paidFromDb ?? !!(exp.isPaid ?? exp.ispaid),
    };
  });

  const freshRevenues = parseList(freshProject.revenues).map((rev) => {
    const revAmount = parseFloat(rev?.amount || 0);
    const revDesc = (rev?.description || "").trim().toLowerCase();

    const matchedLine = (Array.isArray(revenueLines) ? revenueLines : []).find((line) => {
      const lineIdMatch = rev?.dbLineId && String(line.id) === String(rev.dbLineId);
      const descMatch = (line?.description || "").trim().toLowerCase() === revDesc;
      const lineAmount = parseFloat(line?.projectedAmount ?? line?.projectedamount ?? 0);
      const amountMatch = Math.abs(lineAmount - revAmount) < 0.01;
      return lineIdMatch || (descMatch && amountMatch);
    });

    const dateObj = rev?.date ? new Date(rev.date) : new Date();
    const meta = rev?.metadata || {};

    const nombreLP1 = meta?.nombreLP1 ?? rev?.nombreLP1 ?? 1;
    const prixUnitaireKg = meta?.prixUnitaireKg ?? meta?.prixUnitaire ?? rev?.prixUnitaireKg ?? 0;
    const quantiteKg = meta?.quantite ?? rev?.quantiteKg ?? 0;

    const receivedFromDb = matchedLine ? !!(matchedLine.isReceived ?? matchedLine.isreceived) : null;

    return {
      ...rev,
      id: rev.id || uuidv4(),
      date: dateObj,
      plannedDate: rev?.plannedDate ?? (dateObj ? toLocalISODate(dateObj) : null),
      amount: revAmount,
      dbLineId: rev.dbLineId || matchedLine?.id,
      isPaid: receivedFromDb ?? !!(rev.isPaid ?? rev.ispaid),
      nombreLP1,
      prixUnitaireKg,
      quantiteKg,
    };
  });

  setExpenses(freshExpenses);
  setRevenues(freshRevenues);
};

// ==================== PAYER DÉPENSE (respect strict projectController.js) ====================
const handlePayerDepense = async (expense) => {
  if (!isMountedRef.current) return;
  try {
    if (!project?.id) return alert("Projet introuvable.");
    if (expense?.isPaid) return alert("Cette dépense est déjà payée.");
    if (isProcessingPayment) return;

    if (!expense?.account) return alert("Veuillez choisir un compte.");
    const accountObj = accounts.find((a) => a.name === expense.account);
    if (!accountObj) return alert("Compte introuvable.");

    patch({ isProcessingPayment: true });

    // 1) dbLineId strict (string numérique)
    let dbLineId = expense.dbLineId;
    if (!dbLineId) dbLineId = await getOrCreateDbLineId(expense);
    if (!isMountedRef.current) return;
    if (!dbLineId || !/^\d+$/.test(String(dbLineId))) {
      console.error("dbLineId invalide:", dbLineId);
      return alert("Impossible de déterminer la ligne DB (dbLineId). Sauvegardez le projet.");
    }

    // 2) date: toujours YYYY-MM-DD
    const paiddate = toYYYYMMDD(expense?.date);

    // 3) choix utilisateur
    const alreadyPaid = window.confirm(
      `Payer ${formatCurrency(expense.amount)} depuis ${expense.account}.\n\n` +
      `Cette dépense a-t-elle déjà été payée physiquement ?\n\n` +
      `- OK: Marquer comme payée sans créer de transaction.\n` +
      `- Annuler: Créer une transaction et débiter le compte.`
    );

    const amount = Number(expense?.amount || 0);

    const payload = alreadyPaid
      ? { paidexternally: true, amount, paiddate }
      : { createtransaction: true, amount, paiddate, accountid: parseInt(accountObj.id, 10) };

    await api.patch(
      `/projects/${project.id}/expense-lines/${dbLineId}/mark-paid`,
      payload
    );

    if (!isMountedRef.current) return;

    await refreshFromProject();
    if (onProjectUpdated) await onProjectUpdated(project.id);

    alert("Dépense marquée comme payée !");
  } catch (err) {
    if (!isMountedRef.current) return;
    console.error("❌ Erreur handlePayerDepense:", err);
    alert(err?.message || "Erreur paiement dépense");
  } finally {
    if (isMountedRef.current) patch({ isProcessingPayment: false });
  }
};

// ==================== ANNULER PAIEMENT DÉPENSE (respect strict projectController.js) ====================
const handleCancelPayment = async (expenseIdOrObject) => {
  if (!isMountedRef.current) return;

  try {
    if (!project?.id) {
      alert("❌ Projet introuvable.");
      return;
    }

    const frontendExpenseId =
      typeof expenseIdOrObject === "object" ? expenseIdOrObject.id : expenseIdOrObject;

    const expense = expenses.find((e) => e.id === frontendExpenseId);
    if (!expense) {
      alert("Ligne de dépense introuvable");
      return;
    }

    const dbLineId = expense.dbLineId || (await getOrCreateDbLineId(expense));
    if (!isMountedRef.current) return;

    if (!dbLineId) {
      alert("Impossible de déterminer la ligne DB (dbLineId). Sauvegardez le projet d'abord.");
      return;
    }

    const lineIdStr = String(dbLineId ?? "");
if (!/^\d+$/.test(lineIdStr)) {
  console.error("❌ dbLineId invalide (expense):", { dbLineId, expense });
  alert("❌ dbLineId invalide. Sauvegardez puis rechargez le projet.");
  return;
}

    // ✅ Endpoint backend: cancelExpenseLinePayment (cancel-payment)
    await api.patch(`/projects/${project.id}/expense-lines/${dbLineId}/cancel-payment`, {});
    if (!isMountedRef.current) return;

    // Refresh = source de vérité (DB + JSON sync côté controller)
    await refreshFromProject();
    if (!isMountedRef.current) return;

    if (onProjectUpdated) onProjectUpdated(project.id);

    alert("✅ Paiement dépense annulé");
  } catch (error) {
    if (!isMountedRef.current) return;
    console.error("❌ Erreur handleCancelPayment:", error);
    alert("Erreur lors de l'annulation: " + (error?.message || error));

    if (isMountedRef.current) {
      try {
        await refreshFromProject();
      } catch {}
    }
  }
}; 

// ==================== ENCAISSER REVENU (respect strict projectController.js) ====================
const handleEncaisser = async (rev) => {
  if (!isMountedRef.current) return;

  try {
    if (!project?.id) return alert("Projet introuvable.");
    if (!rev?.dbLineId || !/^\d+$/.test(String(rev.dbLineId)))
      return alert("Ce revenu n'a pas de dbLineId valide. Sauvegardez d'abord le projet.");
    if (rev?.isPaid) return alert("Ce revenu est déjà encaissé.");

    if (!rev?.account) return alert("Choisissez un compte.");
    const accountObj = accounts.find((a) => a.name === rev.account);
    if (!accountObj) return alert("Compte introuvable.");

    patch({ isPaymentInProgress: true });

    const receiveddate = toYYYYMMDD(new Date());
    const amount = Number(rev?.amount || 0);

    await api.patch(
      `/projects/${project.id}/revenue-lines/${rev.dbLineId}/mark-received`,
      {
        createtransaction: true,
        amount,
        receiveddate,
        accountid: parseInt(accountObj.id, 10),
      }
    );

    if (!isMountedRef.current) return;

    await refreshFromProject();
    if (onProjectUpdated) await onProjectUpdated(project.id);

    alert("Revenu encaissé !");
  } catch (err) {
    if (!isMountedRef.current) return;
    console.error("❌ Erreur handleEncaisser:", err);
    alert(err?.message || "Erreur encaissement");
  } finally {
    if (isMountedRef.current) patch({ isPaymentInProgress: false });
  }
};

// ==================== ANNULER ENCAISSEMENT REVENU (respect strict projectController.js) ====================
const handleCancelPaymentRevenue = async (rev, index) => {
  if (!isMountedRef.current) return;

  try {
    if (!project?.id) {
      alert("❌ Projet non enregistré");
      return;
    }

    if (!rev?.dbLineId) {
      alert("❌ Cette ligne n'a pas encore de dbLineId. Sauvegardez d'abord le projet.");
      return;
    }

    if (!rev.isPaid) {
      alert("⚠️ Ce revenu n'est pas encore encaissé");
      return;
    }

    if (!window.confirm(`🔄 Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`)) {
      return;
    }

    // ✅ Endpoint backend: cancelRevenueLineReceipt (cancel-receipt)
    await api.patch(`/projects/${project.id}/revenue-lines/${rev.dbLineId}/cancel-receipt`, {});
    if (!isMountedRef.current) return;

    // Refresh = source de vérité
    await refreshFromProject();
    if (!isMountedRef.current) return;

    if (onProjectUpdated) onProjectUpdated(project.id);

    alert("✅ Encaissement annulé");
  } catch (err) {
    if (!isMountedRef.current) return;

    console.error("❌ Erreur handleCancelPaymentRevenue:", err);
    alert("❌ Erreur annulation: " + (err?.message || err));

    if (isMountedRef.current) {
      try {
        await refreshFromProject();
      } catch {}
    }
  }
}; 

// LISTE DES SUBSTANCES COMMUNES
const substancesList = [
  "Agate","Quartz","Améthyste","Citrine","Labradorite","Tourmaline","Béryl",
  "Graphite","Mica","Feldspath","Calcaire","Sable","Gravier","Argile","Autre",
];

const expenseCategories = [
  { value: "Exploitation", label: "Exploitation" },
  { value: "Equipements", label: "Équipements" },
  { value: "Transport", label: "Transport" },
  { value: "Main d'oeuvre", label: "Main d'œuvre" },
  { value: "Redevances Minieres", label: "Redevances Minières" },
  { value: "Permis Admin", label: "Permis / Admin" },
  { value: "Autre", label: "Autre" },
];

const revenueCategories = [
  { value: "Cession LP1", label: "Cession LP1" },
  { value: "Vente Substance", label: "Vente Substance" },
  { value: "Autre", label: "Autre" },
];


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
              {project ? "Modifier" : "Nouveau"} Projet Carrière
            </h2>
            <p className="text-amber-100 text-sm">
              Gestion des LP1, Redevances & Ristournes automatiques
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
                onChange={(e) => patch({ projectName: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Ex: Carrière MAROVOAY"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select
                value={status}
                onChange={(e) => patch({ status: e.target.value })}
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
                onChange={(e) => patch({ description: e.target.value })}
                className="w-full p-2 border rounded"
                rows={2}
                placeholder="Description du projet..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date Début</label>
              <DatePicker
                selected={startDate}
                onChange={(d) => patch({ startDate: d })}
                dateFormat="dd/MM/yyyy"
                className="w-full p-2 border rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date Fin (Optionnelle)</label>
              <DatePicker
                selected={endDate}
                onChange={(d) => patch({ endDate: d })}
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
                onChange={(e) => patch({ lieu: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Ex: Ibity, Antsirabe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Substances Exploitées</label>
              <input
                type="text"
                value={substances}
                onChange={(e) => patch({ substances: e.target.value })}
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
                onChange={(e) => patch({ perimetre: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Ex: 500 ha, Carré 1234"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Type Permis</label>
                <select
                  value={typePermis}
                  onChange={(e) => patch({ typePermis: e.target.value })}
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
                  onChange={(e) => patch({ numeroPermis: e.target.value })}
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
            <h3 className="font-bold text-lg flex items-center gap-2">Laissez-Passer (LP1)</h3>
            <button
              onClick={() => patch({ showLP1Form: !showLP1Form })}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Ajouter LP1
            </button>
          </div>

          {/* BANDEAU TAUX DE CHANGE */}
          <div className="mt-2 p-3 rounded-lg bg-white border border-blue-200 flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-gray-500">Taux de change du jour (USD → MGA)</div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  className="w-28 px-2 py-1 rounded border border-gray-300 bg-white text-sm text-gray-900"
                  value={usdToMgaRate}
                  onChange={(e) => patch({ usdToMgaRate: parseFloat(e.target.value) || 0 })}
                />
                <span className="text-gray-700 text-sm">Ar pour 1 USD</span>
              </div>
            </div>

            {rateLoadedAt && (
              <div className="text-xs text-gray-500 text-right">
                Mis à jour le {new Date(rateLoadedAt).toLocaleDateString()} à{" "}
                {new Date(rateLoadedAt).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Formulaire LP1 */}
{showLP1Form && (
  <div className="bg-white p-4 rounded-lg mb-4 border-2 border-blue-200 mt-4">
    <h4 className="font-semibold mb-3">Nouveau LP1</h4>

    <div className="grid grid-cols-3 gap-3">
      {/* N° LP1 */}
      <div>
        <label className="block text-sm font-medium mb-1">N° LP1 *</label>
        <input
          type="text"
          value={newLP1.numeroLP1}
          onChange={(e) =>
            patch({ newLP1: { ...newLP1, numeroLP1: e.target.value } })
          }
          className="w-full p-2 border rounded"
          placeholder="LP1-2025-001"
        />
      </div>

      {/* ÉTAPE 1: Choisir la substance principale */}
      <div>
        <label className="block text-sm font-medium mb-1">Substance *</label>
        <select
          value={newLP1.substance}
          onChange={(e) => {
            patch({
              newLP1: {
                ...newLP1,
                substance: e.target.value,
                typeSubstance: '',
                qualiteSubstance: '',
                prixUnitaireUSD: 0
              }
            });
          }}
          className="w-full p-2 border rounded"
        >
          <option value="">-- Choisir une substance --</option>
          {Object.keys(SUBSTANCE_PRICES).map(substance => (
            <option key={substance} value={substance}>{substance}</option>
          ))}
        </select>
      </div>

      {/* ÉTAPE 2: Choisir le type (taille/variété) */}
      {newLP1.substance && (
        <div>
          <label className="block text-sm font-medium mb-1">Type / Taille *</label>
          <select
            value={newLP1.typeSubstance}
            onChange={(e) => {
              patch({
                newLP1: {
                  ...newLP1,
                  typeSubstance: e.target.value,
                  qualiteSubstance: '',
                  prixUnitaireUSD: 0
                }
              });
            }}
            className="w-full p-2 border rounded"
          >
            <option value="">-- Choisir un type --</option>
            {SUBSTANCE_PRICES[newLP1.substance]?.map((type, idx) => (
              <option key={idx} value={type.label}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ÉTAPE 3: Choisir la catégorie (A, B, C) */}
      {newLP1.substance && newLP1.typeSubstance && (
        <div>
          <label className="block text-sm font-medium mb-1">Catégorie *</label>
          <select
            value={newLP1.qualiteSubstance}
            onChange={(e) => {
              const selectedGrade = e.target.value;
              const typeData = SUBSTANCE_PRICES[newLP1.substance]?.find(
                t => t.label === newLP1.typeSubstance
              );
              const categoryData = typeData?.categories.find(
                c => c.grade === selectedGrade
              );
              
              patch({
                newLP1: {
                  ...newLP1,
                  qualiteSubstance: selectedGrade,
                  prixUnitaireUSD: categoryData?.price || 0
                }
              });
            }}
            className="w-full p-2 border rounded"
          >
            <option value="">-- Choisir une catégorie --</option>
            {SUBSTANCE_PRICES[newLP1.substance]
              ?.find(t => t.label === newLP1.typeSubstance)
              ?.categories.map(category => (
                <option key={category.grade} value={category.grade}>
                  Catégorie {category.grade} - ${category.price}/kg
                </option>
              ))
            }
          </select>
        </div>
      )}

      {/* Quantité (kg) */}
      <div>
        <label className="block text-sm font-medium mb-1">Quantité (kg) *</label>
        <CalculatorInput
          value={newLP1.quantiteKg}
          onChange={(val) => patch({ newLP1: { ...newLP1, quantiteKg: val } })}
          placeholder="27000"
          className="w-full p-2 border rounded"
        />
      </div>

      {/* Prix Unitaire (lecture seule, rempli automatiquement) */}
      <div>
        <label className="block text-sm font-medium mb-1">Prix Unitaire (USD/kg)</label>
        <input
          type="text"
          value={newLP1.prixUnitaireUSD > 0 ? `$${newLP1.prixUnitaireUSD}` : ''}
          readOnly
          className="w-full p-2 border rounded bg-gray-100 text-gray-700 font-semibold"
          placeholder="Sélectionner catégorie"
        />
      </div>

      {/* Date Émission */}
      <div>
        <label className="block text-sm font-medium mb-1">Date Émission</label>
        <DatePicker
          selected={newLP1.dateEmission}
          onChange={(date) =>
            patch({ newLP1: { ...newLP1, dateEmission: date } })
          }
          dateFormat="dd/MM/yyyy"
          className="w-full p-2 border rounded"
        />
      </div>

      {/* N° OV */}
      <div>
        <label className="block text-sm font-medium mb-1">N° OV</label>
        <input
          type="text"
          value={newLP1.numeroOV}
          onChange={(e) =>
            patch({ newLP1: { ...newLP1, numeroOV: e.target.value } })
          }
          className="w-full p-2 border rounded"
          placeholder="OV-2025-001"
        />
      </div>
    </div>

    {/* Aperçu calculs */}
    {newLP1.quantiteKg > 0 && newLP1.prixUnitaireUSD > 0 && (
      <div className="mt-3 p-3 bg-blue-100 rounded text-sm">
        <p className="font-semibold mb-2">Calculs automatiques</p>
        
        {/* Résumé de la sélection */}
        <div className="bg-white p-2 rounded border border-blue-200 mb-2">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">{newLP1.substance}</span>
            {newLP1.typeSubstance && (
              <>
                {' → '}
                <span className="font-semibold">{newLP1.typeSubstance}</span>
              </>
            )}
            {newLP1.qualiteSubstance && (
              <>
                {' → '}
                <span className="font-semibold text-blue-600">
                  Catégorie {newLP1.qualiteSubstance}
                </span>
              </>
            )}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Prix unitaire: <span className="font-bold">${newLP1.prixUnitaireUSD}/kg</span>
          </p>
        </div>

        {/* Calculs */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="text-gray-600">Valeur totale (USD)</span>
            <p className="font-bold text-green-600">
              ${(newLP1.quantiteKg * newLP1.prixUnitaireUSD).toFixed(2)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Valeur totale (Ar)</span>
            <p className="font-bold">
              {formatCurrency(newLP1.quantiteKg * newLP1.prixUnitaireUSD * usdToMgaRate)}
            </p>
          </div>
          <div>
            <span className="text-gray-600">RedRist (5%)</span>
            <p className="font-bold text-red-600">
              {formatCurrency(
                calculateRedRist(newLP1.quantiteKg, newLP1.prixUnitaireUSD, usdToMgaRate)
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
        onClick={() => patch({ showLP1Form: false })}
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
                    <p className="font-bold text-green-600">{formatCurrency(lp1.valeurTotale)}</p>
                  </div>

                  <div>
                    <span className="text-gray-600">DTSPM (Ar):</span>
                    <p className="font-bold text-red-600">{formatCurrency(lp1.totalDTSPM)}</p>
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
            style={{ gridTemplateColumns: "repeat(13, 1fr)" }}
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
                    isPaid ? "border-green-300 bg-green-50" : "border-gray-200"
                  }`}
                  style={{ gridTemplateColumns: "repeat(13, 1fr)" }}
                >
                  {/* Description */}
                  <input
                    type="text"
                    value={exp.description}
                    onChange={(e) => updateExpense(exp.id, "description", e.target.value)}
                    className="col-span-2 p-2 border rounded text-sm"
                    placeholder="Description"
                    disabled={exp.lp1Id}
                  />

                  {/* Catégorie */}
                  <select
                    value={exp.category}
                    onChange={(e) => updateExpense(exp.id, "category", e.target.value)}
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
                    onChange={(val) => updateExpense(exp.id, "amount", val)}
                    className="col-span-2 p-2 border rounded text-sm font-semibold"
                    disabled={exp.lp1Id}
                  />

                  {/* Date réelle */}
                  <div className="col-span-2">
                    <DatePicker
                      selected={exp.date}
                      onChange={(date) => updateExpense(exp.id, "date", date)}
                      dateFormat="dd/MM/yy"
                      className="w-full p-2 border rounded text-sm"
                      placeholderText="Effectuée"
                    />
                  </div>

                  {/* Date planifiée */}
                  <div className="col-span-2">
                    <input
                      type="date"
                      value={exp.plannedDate || ""}
                      onChange={(e) => updateExpense(exp.id, "plannedDate", e.target.value)}
                      className="w-full p-2 border border-indigo-300 rounded text-sm bg-indigo-50"
                      title="Date planifiée du paiement"
                    />
                  </div>

                  {/* Compte */}
                  <select
                    value={exp.account}
                    onChange={(e) => updateExpense(exp.id, "account", e.target.value)}
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
  className="bg-orange-500 text-white p-2 rounded hover:bg-orange-600 text-xs"
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
                    title="Supprimer la ligne"
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
            <span className="font-bold text-red-600 text-lg">{formatCurrency(totalExpenses)}</span>
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
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1.2fr 1.2fr 1fr 1fr 0.8fr 0.8fr",
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
                  rev.isPaid ? "border-green-500 bg-green-50" : "border-gray-200"
                }`}
                style={{
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 1.2fr 1.2fr 1fr 1fr 0.8fr 0.8fr",
                }}
              >
                {/* Description */}
                <input
                  type="text"
                  value={rev.description}
                  onChange={(e) => updateRevenue(rev.id, "description", e.target.value)}
                  className="p-2 border rounded text-sm"
                  placeholder="Description"
                  disabled={rev.lp1Id}
                />

                {/* Catégorie */}
                <select
                  value={rev.category}
                  onChange={(e) => updateRevenue(rev.id, "category", e.target.value)}
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
                    updateRevenue(rev.id, "nombreLP1", parseInt(e.target.value || "1", 10))
                  }
                />

                {/* PU (Ar/kg) */}
                <input
                  type="number"
                  className="p-2 border rounded text-sm bg-white text-gray-900"
                  value={rev.prixUnitaireKg || 0}
                  placeholder="PU"
                  onChange={(e) =>
                    updateRevenue(rev.id, "prixUnitaireKg", parseFloat(e.target.value || "0"))
                  }
                />

                {/* Qté (kg) */}
                <CalculatorInput
                  value={rev.quantiteKg || 0}
                  onChange={(val) => updateRevenue(rev.id, "quantiteKg", parseFloat(val || "0"))}
                  placeholder="Qté"
                  className="p-2 border rounded text-sm bg-white text-gray-900"
                />

                {/* Montant (numérique, pas formaté) */}
                <CalculatorInput
                  value={rev.amount || 0}
                  onChange={(val) => updateRevenue(rev.id, "amount", val)}
                  className="p-2 border rounded text-sm font-semibold"
                  disabled={rev.lp1Id}
                />

                {/* Date réelle */}
                <DatePicker
                  selected={rev.date}
                  onChange={(date) => updateRevenue(rev.id, "date", date)}
                  dateFormat="dd/MM/yy"
                  className="w-full p-2 border rounded text-sm"
                  placeholderText="Encaissée"
                />

                {/* Date planifiée */}
                <input
                  type="date"
                  value={rev.plannedDate || ""}
                  onChange={(e) => updateRevenue(rev.id, "plannedDate", e.target.value)}
                  className="w-full p-2 border border-green-300 rounded text-sm bg-green-50"
                  title="Date planifiée de l'encaissement"
                />

                {/* Compte */}
                <select
                  value={rev.account}
                  onChange={(e) => updateRevenue(rev.id, "account", e.target.value)}
                  className="p-2 border rounded text-sm"
                >
                  <option value="">Compte</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.name}>
                      {acc.name}
                    </option>
                  ))}
                </select>

                {/* Actions */}
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
            <span className="font-bold text-green-600 text-lg">{formatCurrency(totalRevenues)}</span>
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
                className={`text-2xl font-bold ${
                  netProfit >= 0 ? "text-green-300" : "text-red-300"
                }`}
              >
                {formatCurrency(netProfit)}
              </p>
            </div>
            <div>
              <p className="text-blue-100 text-sm">ROI</p>
              <p
                className={`text-2xl font-bold ${roi >= 0 ? "text-green-300" : "text-red-300"}`}
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
          {loading ? "Enregistrement..." : "Enregistrer le Projet"}
        </button>
      </div>
    </div>
  </div>
);
}