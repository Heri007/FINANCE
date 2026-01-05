// src/ProjectPlannerModal.jsx - VERSION FINALE CORRIGÉE (Export + Auto Commissions)

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Save,
  FileText,
  CheckCircle,
  Zap,
  Copy,
  Flame,
  Anchor,
  Download,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
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
  onProjectSaved,
  onProjectUpdated,
  createTransaction,
}) {
  // ✅ AJOUTER: Vérification de sécurité
  if (!createTransaction) {
    console.error('❌ createTransaction manquant dans ProjectPlannerModal !');
    // Empêcher le crash total
    return null;
  }

  // --- ÉTATS DU FORMULAIRE ---
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState('PRODUCTFLIP');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);

  // Financier
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);

  // États EXPORT (Paramètres)
  const [pricePerContainer, setPricePerContainer] = useState(0);
  const [containerCount, setContainerCount] = useState(0);
  const [commissionRateProprio, setCommissionRateProprio] = useState(0.2); // 20%
  const [commissionRateRandou, setCommissionRateRandou] = useState(0.1); // 10%

  // États Operator
  const [relatedSOPs, setRelatedSOPs] = useState([]);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [showSOPSection, setShowSOPSection] = useState(true);
  const [showTaskSection, setShowTaskSection] = useState(true);

  const [loading, setLoading] = useState(false);
  const [loadingOperational, setLoadingOperational] = useState(false);

  // --- CHARGEMENT INITIAL (CORRIGÉ & ROBUSTE) ---
  // --- CHARGEMENT INITIAL (AVEC RÉCUPÉRATION DES TRANSACTIONS RÉELLES) ---
  useEffect(() => {
    const loadProjectData = async () => {
      if (project) {
        setProjectName(project.name || '');
        setDescription(project.description || '');
        setProjectType(project.type || 'PRODUCTFLIP');
        setStatus(project.status || 'active');

        // Gestion des dates
        const start = project.startDate || project.start_date;
        const end = project.endDate || project.end_date;
        setStartDate(start ? new Date(start) : new Date());
        setEndDate(end ? new Date(end) : null);

        // 1. Charger les lignes enregistrées dans le projet
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

        // 2. RECUPÉRER LES TRANSACTIONS RÉELLES (Ce qui a été lié par SQL)
        if (project.id) {
          try {
            const allTx = await transactionsService.getAll();
            const projectTx = allTx.filter(
              (t) => String(t.project_id) === String(project.id)
            );

            console.log('📥 Transactions récupérées pour le projet:', projectTx.length);

            // Fonction pour fusionner/ajouter les transactions réelles
            const mergeTransactions = (lines, type) => {
              const newLines = [...lines];

              projectTx
                .filter((t) => t.type === type)
                .forEach((tx) => {
                  const accName =
                    accounts.find((a) => a.id === tx.account_id)?.name || 'Inconnu';

                  const existingIdx = newLines.findIndex(
                    (l) =>
                      String(l.id) === String(tx.project_line_id) ||
                      (Number(l.amount) === Number(tx.amount) &&
                        l.description === tx.description &&
                        !l.isPaid)
                  );

                  const realDate = tx.transaction_date || tx.date; // ✅ Date réelle

                  if (existingIdx >= 0) {
                    // Ligne existante: on garde l'ancienne date (planifiée) dans `date`,
                    // et on stocke la date réelle séparément
                    newLines[existingIdx] = {
                      ...newLines[existingIdx],
                      isPaid: true,
                      account: accName,
                      realDate: realDate ? new Date(realDate) : null, // ✅ nouvelle propriété
                    };
                  } else {
                    // Nouvelle ligne créée depuis une transaction réelle
                    newLines.push({
                      id: tx.project_line_id || uuidv4(),
                      description: tx.description,
                      amount: parseFloat(tx.amount),
                      category: tx.category,
                      date: new Date(), // planifiée par défaut ou null si tu préfères
                      realDate: realDate ? new Date(realDate) : null, // ✅ stocker la date réelle
                      account: accName,
                      isPaid: true,
                      isRecurring: false,
                    });
                  }
                });

              return newLines;
            };

            currentExpenses = mergeTransactions(currentExpenses, 'expense');
            currentRevenues = mergeTransactions(currentRevenues, 'income');
          } catch (err) {
            console.error('Erreur lors de la synchronisation des transactions:', err);
          }
        }

        setExpenses(currentExpenses);
        setRevenues(currentRevenues);

        // Logique Export (inchangée)
        if (project.type === 'EXPORT') {
          const containers = currentRevenues.filter(
            (r) =>
              r.category === 'Vente Export Global' ||
              r.description.includes('Export Global')
          );
          if (containers.length > 0) {
            const matchCount = containers[0].description.match(/(\d+)\s+Containers/i);
            if (matchCount && matchCount[1]) {
              const count = parseInt(matchCount[1], 10);
              setContainerCount(count);
              if (count > 0) setPricePerContainer(containers[0].amount / count);
            }
          }
        }

        if (project.id) loadOperationalData(project.id);
      } else {
        // Reset (Nouveau projet)
        setProjectName('');
        setDescription('');
        setProjectType('PRODUCTFLIP');
        setStatus('active');
        setStartDate(new Date());
        setEndDate(null);
        setExpenses([]);
        setRevenues([]);
        setPricePerContainer(0);
        setContainerCount(0);
        setRelatedSOPs([]);
        setRelatedTasks([]);
      }
    };

    loadProjectData();
  }, [project, isOpen]); // Retirez 'accounts' des dépendances si cela crée une boucle, sinon laissez-le

  // ✅ LOGIQUE AUTOMATIQUE EXPORT (COMMISSIONS SEULEMENT)
  // Met à jour les commissions quand le CA théorique change
  useEffect(() => {
    if (projectType !== 'EXPORT') return;

    // Calcul du CA théorique (ou réel si ligne générée)
    const theoreticalRevenue = pricePerContainer * containerCount;

    // On met à jour les lignes de commissions existantes
    setExpenses((prevExpenses) => {
      return prevExpenses.map((exp) => {
        // Si la ligne n'est pas payée, on met à jour son montant
        if (!exp.isPaid) {
          if (exp.description === 'Commission intermédiaire proprio') {
            return { ...exp, amount: theoreticalRevenue * commissionRateProprio };
          }
          if (exp.description === 'Commission intermédiaire @RANDOU') {
            return { ...exp, amount: theoreticalRevenue * commissionRateRandou };
          }
        }
        return exp;
      });
    });
  }, [
    pricePerContainer,
    containerCount,
    commissionRateProprio,
    commissionRateRandou,
    projectType,
  ]);

  // ✅ FONCTION MANUELLE : GÉNÉRER LA LIGNE DE REVENU GLOBAL
  const generateContainerRevenues = () => {
    if (!pricePerContainer || !containerCount) {
      alert('Veuillez définir le prix par container et le nombre de containers');
      return;
    }

    const totalAmount = pricePerContainer * containerCount;

    // On supprime l'ancienne ligne globale si elle existe pour la remplacer
    const otherRevenues = revenues.filter((r) => r.category !== 'Vente Export Global');

    const globalRevenue = {
      id: uuidv4(),
      description: `Export Global (${containerCount} Containers à ${formatCurrency(pricePerContainer)})`,
      amount: totalAmount,
      date: new Date(),
      account: '',
      isPaid: false,
      category: 'Vente Export Global',
    };

    setRevenues([...otherRevenues, globalRevenue]);

    // On ajoute aussi les lignes de commissions si elles n'existent pas encore
    setExpenses((prevExpenses) => {
      const newExpenses = [...prevExpenses];

      // Helper pour ajouter si n'existe pas
      const addIfNotExists = (desc, rate) => {
        if (!newExpenses.find((e) => e.description === desc)) {
          newExpenses.push({
            id: uuidv4(),
            description: desc,
            amount: totalAmount * rate,
            category: 'Commissions',
            date: new Date(),
            account: 'Coffre',
            isPaid: false,
          });
        }
      };

      addIfNotExists('Commission intermédiaire proprio', commissionRateProprio);
      addIfNotExists('Commission intermédiaire @RANDOU', commissionRateRandou);

      return newExpenses;
    });

    alert(`Ligne de revenu global générée : ${formatCurrency(totalAmount)}`);
  };

  // --- CHARGEMENT DONNÉES OPÉRATIONNELLES ---
  const loadOperationalData = async (projectId) => {
    setLoadingOperational(true);
    try {
      const [allSOPs, allTasks] = await Promise.all([
        operatorService.getSOPs(),
        operatorService.getTasks(),
      ]);

      const linkedTasks = allTasks.filter(
        (task) => String(task.projectid || task.projectId) === String(projectId)
      );
      setRelatedTasks(linkedTasks);

      const linkedSOPs = allSOPs.filter(
        (s) => String(s.projectid || s.projectId) === String(projectId)
      );

      setRelatedSOPs(linkedSOPs);

      if (linkedSOPs.length > 0) setShowSOPSection(true);
      if (linkedTasks.length > 0) setShowTaskSection(true);
    } catch (error) {
      console.error('Erreur chargement données opérationnelles:', error);
    } finally {
      setLoadingOperational(false);
    }
  };

  // --- CATÉGORIES ---
  const getExpenseCategories = () => {
    const baseCategories = [
      {
        value: 'CAPEX',
        label: '🏗️ CAPEX',
        types: ['LIVESTOCK', 'REALESTATE', 'FISHING'],
      },
      {
        value: 'Équipements',
        label: '🔧 Équipements',
        types: ['LIVESTOCK', 'FISHING', 'PRODUCTFLIP'],
      },
      {
        value: 'Fonds de roulement',
        label: '💰 Fonds de rlmnt',
        types: ['LIVESTOCK', 'FISHING', 'PRODUCTFLIP'],
      },
      {
        value: 'Transport',
        label: '🚚 Transport',
        types: ['PRODUCTFLIP', 'FISHING', 'LIVESTOCK'],
      },
      { value: 'Automobile', label: '🚗 Automobile', types: ['PRODUCTFLIP'] },
      { value: 'Achat', label: '🛒 Achat Stock', types: ['PRODUCTFLIP'] },
    ];

    const exportCategories = [
      { value: 'Droits Bancaires', label: '🏦 Bancaire', types: ['EXPORT'] },
      { value: 'Frais Déplacement', label: '🚗 Déplacement', types: ['EXPORT'] },
      { value: 'Administratif', label: '📄 Administratif', types: ['EXPORT'] },
      { value: 'Commissions', label: '💼 Commissions', types: ['EXPORT'] },
      { value: 'Douanes', label: '🛃 Douanes', types: ['EXPORT'] },
      { value: 'Conteneurs', label: '📦 Location Cont.', types: ['EXPORT'] },
      { value: 'Certification', label: '✅ Certifications', types: ['EXPORT'] },
    ];

    const allCategories = [...baseCategories, ...exportCategories];
    return allCategories.filter((cat) => !cat.types || cat.types.includes(projectType));
  };

  // --- GESTION LIGNES ---
  const updateExpense = (id, field, value) => {
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };
  const updateRevenue = (id, field, value) => {
    setRevenues(revenues.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const removeExpense = (id) => setExpenses(expenses.filter((e) => e.id !== id));
  const removeRevenue = (id) => setRevenues(revenues.filter((r) => r.id !== id));

  const handlePayerDepense = async (exp, index) => {
    try {
      if (!exp.account) return alert('Choisis un compte');

      const accountObj = accounts.find((a) => a.name === exp.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!project?.id) return alert('Erreur: Projet introuvable.');

      const alreadyPaid = window.confirm(
        `Payer ${formatCurrency(exp.amount)} depuis ${exp.account}.\n\n` +
          `Cette dépense a-t-elle DÉJÀ été payée physiquement ?\n` +
          `- OUI (OK) → Je marque juste la ligne comme payée, sans créer de transaction.\n` +
          `- NON (Annuler) → Je crée une transaction et débite le compte.`
      );

      const payload = alreadyPaid
        ? {
            paid_externally: true,
            amount: parseFloat(exp.amount),
            paid_date: exp.realDate || new Date().toISOString().split('T')[0],
          }
        : {
            create_transaction: true,
            amount: parseFloat(exp.amount),
            paid_date: exp.realDate || new Date().toISOString().split('T')[0],
          };

      // 🔐 Appel backend via client API (CSRF + JWT auto)
      const result = await api.patch(
        `/projects/${project.id}/expense-lines/${exp.id}/mark-paid`,
        payload
      );

      const updated = [...expenses];
      updated[index] = { ...updated[index], isPaid: true };
      setExpenses(updated);

      await saveProjectState(updated, revenues);

      if (onProjectUpdated) onProjectUpdated();

      alert(result.message || 'Dépense marquée comme payée !');
    } catch (error) {
      console.error('Erreur handlePayerDepense:', error);
      alert(error?.message || 'Erreur paiement');
    }
  };

  const handleEncaisser = async (rev, index) => {
    try {
      if (!rev.account) return alert('Choisis un compte');

      const accountObj = accounts.find((a) => a.name === rev.account);
      if (!accountObj) return alert('Compte introuvable');

      if (!project?.id) return alert('Erreur: Projet introuvable.');

      const alreadyReceived = window.confirm(
        `Encaisser ${formatCurrency(rev.amount)} sur ${rev.account}.\n\n` +
          `Ce revenu a-t-il DÉJÀ été encaissé physiquement ?\n` +
          `- OUI (OK) → Je marque juste la ligne comme reçue, sans créer de transaction.\n` +
          `- NON (Annuler) → Je crée une transaction et crédite le compte.`
      );

      const payload = alreadyReceived
        ? {
            received_externally: true,
            amount: parseFloat(rev.amount),
            received_date: rev.realDate || new Date().toISOString().split('T')[0],
          }
        : {
            create_transaction: true,
            amount: parseFloat(rev.amount),
            received_date: rev.realDate || new Date().toISOString().split('T')[0],
          };

      // 🔐 Appel backend via client API (CSRF + JWT auto)
      const result = await api.patch(
        `/projects/${project.id}/revenue-lines/${rev.id}/mark-received`,
        payload
      );

      const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: true };
      setRevenues(updated);

      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();

      alert(result.message || 'Revenu marqué comme reçu !');
    } catch (error) {
      console.error('Erreur handleEncaisser:', error);
      alert(error?.message || 'Erreur encaissement');
    }
  };

  // --- ANNULATION PAIEMENT DÉPENSE/REVENUE ---
  const handleCancelPaymentExpense = async (exp, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');

      if (!window.confirm(`Annuler le paiement de ${formatCurrency(exp.amount)} ?`))
        return;

      // 🔐 Appel backend via client API (CSRF + JWT auto)
      const result = await api.patch(
        `/projects/${project.id}/expense-lines/${exp.id}/cancel-payment`,
        {} // pas de payload spécifique
      );

      const updated = [...expenses];
      updated[index] = { ...updated[index], isPaid: false };
      setExpenses(updated);

      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();

      alert(result.message);
    } catch (err) {
      console.error('Erreur handleCancelPaymentExpense:', err);
      alert('Erreur annulation: ' + (err.message || err));
    }
  };

  const handleCancelPaymentRevenue = async (rev, index) => {
    try {
      if (!project?.id) return alert('Projet non enregistré');

      if (!window.confirm(`Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`))
        return;

      // 🔐 Appel backend via client API (CSRF + JWT auto)
      const result = await api.patch(
        `/projects/${project.id}/revenue-lines/${rev.id}/cancel-receipt`,
        {} // pas de payload spécifique
      );

      const updated = [...revenues];
      updated[index] = { ...updated[index], isPaid: false };
      setRevenues(updated);

      await saveProjectState(expenses, updated);

      if (onProjectUpdated) onProjectUpdated();

      alert(result.message);
    } catch (err) {
      console.error('Erreur handleCancelPaymentRevenue:', err);
      alert('Erreur annulation: ' + (err.message || err));
    }
  };

  const saveProjectState = async (currentExpenses, currentRevenues) => {
    if (!project?.id) return;

    // ✅ Mapper Date planifiée
    const expensesWithDate = currentExpenses.map((e) => ({
      ...e,
      plannedDate: e.date ? new Date(e.date).toISOString().split('T')[0] : null,
    }));
    console.log('🔍 EXPENSES WITH DATE:', expensesWithDate[0]); // ✅ Vérifie ici
    const revenuesWithDate = currentRevenues.map((r) => ({
      ...r,
      plannedDate: r.date ? new Date(r.date).toISOString().split('T')[0] : null,
    }));
    console.log('🔍 REVENUES WITH DATE:', revenuesWithDate[0]); // ✅ Vérifie ici
    const newTotalRevenues = revenuesWithDate.reduce(
      (s, r) => s + (parseFloat(r.amount) || 0),
      0
    );
    const newTotalExpenses = expensesWithDate.reduce(
      (s, e) => s + (parseFloat(e.amount) || 0),
      0
    );
    const newNetProfit = newTotalRevenues - newTotalExpenses;
    const newRoi =
      newTotalExpenses > 0 ? ((newNetProfit / newTotalExpenses) * 100).toFixed(1) : 0;

    const payload = {
      name: projectName.trim(),
      type: projectType,
      description: description || '',
      status: status || 'active',
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      totalCost: newTotalExpenses,
      totalRevenues: newTotalRevenues,
      netProfit: newNetProfit,
      roi: parseFloat(newRoi),
      remainingBudget: parseFloat(totalAvailable) - newTotalExpenses,
      totalAvailable: parseFloat(totalAvailable),
      // ✅ avec plannedDate
      expenses: JSON.stringify(expensesWithDate),
      revenues: JSON.stringify(revenuesWithDate),
    };

    await projectsService.updateProject(project.id, payload);
  };

  // --- TEMPLATES ---
  const applyTemplate = (template) => {
    if (expenses.length > 0 && !window.confirm('Écraser les données actuelles ?')) return;
    setProjectName(template.name);
    setProjectType(template.type);
    setDescription(template.description);
    setExpenses(template.expenses);
    setRevenues(template.revenues);
    if (template.pricePerContainer) setPricePerContainer(template.pricePerContainer);
    if (template.containerCount) setContainerCount(template.containerCount);
  };

  const templates = {
    mineralExport: {
      name: 'Export Pierres Industrielles',
      type: 'EXPORT',
      description: 'Exportation de pierres industrielles en containers.',
      pricePerContainer: 5000000,
      containerCount: 3,
      expenses: [
        {
          id: uuidv4(),
          description: 'Domiciliation bancaire',
          amount: 500000,
          category: 'Droits Bancaires',
          date: new Date(),
          account: 'Compte BOA',
        },
        {
          id: uuidv4(),
          description: 'Frais administratifs',
          amount: 150000,
          category: 'Administratif',
          date: new Date(),
          account: 'Coffre',
        },
      ],
      revenues: [],
    },
    // ... autres templates ...
    productFlip: {
      name: 'Achat/Revente Rapide',
      type: 'PRODUCTFLIP',
      description: 'Achat de stock pour revente immédiate.',
      expenses: [
        {
          id: uuidv4(),
          description: 'Achat Stock',
          amount: 500000,
          category: 'Achat',
          date: new Date(),
          account: 'Coffre',
        },
      ],
      revenues: [
        {
          id: uuidv4(),
          description: 'Vente Client',
          amount: 750000,
          category: 'Vente',
          date: new Date(),
          account: 'Coffre',
        },
      ],
    },
  };

  // --- CALCULS ---
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
    if (!projectName) return alert('Le nom est obligatoire');
    setLoading(true);

    try {
      // ✅ Mapper Date planifiée
      const expensesWithDate = expenses.map((e) => ({
        ...e,
        plannedDate: e.date ? new Date(e.date).toISOString().split('T')[0] : null,
      }));

      const revenuesWithDate = revenues.map((r) => ({
        ...r,
        plannedDate: r.date ? new Date(r.date).toISOString().split('T')[0] : null,
      }));

      const totalRevenues = revenuesWithDate.reduce(
        (s, r) => s + (parseFloat(r.amount) || 0),
        0
      );
      const totalExpenses = expensesWithDate.reduce(
        (s, e) => s + (parseFloat(e.amount) || 0),
        0
      );
      const netProfit = totalRevenues - totalExpenses;
      const roi = totalExpenses > 0 ? ((netProfit / totalExpenses) * 100).toFixed(1) : 0;

      const payload = {
        name: projectName.trim(),
        description: description.trim(),
        type: projectType,
        status,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        totalCost: parseFloat(totalExpenses) || 0,
        totalRevenues: parseFloat(totalRevenues) || 0,
        netProfit: parseFloat(netProfit) || 0,
        roi: parseFloat(roi) || 0,
        remainingBudget: parseFloat(remainingBudget) || 0,
        totalAvailable: parseFloat(totalAvailable) || 0,
        // ✅ avec plannedDate
        expenses: JSON.stringify(expensesWithDate),
        revenues: JSON.stringify(revenuesWithDate),
      };

      if (project?.id) {
        await projectsService.updateProject(project.id, payload);
        if (onProjectUpdated) onProjectUpdated();
      } else {
        await projectsService.createProject(payload);
        if (onProjectSaved) onProjectSaved();
      }

      onClose();
    } catch (e) {
      alert('Erreur sauvegarde: ' + e.message);
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
              {project ? `Édition : ${project.name}` : 'Nouveau Projet'}
            </h2>
            <p className="text-purple-100 text-sm">
              Planification Financière & Opérationnelle
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyTemplate(templates.productFlip)}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs transition"
            >
              Template Flip
            </button>
            <button
              onClick={() => applyTemplate(templates.mineralExport)}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded text-xs transition"
            >
              Template Export
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition"
            >
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
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-purple-500 font-bold text-lg"
                placeholder="Nom du Projet"
              />
              <div className="grid grid-cols-2 gap-4">
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full border-gray-300 rounded-lg p-2.5"
                >
                  <option value="PRODUCTFLIP">💰 Achat/Revente</option>
                  <option value="LIVESTOCK">🐓 Élevage</option>
                  <option value="FISHING">🎣 Pêche</option>
                  <option value="REALESTATE">🏠 Immobilier</option>
                  <option value="EXPORT">📦 Exportation</option>
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border-gray-300 rounded-lg p-2.5"
                >
                  <option value="active">Actif</option>
                  <option value="draft">Brouillon</option>
                  <option value="completed">Terminé</option>
                </select>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border-gray-300 rounded-lg p-2.5 text-sm"
                placeholder="Description..."
              />
            </div>

            {/* KPI Live */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="text-xs text-red-600 font-bold uppercase">Coût Total</div>
                <div className="text-xl font-bold text-red-700">
                  {formatCurrency(totalExpenses)}
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="text-xs text-green-600 font-bold uppercase flex items-center justify-between">
                  <span>Revenus</span>
                  {projectType === 'EXPORT' && revenues.length === 0 && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                      Prévisionnel
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-green-700">
                  {formatCurrency(
                    totalRevenues > 0 ? totalRevenues : pricePerContainer * containerCount
                  )}
                </div>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="text-xs text-indigo-600 font-bold uppercase">
                  Marge Nette
                </div>
                <div
                  className={`text-xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}
                >
                  {formatCurrency(netProfit)}
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-bold uppercase">
                  Solde après projet
                </div>
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
                  {relatedSOPs.map((s) => (
                    <li key={s.id} className="bg-white px-2 py-1 rounded border">
                      • {s.title}
                    </li>
                  ))}
                  {relatedSOPs.length === 0 && (
                    <li className="text-slate-400 italic">Aucune SOP liée</li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <CheckCircle size={16} /> Tâches ({relatedTasks.length})
                </h3>
                <ul className="text-sm space-y-1">
                  {relatedTasks.map((t) => (
                    <li key={t.id} className="bg-white px-2 py-1 rounded border">
                      • {t.title}
                    </li>
                  ))}
                  {relatedTasks.length === 0 && (
                    <li className="text-slate-400 italic">Aucune tâche liée</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* ✅ SECTION EXPORT: Configuration Auto */}
          {projectType === 'EXPORT' && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                📦 Configuration Export Automatique
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Prix / Container (Ar)
                  </label>
                  <CalculatorInput
                    value={pricePerContainer}
                    onChange={setPricePerContainer}
                    className="w-full text-right font-mono p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nb Containers
                  </label>
                  <input
                    type="number"
                    value={containerCount}
                    onChange={(e) => setContainerCount(parseInt(e.target.value) || 0)}
                    className="w-full text-right font-mono p-2 border rounded"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Comm. Proprio (%)
                  </label>
                  <input
                    type="number"
                    value={Math.round(commissionRateProprio * 100)}
                    onChange={(e) =>
                      setCommissionRateProprio(parseFloat(e.target.value) / 100)
                    }
                    className="w-full text-right p-2 border rounded"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Comm. Randou (%)
                  </label>
                  <input
                    type="number"
                    value={Math.round(commissionRateRandou * 100)}
                    onChange={(e) =>
                      setCommissionRateRandou(parseFloat(e.target.value) / 100)
                    }
                    className="w-full text-right p-2 border rounded"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-3">
                <button
                  onClick={generateContainerRevenues}
                  disabled={!pricePerContainer || !containerCount}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Plus size={16} />
                  Ajouter le Revenu Global
                </button>
              </div>

              {/* Info box */}
              <div className="mt-4 bg-blue-100 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Info:</strong> Le bouton ajoute une ligne unique correspondant au
                total des ventes prévues ({containerCount} containers). Les commissions
                (dépenses) sont calculées automatiquement en pourcentage de ce total.
              </div>
            </div>
          )}

          {/* TABLEAU DES DÉPENSES */}
          <div className="border rounded-xl p-4 bg-white shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-red-800 flex items-center gap-2">
                <TrendingDown size={20} /> Dépenses
              </h3>
              <button
                onClick={() =>
                  setExpenses([
                    ...expenses,
                    {
                      id: uuidv4(),
                      description: '',
                      amount: 0,
                      category: '',
                      date: new Date(),
                      account: '',
                      isPaid: false,
                    },
                  ])
                }
                className="bg-red-50 text-red-700 px-3 py-1 rounded-lg text-sm hover:bg-red-100 flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {expenses.map((exp, idx) => (
                <div
                  key={exp.id}
                  className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${exp.isPaid ? 'bg-gray-50 border-gray-200' : 'bg-white border-red-100'}`}
                >
                  <div className="col-span-4">
                    <div className="flex gap-2">
                      <select
                        value={exp.category || ''}
                        onChange={(e) =>
                          updateExpense(exp.id, 'category', e.target.value)
                        }
                        className="w-40 text-sm border rounded"
                        disabled={exp.isPaid}
                      >
                        <option value="">Catégorie</option>
                        {getExpenseCategories().map((cat) => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={exp.description}
                        onChange={(e) =>
                          updateExpense(exp.id, 'description', e.target.value)
                        }
                        placeholder="Description"
                        className="flex-1 text-sm border rounded"
                        disabled={exp.isPaid}
                      />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <CalculatorInput
                      value={exp.amount}
                      onChange={(val) => updateExpense(exp.id, 'amount', val)}
                      className="w-full text-sm border rounded text-right font-mono"
                      placeholder="0 Ar"
                      disabled={exp.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={exp.account || ''}
                      onChange={(e) => updateExpense(exp.id, 'account', e.target.value)}
                      className="w-full text-sm border rounded"
                      disabled={exp.isPaid}
                    >
                      <option value="">-- Compte --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    {exp.isPaid ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded flex items-center">
                          <CheckCircle size={12} className="mr-1" /> Payé
                        </span>
                        <button
                          onClick={() => handleCancelPaymentExpense(exp, idx)}
                          className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handlePayerDepense(exp, idx)}
                          disabled={!exp.account || !exp.amount}
                          className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          Payer
                        </button>
                        <button
                          onClick={() => removeExpense(exp.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
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
                <TrendingUp size={20} /> Revenus
              </h3>
              <button
                onClick={() =>
                  setRevenues([
                    ...revenues,
                    {
                      id: uuidv4(),
                      description: '',
                      amount: 0,
                      category: '',
                      date: new Date(),
                      account: '',
                      isPaid: false,
                    },
                  ])
                }
                className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-sm hover:bg-green-100 flex items-center gap-1"
              >
                <Plus size={16} /> Ajouter
              </button>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {revenues.map((rev, idx) => (
                <div
                  key={rev.id}
                  className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg border ${rev.isPaid ? 'bg-gray-50 border-gray-200' : 'bg-white border-green-100'}`}
                >
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={rev.description}
                      onChange={(e) =>
                        updateRevenue(rev.id, 'description', e.target.value)
                      }
                      className="w-full text-sm border rounded"
                      disabled={rev.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <CalculatorInput
                      value={rev.amount}
                      onChange={(val) => updateRevenue(rev.id, 'amount', val)}
                      className="w-full text-sm border rounded text-right font-mono"
                      disabled={rev.isPaid}
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      value={rev.account || ''}
                      onChange={(e) => updateRevenue(rev.id, 'account', e.target.value)}
                      className="w-full text-sm border rounded"
                      disabled={rev.isPaid}
                    >
                      <option value="">-- Compte --</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.name}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 flex justify-end gap-1">
                    {rev.isPaid ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded">
                          <CheckCircle size={12} className="mr-1" /> Reçu
                        </span>
                        <button
                          onClick={() => handleCancelPaymentRevenue(rev, idx)}
                          className="text-xs bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEncaisser(rev, idx)}
                          disabled={!rev.account || !rev.amount}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                        >
                          Encaisser
                        </button>
                        <button
                          onClick={() => removeRevenue(rev.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
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
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-purple-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-purple-700 shadow-lg disabled:opacity-70"
          >
            <Save size={18} /> {loading ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
