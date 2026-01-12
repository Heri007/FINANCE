import React, { useState, useEffect } from 'react';
import { Activity, Database, Cpu, HardDrive, Zap, AlertCircle, RefreshCw } from 'lucide-react';

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // États pour l'audit
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilter, setAuditFilter] = useState({
    table: 'all',
    operation: 'all',
    limit: 20
  });

  useEffect(() => {
    fetchMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:5002/api/monitoring/metrics');
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const data = await response.json();
      setMetrics(data);
      setLastUpdate(new Date());
      setLoading(false);
      setError(null);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Fonction pour charger l'historique d'audit
  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    
    try {
      const params = new URLSearchParams();
      
      if (auditFilter.table !== 'all') {
        params.append('table', auditFilter.table);
      }
      
      if (auditFilter.operation !== 'all') {
        params.append('operation', auditFilter.operation);
      }
      
      params.append('limit', auditFilter.limit);

      const response = await fetch(
        `http://localhost:5002/api/audit?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      setAuditLogs(data.data || []);
      setAuditLoading(false);

    } catch (err) {
      console.error('Erreur chargement audit:', err);
      setAuditLoading(false);
    }
  };

  // Charger l'audit au montage et quand les filtres changent
  useEffect(() => {
    fetchAuditLogs();
  }, [auditFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des métriques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-900 text-lg mb-2">Erreur de connexion</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <button
                onClick={fetchMetrics}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'bg-gradient-to-r from-green-500 to-green-600';
      case 'degraded': return 'bg-gradient-to-r from-yellow-500 to-yellow-600';
      case 'critical': return 'bg-gradient-to-r from-red-500 to-red-600';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'connected': 'bg-green-100 text-green-700',
      'disconnected': 'bg-gray-100 text-gray-600',
      'error': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Monitoring Système</h1>
              <p className="text-sm text-gray-500 mt-1">
                Dernière mise à jour: {lastUpdate?.toLocaleTimeString('fr-FR')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">Auto-refresh (5s)</span>
            </label>
            
            <button
              onClick={fetchMetrics}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser
            </button>
          </div>
        </div>

        {/* Health Score Banner */}
        <div className={`${getHealthColor(metrics.health.status)} rounded-2xl shadow-2xl p-8 mb-8 text-white`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-xl font-semibold opacity-90 mb-3">État de Santé Global</h2>
              <div className="flex items-baseline gap-4">
                <p className="text-6xl font-bold">{metrics.health.score}</p>
                <p className="text-3xl opacity-80">/100</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl uppercase font-bold tracking-wider mb-2">
                {metrics.health.status === 'healthy' && '✓ HEALTHY'}
                {metrics.health.status === 'degraded' && '⚠ DEGRADED'}
                {metrics.health.status === 'critical' && '✗ CRITICAL'}
              </p>
              <p className="text-sm opacity-90">
                {new Date(metrics.timestamp).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Système */}
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Cpu className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Système</h3>
            </div>
            
            <div className="space-y-4">
              {/* CPU */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">CPU Usage</span>
                  <span className="font-bold text-gray-900">{metrics.system.cpu.usage}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: metrics.system.cpu.usage }}
                  ></div>
                </div>
              </div>
              
              {/* Mémoire */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Mémoire RAM</span>
                  <span className="font-bold text-gray-900">{metrics.system.memory.usagePercent}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      parseFloat(metrics.system.memory.usagePercent) > 90 ? 'bg-red-600' :
                      parseFloat(metrics.system.memory.usagePercent) > 80 ? 'bg-yellow-600' : 'bg-green-600'
                    }`}
                    style={{ width: `${metrics.system.memory.usagePercent}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Détails mémoire */}
              <div className="pt-3 space-y-2 text-xs text-gray-600 border-t">
                <div className="flex justify-between">
                  <span>Utilisée</span>
                  <span className="font-semibold text-gray-900">{metrics.system.memory.usedHuman}</span>
                </div>
                <div className="flex justify-between">
                  <span>Libre</span>
                  <span className="font-semibold text-gray-900">{metrics.system.memory.freeHuman}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total</span>
                  <span className="font-semibold text-gray-900">{metrics.system.memory.totalHuman}</span>
                </div>
              </div>
              
              {/* Uptime */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-600">Uptime</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {metrics.application.uptime.human}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PostgreSQL */}
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Database className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">PostgreSQL</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(metrics.database.status)}`}>
                  {metrics.database.status === 'connected' ? '✓ Connecté' : '✗ Déconnecté'}
                </span>
              </div>
              
              {metrics.database.status === 'connected' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Temps réponse</span>
                    <span className="font-semibold text-gray-900">{metrics.database.responseTime}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Connexions actives</span>
                    <span className="font-semibold text-gray-900">{metrics.database.connections.active}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Taille DB</span>
                    <span className="font-semibold text-gray-900">{metrics.database.databaseSize}</span>
                  </div>
                  
                  <div className="pt-3 space-y-2 text-xs text-gray-600 border-t">
                    <div className="flex justify-between">
                      <span>Pool total</span>
                      <span className="font-semibold text-gray-900">{metrics.database.poolSize.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pool idle</span>
                      <span className="font-semibold text-gray-900">{metrics.database.poolSize.idle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Pool waiting</span>
                      <span className="font-semibold text-gray-900">{metrics.database.poolSize.waiting}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">❌ Base de données déconnectée</p>
                  {metrics.database.error && (
                    <p className="text-xs mt-2 text-red-600">{metrics.database.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Redis Cache */}
          <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Redis Cache</h3>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(metrics.cache.status)}`}>
                  {metrics.cache.status === 'connected' ? '✓ Connecté' : '○ Désactivé'}
                </span>
              </div>
              
              {metrics.cache.status === 'connected' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Clés en cache</span>
                    <span className="font-semibold text-gray-900">{metrics.cache.keyCount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Mémoire utilisée</span>
                    <span className="font-semibold text-gray-900">{metrics.cache.memory.used}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Hit Rate</span>
                    <span className="font-semibold text-green-600">{metrics.cache.hitRate}</span>
                  </div>
                  
                  <div className="pt-3 space-y-2 text-xs text-gray-600 border-t">
                    <div className="flex justify-between">
                      <span>Peak Memory</span>
                      <span className="font-semibold text-gray-900">{metrics.cache.memory.peak}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fragmentation</span>
                      <span className="font-semibold text-gray-900">{metrics.cache.memory.fragmentation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commands</span>
                      <span className="font-semibold text-gray-900">{metrics.cache.stats.commands}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">○ Cache désactivé</p>
                  <p className="text-xs mt-2">Les performances peuvent être réduites</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Application Stats */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <HardDrive className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Statistiques Application</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl hover:scale-105 transition-transform">
              <p className="text-4xl font-bold text-blue-600 mb-2">
                {metrics.application.entities.accounts.toLocaleString('fr-FR')}
              </p>
              <p className="text-sm text-gray-600 font-medium">Comptes</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl hover:scale-105 transition-transform">
              <p className="text-4xl font-bold text-green-600 mb-2">
                {metrics.application.entities.transactions.toLocaleString('fr-FR')}
              </p>
              <p className="text-sm text-gray-600 font-medium">Transactions</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl hover:scale-105 transition-transform">
              <p className="text-4xl font-bold text-purple-600 mb-2">
                {metrics.application.entities.projects.toLocaleString('fr-FR')}
              </p>
              <p className="text-sm text-gray-600 font-medium">Projets</p>
            </div>
            
            <div className="text-center p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl hover:scale-105 transition-transform">
              <p className="text-4xl font-bold text-yellow-600 mb-2">
                {metrics.application.entities.receivables.toLocaleString('fr-FR')}
              </p>
              <p className="text-sm text-gray-600 font-medium">Avoirs</p>
            </div>
          </div>
        </div>

        {/* Top Tables */}
        {metrics.database.status === 'connected' && metrics.database.topTables && metrics.database.topTables.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Database className="w-5 h-5 text-purple-600" />
              Top 10 Tables PostgreSQL
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Table</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Taille</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Lignes</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.database.topTables.map((table, index) => (
                    <tr 
                      key={index} 
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                          {table.tablename}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {table.size}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {parseInt(table.row_count).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Historique d'Audit */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* En-tête */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Historique des Modifications
            </h3>
            
            {/* Filtres */}
            <div className="flex items-center gap-3">
              {/* Filtre par table */}
              <select
                value={auditFilter.table}
                onChange={(e) => setAuditFilter({ ...auditFilter, table: e.target.value })}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="all">📋 Toutes les tables</option>
                <option value="transactions">💳 Transactions</option>
                <option value="projects">📊 Projets</option>
                <option value="accounts">💰 Comptes</option>
                <option value="project_expense_lines">📉 Dépenses</option>
                <option value="project_revenue_lines">📈 Revenus</option>
                <option value="receivables">🧾 Avoirs</option>
              </select>

              {/* Filtre par opération */}
              <select
                value={auditFilter.operation}
                onChange={(e) => setAuditFilter({ ...auditFilter, operation: e.target.value })}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="all">🔄 Toutes actions</option>
                <option value="INSERT">➕ INSERT</option>
                <option value="UPDATE">✏️ UPDATE</option>
                <option value="DELETE">🗑️ DELETE</option>
              </select>

              {/* Bouton refresh */}
              <button
                onClick={fetchAuditLogs}
                disabled={auditLoading}
                className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 transition disabled:opacity-50"
                title="Actualiser"
              >
                <RefreshCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Loading */}
          {auditLoading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}

          {/* Liste des logs */}
          {!auditLoading && auditLogs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Aucune modification enregistrée</p>
            </div>
          )}

          {!auditLoading && auditLogs.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
              ))}
            </div>
          )}

          {/* Footer avec stats */}
          {!auditLoading && auditLogs.length > 0 && (
            <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-gray-500">
              <span>{auditLogs.length} modification(s) affichée(s)</span>
              <button
                onClick={() => setAuditFilter({ ...auditFilter, limit: auditFilter.limit + 20 })}
                className="text-indigo-600 hover:underline"
              >
                Voir plus
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Composant pour afficher un log
function AuditLogItem({ log }) {
  const [showDetails, setShowDetails] = useState(false);

  const getOperationColor = (operation) => {
    switch (operation) {
      case 'INSERT':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'UPDATE':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DELETE':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getOperationIcon = (operation) => {
    switch (operation) {
      case 'INSERT':
        return '➕';
      case 'UPDATE':
        return '✏️';
      case 'DELETE':
        return '🗑️';
      default:
        return '🔄';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)} h`;
    return date.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg hover:shadow-md transition-all">
      {/* En-tête du log */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center justify-between">
          {/* Gauche : Opération + Table */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getOperationColor(log.operation)}`}>
              {getOperationIcon(log.operation)} {log.operation}
            </span>
            
            <code className="text-sm bg-gray-100 px-3 py-1 rounded font-mono text-gray-800">
              {log.table_name}
            </code>

            {log.record_id && (
              <span className="text-xs text-gray-500">
                ID: <span className="font-semibold">{log.record_id}</span>
              </span>
            )}
          </div>

          {/* Droite : User + Date */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="font-medium">{log.performed_by}</span>
            <span>{formatDate(log.performed_at)}</span>
            <span className="text-gray-400">{showDetails ? '▼' : '▶'}</span>
          </div>
        </div>

        {/* Champs modifiés (UPDATE uniquement) */}
        {log.operation === 'UPDATE' && log.changed_fields && log.changed_fields.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Champs modifiés:</span>
            <div className="flex flex-wrap gap-1">
              {log.changed_fields.map((field, idx) => (
                <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {field}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Détails expandables */}
      {showDetails && (
        <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-3">
          {/* Anciennes valeurs */}
          {log.old_data && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">❌ AVANT (old_data):</p>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto max-h-40">
                {JSON.stringify(log.old_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Nouvelles valeurs */}
          {log.new_data && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">✅ APRÈS (new_data):</p>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto max-h-40">
                {JSON.stringify(log.new_data, null, 2)}
              </pre>
            </div>
          )}

          {/* Notes */}
          {log.notes && (
            <div className="text-xs text-gray-600">
              <strong>Notes:</strong> {log.notes}
            </div>
          )}

          {/* Timestamp exact */}
          <div className="text-xs text-gray-400">
            {new Date(log.performed_at).toLocaleString('fr-FR')}
          </div>
        </div>
      )}
    </div>
  );
}