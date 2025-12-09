// OperatorDashboard.jsx - VERSION COMPLÃˆTE CORRIGÃ‰E
import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Settings, CheckSquare, Clock, Target, FileText, 
  Plus, Edit, Trash2, Play, Pause, AlertCircle, TrendingUp 
} from 'lucide-react';
import operatorService from './services/operatorService';
import {CopyButton} from './components/common/CopyButton';

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount || 0) + ' Ar';
};

export function OperatorDashboard({ onClose, projects = [], transactions = [], accounts = [] }) {
  const [sops, setSops] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSOPModal, setShowSOPModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Charger les donnÃ©es au montage
  useEffect(() => {
    loadData();
  }, []);

  // 3. DEBUG EFFECT - DEPLACER ICI (PAS dans useMemo!)
  useEffect(() => {
    console.log('PROJETS REÇUS DANS OPERATOR:', projects);
    console.log('Nombre de projets:', projects.length);
    
    projects.forEach((p, idx) => {
      console.log(`\‹ Projet ${idx + 1}:`, {
        id: p.id,
        name: p.name,
        status: p.status,
        totalcost: p.totalcost,
        totalrevenues: p.totalrevenues,
        type_totalcost: typeof p.totalcost,
        type_totalrevenues: typeof p.totalrevenues
      });
    });
  }, [projects]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sopsData, tasksData] = await Promise.all([
        operatorService.getSOPs(),
        operatorService.getTasks()
      ]);
      
      console.log('📋 SOPs chargées:', sopsData);
      console.log('✅ Tasks chargées:', tasksData);
      
      setSops(sopsData || []);
      setTasks(tasksData || []);
    } catch (error) {
      console.error('Erreur chargement Operator:', error);
      setSops([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // CRUD SOPs
  const handleCreateSOP = async (sopData) => {
    try {
      await operatorService.createSOP(sopData);
      await loadData();
      setShowSOPModal(false);
    } catch (error) {
      console.error('Erreur création SOP:', error);
      alert('Erreur lors de la création de la SOP');
    }
  };

  const handleUpdateSOP = async (id, updates) => {
  try {
    // Trouver la SOP complÃ¨te
    const currentSOP = sops.find(s => s.id === id);
    if (!currentSOP) {
      throw new Error('SOP non trouvée');
    }

    // Fusionner les updates avec les données existantes
    const fullData = {
      title: currentSOP.title,
      description: currentSOP.description,
      owner: currentSOP.owner,
      steps: currentSOP.steps || [],
      avg_time: currentSOP.avg_time || currentSOP.avgtime,
      status: currentSOP.status,
      category: currentSOP.category,
      checklist: currentSOP.checklist || [],
      ...updates  // Appliquer les mises à jour par-dessus
    };

    console.log('📝 Mise à jour SOP avec données complètes:', fullData);
    
    await operatorService.updateSOP(id, fullData);
    await loadData();
    setSelectedSOP(null);
  } catch (error) {
    console.error('Erreur mise à jour SOP:', error);
    alert(`Erreur lors de la mise à jour de la SOP: ${error.message}`);
  }
};


  const handleDeleteSOP = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette SOP ?')) return;
    try {
      await operatorService.deleteSOP(id);
      await loadData();
    } catch (error) {
      console.error('Erreur suppression SOP:', error);
      alert('Erreur lors de la suppression de la SOP');
    }
  };

  // Construit une liste d'étapes à partir d'un projet (codes internes)
  const buildProjectSteps = (project) => {
    const parseData = (data) => {
      if (!data) return [];
      if (typeof data === 'string') {
        try {
          return JSON.parse(data);
        } catch {
          return [];
        }
      }
      return Array.isArray(data) ? data : [];
    };

    const expenses = parseData(project.expenses);
    const revenues = parseData(project.revenues);

    const stepsExpenses = expenses.map((exp, index) => ({
      id: `exp-${index}`,
      type: 'expense',
      label: exp.description || exp.category || 'Dépense',
      code: exp.code || exp.category,
      phase: exp.phase || project.currentPhase || 'investissement',
      amount: parseFloat(exp.amount) || 0,
      isDone: !!exp.isPaid
    }));

    const stepsRevenues = revenues.map((rev, index) => ({
      id: `rev-${index}`,
      type: 'revenue',
      label: rev.description || 'Revenu',
      code: rev.code,
      phase: rev.phase || 'ventes',
      amount: parseFloat(rev.amount) || 0,
      isDone: !!rev.isPaid
    }));

    const allSteps = [...stepsExpenses, ...stepsRevenues];

    const phasesOrder = ['investissement', 'logistique', 'ventes'];
    const phaseLabels = {
      investissement: 'Investissement',
      logistique: 'Logistique',
      ventes: 'Ventes'
    };

    const grouped = phasesOrder
      .map(phase => ({
        phase,
        label: phaseLabels[phase],
        items: allSteps.filter(s => s.phase === phase)
      }))
      .filter(group => group.items.length > 0);

    return grouped;
  };

  // CRUD Tasks
  const handleCreateTask = async (taskData) => {
    try {
      await operatorService.createTask(taskData);
      await loadData();
      setShowTaskModal(false);
    } catch (error) {
      console.error('Erreur création tâche:', error);
      alert('Erreur lors de la création de la tâche');
    }
  };

  const handleUpdateTask = async (id, updates) => {
    try {
      await operatorService.updateTask(id, updates);
      await loadData();
      setSelectedTask(null);
    } catch (error) {
      console.error('Erreur mise à jour tâche:', error);
      alert('Erreur lors de la mise à jour de la tâche');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) return;
    try {
      await operatorService.deleteTask(id);
      await loadData();
    } catch (error) {
      console.error('Erreur suppression tâche:', error);
      alert('Erreur lors de la suppression de la tâche');
    }
  };

  // Stats SOPs/Tasks
  const stats = {
    totalSOPs: sops.length,
    activeSOPs: sops.filter(s => s.status === 'active').length,
    pendingTasks: tasks.filter(t => t.status !== 'done').length,
    overdueSOPs: sops.filter(s => {
      const lastReview = new Date(s.lastreview);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return lastReview < thirtyDaysAgo;
    }).length
  };

// STATS PROJETS (nombres bruts + liste active)
const projectStats = useMemo(() => {
  const activeProjects = projects.filter(p => {
    const status = (p.status || '').toLowerCase();
    return status === 'active' || status === 'actif' || status.startsWith('phase');
  });

  const totalCost = activeProjects.reduce((sum, p) => {
    // âœ… Convertir string â†’ number
    const cost = parseFloat(p.totalCost || p.totalcost || 0);
    return sum + cost;
  }, 0);

  const totalRevenues = activeProjects.reduce((sum, p) => {
    // âœ… Convertir string â†’ number
    const revenue = parseFloat(p.totalRevenues || p.totalrevenues || 0);
    return sum + revenue;
  }, 0);

  const roi = totalCost > 0 ? ((totalRevenues - totalCost) / totalCost) * 100 : 0;

  return {
    active: activeProjects.length,
    totalCost,
    totalRevenues,
    roi,
    activeProjects
  };
}, [projects]);

  // Transactions projets rÃ©centes
  const projectTransactions = useMemo(() => {
    return transactions
      .filter(t => t.projectid && !t.isplanned)
      .slice(0, 5)
      .map(t => ({
        ...t,
        projectName: projects.find(p => p.id === t.projectid)?.name || 'Projet'
      }));
  }, [transactions, projects]);

  // Texte à copier
const generateCopyText = () => {
  const now = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let text = '📊 OPERATOR DASHBOARD\n';
  text += `\n📅 Date: ${now}\n`;
  text += '\n🎯 INDICATEURS\n';
  text += `• SOPs: Total ${stats.totalSOPs} | Actives ${stats.activeSOPs}\n`;
  text += `• Tâches: En Cours ${stats.pendingTasks}\n`;
  text += `• SOPs à Revoir: ${stats.overdueSOPs}\n`;
  text += `• Projets Actifs: ${projectStats.active}\n`;

  if (projectStats.active > 0) {
    text += '\n💰 PROJETS ACTIFS\n';
    text += `• Investi: ${formatCurrency(projectStats.totalCost)}\n`;
    text += `• CA prévu: ${formatCurrency(projectStats.totalRevenues)}\n`;
    text += `• ROI moyen: ${projectStats.roi.toFixed(1)}%\n`;
  }

  text += `\n⚡ Généré par Money Tracker | ${new Date().toLocaleTimeString('fr-FR')}`;
  return text;
};

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Settings size={28} />
                Operator Dashboard
              </h2>
              <p className="text-purple-100 mt-1">Execution • SOPs • Tâches • Projets Actifs</p>
            </div>
            <div className="flex items-center gap-3">
              <CopyButton textToCopy={generateCopyText()} />
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white hover:bg-white/20 p-2 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>

        {/* 5 STATS CARDS */}
        <div className="grid grid-cols-5 gap-4 mt-6 px-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="text-gray-600 text-xs font-semibold uppercase tracking-wide">Total SOPs</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{stats.totalSOPs}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-4">
            <div className="text-emerald-600 text-xs font-semibold uppercase tracking-wide">SOPs Actives</div>
            <div className="text-3xl font-bold text-emerald-700 mt-1">{stats.activeSOPs}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-4">
            <div className="text-yellow-600 text-xs font-semibold uppercase tracking-wide">Tâches en Cours</div>
            <div className="text-3xl font-bold text-yellow-700 mt-1">{stats.pendingTasks}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
            <div className="text-red-600 text-xs font-semibold uppercase tracking-wide">SOPs à Revoir</div>
            <div className="text-3xl font-bold text-red-700 mt-1">{stats.overdueSOPs}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4">
            <div className="text-blue-600 text-xs font-semibold uppercase tracking-wide">Projets Actifs</div>
            <div className="text-3xl font-bold text-blue-700 mt-1">{projectStats.active}</div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            
            {/* SOPs */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-purple-600" />
                  Standard Operating Procedures
                </h3>
                <button
                  onClick={() => setShowSOPModal(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  Nouvelle SOP
                </button>
              </div>

                              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {sops.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <FileText size={48} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">Aucune SOP crÃ©Ã©e</p>
                    <button 
                      onClick={() => setShowSOPModal(true)}
                      className="mt-3 text-purple-600 hover:text-purple-700 font-semibold"
                    >
                      CrÃ©er votre premiÃ¨re SOP
                    </button>
                  </div>
                ) : (
                  sops.map(sop => (
                    <div
                      key={sop.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
                      onClick={() => setSelectedSOP(sop)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{sop.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">{sop.description}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          sop.status === 'active' ? 'bg-green-100 text-green-700' :
                          sop.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {sop.status === 'active' ? 'Active' : 
                           sop.status === 'draft' ? 'Brouillon' : 'ArchivÃ©'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-3">
                        <span>{sop.owner}</span>
                        <span>
                          {Array.isArray(sop.steps) ? sop.steps.length : 0} étapes
                        </span>
                        <span>{sop.avg_time || sop.avgtime} j</span>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateSOP(sop.id, {
                              status: sop.status === 'active' ? 'archived' : 'active'
                            });
                          }}
                          className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded transition"
                        >
                          {sop.status === 'active' ? (
                            <>
                              <Pause size={12} className="inline mr-1" />
                              Archiver
                            </>
                          ) : (
                            <>
                              <Play size={12} className="inline mr-1" />
                              Activer
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSOP(sop.id);
                          }}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition"
                        >
                          <Trash2 size={12} className="inline mr-1" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* TASKS */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <CheckSquare size={20} className="text-pink-600" />
                  Tâches Opérationnelles
                </h3>
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 transition flex items-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  Nouvelle TÃ¢che
                </button>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <CheckSquare size={48} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">Aucune tÃ¢che crÃ©Ã©e</p>
                    <button 
                      onClick={() => setShowTaskModal(true)}
                      className="mt-3 text-pink-600 hover:text-pink-700 font-semibold"
                    >
                      CrÃ©er votre premiÃ¨re tÃ¢che
                    </button>
                  </div>
                ) : (
                  tasks.map(task => (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{task.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {task.description || 'Pas de description'}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          task.status === 'done' ? 'bg-green-100 text-green-700' :
                          task.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {task.status === 'done' ? 'TerminÃ©' :
                           task.status === 'in-progress' ? 'En cours' : 'À faire'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600 mt-3">
                        <span>{task.due_date || task.duedate}</span>
                        <span>{task.assigned_to || task.assignee || 'Non assigné'}</span>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => setSelectedTask(task)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded transition"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded transition"
                        >
                          <Trash2 size={12} className="inline mr-1" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* PROJETS ACTIFS */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp size={24} className="text-blue-600" />
              Projets Actifs ({projectStats.active})
            </h3>
          </div>

          {/* Impacts Financiers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
              <div className="text-blue-600 text-sm font-medium mb-2">📊 Investissement Total</div>
              <div className="text-3xl font-bold text-blue-900">
                {formatCurrency(projectStats.totalCost)}
              </div>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
              <div className="text-emerald-600 text-sm font-medium mb-2">📅 Revenus Prévisionnels</div>
              <div className="text-3xl font-bold text-emerald-900">
                {formatCurrency(projectStats.totalRevenues)}
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
              <div className="text-purple-600 text-sm font-medium mb-2">🎯 ROI Estimé</div>
              <div className={`text-3xl font-bold ${
                projectStats.roi >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}>
                {projectStats.roi.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Liste Projets Actifs */}
          <div className="space-y-4 max-h-[350px] overflow-y-auto">
            {projectStats.active === 0 ? (
              <div className="text-center py-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200">
                <TrendingUp size={64} className="mx-auto text-blue-300 mb-4" />
                <h4 className="text-xl font-bold text-gray-700 mb-2">Aucun projet actif</h4>
                <p className="text-gray-500 mb-6">Activez un projet depuis le Planificateur</p>
              </div>
            ) : (
              projectStats.activeProjects.map(project => {
                const stepGroups = buildProjectSteps(project);

                return (
                  <div
                    key={project.id}
                    className="group border border-gray-200 rounded-xl p-6 hover:shadow-xl hover:border-blue-300 transition-all bg-white"
                  >
                    {/* En-tête projet */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 mr-4">
                        <h4 className="font-bold text-xl text-gray-900 mb-1 line-clamp-1 group-hover:text-blue-700">
                          {project.name}
                        </h4>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">
                            💰 Actif
                          </span>
                          <span className="text-sm font-medium text-gray-700">
  {formatCurrency(parseFloat(project.totalcost) || 0)}
</span>
                          <span className="text-xs text-gray-500">
                            {project.createdat ? new Date(project.createdat).toLocaleDateString('fr-FR') : ''}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                        )}
                      </div>

                      {/* ROI rapide */}
                      <div className="w-28 text-right">
                        <div className={`text-2xl font-bold ${
                          ((project.totalrevenues || project.totalRevenues || 0) - 
                           (project.totalcost || project.totalCost || 0)) >= 0 
                            ? 'text-emerald-600' 
                            : 'text-red-600'
                        }`}>
                          {project.totalrevenues
  ? (
      (parseFloat(project.totalrevenues) / 
      Math.max(parseFloat(project.totalcost) || 1, 1)) * 100
    ).toFixed(0)
  : 0}%
                        </div>
                      </div>
                    </div>

                    {/* Suivi par étapes (codes) */}
                    {stepGroups.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {stepGroups.map(group => (
                          <div key={group.phase} className="mb-2">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                              {group.label}
                            </div>
                            <div className="space-y-1">
                              {group.items.map(step => (
                                <div
                                  key={step.id}
                                  className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${
                                      step.type === 'expense' ? 'bg-red-400' : 'bg-emerald-400'
                                    }`}></span>
                                    <span className="truncate max-w-[180px]">
                                      {step.code ? step.code : step.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-gray-600">
                                      {formatCurrency(step.amount)}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                      step.isDone 
                                        ? 'bg-emerald-100 text-emerald-700' 
                                        : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                      {step.isDone ? '✅ Fait' : 'À faire'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                                        {/* Aperçu transactions projet */}
                    {projectTransactions.filter(t => t.projectid === project.id).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {projectTransactions
                            .filter(t => t.projectid === project.id)
                            .slice(0, 3)
                            .map((t, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                              >
                                {t.type === 'income' ? '+' : '-'}{formatCurrency(parseFloat(t.amount))}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Best Practices */}
          <div className="mt-8 p-8 rounded-2xl border-t-2 border-purple-200 bg-gradient-to-r from-purple-50/50 to-pink-50/50">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8">
              <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
                <Target size={32} className="text-purple-600 shrink-0" />
                Best Practices Operator
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* 1. Documenter */}
                <div className="group flex items-start gap-4 p-6 bg-white/70 hover:bg-white hover:shadow-lg rounded-xl border border-purple-200 hover:border-purple-300 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-3xl flex-shrink-0 mt-1">💰</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl text-gray-900 mb-2 group-hover:text-purple-700">
                      Documenter avant automatiser
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      Ne jamais automatiser un processus mal défini
                    </div>
                  </div>
                </div>

                {/* 2. Revue hebdo */}
                <div className="group flex items-start gap-4 p-6 bg-white/70 hover:bg-white hover:shadow-lg rounded-xl border border-pink-200 hover:border-pink-300 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-3xl flex-shrink-0 mt-1">📈</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl text-gray-900 mb-2 group-hover:text-pink-700">
                      Revue hebdo stand-up
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      15 min pour faire le point sur l'exécution
                    </div>
                  </div>
                </div>

                {/* 3. Rétro bi-mensuelle */}
                <div className="group flex items-start gap-4 p-6 bg-white/70 hover:bg-white hover:shadow-lg rounded-xl border border-indigo-200 hover:border-indigo-300 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-3xl flex-shrink-0 mt-1">📝</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl text-gray-900 mb-2 group-hover:text-indigo-700">
                      Rétro bi-mensuelle
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      Qu'est-ce qui fonctionne ? Qu'est-ce qui coince ?
                    </div>
                  </div>
                </div>

                {/* 4. SOP 1 page */}
                <div className="group flex items-start gap-4 p-6 bg-white/70 hover:bg-white hover:shadow-lg rounded-xl border border-emerald-200 hover:border-emerald-300 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-3xl flex-shrink-0 mt-1">📄</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl text-gray-900 mb-2 group-hover:text-emerald-700">
                      Une SOP = 1 page max
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      But • Entrées • Étapes • Checkpoints • Responsables
                    </div>
                  </div>
                </div>

                {/* 5. 3 outils max */}
                <div className="group flex items-start gap-4 p-6 bg-white/70 hover:bg-white hover:shadow-lg rounded-xl border border-blue-200 hover:border-blue-300 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-3xl flex-shrink-0 mt-1">🛠️</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl text-gray-900 mb-2 group-hover:text-blue-700">
                      Standardiser 3 outils max
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      Éviter la multiplication des plateformes
                    </div>
                  </div>
                </div>

                {/* 6. Mesurer */}
                <div className="group flex items-start gap-4 p-6 bg-white/70 hover:bg-white hover:shadow-lg rounded-xl border border-yellow-200 hover:border-yellow-300 transition-all duration-300 hover:-translate-y-1">
                  <div className="text-3xl flex-shrink-0 mt-1">✅</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xl text-gray-900 mb-2 group-hover:text-yellow-700">
                      Mesurer pour améliorer
                    </div>
                    <div className="text-gray-700 leading-relaxed">
                      Temps, qualité, coûts - Track everything
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-gray-600">
              <strong>⚡ Prêt pour l'exécution</strong> • {stats.activeSOPs} SOPs actives • {stats.pendingTasks} tâches en cours • {projectStats.active} projets
            </div>
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm"
            >
              Fermer Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedSOP && (
        <SOPDetailsModal
          sop={selectedSOP}
          onClose={() => setSelectedSOP(null)}
          onUpdate={handleUpdateSOP}
        />
      )}

      {showSOPModal && (
        <SOPCreateModal
          onClose={() => setShowSOPModal(false)}
          onCreate={handleCreateSOP}
        />
      )}

      {showTaskModal && (
        <TaskCreateModal
          onClose={() => setShowTaskModal(false)}
          onCreate={handleCreateTask}
          sops={sops}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANTS MODALS
// ============================================

function SOPDetailsModal({ sop, onClose, onUpdate }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold">{sop.title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <p className="text-gray-600 mb-4">{sop.description}</p>

        <div className="space-y-4 text-sm">
          <div>
            <strong>Responsable:</strong> {sop.owner}
          </div>
          <div>
            <strong>DurÃ©e moyenne:</strong> {sop.avg_time || sop.avgtime} jours
          </div>
          <div>
            <strong>Statut:</strong>{' '}
            <span className={`px-2 py-1 rounded text-xs font-semibold ${
              sop.status === 'active' ? 'bg-green-100 text-green-700' :
              sop.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {sop.status}
            </span>
          </div>
          <div>
            <strong>CatÃ©gorie:</strong> {sop.category}
          </div>

          {/* âœ… Ã‰TAPES - CORRECTION ICI */}
          {sop.steps && Array.isArray(sop.steps) && sop.steps.length > 0 && (
            <div>
              <strong className="block mb-2">Étapes ({sop.steps.length}):</strong>
              <div className="space-y-2">
                {sop.steps.map((step, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-purple-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {step.order || index + 1}
                      </span>
                      <strong className="text-gray-900">{step.title}</strong>
                    </div>
                    <p className="text-gray-600 text-xs ml-8">{step.description}</p>
                    <span className="text-xs text-gray-500 ml-8">â±ï¸ {step.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* âœ… CHECKLIST - CORRECTION ICI */}
          {sop.checklist && Array.isArray(sop.checklist) && sop.checklist.length > 0 && (
            <div>
              <strong className="block mb-2">Checklist ({sop.checklist.length}):</strong>
              <div className="space-y-1">
                {sop.checklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`check-${index}`}
                      className="w-4 h-4"
                    />
                    <label htmlFor={`check-${index}`} className="text-gray-700">
                      {item.item}
                      {item.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function SOPCreateModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    owner: '',
    steps: [],
    avg_time: '',
    status: 'draft',
    category: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="text-xl font-bold mb-4">Nouvelle SOP</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Titre de la SOP"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            rows={3}
          />
          <input
            type="text"
            placeholder="Responsable"
            value={formData.owner}
            onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
          <input
            type="text"
            placeholder="CatÃ©gorie"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
                    <input
            type="number"
            placeholder="DurÃ©e moyenne (jours)"
            value={formData.avg_time}
            onChange={(e) => setFormData({ ...formData, avg_time: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700"
            >
              CrÃ©er
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskCreateModal({ onClose, onCreate, sops = [] }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
    status: 'todo',
    sop_id: null
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6">
        <h3 className="text-xl font-bold mb-4">Nouvelle TÃ¢che</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Titre de la tÃ¢che"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
          <textarea
            placeholder="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            rows={3}
          />
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="low">PrioritÃ© Faible</option>
            <option value="medium">PrioritÃ© Moyenne</option>
            <option value="high">PrioritÃ© Haute</option>
            <option value="critical">PrioritÃ© Critique</option>
          </select>
          <input
            type="date"
            value={formData.due_date}
            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
          <input
            type="text"
            placeholder="AssignÃ© à"
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="todo">À faire</option>
            <option value="in-progress">En cours</option>
            <option value="done">TerminÃ©</option>
          </select>
          <select
            value={formData.sop_id || ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              sop_id: e.target.value ? parseInt(e.target.value, 10) : null 
            })}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">Aucune SOP liÃ©e</option>
            {sops.map(sop => (
              <option key={sop.id} value={sop.id}>
                {sop.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-pink-600 text-white py-2 rounded-lg hover:bg-pink-700"
            >
              CrÃ©er
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}