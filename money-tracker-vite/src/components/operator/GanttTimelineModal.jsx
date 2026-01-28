import  { useState, useMemo, useCallback, memo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  Download,
  Edit2,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Package,
  TrendingUp,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  differenceInDays,
  parseISO,
  isSameDay,
  addDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import TreasuryTimeline from '../TreasuryTimeline';
import { useFinance } from '../../contexts/FinanceContext';

// ✅ OPTIMISATION #1 : Déplacer les fonctions pures HORS du composant
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount || 0) + ' Ar';
};

// ✅ Parser les dépenses (fonction pure)
const parseProjectExpenses = (project) => {
  if (!project.expenses) return [];
  try {
    return typeof project.expenses === 'string' 
      ? JSON.parse(project.expenses) 
      : project.expenses;
  } catch (e) {
    return [];
  }
};

// ✅ Calculer les métriques d'un projet (fonction pure)
const calculateProjectMetrics = (project) => {
  const expenses = parseProjectExpenses(project);
  
  // Montant payé
  const paid = Array.isArray(expenses)
    ? expenses
        .filter(exp => exp.isPaid === true || exp.is_paid === true || exp.ispaid === true)
        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)
    : 0;
  
  // Montant non payé (inverse de paid)
  const unpaid = Array.isArray(expenses)
    ? expenses
        .filter(exp => !(exp.isPaid === true || exp.is_paid === true || exp.ispaid === true))
        .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)
    : parseFloat(project.totalcost || 0);
  
  // Profit = Revenus - Coûts totaux
  const profit = parseFloat(project.totalamount || 0) - parseFloat(project.totalcost || 0);
  return { paid, unpaid, profit };
};


// ✅ OPTIMISATION #5.1 : Sous-composant mémoïsé pour les badges de statut
const StatusBadge = memo(({ status }) => {
  const statusConfig = {
    active: { label: 'Actif', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
    completed: { label: 'Terminé', color: 'bg-green-100 text-green-700 border-green-300' },
    inprogress: { label: 'En cours', color: 'bg-blue-100 text-blue-700 border-blue-300' },
    paused: { label: 'En pause', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    cancelled: { label: 'Annulé', color: 'bg-red-100 text-red-700 border-red-300' },
  };
  
  const config = statusConfig[status] || { 
    label: status || 'Inconnu', 
    color: 'bg-purple-100 text-purple-700 border-purple-300' 
  };
  
  return (
    <span className={`px-2 py-1 rounded border ${config.color} font-medium`}>
      {config.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ✅ OPTIMISATION #5.2 : Sous-composant mémoïsé pour les cartes de statistiques
const StatCard = memo(({ icon: Icon, label, value, colorClass, bgClass }) => (
  <div className={`${bgClass} rounded-lg p-3 border-2 ${colorClass}`}>
    <div className="flex items-center gap-2 mb-1">
      <Icon size={16} className="text-white" strokeWidth={2.5} />
      <p className="text-xs font-bold text-white uppercase tracking-wider">{label}</p>
    </div>
    <p className="text-lg font-black text-white">{value}</p>
  </div>
));
StatCard.displayName = 'StatCard';

// ✅ OPTIMISATION #8.1 : Header de timeline mémoïsé
const TimelineHeader = memo(({ timelineDays, today }) => {
  return (
    <div className="sticky top-0 bg-white z-10 border-b border-gray-300" style={{ height: '60px' }}>
      <div className="flex items-center h-full">
        {timelineDays.map((day, index) => {
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isToday = isSameDay(day, today);
          const isFirstOfMonth = day.getDate() === 1;
          
          return (
            <div
              key={index}
              className={`flex-shrink-0 w-[40px] text-center p-2 border-r border-gray-200 text-xs ${
                isWeekend ? 'bg-gray-50' : 'bg-white'
              } ${isToday ? 'bg-blue-50 font-bold' : ''} ${
                isFirstOfMonth ? 'border-l-2 border-l-blue-400' : ''
              }`}
            >
              <div className={isToday ? 'text-blue-600' : 'text-gray-600'}>
                {format(day, 'd')}
              </div>
              {isFirstOfMonth && (
                <div className="text-[10px] text-blue-600 font-semibold">
                  {format(day, 'MMM', { locale: fr })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
TimelineHeader.displayName = 'TimelineHeader';

// ✅ OPTIMISATION #8.2 : Ligne de projet mémoïsée
const ProjectRow = memo(({ 
  project, 
  projectIndex, 
  isDelayed, 
  metrics, 
  onEdit 
}) => {
  return (
    <div
      className={`border-b border-gray-200 p-4 hover:bg-gray-100 transition-colors ${
        projectIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      }`}
      style={{ height: '175px' }}
    >
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 min-w-0">
          {/* Nom du projet */}
          <h3 className="font-semibold text-gray-800 text-sm mb-1 truncate" title={project.name}>
            {project.name}
          </h3>
          
          {/* Client */}
          <p className="text-xs text-gray-500 mb-2 truncate" title={project.clientname}>
            {project.clientname}
          </p>
          
          {/* Badges de statut */}
          <div className="flex items-center gap-2 text-xs flex-wrap mb-2">
            <StatusBadge status={project.status} />
            
            {/* Badge de retard */}
            {isDelayed && (
              <span className="px-2 py-1 rounded border bg-red-100 text-red-700 border-red-300 font-medium animate-pulse">
                Retard
              </span>
            )}
          </div>
          
          {/* Informations financières */}
          <div className="mt-2 text-xs text-gray-600 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Progression</span>
              <span className="font-semibold">{project.progress}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Revenus</span>
              <span className="font-semibold text-green-600">{formatCurrency(project.totalamount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Coûts</span>
              <span className="font-semibold text-red-600">{formatCurrency(project.totalcost)}</span>
            </div>
            <div className="flex justify-between pt-0.5 border-t border-gray-200 mt-1">
              <span className="text-gray-500 font-medium">Profit</span>
              <span className={`font-bold ${metrics.profit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                {formatCurrency(metrics.profit)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Bouton d'édition */}
        <button
          onClick={onEdit}
          className="text-blue-500 hover:text-blue-700 ml-2 flex-shrink-0"
          title="Éditer le projet"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
});
ProjectRow.displayName = 'ProjectRow';

// ✅ OPTIMISATION #9 : Ligne de timeline mémoïsée
const ProjectTimelineRow = memo(({ 
  project, 
  projectIndex, 
  timelineDays, 
  position, 
  progressOpacity, 
  metrics,
  today,
  onDragStart,
  onDragOver,
  onDrop 
}) => {
  return (
    <div
      className={`flex border-b border-gray-200 relative ${
        projectIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
      }`}
      style={{ height: '175px' }}
    >
      
      {/* Grid Lines */}
      <div className="absolute inset-0 flex pointer-events-none">
        {timelineDays.map((day, index) => {
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          const isToday = isSameDay(day, today);

          return (
            <div
              key={index}
              className={`flex-shrink-0 w-[40px] border-r border-gray-200 ${
                isWeekend ? 'bg-gray-50' : ''
              } ${isToday ? 'bg-blue-50' : ''}`}
            />
          );
        })}
      </div>

      {/* Drag & Drop Grid */}
      <div className="absolute inset-0 flex">
        {timelineDays.map((day, index) => (
          <div
            key={index}
            className="flex-shrink-0 w-[40px]"
            onDragOver={(e) => onDragOver(e, day)}
            onDrop={(e) => onDrop(e, day)}
          />
        ))}
      </div>

      {/* Project Bar */}
      {position && (
        <div
          className="absolute top-1/2 -translate-y-1/2 h-12 cursor-move group z-10"
          style={{ left: `${position.left}%`, width: `${position.width}%` }}
          draggable
          onDragStart={() => onDragStart(project)}
        >
          <div
            className={`h-full ${progressOpacity} rounded shadow-md flex items-center justify-between px-3 text-white text-xs font-semibold group-hover:shadow-lg transition-all relative`}
            style={{ backgroundColor: project.color || '#3B82F6' }}
          >
            <span className="truncate">{project.name}</span>
            <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded">
              {project.progress || 0}%
            </span>

            {/* Indicateurs de flux */}
            <div className="absolute top-0 right-0 flex gap-1">
              {project.expectedrevenue > 0 && (
                <div
                  className="bg-green-500 text-white text-xs px-1 rounded"
                  title="Revenus prévus"
                >
                  {(project.expectedrevenue / 1000000).toFixed(1)}M
                </div>
              )}
              {project.estimatedcost > 0 && (
                <div
                  className="bg-red-500 text-white text-xs px-1 rounded"
                  title="Coûts prévus"
                >
                  {(project.estimatedcost / 1000000).toFixed(1)}M
                </div>
              )}
            </div>
          </div>

          {/* Progress Fill */}
          <div
            className="absolute top-0 left-0 h-full bg-white bg-opacity-30 rounded-l"
            style={{ width: `${project.progress || 0}%` }}
          />

          {/* Tooltip */}
          <div
            className={`absolute ${
              projectIndex === 0 || projectIndex === 1
                ? 'top-full mt-2'
                : 'bottom-full mb-2'
            } left-0 hidden group-hover:block bg-gray-800 text-white p-3 rounded shadow-xl text-xs w-64 z-50 pointer-events-none`}
          >
            <div className="font-semibold mb-2">{project.name}</div>
            <div className="space-y-1">
              <div>Client: {project.clientname}</div>
              <div>
                Début:{' '}
                {project.startdate
                  ? format(parseISO(project.startdate), 'dd/MM/yyyy')
                  : 'N/A'}
              </div>
              <div>
                Fin:{' '}
                {project.enddate
                  ? format(parseISO(project.enddate), 'dd/MM/yyyy')
                  : 'N/A'}
              </div>
              <div>Progression: {project.progress || 0}%</div>
              <div>Revenus: {formatCurrency(project.totalamount)}</div>
              <div>Coûts: {formatCurrency(project.totalcost)}</div>

              <div className="pt-1 border-t border-gray-600">
                <div>Payé: {formatCurrency(metrics.paid)}</div>
              </div>
              <div>Reste à payer: {formatCurrency(metrics.unpaid)}</div>

              <div className="font-semibold pt-1 border-t border-gray-600">
                Profit: {formatCurrency(metrics.profit)}
              </div>
              
              {project.productname && project.productname !== 'N/A' && (
                <div className="pt-1 border-t border-gray-600">
                  Produit: {project.productname}
                </div>
              )}
            </div>

            {/* Flèche indicatrice */}
            <div
              className={`absolute ${
                projectIndex === 0 || projectIndex === 1
                  ? 'bottom-full'
                  : 'top-full'
              } left-4 w-0 h-0 border-l-4 border-r-4 border-transparent ${
                projectIndex === 0 || projectIndex === 1
                  ? 'border-b-4 border-b-gray-800'
                  : 'border-t-4 border-t-gray-800'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
});
ProjectTimelineRow.displayName = 'ProjectTimelineRow';

const GanttTimelineModal = ({
  isOpen,
  onClose,
  projects,
  onUpdateProject,
  onRefresh,
}) => {

// ✅ OPTIMISATION #4 : Créer now/today UNE SEULE FOIS avec useMemo
  const now = useMemo(() => new Date(), []);
  const today = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now]);
  const [currentMonth, setCurrentMonth] = useState(() => {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const [viewMode, setViewMode] = useState('month');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [draggedProject, setDraggedProject] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const { accounts, transactions, plannedTransactions } = useFinance();
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

// Normaliser les données des projets
const normalizedProjects = useMemo(() => {
  console.log('🔍 Projets bruts reçus:', projects);
  
  // ✅ AJOUTER CE LOG AVANT LA BOUCLE
  console.log('🚀 DÉBUT NORMALISATION - Nombre de projets:', projects.length);

  return projects.map((p, index) => {
    // ✅ LOG 1 : Projet brut complet
    console.log(`\n📦 [${index + 1}/${projects.length}] Projet BRUT:`, p);
    
    // ✅ LOG 2 : Données de progression disponibles
    console.log(`📊 Données de progression pour "${p.name}":`, {
  'p.progress': p.progress,
  'p.metadata?.progress': p.metadata?.progress,
  'p.expenseprogresspct': p.expenseprogresspct,
  'p.expense_progress_pct': p.expense_progress_pct,
  'p.totalpaidexpenses': p.totalpaidexpenses,
  'p.total_paid_expenses': p.total_paid_expenses,
  'p.total_cost': p.total_cost,
  'p.expenses (type)': typeof p.expenses,
  'p.expenses (length)': Array.isArray(p.expenses) ? p.expenses.length : 'N/A',
});
    const name = p.name || 'Projet sans nom';
    const startdate = p.start_date || p.startDate || null;
    const enddate = p.end_date || p.endDate || null;
    const totalcost = parseFloat(p.total_cost || p.totalCost || 0);
    const totalamount = parseFloat(p.total_revenues || p.totalRevenues || p.totalAmount || 0);
    const status = p.status || 'draft';
    
// Calculer progression basée sur les dépenses
let progress = 0;

// Priorité 1 : Metadata.progress (SAUF si = 0 ou undefined)
const metadataProgress = p.metadata?.progress ? parseFloat(p.metadata.progress) : 0;
if (metadataProgress > 0) {
  progress = metadataProgress;
  console.log(`📊 [${name}] Source: metadata.progress → ${progress}%`);
}
// Priorité 2 : Calculer depuis les expenses JSONB
else if (p.expenses && totalcost > 0) {
  const expensesArray = parseProjectExpenses({ expenses: p.expenses });
  
  if (Array.isArray(expensesArray) && expensesArray.length > 0) {
    console.log(`🔍 [${name}] Analyse de ${expensesArray.length} dépenses...`);
    
    const paidAmount = expensesArray
      .filter(exp => exp.is_paid === true) // ✅ ATTENTION: "is_paid" avec underscore
      .reduce((sum, exp) => {
        const amount = parseFloat(exp.amount || 0);
        
        if (amount > 0) {
          console.log(`  💸 [${name}] "${exp.description}": ${amount.toLocaleString()} Ar (is_paid: ${exp.is_paid})`);
        }
        
        return sum + amount;
      }, 0);
    
    progress = (paidAmount / totalcost) * 100;
    console.log(`💰 [${name}] Calcul: ${paidAmount.toLocaleString()} / ${totalcost.toLocaleString()} = ${progress.toFixed(1)}%`);
  } else {
    console.log(`⚠️ [${name}] Aucune dépense trouvée dans expenses JSONB`);
  }
}
// Défaut : 0%
else {
  console.log(`⚠️ [${name}] Aucune source de progression (totalcost: ${totalcost})`);
}

// Arrondir et limiter entre 0 et 100
progress = Math.min(100, Math.max(0, Math.round(progress * 10) / 10));
console.log(`✅ [${name}] PROGRESSION FINALE: ${progress}%`);

    const color = p.color || p.metadata?.color || '#3B82F6';
    const clientname = p.client_name || p.metadata?.client_name || 'N/A';
    const productname = p.product_name || p.metadata?.product_name || 'N/A';
    const expectedrevenue = parseFloat(p.expected_revenue || p.metadata?.expected_revenue || 0);
    const estimatedcost = parseFloat(p.estimated_cost || p.metadata?.estimated_cost || 0);
    const expenses = p.expenses || [];

    return {
      ...p,
      name,
      startdate,
      enddate,
      totalcost,
      totalamount,
      status,
      progress,
      color,
      clientname,
      productname,
      expectedrevenue,
      estimatedcost,
      expenses,
    };
  });
}, [projects]);

console.log('📊 Total projets normalisés:', normalizedProjects.length);

  // 5️⃣ 🆕 Calculer les dates de timeline
  const timelineEnd = useMemo(() => {
    if (normalizedProjects.length === 0) return endOfMonth(addMonths(new Date(), 3));

    const dates = normalizedProjects
      .map((p) => new Date(p.enddate))
      .filter((d) => !isNaN(d.getTime()));

    if (dates.length === 0) return endOfMonth(addMonths(new Date(), 3));

    const latest = new Date(Math.max(...dates));
    return endOfMonth(addMonths(latest, 1));
  }, [normalizedProjects]);

  // Calculer les statistiques globales
  const statistics = useMemo(() => {
    const stats = {
      total: normalizedProjects.length,
      active: 0,
      completed: 0,
      delayed: 0,
      totalRevenue: 0,
      totalCost: 0,
      avgProgress: 0,
    };

    normalizedProjects.forEach((project) => {
      if (project.status === 'completed') stats.completed++;
      else if (project.status === 'active' || project.status === 'in_progress')
        stats.active++;

      if (
  project.enddate &&
  new Date(project.enddate) < today &&
  project.status !== 'completed'
) {
  stats.delayed++;
}

stats.totalRevenue += parseFloat(project.totalamount || 0);
stats.totalCost += parseFloat(project.totalcost || 0);
      stats.avgProgress += parseFloat(project.progress || 0);
    });

    stats.avgProgress =
      normalizedProjects.length > 0 ? stats.avgProgress / normalizedProjects.length : 0;
    stats.profit = stats.totalRevenue - stats.totalCost;
    stats.profitMargin =
      stats.totalRevenue > 0 ? (stats.profit / stats.totalRevenue) * 100 : 0;

    return stats;
  }, [normalizedProjects, today]);

  // Filtrer et rechercher les projets
  const filteredProjects = useMemo(() => {
    return normalizedProjects.filter((project) => {
      if (filterStatus !== 'all') {
        if (
          filterStatus === 'active' &&
          !['active', 'in_progress'].includes(project.status)
        )
          return false;
        if (filterStatus === 'delayed') {
  const isDelayed =
    project.enddate &&  
    new Date(project.enddate) < today &&
    project.status !== 'completed';
  if (!isDelayed) return false;
}
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          project.name?.toLowerCase().includes(search) ||
          project.clientname?.toLowerCase().includes(search) ||
          project.description?.toLowerCase().includes(search) ||
          project.productname?.toLowerCase().includes(search)
        );
      }

      return true;
    });
  }, [normalizedProjects, filterStatus, searchTerm]);

  // Générer les jours de la vue actuelle
  const timelineDays = useMemo(() => {
    let start, end;

    switch (viewMode) {
      case 'month':
        start = startOfMonth(currentMonth);
        end = endOfMonth(currentMonth);
        break;
      case 'quarter':
        start = startOfMonth(subMonths(currentMonth, 1));
        end = endOfMonth(addMonths(currentMonth, 1));
        break;
      case 'year':
        start = startOfMonth(subMonths(currentMonth, 5));
        end = endOfMonth(addMonths(currentMonth, 6));
        break;
      default:
        start = startOfMonth(currentMonth);
        end = endOfMonth(currentMonth);
    }

    return eachDayOfInterval({ start, end });
  }, [currentMonth, viewMode]);

  // Calculer la position et largeur d'un projet sur la timeline
  // ✅ OPTIMISATION #3 : useCallback pour fonction appelée dans boucle
const getProjectTimelinePosition = useCallback((project) => {
  if (!project.startdate || !project.enddate) {
    console.warn('Dates manquantes pour', project.name);
    return null;
  }

  try {
    const projectStart = parseISO(project.startdate);
    const projectEnd = parseISO(project.enddate);
    const timelineStart = timelineDays[0];
    const timelineEnd = timelineDays[timelineDays.length - 1];

    if (projectEnd < timelineStart || projectStart > timelineEnd) {
      return null;
    }

    const visibleStart = projectStart < timelineStart ? timelineStart : projectStart;
    const visibleEnd = projectEnd > timelineEnd ? timelineEnd : projectEnd;

    const startOffset = differenceInDays(visibleStart, timelineStart);
    const duration = differenceInDays(visibleEnd, visibleStart) + 1;

    const leftPercent = (startOffset / timelineDays.length) * 100;
    const widthPercent = (duration / timelineDays.length) * 100;

    return { left: leftPercent, width: widthPercent };
  } catch (error) {
    console.error('Erreur calcul position:', error, project);
    return null;
  }
}, [timelineDays]); // ⚠️ IMPORTANT : Dépend de timelineDays

  // Déterminer l'opacité selon la progression
  // ✅ OPTIMISATION #3 : useCallback pour fonction pure
const getProgressOpacity = useCallback((progress) => {
  const p = parseFloat(progress || 0);
  if (p === 0) return 'opacity-30';
  if (p <= 25) return 'opacity-40';
  if (p <= 50) return 'opacity-60';
  if (p <= 75) return 'opacity-80';
  return 'opacity-100';
}, []); // ✅ Aucune dépendance (fonction pure)

  // Navigation dans le temps
  // ✅ OPTIMISATION #2 : useCallback pour éviter recréation
const handlePrevious = useCallback(() => {
  setCurrentMonth(prev => subMonths(prev, viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1));
}, [viewMode]); // ⚠️ Dépend de viewMode

const handleNext = useCallback(() => {
  setCurrentMonth(prev => addMonths(prev, viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1));
}, [viewMode]); // ⚠️ Dépend de viewMode

const handleToday = useCallback(() => {
  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}, [now]); // ⚠️ Dépend de now

const handleDateSelect = useCallback((date) => {
  setCurrentMonth(date);
  setShowCalendar(false);
}, []); // ✅ Aucune dépendance

  const handleDragStart = useCallback((project) => {
  setDraggedProject(project);
}, []); // ✅ Aucune dépendance

const handleDragOver = useCallback((e, day) => {
  e.preventDefault();
}, []); // ✅ Aucune dépendance

const handleDrop = useCallback(async (e, day) => {
  e.preventDefault();
  if (!draggedProject) return;

  const originalStart = parseISO(draggedProject.startdate);
  const originalEnd = parseISO(draggedProject.enddate);
  const duration = differenceInDays(originalEnd, originalStart);
  const newStart = day;
  const newEnd = addDays(day, duration);

  if (onUpdateProject) {
    await onUpdateProject(draggedProject.id, {
      startdate: format(newStart, 'yyyy-MM-dd'),
      enddate: format(newEnd, 'yyyy-MM-dd'),
    });
  }

  setDraggedProject(null);
}, [draggedProject, onUpdateProject]); // ⚠️ Dépend de draggedProject et onUpdateProject

  // Export CSV
  const handleExport = useCallback(() => {
  const csvContent = [
    'Projet,Client,Début,Fin,Statut,Progression,Revenus (Ar),Coûts (Ar),Profit (Ar)',
    ...filteredProjects.map(p =>
      `"${p.name}","${p.clientname}","${p.startdate}","${p.enddate}","${p.status}",${p.progress || 0},${p.totalamount || 0},${p.totalcost || 0},${parseFloat(p.totalamount || 0) - parseFloat(p.totalcost || 0)}`
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gantt-timeline-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}, [filteredProjects]); // ⚠️ Dépend de filteredProjects

// ✅ OPTIMISATION #7.1 : Callback pour édition de projet
const handleEditProject = useCallback((project) => {
  setSelectedProject(project);
}, []);

  // ✅ Solde réel Coffre actuel
  const coffreAccount = accounts?.find((a) => a.name === 'Coffre');
  const currentCoffreBalance = Number(coffreAccount?.balance || 0);

  console.log('💰 DEBUG GanttTimelineModal Coffre:', {
    coffreAccount,
    currentCoffreBalance,
  });

  if (!isOpen) return null;

  return (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full h-[95vh] flex flex-col overflow-hidden border border-slate-200">
      
      {/* Header moderne */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Gantt Timeline – Gestion de projets
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {filteredProjects.length} projet{filteredProjects.length > 1 ? 's' : ''} •{' '}
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
        >
          <X size={22} />
        </button>
      </div>

      {/* ✅ OPTIMISATION #5 : Stats compactes avec StatCard mémoïsé */}
      <div className="grid grid-cols-6 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
        <StatCard
          icon={Package}
          label="Total"
          value={statistics.total}
          colorClass="border-slate-600"
          bgClass="bg-gradient-to-br from-slate-600 to-slate-700"
        />
        <StatCard
          icon={CheckCircle}
          label="Actifs"
          value={statistics.active}
          colorClass="border-emerald-600"
          bgClass="bg-gradient-to-br from-emerald-600 to-emerald-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Complétés"
          value={statistics.completed}
          colorClass="border-green-600"
          bgClass="bg-gradient-to-br from-green-600 to-green-700"
        />
        <StatCard
          icon={AlertCircle}
          label="Retard"
          value={statistics.delayed}
          colorClass="border-rose-600"
          bgClass="bg-gradient-to-br from-rose-600 to-rose-700"
        />
        <StatCard
          icon={DollarSign}
          label="Revenus"
          value={formatCurrency(statistics.totalRevenue)}
          colorClass="border-purple-600"
          bgClass="bg-gradient-to-br from-purple-600 to-purple-700"
        />
        <StatCard
          icon={TrendingUp}
          label="Marge"
          value={`${statistics.profitMargin.toFixed(1)}%`}
          colorClass="border-blue-600"
          bgClass="bg-gradient-to-br from-blue-600 to-blue-700"
        />
      </div>

      {/* Timeline Coffre en hover */}
      <div
        className="px-2 pt-2 pb-2 border-b border-slate-200 bg-slate-600 transition-all duration-300"
        onMouseEnter={() => setIsTimelineExpanded(true)}
        onMouseLeave={() => setIsTimelineExpanded(false)}
      >
        <div
          className={`rounded-2xl overflow-hidden bg-slate-600 transition-all duration-300 ${
            isTimelineExpanded ? 'h-[680px]' : 'h-[140px]'
          }`}
        >
          <TreasuryTimeline
            projects={normalizedProjects.filter(p => 
              p.status === 'active' || p.status === 'inprogress'
            )}
            currentCashBalance={currentCoffreBalance}
            startDate={today}
            endDate={timelineEnd}
            transactions={transactions}
            plannedTransactions={plannedTransactions}
          />
        </div>
      </div>

      {/* Barre de contrôles modernisée */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevious}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Aujourd'hui
          </button>
          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>

          <span className="ml-3 text-sm font-semibold text-slate-700">
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </span>

          {/* Calendrier */}
          <div className="relative ml-4">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
            >
              <CalendarIcon size={18} />
              Calendrier
            </button>

            {showCalendar && (
              <div className="absolute top-full mt-2 left-0 bg-white border border-gray-300 rounded-lg shadow-xl z-50 p-4 w-80">
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="font-semibold text-sm">
                    {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                  </span>
                  <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                    <div key={i} className="text-xs font-bold text-gray-500 p-1">
                      {day}
                    </div>
                  ))}
                  {eachDayOfInterval({
                    start: startOfMonth(currentMonth),
                    end: endOfMonth(currentMonth),
                  }).map((day, i) => {
                    const isToday = isSameDay(day, today);
                    const isSelected = isSameDay(day, currentMonth);

                    return (
                      <button
                        key={i}
                        onClick={() => handleDateSelect(day)}
                        className={`p-2 text-xs rounded hover:bg-blue-100 transition-colors ${
                          isToday
                            ? 'bg-blue-500 text-white font-bold'
                            : isSelected
                              ? 'bg-blue-200 text-blue-800'
                              : 'text-gray-700'
                        }`}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    handleToday();
                    setShowCalendar(false);
                  }}
                  className="w-full mt-3 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Aller à aujourd'hui
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"
          >
            <option value="month">Mois</option>
            <option value="quarter">Trimestre</option>
            <option value="year">Année</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="completed">Complétés</option>
            <option value="delayed">En retard</option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm w-52"
            />
          </div>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-1.5"
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Gantt Chart - STRUCTURE CORRIGÉE */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex flex-1 min-h-0">
          
          {/* Colonne projets - FIXE */}
          <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-gray-300 bg-gray-50">
            <div
              className="sticky top-0 bg-gray-100 border-b border-gray-300 p-4 font-semibold z-20"
              style={{ height: '60px' }}
            >
              Projets ({filteredProjects.length})
            </div>

            {filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Package size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-semibold">Aucun projet trouvé</p>
                <p className="text-sm">Modifiez vos filtres</p>
              </div>
            ) : (
              filteredProjects.map((project, projectIndex) => {
                const isDelayed = project.enddate && new Date(project.enddate) < today && project.status !== 'completed';
                const metrics = calculateProjectMetrics(project);

                return (
                  <ProjectRow
                    key={`col-${project.id}`}
                    project={project}
                    projectIndex={projectIndex}
                    isDelayed={isDelayed}
                    metrics={metrics}
                    onEdit={() => handleEditProject(project)}
                  />
                );
              })
            )}
          </div>

          {/* Timeline - SCROLLABLE */}
          <div className="flex-1 overflow-x-auto overflow-y-auto">
            <div className="min-w-max">
              
              {/* ✅ OPTIMISATION #8 : Timeline Header mémoïsé */}
              <TimelineHeader timelineDays={timelineDays} today={today} />

              {/* ✅ OPTIMISATION #9 : Project Rows avec composant mémoïsé */}
<div className="relative">
  {filteredProjects.map((project, projectIndex) => {
    const position = getProjectTimelinePosition(project);
    const progressOpacity = getProgressOpacity(project.progress);
    const metrics = calculateProjectMetrics(project);

    return (
      <ProjectTimelineRow
        key={`timeline-${project.id}`}
        project={project}
        projectIndex={projectIndex}
        timelineDays={timelineDays}
        position={position}
        progressOpacity={progressOpacity}
        metrics={metrics}
        today={today}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    );
  })}

  {/* Today Marker - EN DEHORS de la boucle */}
  {timelineDays.some(day => isSameDay(day, today)) && (
    <div
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-15 pointer-events-none"
      style={{ left: `${differenceInDays(today, timelineDays[0]) * 40}px` }}
    >
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
    </div>
  )}
</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal détails projet */}
      {selectedProject && (
        <ProjectDetailsModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onUpdate={async (updates) => {
            if (onUpdateProject) {
              await onUpdateProject(selectedProject.id, updates);
            }
            setSelectedProject(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  </div>
);
} 

export default GanttTimelineModal;