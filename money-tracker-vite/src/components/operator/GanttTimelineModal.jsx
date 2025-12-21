import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Search, Download, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Clock, DollarSign, Users, Package, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, differenceInDays, parseISO, isWithinInterval, isSameDay, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import TreasuryTimeline from '../TreasuryTimeline';
import { useFinance } from '../../contexts/FinanceContext';

const GanttTimelineModal = ({ isOpen, onClose, projects, onUpdateProject, onRefresh }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [draggedProject, setDraggedProject] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const { accounts, receivables, transactions, plannedTransactions } = useFinance();


  console.log('🎨 GanttTimelineModal - Projets reçus:', projects);

  // Normaliser les données des projets
  const normalizedProjects = useMemo(() => {
    console.log('🔍 Projets bruts reçus:', projects);
  
    return projects.map(p => {
      const start_date = p.start_date || p.startdate || p.startDate || null;
      const end_date = p.end_date || p.enddate || p.endDate || null;
      const total_amount = parseFloat(p.total_amount || p.totalrevenues || p.totalRevenues || p.total_revenues || 0);
      const total_cost = parseFloat(p.total_cost || p.totalcost || p.totalCost || p.total_expenses || 0);
      const name = p.name || p.projectName || p.project_name || 'Projet sans nom';
      const client_name = p.client_name || p.clientname || p.clientName || p.client || 'N/A';
      const product_name = p.product_name || p.productname || p.productName || p.product || 'N/A';
      const progress = parseFloat(p.progress || 0);
      const color = p.color || '#3B82F6';
      const status = p.status || 'active';
      
      const normalized = {
        ...p,
        name,
        start_date,
        end_date,
        total_amount,
        total_cost,
        client_name,
        product_name,
        progress,
        color,
        status,
      };
      
      console.log(`✅ Projet normalisé: "${normalized.name}"`, {
        id: normalized.id,
        start_date: normalized.start_date,
        end_date: normalized.end_date,
      });
      
      return normalized;
    });
  }, [projects]);

  console.log('📊 Total projets normalisés:', normalizedProjects.length);

  // Au lieu de passer timelineStart/timelineEnd bruts
//const focusStart = new Date();
//focusStart.setDate(focusStart.getDate() - 45); // 45 jours avant
//const focusEnd = new Date();
//focusEnd.setDate(focusEnd.getDate() + 45); // 45 jours après

  const coffreBalance = useMemo(() => {
    return accounts?.find(a => a.name === 'Coffre')?.balance || 75000000;
  }, [accounts]);

  // 5️⃣ 🆕 Calculer les dates de timeline
  const timelineStart = useMemo(() => {
    if (normalizedProjects.length === 0) return startOfMonth(new Date());
    
    const dates = normalizedProjects
      .map(p => new Date(p.start_date || p.startDate))
      .filter(d => !isNaN(d.getTime()));
    
    if (dates.length === 0) return startOfMonth(new Date());
    
    const earliest = new Date(Math.min(...dates));
    return startOfMonth(earliest);
  }, [normalizedProjects]);

  const timelineEnd = useMemo(() => {
    if (normalizedProjects.length === 0) return endOfMonth(addMonths(new Date(), 3));
    
    const dates = normalizedProjects
      .map(p => new Date(p.end_date || p.endDate))
      .filter(d => !isNaN(d.getTime()));
    
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
      avgProgress: 0
    };

    normalizedProjects.forEach(project => {
      if (project.status === 'completed') stats.completed++;
      else if (project.status === 'active' || project.status === 'in_progress') stats.active++;
      
      if (project.end_date && new Date(project.end_date) < new Date() && project.status !== 'completed') {
        stats.delayed++;
      }

      stats.totalRevenue += parseFloat(project.total_amount || 0);
      stats.totalCost += parseFloat(project.total_cost || 0);
      stats.avgProgress += parseFloat(project.progress || 0);
    });

    stats.avgProgress = normalizedProjects.length > 0 ? stats.avgProgress / normalizedProjects.length : 0;
    stats.profit = stats.totalRevenue - stats.totalCost;
    stats.profitMargin = stats.totalRevenue > 0 ? (stats.profit / stats.totalRevenue) * 100 : 0;

    return stats;
  }, [normalizedProjects]);

  // Filtrer et rechercher les projets
  const filteredProjects = useMemo(() => {
    return normalizedProjects.filter(project => {
      if (filterStatus !== 'all') {
        if (filterStatus === 'active' && !['active', 'in_progress'].includes(project.status)) return false;
        if (filterStatus === 'completed' && project.status !== 'completed') return false;
        if (filterStatus === 'delayed') {
          const isDelayed = project.end_date && new Date(project.end_date) < new Date() && project.status !== 'completed';
          if (!isDelayed) return false;
        }
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          project.name?.toLowerCase().includes(search) ||
          project.client_name?.toLowerCase().includes(search) ||
          project.description?.toLowerCase().includes(search) ||
          project.product_name?.toLowerCase().includes(search)
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
  const getProjectTimelinePosition = (project) => {
    if (!project.start_date || !project.end_date) {
      console.warn('⚠️ Dates manquantes pour:', project.name);
      return null;
    }

    try {
      const projectStart = parseISO(project.start_date);
      const projectEnd = parseISO(project.end_date);
      const timelineStart = timelineDays[0];
      const timelineEnd = timelineDays[timelineDays.length - 1];

      if (projectEnd < timelineStart || projectStart > timelineEnd) return null;

      const visibleStart = projectStart < timelineStart ? timelineStart : projectStart;
      const visibleEnd = projectEnd > timelineEnd ? timelineEnd : projectEnd;

      const startOffset = differenceInDays(visibleStart, timelineStart);
      const duration = differenceInDays(visibleEnd, visibleStart) + 1;

      const leftPercent = (startOffset / timelineDays.length) * 100;
      const widthPercent = (duration / timelineDays.length) * 100;

      return { left: `${leftPercent}%`, width: `${widthPercent}%` };
    } catch (error) {
      console.error('❌ Erreur calcul position:', error, project);
      return null;
    }
  };

  // Déterminer l'opacité selon la progression
  const getProgressOpacity = (progress) => {
    const p = parseFloat(progress || 0);
    if (p === 0) return 'opacity-30';
    if (p < 25) return 'opacity-40';
    if (p < 50) return 'opacity-60';
    if (p < 75) return 'opacity-80';
    return 'opacity-100';
  };

  // Navigation dans le temps
  const handlePrevious = () => {
    setCurrentMonth(prev => subMonths(prev, viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1));
  };

  const handleNext = () => {
    setCurrentMonth(prev => addMonths(prev, viewMode === 'year' ? 12 : viewMode === 'quarter' ? 3 : 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleDateSelect = (date) => {
    setCurrentMonth(date);
    setShowCalendar(false);
  };

  // Drag & Drop
  const handleDragStart = (project) => {
    setDraggedProject(project);
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    setHoveredDay(day);
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    if (!draggedProject) return;

    const originalStart = parseISO(draggedProject.start_date);
    const originalEnd = parseISO(draggedProject.end_date);
    const duration = differenceInDays(originalEnd, originalStart);

    const newStart = day;
    const newEnd = addDays(day, duration);

    if (onUpdateProject) {
      await onUpdateProject(draggedProject.id, {
        start_date: format(newStart, 'yyyy-MM-dd'),
        end_date: format(newEnd, 'yyyy-MM-dd')
      });
    }

    setDraggedProject(null);
    setHoveredDay(null);
  };

  // Export CSV
  const handleExport = () => {
    const csvContent = [
      ['Projet', 'Client', 'Début', 'Fin', 'Statut', 'Progression', 'Revenus (Ar)', 'Coûts (Ar)', 'Profit (Ar)'].join(','),
      ...filteredProjects.map(p => [
        p.name,
        p.client_name || '',
        p.start_date || '',
        p.end_date || '',
        p.status || '',
        `${p.progress || 0}%`,
        p.total_amount || 0,
        p.total_cost || 0,
        (parseFloat(p.total_amount || 0) - parseFloat(p.total_cost || 0))
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantt-timeline-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0
    }).format(amount || 0) + ' Ar';
  };

  if (!isOpen) return null;

  // Fonction pour calculer le solde Coffre à une date donnée
const getBalanceAtDate = (targetDate) => {
  const targetStr = new Date(targetDate).toISOString().split('T')[0];
  
  // Solde actuel du compte Coffre
  const currentBalance = accounts?.find(a => a.name === 'Coffre')?.balance || 0;
  
  // Calculer les flux Coffre APRÈS targetDate
  const futureFlows = transactions
    .filter(tx => {
      const isCoffre = (tx.account_name || tx.accountName || tx.account) === 'Coffre';
      const txDate = tx.date ? new Date(tx.date).toISOString().split('T')[0] : null;
      return isCoffre && txDate && txDate > targetStr;
    })
    .reduce((sum, tx) => {
      const amount = Number(tx.amount) || 0;
      const isIncome = String(tx.type).toLowerCase() === 'income';
      return sum + (isIncome ? amount : -amount);
    }, 0);
  
  // Solde au targetDate = solde actuel - flux futurs
  return currentBalance - futureFlows;
};

// Utiliser pour calculer le solde initial de la timeline
const focusStart = new Date();
focusStart.setDate(focusStart.getDate() - 45);

const focusEnd = new Date();
focusEnd.setDate(focusEnd.getDate() + 45);

const initialBalance = getBalanceAtDate(focusStart);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Gantt Timeline - Gestion de Projets</h2>
            <p className="text-sm text-gray-500 mt-1">
              {filteredProjects.length} projet{filteredProjects.length > 1 ? 's' : ''} • {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-6 gap-4 p-6 bg-gray-50 border-b border-gray-200">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Total Projets</p>
                <p className="text-2xl font-bold text-gray-800">{statistics.total}</p>
              </div>
              <Package className="text-blue-500" size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Actifs</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.active}</p>
              </div>
              <Clock className="text-blue-500" size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Complétés</p>
                <p className="text-2xl font-bold text-green-600">{statistics.completed}</p>
              </div>
              <CheckCircle className="text-green-500" size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">En Retard</p>
                <p className="text-2xl font-bold text-red-600">{statistics.delayed}</p>
              </div>
              <AlertCircle className="text-red-500" size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Revenus</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(statistics.totalRevenue)}</p>
              </div>
              <DollarSign className="text-green-500" size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Marge</p>
                <p className="text-lg font-bold text-purple-600">{statistics.profitMargin.toFixed(1)}%</p>
              </div>
              <TrendingUp className="text-purple-500" size={24} />
            </div>
          </div>
        </div>

         {/* Prévision de Trésorerie */}
/ Passer à TreasuryTimeline
<TreasuryTimeline
  projects={normalizedProjects}
  currentCashBalance={initialBalance} // ✅ Solde au début de la période
  startDate={focusStart}
  endDate={focusEnd}
  receivables={receivables}
  transactions={transactions}
  plannedTransactions={plannedTransactions}
/>
        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 gap-4">
          <div className="flex items-center gap-2">
            <button onClick={handlePrevious} className="p-2 hover:bg-gray-100 rounded">
              <ChevronLeft size={20} />
            </button>
            <button onClick={handleToday} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
              Aujourd'hui
            </button>
            <button onClick={handleNext} className="p-2 hover:bg-gray-100 rounded">
              <ChevronRight size={20} />
            </button>
            <span className="ml-4 font-semibold text-gray-700">
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
                      end: endOfMonth(currentMonth)
                    }).map((day, i) => {
                      const isToday = isSameDay(day, new Date());
                      const isSelected = isSameDay(day, currentMonth);
                      
                      return (
                        <button
                          key={i}
                          onClick={() => handleDateSelect(day)}
                          className={`p-2 text-xs rounded hover:bg-blue-100 transition-colors ${
                            isToday ? 'bg-blue-500 text-white font-bold' : 
                            isSelected ? 'bg-blue-200 text-blue-800' : 
                            'text-gray-700'
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
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value="month">Mois</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Année</option>
            </select>

            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="completed">Complétés</option>
              <option value="delayed">En retard</option>
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded w-64"
              />
            </div>

            <button 
              onClick={handleExport}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center gap-2"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

       {/* Gantt Chart - STRUCTURE CORRIGÉE */}
<div className="flex-1 overflow-hidden flex flex-col">
  <div className="flex flex-1 min-h-0">
    {/* Colonne projets - FIXE */}
    <div className="w-80 flex-shrink-0 overflow-y-auto border-r border-gray-300 bg-gray-50">
      <div className="sticky top-0 bg-gray-100 border-b border-gray-300 p-4 font-semibold z-20" style={{ height: '60px' }}>
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
          const isDelayed = project.end_date && new Date(project.end_date) < new Date() && project.status !== 'completed';



          return (
            <div
              key={`project-col-${project.id}`}
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
                  <p className="text-xs text-gray-500 mb-2 truncate" title={project.client_name}>//
                   {project.client_name}
                  </p>

                  {/* Badges de statut */}
                  <div className="flex items-center gap-2 text-xs flex-wrap mb-2">
                    {/* Badge de statut */}
                    {(() => {
                      const statusConfig = {
                        active: { label: '✅ Actif', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
                        completed: { label: '🎉 Terminé', color: 'bg-green-100 text-green-700 border-green-300' },
                        in_progress: { label: '🔄 En cours', color: 'bg-blue-100 text-blue-700 border-blue-300' },
                        paused: { label: '⏸️ En pause', color: 'bg-orange-100 text-orange-700 border-orange-300' },
                        draft: { label: '📝 Brouillon', color: 'bg-gray-100 text-gray-700 border-gray-300' },
                        cancelled: { label: '❌ Annulé', color: 'bg-red-100 text-red-700 border-red-300' },
                      };

                      const config = statusConfig[project.status] || { 
                        label: project.status || 'Inconnu', 
                        color: 'bg-purple-100 text-purple-700 border-purple-300' 
                      };

                      return (
                        <span className={`px-2 py-1 rounded border ${config.color} font-medium`}>
                          {config.label}
                        </span>
                      );
                    })()}
                    
                    {/* Badge de retard */}
                    {isDelayed && (
                      <span className="px-2 py-1 rounded border bg-red-100 text-red-700 border-red-300 font-medium animate-pulse">
                        ⚠️ Retard
                      </span>
                    )}
                  </div>

                  {/* Informations financières */}
                  <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Progression:</span>
                      <span className="font-semibold">{project.progress || 0}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Revenus:</span>
                      <span className="font-semibold text-green-600">{formatCurrency(project.total_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Coûts:</span>
                      <span className="font-semibold text-red-600">{formatCurrency(project.total_cost)}</span>
                    </div>
                    <div className="flex justify-between pt-0.5 border-t border-gray-200 mt-1">
                      <span className="text-gray-500 font-medium">Profit:</span>
                      <span className={`font-bold ${
                        (parseFloat(project.total_amount || 0) - parseFloat(project.total_cost || 0)) >= 0 
                          ? 'text-purple-600' 
                          : 'text-red-600'
                      }`}>
                        {formatCurrency(parseFloat(project.total_amount || 0) - parseFloat(project.total_cost || 0))}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Bouton d'édition */}
                <button
                  onClick={() => setSelectedProject(project)}
                  className="text-blue-500 hover:text-blue-700 ml-2 flex-shrink-0"
                  title="Éditer le projet"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>

    {/* Timeline - SCROLLABLE */}
    <div className="flex-1 overflow-x-auto overflow-y-auto">
      <div className="min-w-max">
        {/* Timeline Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-300" style={{ height: '60px' }}>
          <div className="flex items-center h-full">
            {timelineDays.map((day, index) => {
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const isToday = isSameDay(day, new Date());
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

        {/* Project Rows */}
        <div className="relative">
          {filteredProjects.map((project, projectIndex) => {
            const position = getProjectTimelinePosition(project);
            const progressOpacity = getProgressOpacity(project.progress);

            return (
              <div
                key={`timeline-${project.id}`}
                className={`flex border-b border-gray-200 relative ${
                  projectIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
                style={{ height: '175px' }}
              >
                {/* Grid Lines */}
                <div className="absolute inset-0 flex pointer-events-none">
                  {timelineDays.map((day, index) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, new Date());
                    
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
                      onDragOver={(e) => handleDragOver(e, day)}
                      onDrop={(e) => handleDrop(e, day)}
                    />
                  ))}
                </div>

                {/* Project Bar */}
{position && (
  <div
    className="absolute top-1/2 -translate-y-1/2 h-12 cursor-move group z-10"
    style={{ left: position.left, width: position.width }}
    draggable
    onDragStart={() => handleDragStart(project)}
  >
    <div
      className={`h-full ${progressOpacity} rounded shadow-md flex items-center justify-between px-3 text-white text-xs font-semibold group-hover:shadow-lg transition-all`}
      style={{ backgroundColor: project.color || '#3B82F6' }}
    >
      <span className="truncate">{project.name}</span>
      <span className="ml-2 bg-white bg-opacity-30 px-2 py-0.5 rounded">
        {project.progress || 0}%
      </span>
      {/* Dans le rendu de chaque barre de projet */}
<div className="relative">
  {/* Barre existante */}
  <div className={`h-8 rounded ${project.color} ...`}>
    {/* Contenu existant */}
  </div>
  
  {/* Indicateurs de flux */}
  <div className="absolute top-0 right-0 flex gap-1">
    {project.expected_revenue > 0 && (
      <div className="bg-green-500 text-white text-xs px-1 rounded" title="Revenus prévus">
        ↑ {(project.expected_revenue / 1000000).toFixed(1)}M
      </div>
    )}
    {project.estimated_cost > 0 && (
      <div className="bg-red-500 text-white text-xs px-1 rounded" title="Coûts prévus">
        ↓ {(project.estimated_cost / 1000000).toFixed(1)}M
      </div>
    )}
  </div>
</div>

    </div>

    {/* Progress Fill */}
    <div
      className="absolute top-0 left-0 h-full bg-white bg-opacity-30 rounded-l"
      style={{ width: `${project.progress || 0}%` }}
    />

    {/* Tooltip - Position adaptative selon le rang */}
    <div className={`absolute ${
      projectIndex === 0 || projectIndex === 1 ? 'top-full mt-2' : 'bottom-full mb-2'
    } left-0 hidden group-hover:block bg-gray-800 text-white p-3 rounded shadow-xl text-xs w-64 z-50 pointer-events-none`}>
      <div className="font-semibold mb-2">{project.name}</div>
      <div className="space-y-1">
        <div>Client: {project.client_name}</div>
        <div>Début: {project.start_date ? format(parseISO(project.start_date), 'dd/MM/yyyy') : 'N/A'}</div>
        <div>Fin: {project.end_date ? format(parseISO(project.end_date), 'dd/MM/yyyy') : 'N/A'}</div>
        <div>Progression: {project.progress || 0}%</div>
        <div>Revenus: {formatCurrency(project.total_amount)}</div>
        <div>Coûts: {formatCurrency(project.total_cost)}</div>
        <div className="font-semibold pt-1 border-t border-gray-600">
          Profit: {formatCurrency(parseFloat(project.total_amount || 0) - parseFloat(project.total_cost || 0))}
        </div>
        {project.product_name && project.product_name !== 'N/A' && (
          <div className="pt-1 border-t border-gray-600">
            Produit: {project.product_name}
          </div>
        )}
      </div>
      
      {/* Petite flèche indicatrice */}
      <div className={`absolute ${
        projectIndex === 0 || projectIndex === 1 ? 'bottom-full' : 'top-full'
      } left-4 w-0 h-0 border-l-4 border-r-4 border-transparent ${
        projectIndex === 0 || projectIndex === 1 ? 'border-b-4 border-b-gray-800' : 'border-t-4 border-t-gray-800'
      }`} />
    </div>
  </div>
)}


                {/* Today Marker */}
                {timelineDays.some(day => isSameDay(day, new Date())) && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-15 pointer-events-none"
                    style={{ left: `${(differenceInDays(new Date(), timelineDays[0]) * 40)}px` }}
                  >
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </div>
</div>


        {/* Modal de détails */}
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
};

// Modal de détails
const ProjectDetailsModal = ({ project, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    progress: project.progress || 0,
    status: project.status || 'active',
    color: project.color || '#3B82F6',
  });

  const colorPalette = [
    { name: 'Bleu', value: '#3B82F6' },
    { name: 'Vert', value: '#10B981' },
    { name: 'Rouge', value: '#EF4444' },
    { name: 'Jaune', value: '#F59E0B' },
    { name: 'Violet', value: '#8B5CF6' },
    { name: 'Rose', value: '#EC4899' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Cyan', value: '#06B6D4' },
    { name: 'Lime', value: '#84CC16' },
    { name: 'Emeraude', value: '#059669' },
    { name: 'Fuchsia', value: '#D946EF' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onUpdate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-800">Éditer: {project.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date de début
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Date de fin
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Progression (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Actif</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Complété</option>
                <option value="on_hold">En attente</option>
                <option value="cancelled">Annulé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Couleur du projet
            </label>
            <div className="grid grid-cols-6 gap-3">
              {colorPalette.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`h-12 rounded-lg border-2 transition-all ${
                    formData.color === color.value
                      ? 'border-gray-800 ring-2 ring-gray-400'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                >
                  {formData.color === color.value && (
                    <CheckCircle className="mx-auto text-white" size={20} />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label className="text-sm text-gray-600">Personnalisée:</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-mono">{formData.color}</span>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-semibold text-gray-700 mb-2">Informations</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Client:</span>
                <span className="ml-2 font-semibold">{project.client_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Produit:</span>
                <span className="ml-2 font-semibold">{project.product_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-600">Revenus:</span>
                <span className="ml-2 font-semibold text-green-600">
                  {new Intl.NumberFormat('fr-FR').format(parseFloat(project.total_amount || 0))} Ar
                </span>
              </div>
              <div>
                <span className="text-gray-600">Coûts:</span>
                <span className="ml-2 font-semibold text-red-600">
                  {new Intl.NumberFormat('fr-FR').format(parseFloat(project.total_cost || 0))} Ar
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-600">Profit:</span>
                <span className="ml-2 font-semibold text-purple-600">
                  {new Intl.NumberFormat('fr-FR').format(
                    parseFloat(project.total_amount || 0) - parseFloat(project.total_cost || 0)
                  )} Ar
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GanttTimelineModal;