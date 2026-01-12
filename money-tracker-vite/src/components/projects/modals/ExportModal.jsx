// src/components/projects/modals/ExportModal.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Save,
  Ship,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calculator,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { v4 as uuidv4 } from 'uuid';
import { projectsService } from '../../../services/projectsService';
import { transactionsService } from '../../../services/transactionsService';
import { formatCurrency } from '../../../utils/formatters';
import { CalculatorInput } from '../../common/CalculatorInput';
import { api } from '../../../services/api';
import { useFinance } from '../../../contexts/FinanceContext';
import { toLocalISODate, toLocalISOString } from '../../../utils/dateUtils';

export function ExportModal({
  isOpen,
  onClose,
  accounts = [],
  project = null,
  onProjectSaved,
  onProjectUpdated,
  createTransaction,
}) {
  const { refreshProjects } = useFinance();

  // ===== VÉRIFICATION SÉCURITÉ =====
  if (!createTransaction) {
    console.error('❌ createTransaction manquant dans ExportModal !');
    return null;
  }

  // ✅ AJOUT : isMountedRef
  const isMountedRef = useRef(true);

  // ===== ÉTATS DE BASE =====
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('active');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(null);

  // ===== ÉTATS SPÉCIFIQUES EXPORT =====
  const [pricePerContainer, setPricePerContainer] = useState(0);
  const [containerCount, setContainerCount] = useState(0);
  const [commissionRateProprio, setCommissionRateProprio] = useState(0.2); // 20%
  const [commissionRateRandou, setCommissionRateRandou] = useState(0.1); // 10%
  const [productType, setProductType] = useState(''); // Type de produit exporté
  const [destination, setDestination] = useState(''); // Pays de destination
  const [containerType, setContainerType] = useState('20FT'); // 20FT ou 40FT

  // ===== CHARGES & VENTES =====
  const [expenses, setExpenses] = useState([]);
  const [revenues, setRevenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // ✅ AJOUT : Cleanup au unmount
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      console.log('🧹 ExportModal unmounted - cleanup effectué');
    };
  }, []);

  // ===== CHARGEMENT PROJET EXISTANT =====
  useEffect(() => {
    const loadProjectData = async () => {
      // 🛡️ CHECK 1: Au début
      if (!isMountedRef.current) return;
      
      if (project) {
        setProjectName(project.name);
        setDescription(project.description);
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
          setCommissionRateProprio(meta.commissionRateProprio || 0.2);
          setCommissionRateRandou(meta.commissionRateRandou || 0.1);
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

        let currentExpenses = parseList(project.expenses).map(e => ({
          ...e,
          id: e.id || uuidv4(),
          date: e.date ? new Date(e.date) : new Date(),
          amount: parseFloat(e.amount) || 0,
        }));

        let currentRevenues = parseList(project.revenues).map(r => ({
          ...r,
          id: r.id || uuidv4(),
          date: r.date ? new Date(r.date) : new Date(),
          amount: parseFloat(r.amount) || 0,
        }));

        // CHARGER LE PROJET COMPLET AVEC LES LIGNES DB
        if (project.id) {
          try {
            console.log('🔄 Chargement projet complet avec lignes DB...');
            const fullProject = await projectsService.getById(project.id);

            // 🛡️ CHECK 2: Après appel async
            if (!isMountedRef.current) return;

            // Parser les lignes DB
            let expenseLines = parseList(fullProject?.expenseLines || fullProject?.expense_lines);
            let revenueLines = parseList(fullProject?.revenueLines || fullProject?.revenue_lines);

            // CRUCIAL : Stocker dans project
            project.expenseLines = expenseLines;
            project.revenueLines = revenueLines;

            // Récupérer les transactions
            const allTx = await transactionsService.getAll();

            // 🛡️ CHECK 3: Après second appel async
            if (!isMountedRef.current) return;

            const projectTx = allTx.filter(t => 
              String(t.project_id) === String(project.id)
            );

            console.log('💳 Transactions récupérées:', projectTx.length);

            // ✅ Fusionner avec les lignes DB en paramètre
            const mergeTransactions = (lines, type, dbLines) => {
              const newLines = [...lines];

              projectTx
                .filter((t) => t.type === type)
                .forEach((tx) => {
                  const accName =
                    accounts.find((a) => a.id === tx.account_id)?.name || 'Inconnu';
                  const realDate = tx.transaction_date || tx.date;

                  // ✅ Recherche améliorée
                  const existingIdx = newLines.findIndex((l) => {
                    // Match par project_line_id
                    if (
                      tx.project_line_id &&
                      String(l.id) === String(tx.project_line_id)
                    ) {
                      return true;
                    }

                    // Match par description + montant (tolérance)
                    const descMatch = l.description === tx.description;
                    const amountMatch =
                      Math.abs(parseFloat(l.amount) - parseFloat(tx.amount)) < 0.01;
                    const notPaid = !l.isPaid;

                    return descMatch && amountMatch && notPaid;
                  });

                  // ✅ Trouver le dbLineId depuis dbLines
                  const findDbLine = (desc, amount) => {
                    return dbLines.find((dl) => {
                      const dlDesc = (dl.description || '').trim().toLowerCase();
                      const searchDesc = (desc || '').trim().toLowerCase();
                      const dlAmount = parseFloat(
                        dl.projected_amount ||
                          dl.projectedamount ||
                          dl.projectedAmount ||
                          dl.actual_amount ||
                          dl.actualamount ||
                          dl.actualAmount ||
                          dl.amount ||
                          0
                      );

                      return dlDesc === searchDesc && Math.abs(dlAmount - amount) < 0.01;
                    });
                  };

                  if (existingIdx >= 0) {
                    // ✅ Mettre à jour ligne existante
                    const dbLine = findDbLine(tx.description, parseFloat(tx.amount));

                    newLines[existingIdx] = {
                      ...newLines[existingIdx],
                      isPaid: true,
                      account: accName,
                      realDate: realDate ? new Date(realDate) : null,
                      dbLineId: dbLine?.id || tx.project_line_id, // ✅ CRITIQUE
                    };

                  } else {
                    // ✅ Créer nouvelle ligne
                    const dbLine = findDbLine(tx.description, parseFloat(tx.amount));

                    newLines.push({
                      id: tx.project_line_id || uuidv4(),
                      description: tx.description,
                      amount: parseFloat(tx.amount),
                      category: tx.category,
                      date: new Date(),
                      realDate: realDate ? new Date(realDate) : null,
                      account: accName,
                      isPaid: true,
                      isRecurring: false,
                      dbLineId: dbLine?.id || tx.project_line_id, // ✅ CRITIQUE
                    });
                  }
                });

              return newLines;
            };

            // ✅ APPELS CORRIGÉS avec dbLines en paramètre
            currentExpenses = mergeTransactions(currentExpenses, 'expense', expenseLines);
            currentRevenues = mergeTransactions(currentRevenues, 'income', revenueLines);

            // 🛡️ CHECK 4: Avant setState
            if (!isMountedRef.current) return;

            setExpenses(currentExpenses);
            setRevenues(currentRevenues);

          } catch (err) {
            // 🛡️ CHECK 5: Avant log d'erreur
            if (!isMountedRef.current) return;
            
            console.error('❌ Erreur synchronisation:', err);
          }
        }

      } else {
        resetForm();
      }
    };

    loadProjectData();
  }, [project, isOpen, accounts]);

  // ===== RÉINITIALISER LE FORMULAIRE =====
  const resetForm = () => {
    setProjectName('');
    setDescription('');
    setStatus('active');
    setStartDate(new Date());
    setEndDate(null);
    setPricePerContainer(0);
    setContainerCount(0);
    setCommissionRateProprio(0.2);
    setCommissionRateRandou(0.1);
    setProductType('');
    setDestination('');
    setContainerType('20FT');
    setExpenses([]);
    setRevenues([]);
  };

  // ===== MISE À JOUR AUTOMATIQUE DES COMMISSIONS =====
  useEffect(() => {
    const theoreticalRevenue = pricePerContainer * containerCount;

    setExpenses((prevExpenses) => {
      return prevExpenses.map((exp) => {
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
  }, [pricePerContainer, containerCount, commissionRateProprio, commissionRateRandou]);

  // ===== GÉNÉRER LA LIGNE DE REVENU GLOBAL =====
  const generateContainerRevenues = () => {
    if (!pricePerContainer || !containerCount) {
      alert('Veuillez définir le prix par container et le nombre de containers');
      return;
    }

    const totalAmount = pricePerContainer * containerCount;

    // Supprimer l'ancienne ligne globale si elle existe
    const otherRevenues = revenues.filter((r) => r.category !== 'Vente Export Global');

    const globalRevenue = {
      id: uuidv4(),
      description: `Export Global (${containerCount} Containers ${containerType} à ${formatCurrency(pricePerContainer)})`,
      amount: totalAmount,
      date: new Date(),
      account: '',
      isPaid: false,
      category: 'Vente Export Global',
      isRecurring: false,
    };

    setRevenues([...otherRevenues, globalRevenue]);

    // Ajouter les lignes de commissions si elles n'existent pas
    setExpenses((prevExpenses) => {
      const newExpenses = [...prevExpenses];

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
            isRecurring: false,
          });
        }
      };

      addIfNotExists('Commission intermédiaire proprio', commissionRateProprio);
      addIfNotExists('Commission intermédiaire @RANDOU', commissionRateRandou);

      return newExpenses;
    });

    alert(`✅ Ligne de revenu global générée : ${formatCurrency(totalAmount)}`);
  };

  // ===== CATÉGORIES =====
  const expenseCategories = [
    { value: 'Droits Bancaires', label: '🏦 Bancaire' },
    { value: 'Frais Déplacement', label: '🚗 Déplacement' },
    { value: 'Administratif', label: '📄 Administratif' },
    { value: 'Commissions', label: '💼 Commissions' },
    { value: 'Douanes', label: '🛃 Douanes' },
    { value: 'Conteneurs', label: '📦 Location Cont.' },
    { value: 'Certification', label: '✅ Certifications' },
    { value: 'Transport', label: '🚚 Transport' },
    { value: 'Assurance', label: '🛡️ Assurance' },
    { value: 'Autre', label: '📦 Autre' },
  ];

  const revenueCategories = [
    { value: 'Vente Export Global', label: '🌍 Export Global' },
    { value: 'Vente Partielle', label: '💰 Vente Partielle' },
    { value: 'Autre', label: '💵 Autre' },
  ];

  // ===== GESTION DES LIGNES =====
  const addExpense = () => {
    setExpenses([
      ...expenses,
      {
        id: uuidv4(),
        description: '',
        amount: 0,
        category: 'Administratif',
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
        category: 'Vente Partielle',
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

  // ===== PAYER DÉPENSE (VERSION CORRIGÉE SANS getOrCreateDbLineId) =====
const handlePayerDepense = async (expense) => {
  // 🛡️ CHECK 1: Au début
  if (!isMountedRef.current) return;
  
  if (expense.isPaid === true) {
    alert('⚠️ Cette dépense est déjà payée');
    return;
  }

  if (isProcessingPayment) return;

  setIsProcessingPayment(true);

  try {
    if (!expense.account) {
      alert('❌ Veuillez choisir un compte');
      if (isMountedRef.current) setIsProcessingPayment(false);
      return;
    }

    const accountObj = accounts.find(a => a.name === expense.account);
    if (!accountObj) {
      alert('❌ Compte introuvable');
      if (isMountedRef.current) setIsProcessingPayment(false);
      return;
    }

    // Trouver ou créer dbLineId
    let dbLineId = expense.dbLineId;

    if (!dbLineId) {
      console.log('🔍 Recherche dbLineId pour', {
        description: expense.description,
        amount: expense.amount
      });

      const freshProject = await projectsService.getById(project.id);

      // 🛡️ CHECK 2: Après appel async
      if (!isMountedRef.current) {
        setIsProcessingPayment(false);
        return;
      }

      let expenseLines = freshProject?.expenseLines || freshProject?.expense_lines || [];

      if (typeof expenseLines === 'string') {
        try {
          expenseLines = JSON.parse(expenseLines);
        } catch (e) {
          expenseLines = [];
        }
      }

      if (!Array.isArray(expenseLines) || expenseLines.length === 0) {
        console.error('❌ Aucune ligne expense trouvée');
        alert('Impossible de trouver les lignes de dépenses.');
        if (isMountedRef.current) setIsProcessingPayment(false);
        return;
      }

      const expenseAmount = parseFloat(expense.amount || 0);
      const expenseLine = expenseLines.find(line => {
        const lineDesc = (line.description || '').trim().toLowerCase();
        const expDesc = (expense.description || '').trim().toLowerCase();
        
        if (lineDesc !== expDesc) return false;
        
        const lineAmount = parseFloat(
          line.projected_amount || line.projectedamount || line.amount || 0
        );
        
        return Math.abs(lineAmount - expenseAmount) < 0.01;
      });

      if (!expenseLine) {
        const createConfirm = confirm(
          `La ligne "${expense.description}" n'existe pas.\n\nCréer maintenant ?\n${formatCurrency(expense.amount)}`
        );
        
        if (!createConfirm) {
          if (isMountedRef.current) setIsProcessingPayment(false);
          return;
        }

        // 🛡️ CHECK 3: Avant création
        if (!isMountedRef.current) {
          setIsProcessingPayment(false);
          return;
        }

        try {
          const newLine = await api.post(`/projects/${project.id}/expense-lines`, {
            description: expense.description,
            category: expense.category || 'Projet - Charge',
            projected_amount: parseFloat(expense.amount),
            actual_amount: 0,
            transaction_date: expense.date || new Date().toISOString(),
            is_paid: false,
          });

          dbLineId = newLine.id;
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (createError) {
          if (isMountedRef.current) {
            alert(`Impossible de créer la ligne:\n${createError.message}`);
            setIsProcessingPayment(false);
          }
          return;
        }
      } else {
        dbLineId = expenseLine.id;
      }
    }

    // DEMANDER À L'UTILISATEUR
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

    console.log('📤 Payload:', payload);

    await api.patch(`/projects/${project.id}/expense-lines/${dbLineId}/mark-paid`, payload);

    // 🛡️ CHECK 4: Après appel API
    if (!isMountedRef.current) return;

    // RECHARGER
    const freshProject = await projectsService.getById(project.id);

    // 🛡️ CHECK 5: Après rechargement
    if (!isMountedRef.current) return;

    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    };

    const freshExpenses = parseList(freshProject.expenses).map(e => ({
      ...e,
      id: e.id || uuidv4(),
      date: e.date ? new Date(e.date) : new Date(),
      amount: parseFloat(e.amount) || 0,
    }));

    setExpenses(freshExpenses);

    await refreshProjects();

    // 🛡️ CHECK 6: Avant callback
    if (!isMountedRef.current) return;

    if (onProjectUpdated) {
      await onProjectUpdated(project.id);
    }

    alert('✅ Dépense marquée comme payée !');

  } catch (err) {
    // 🛡️ CHECK 7: Avant erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur:', err);
    alert('❌ Erreur: ' + (err.message || 'Erreur inconnue'));

  } finally {
    // 🛡️ CHECK 8: Dans finally
    if (isMountedRef.current) {
      setIsProcessingPayment(false);
    }
  }
};

  // ===== ENCAISSER REVENU =====
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

    if (!project?.id) {
      alert('❌ Erreur : Projet introuvable.');
      return;
    }

    console.log('🔍 Recherche/création dbLineId pour revenu:', {
      description: rev.description,
      amount: rev.amount,
      id: rev.id
    });

    // Chercher ou créer le dbLineId
    let dbLineId = rev.dbLineId;

    if (!dbLineId) {
      console.log('revenueLines disponibles:', project.revenueLines);

      // Chercher dans revenueLines existantes
      const revenueAmount = parseFloat(rev.amount || 0);
      let revenueLine = project?.revenueLines?.find(line => {
        // Match par UUID
        if (line.id === rev.id || line.uuid === rev.id) {
          return true;
        }

        // Match par description + montant
        const lineDesc = (line.description || '').trim().toLowerCase();
        const revDesc = (rev.description || '').trim().toLowerCase();
        
        if (lineDesc !== revDesc) return false;
        
        const lineAmount = parseFloat(
          line.projected_amount || line.projectedamount || line.projectedAmount || 0
        );
        
        return Math.abs(lineAmount - revenueAmount) < 0.01;
      });

      // Si pas trouvée, créer la ligne en base
      if (!revenueLine) {
        console.log('📝 Ligne revenu introuvable, création en cours...');
        
        const createConfirm = confirm(
          `La ligne "${rev.description}" n'existe pas encore en base.\n\n` +
          `Voulez-vous la créer maintenant ?\n\n` +
          `Montant: ${formatCurrency(rev.amount)}\n` +
          `Catégorie: ${rev.category || 'Non catégorisé'}`
        );
        
        if (!createConfirm) {
          console.log('❌ Création annulée par l\'utilisateur');
          return;
        }

        // 🛡️ CHECK 2: Avant création
        if (!isMountedRef.current) return;

        try {
          // Créer la ligne via API
          const newLine = await api.post(`/projects/${project.id}/revenue-lines`, {
            description: rev.description,
            category: rev.category || 'Non catégorisé',
            projected_amount: parseFloat(rev.amount),
            actual_amount: 0,
            transaction_date: rev.date || new Date().toISOString(),
            is_received: false,
          });

          revenueLine = newLine;
          console.log('✅ Ligne revenu créée:', newLine);

          // Attendre que la transaction SQL soit commité
          console.log('⏳ Attente sécurité COMMIT (500ms)...');
          await new Promise(resolve => setTimeout(resolve, 500));

          // 🛡️ CHECK 3: Après création et délai
          if (!isMountedRef.current) return;

          // Vérifier que la ligne existe vraiment avec retry
          let lineExists = false;
          let retries = 0;
          const maxRetries = 5;

          while (!lineExists && retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 300));

            try {
              const freshProject = await api.get(`/projects/${project.id}`);
              const lineFound = freshProject.revenueLines?.some(
                line => String(line.id) === String(newLine.id)
              );

              if (lineFound) {
                lineExists = true;
                console.log(`✅ Ligne revenu #${newLine.id} vérifiée après ${retries + 1} tentative(s)`);
              } else {
                throw new Error('Ligne revenue pas encore dans le projet');
              }
            } catch (verifyError) {
              retries++;
              if (retries >= maxRetries) {
                console.error(`❌ Ligne revenu #${newLine.id} toujours introuvable après ${maxRetries} tentatives`);
                throw new Error('La ligne de revenu créée n\'est pas accessible. Ressayez dans quelques secondes.');
              }
              console.log(`⏳ Ligne revenu #${newLine.id} pas encore visible, retry ${retries}/${maxRetries}...`);
            }
          }

          // 🛡️ CHECK 4: Après vérification
          if (!isMountedRef.current) return;

          // Maintenant qu'on est sûr que la ligne existe, on peut recharger
          if (onProjectUpdated) {
            console.log('🔄 Rechargement du projet après vérification ligne revenu...');
            await onProjectUpdated(project.id);
          }

        } catch (createError) {
          if (!isMountedRef.current) return;
          
          console.error('❌ Erreur création ligne revenu:', createError);
          alert(`Impossible de créer la ligne en base:\n${createError.message}`);
          return;
        }
      }

      dbLineId = revenueLine.id;
      console.log('✅ dbLineId revenu:', dbLineId);
    } else {
      console.log('✅ dbLineId revenu déjà stocké:', dbLineId);
    }

    // Demander confirmation d'encaissement (LOGIQUE INVERSE)
    const createTransaction = window.confirm(
      `💰 ENCAISSEMENT: ${formatCurrency(rev.amount)}\n` +
      `Compte: ${rev.account}\n\n` +
      `Voulez-vous CRÉER UNE TRANSACTION et créditer le compte ?\n\n` +
      `Cliquez OK pour ENCAISSER MAINTENANT (le compte SERA crédité de ${formatCurrency(rev.amount)})\n` +
      `Cliquez ANNULER si l'encaissement EST DÉJÀ FAIT (le compte ne sera PAS crédité)`
    );

    const payload = createTransaction
      ? {
          // OK → Créer transaction
          create_transaction: true,
          amount: parseFloat(rev.amount),
          received_date: rev.realDate 
            ? new Date(rev.realDate).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
          account_id: accountObj.id,
        }
      : {
          // Annuler → Encaissement externe
          received_externally: true,
          amount: parseFloat(rev.amount),
          received_date: rev.realDate 
            ? new Date(rev.realDate).toISOString().split('T')[0] 
            : new Date().toISOString().split('T')[0],
          account_id: accountObj.id,
        };

    console.log('📤 Envoi requête mark-received:', {
      url: `/projects/${project.id}/revenue-lines/${dbLineId}/mark-received`,
      payload
    });

    const result = await api.patch(
      `/projects/${project.id}/revenue-lines/${dbLineId}/mark-received`,
      payload
    );

    console.log('✅ Réponse serveur:', result);

    // 🛡️ CHECK 5: Après appel API
    if (!isMountedRef.current) return;

    // Mettre à jour l'état local
    const updated = [...revenues];
    updated[index] = { ...updated[index], isPaid: true, dbLineId };
    setRevenues(updated);

    // Recalcul automatique
    console.log('🔄 Recalcul automatique des totaux...');
    try {
      await api.post(`/projects/${project.id}/recalculate`, {});
      console.log('✅ Totaux recalculés avec succès');
    } catch (recalcError) {
      console.warn('⚠️ Erreur recalcul auto (non bloquant):', recalcError.message);
    }

    // 🛡️ CHECK 6: Avant refresh
    if (!isMountedRef.current) return;

    // Rafraîchir les données
    console.log('🔄 Rafraîchissement après encaissement...');
    await refreshProjects();

    // 🛡️ CHECK 7: Avant callback
    if (!isMountedRef.current) return;

    if (onProjectUpdated) {
      await onProjectUpdated(project.id);
    }

    alert(result.message || '✅ Revenu marqué comme reçu !');

  } catch (error) {
    // 🛡️ CHECK 8: Avant erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur handleEncaisser:', error);
    alert(error?.message || 'Erreur encaissement');
  }
};

  // ===== ANNULER PAIEMENT DÉPENSE/REVENUE =====
const handleCancelPaymentExpense = async (exp, index) => {
  // 🛡️ CHECK 1: Au début
  if (!isMountedRef.current) return;
  
  try {
    if (!project?.id) {
      alert('❌ Projet non enregistré');
      return;
    }

    if (!window.confirm(`🔄 Annuler le paiement de ${formatCurrency(exp.amount)} ?`)) {
      return;
    }

    let dbLineId = exp.dbLineId;

    if (!dbLineId) {
      console.error('❌ Impossible d\'annuler: dbLineId manquant');
      alert('Erreur: ID de ligne introuvable');
      return;
    }

    const result = await api.patch(
      `/projects/${project.id}/expense-lines/${dbLineId}/cancel-payment`,
      {}
    );

    // 🛡️ CHECK 2: Après appel API
    if (!isMountedRef.current) return;

    // RECHARGER LE PROJET COMPLET
    const freshProject = await projectsService.getById(project.id);

    // 🛡️ CHECK 3: Après rechargement
    if (!isMountedRef.current) return;

    // RECHARGER LES EXPENSES DEPUIS LE JSON DU PROJET
    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    };

    const freshExpenses = parseList(freshProject.expenses).map(e => ({
      ...e,
      id: e.id || uuidv4(),
      date: e.date ? new Date(e.date) : new Date(),
      amount: parseFloat(e.amount) || 0,
    }));

    setExpenses(freshExpenses); // Remplacer complètement

    // Mettre à jour aussi
    project.expenseLines = freshProject.expenseLines;

    // Recalcul automatique
    try {
      await api.post(`/projects/${project.id}/recalculate`, {});
    } catch (recalcError) {
      console.warn('⚠️ Erreur recalcul:', recalcError.message);
    }

    // 🛡️ CHECK 4: Avant refresh
    if (!isMountedRef.current) return;

    // Rafraîchir globalement
    await refreshProjects();

    // 🛡️ CHECK 5: Avant callback
    if (!isMountedRef.current) return;

    if (onProjectUpdated) {
      await onProjectUpdated(project.id);
    }

    alert(result.message || '✅ Paiement annulé avec succès!');

  } catch (err) {
    // 🛡️ CHECK 6: Avant erreur
    if (!isMountedRef.current) return;
    
    console.error('❌ Erreur handleCancelPaymentExpense:', err);
    alert('Erreur annulation: ' + (err.message || err));
  }
};

const handleCancelPaymentRevenue = async (rev, index) => {
  // 🛡️ CHECK 1: Au début
  if (!isMountedRef.current) {
    console.log('⚠️ handleCancelPaymentRevenue: Composant démonté');
    return;
  }
  
  try {
    if (!project?.id) {
      alert('❌ Projet non enregistré');
      return;
    }

    if (!window.confirm(`🔄 Annuler l'encaissement de ${formatCurrency(rev.amount)} ?`)) {
      return;
    }

    let dbLineId = rev.dbLineId;

    if (!dbLineId) {
      console.log('🔍 Recherche dbLineId pour revenu:', {
        description: rev.description,
        amount: rev.amount,
      });

      // Recharger le projet
      const freshProject = await projectsService.getById(project.id);

      // 🛡️ CHECK 2: Après rechargement du projet
      if (!isMountedRef.current) {
        console.log('⚠️ Composant démonté après getById');
        return;
      }

      let revenueLines =
        freshProject?.revenueLines || freshProject?.revenue_lines || [];
      
      if (typeof revenueLines === 'string') {
        try {
          revenueLines = JSON.parse(revenueLines);
        } catch (e) {
          revenueLines = [];
        }
      }

      if (!Array.isArray(revenueLines) || revenueLines.length === 0) {
        console.error('❌ Aucune ligne revenue trouvée');
        alert('Impossible de trouver les lignes de revenus.');
        
        if (isMountedRef.current) {
          await refreshProjects();
        }
        return;
      }

      const revenueAmount = parseFloat(rev.amount) || 0;

      const revenueLine = revenueLines.find((line) => {
        // Match par UUID
        if (line.uuid && rev.id && line.uuid === rev.id) return true;

        // Match par ID
        if (line.id && rev.dbLineId && line.id === rev.dbLineId) return true;

        // Match par description + montant
        const lineDesc = (line.description || '').trim().toLowerCase();
        const revDesc = (rev.description || '').trim().toLowerCase();
        if (lineDesc !== revDesc) return false;

        const lineAmount = parseFloat(
          line.projected_amount ||
            line.projectedamount ||
            line.projectedAmount ||
            line.amount ||
            0
        );

        const isReceivedMatch = line.is_received === true || line.isReceived === true;

        return Math.abs(lineAmount - revenueAmount) < 0.01 && isReceivedMatch;
      });

      if (!revenueLine) {
        console.error('❌ Ligne revenue DB introuvable pour annulation');
        alert(
          `Impossible de trouver la ligne de revenu en base.\n\n` +
            `Description: ${rev.description}\n` +
            `Montant: ${formatCurrency(rev.amount)}`
        );
        return;
      }

      dbLineId = revenueLine.id;
      console.log('✅ dbLineId trouvé:', dbLineId);
    }

    const result = await api.patch(
      `/projects/${project.id}/revenue-lines/${dbLineId}/cancel-receipt`,
      {}
    );

    // 🛡️ CHECK 3: Après appel API
    if (!isMountedRef.current) {
      console.log('⚠️ Composant démonté après cancel-receipt');
      return;
    }

    // RECHARGER LE PROJET COMPLET
    const freshProject = await projectsService.getById(project.id);
    
    // 🛡️ CHECK 4: Après second rechargement
    if (!isMountedRef.current) {
      console.log('⚠️ Composant démonté après rechargement');
      return;
    }
    
    const parseList = (data) => {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      try { 
        return JSON.parse(data); 
      } catch { 
        return []; 
      }
    };
    
    const freshRevenues = parseList(freshProject.revenues).map(r => ({
      ...r,
      id: r.id || uuidv4(),
      date: r.date ? new Date(r.date) : new Date(),
      amount: parseFloat(r.amount) || 0,
    }));
    
    setRevenues(freshRevenues);  // Remplacer complètement
    project.revenueLines = freshProject.revenueLines;

    // Recalcul et rafraîchissement
    try {
      await api.post(`/projects/${project.id}/recalculate`, {});
    } catch (recalcError) {
      console.warn('⚠️ Erreur recalcul:', recalcError.message);
    }

    // 🛡️ CHECK 5: Avant refresh
    if (!isMountedRef.current) {
      console.log('⚠️ Composant démonté avant refresh');
      return;
    }

    await refreshProjects();

    // 🛡️ CHECK 6: Avant callback
    if (!isMountedRef.current) {
      console.log('⚠️ Composant démonté avant callback');
      return;
    }

    if (onProjectUpdated) {
      await onProjectUpdated(project.id);
    }

    alert(result.message || '✅ Encaissement annulé avec succès!');

  } catch (err) {
    // 🛡️ CHECK 7: Avant erreur
    if (!isMountedRef.current) {
      console.log('⚠️ Composant démonté lors de l\'erreur');
      return;
    }
    
    console.error('❌ Erreur handleCancelPaymentRevenue:', err);
    alert(err?.message || 'Erreur annulation encaissement');
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

  const theoreticalRevenue = pricePerContainer * containerCount;


// ✅ SAUVEGARDE FINALE CORRIGÉE - AVEC isMountedRef
const handleSave = async () => {
  // 🛡️ CHECK 1: Au début
  if (!isMountedRef.current) {
    console.log('⚠️ handleSave: Composant démonté');
    return;
  }
  
  if (!projectName.trim()) {
    alert('Le nom du projet est obligatoire');
    return;
  }

  setLoading(true);

  // ✅ Utiliser les fonctions dateUtils au lieu de .toISOString()
  const expensesWithDate = expenses.map((exp) => {
    const { isPaid, actualAmount, transactionDate, realDate, ...cleanExp } = exp;
    
    return {
      ...cleanExp,
      dbLineId: exp.dbLineId || null,
      plannedDate: toLocalISODate(exp.date),
      transaction_date: toLocalISOString(exp.date),
    };
  });

  const revenuesWithDate = revenues.map((rev) => {
    const { isPaid, isReceived, actualAmount, transactionDate, ...cleanRev } = rev;
    
    return {
      ...cleanRev,
      dbLineId: rev.dbLineId || null,
      plannedDate: toLocalISODate(rev.date),
      transaction_date: toLocalISOString(rev.date),
    };
  });

  try {
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      type: 'EXPORT',
      status,
      // ✅ CORRECTION: Utiliser toLocalISOString pour les dates du projet aussi
      startDate: toLocalISOString(startDate),
      endDate: endDate ? toLocalISOString(endDate) : null,
      totalCost: parseFloat(totalExpenses) || 0,
      totalRevenues: parseFloat(totalRevenues) || 0,
      netProfit: parseFloat(netProfit) || 0,
      roi: parseFloat(roi) || 0,
      expenses: JSON.stringify(expensesWithDate),
      revenues: JSON.stringify(revenuesWithDate),
      metadata: JSON.stringify({
        pricePerContainer,
        containerCount,
        commissionRateProprio,
        commissionRateRandou,
        productType,
        destination,
        containerType,
      }),
    };

    if (project?.id) {
  await projectsService.update(project.id, payload);  // ✅ CORRECT
} else {
  await projectsService.create(payload);  // ✅ CORRECT
}

    // 🛡️ CHECK 2: Après sauvegarde (async)
    if (!isMountedRef.current) {
      console.log('⚠️ handleSave: Composant démonté après sauvegarde');
      setLoading(false);
      return;
    }

    if (onProjectSaved) {
      onProjectSaved();
    }
    
    onClose();

  } catch (e) {
    // 🛡️ CHECK 3: Avant traitement d'erreur
    if (!isMountedRef.current) {
      console.log('⚠️ handleSave: Composant démonté lors de l\'erreur');
      return;
    }
    
    console.error('❌ Erreur sauvegarde:', e);
    alert('Erreur sauvegarde: ' + e.message);

  } finally {
    // 🛡️ CHECK 4: Dans finally
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
                <label className="block text-sm font-medium mb-1">
                  Prix par Container (USD)
                </label>
                <CalculatorInput
                  value={pricePerContainer}
                  onChange={setPricePerContainer}
                  placeholder="5000000"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre de Containers
                </label>
                <CalculatorInput
                  value={containerCount}
                  onChange={setContainerCount}
                  placeholder="3"
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Commission Proprio (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={commissionRateProprio * 100}
                  onChange={(e) =>
                    setCommissionRateProprio(parseFloat(e.target.value) / 100)
                  }
                  className="w-full p-2 border rounded"
                  placeholder="20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Commission @RANDOU (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={commissionRateRandou * 100}
                  onChange={(e) =>
                    setCommissionRateRandou(parseFloat(e.target.value) / 100)
                  }
                  className="w-full p-2 border rounded"
                  placeholder="10"
                />
              </div>
            </div>

            {/* Aperçu calculs */}
            {theoreticalRevenue > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-green-300">
                <h4 className="font-semibold mb-3 text-green-800">
                  📊 Aperçu des calculs :
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Revenu Total Théorique</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(theoreticalRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      Commission Proprio ({(commissionRateProprio * 100).toFixed(1)}%)
                    </p>
                    <p className="text-xl font-bold text-orange-600">
                      {formatCurrency(theoreticalRevenue * commissionRateProprio)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">
                      Commission @RANDOU ({(commissionRateRandou * 100).toFixed(1)}%)
                    </p>
                    <p className="text-xl font-bold text-purple-600">
                      {formatCurrency(theoreticalRevenue * commissionRateRandou)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Revenu Net Estimé</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(
                        theoreticalRevenue *
                          (1 - commissionRateProprio - commissionRateRandou)
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============================================ */}
{/* SECTION 4: CHARGES */}
{/* ============================================ */}
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
      // ✅ CALCUL DE isPaid EN PRIORITÉ DEPUIS LA DB
      const expenseLine = project?.expenseLines?.find(
        (line) => String(line.id) === String(exp.dbLineId)
      );
      const isPaid = !!(
  expenseLine?.is_paid ||  // ✅ Vrai nom retourné par l'API
  expenseLine?.ispaid ||   // Fallback au cas où
  exp.ispaid ||           // Depuis le JSON
  exp.isPaid              // Depuis le JSON camelCase
);

      return (
        <div
          key={exp.id}
          className={`bg-white p-3 rounded-lg border-2 grid grid-cols-14 gap-2 items-center ${
            isPaid ? 'border-green-300 bg-green-50' : 'border-gray-200'
          }`}
        >
          {/* Description */}
          <input
            type="text"
            value={exp.description}
            onChange={(e) => updateExpense(exp.id, 'description', e.target.value)}
            className="col-span-3 p-2 border rounded text-sm"
            placeholder="Description"
          />

          {/* Catégorie */}
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

          {/* Montant */}
          <CalculatorInput
            value={exp.amount}
            onChange={(val) => updateExpense(exp.id, 'amount', val)}
            className="col-span-2 p-2 border rounded text-sm font-semibold"
          />

          {/* Date planifiée */}
          <DatePicker
            selected={exp.date}
            onChange={(date) => updateExpense(exp.id, 'date', date)}
            dateFormat="dd/MM/yy"
            className="col-span-2 p-2 border rounded text-sm"
          />

          {/* Date réelle */}
          <DatePicker
            selected={exp.realDate || null}
            onChange={(date) => updateExpense(exp.id, 'realDate', date)}
            dateFormat="dd/MM/yy"
            placeholderText="Date réelle"
            className="col-span-2 p-2 border rounded text-sm"
          />

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

          {/* BOUTONS PAYER / ANNULER */}
{!isPaid ? (
  <button
    onClick={() => handlePayerDepense(exp)}
    disabled={!exp.account || !project?.id || isProcessingPayment}
    className="col-span-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700"
    title="Payer"
  >
    Payer
  </button>
) : (
  <button
    onClick={() => handleCancelPaymentExpense(exp, idx)}
    className="col-span-1 bg-orange-500 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-orange-600"
    title="Annuler le paiement"
  >
    Annuler
  </button>
)}

          {/* Bouton Supprimer */}
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
        Aucune charge. Cliquez sur "Ajouter Charge" pour commencer.
      </p>
    )}
  </div>

  {/* Total */}
  <div className="mt-3 text-right">
    <span className="text-sm text-gray-600">Total Charges: </span>
    <span className="font-bold text-red-600 text-xl">
      {formatCurrency(totalExpenses)}
    </span>
  </div>
</div>

{/* SECTION 5 - REVENUS */}
<div className="bg-green-50 p-4 rounded-lg">
  <div className="flex justify-between items-center mb-4">
    <h3 className="font-bold text-lg flex items-center gap-2">
      <TrendingUp className="w-5 h-5 text-green-600" />
      Revenus ({revenues.length})
    </h3>
    <button onClick={addRevenue} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
      <Plus className="w-4 h-4" />
      Ajouter Revenu
    </button>
  </div>

  <div className="space-y-2 max-h-96 overflow-y-auto">
    {revenues.map((rev, idx) => {
      const revenueLine = project?.revenueLines?.find(line => String(line.id) === String(rev.dbLineId));
      const isPaid = !!(
  revenueLine?.is_received ||  // ✅ Vrai nom retourné par l'API
  revenueLine?.isreceived ||   // Fallback
  rev.isreceived ||           // Depuis le JSON
  rev.isReceived              // Depuis le JSON camelCase
);

      return (
        <div key={rev.id} className={`bg-white p-3 rounded-lg border-2 grid grid-cols-14 gap-2 items-center ${isPaid ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
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
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.name}>{acc.name}</option>
            ))}
          </select>

          {!isPaid ? (
            <button
              onClick={() => handleEncaisser(rev, idx)}
              disabled={!rev.account || !project?.id}
              className="col-span-1 bg-blue-600 text-white p-2 rounded text-xs"
              title="Encaisser"
            >
              Encaisser
            </button>
          ) : (
            <button
              onClick={() => handleCancelPaymentRevenue(rev, idx)}
              className="col-span-1 bg-orange-500 text-white p-2 rounded text-xs"
              title="Annuler"
            >
              Annuler
            </button>
          )}

          <button
            onClick={() => removeRevenue(rev.id)}
            className="col-span-1 text-red-600 hover:bg-red-100 p-2 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      );
    })}

    {revenues.length === 0 && (
      <p className="text-center text-gray-500 py-8">
        Aucun revenu. Cliquez sur "Ajouter Revenu" ou "Générer Ligne Globale".
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
                <p
                  className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}
                >
                  {formatCurrency(netProfit)}
                </p>
              </div>
              <div>
                <p className="text-purple-100 text-sm">ROI</p>
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
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
