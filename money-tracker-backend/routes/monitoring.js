const express = require('express');
const router = express.Router();
const os = require('os');
const pool = require('../config/database');
const cacheService = require('../services/cacheService');

/**
 * Endpoint de monitoring complet
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await collectMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Collecte de toutes les métriques
 */
async function collectMetrics() {
  const [systemMetrics, dbMetrics, cacheMetrics, appMetrics] = await Promise.all([
    getSystemMetrics(),
    getDatabaseMetrics(),
    getCacheMetrics(),
    getApplicationMetrics()
  ]);

  return {
    timestamp: new Date().toISOString(),
    system: systemMetrics,
    database: dbMetrics,
    cache: cacheMetrics,
    application: appMetrics,
    health: calculateHealthScore(systemMetrics, dbMetrics, cacheMetrics)
  };
}

/**
 * Métriques système
 */
function getSystemMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    uptime: process.uptime(),
    cpu: {
      count: cpus.length,
      model: cpus[0].model,
      usage: calculateCpuUsage(cpus)
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: ((usedMem / totalMem) * 100).toFixed(2),
      totalHuman: formatBytes(totalMem),
      usedHuman: formatBytes(usedMem),
      freeHuman: formatBytes(freeMem)
    },
    process: {
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      memoryUsageHuman: {
        rss: formatBytes(process.memoryUsage().rss),
        heapTotal: formatBytes(process.memoryUsage().heapTotal),
        heapUsed: formatBytes(process.memoryUsage().heapUsed),
        external: formatBytes(process.memoryUsage().external)
      }
    },
    loadAverage: os.loadavg()
  };
}

/**
 * Métriques base de données
 */
async function getDatabaseMetrics() {
  try {
    const startTime = Date.now();
    
    // Test de connexion
    await pool.query('SELECT NOW()');
    const responseTime = Date.now() - startTime;

    // Statistiques des tables - ✅ CORRIGÉ
    const tablesStats = await pool.query(`
      SELECT 
        schemaname,
        relname as tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||relname) DESC
      LIMIT 10
    `);

    // Connexions actives
    const connections = await pool.query(`
      SELECT count(*) as total,
             count(*) FILTER (WHERE state = 'active') as active,
             count(*) FILTER (WHERE state = 'idle') as idle
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    // Taille de la base
    const dbSize = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);

    return {
      status: 'connected',
      responseTime: `${responseTime}ms`,
      connections: connections.rows[0],
      databaseSize: dbSize.rows[0].size,
      topTables: tablesStats.rows,
      poolSize: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
      }
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}


/**
 * Métriques Redis
 */
async function getCacheMetrics() {
  if (!cacheService.isConnected) {
    return {
      status: 'disconnected',
      message: 'Redis non disponible'
    };
  }

  try {
    const info = await cacheService.client.info();
    const dbsize = await cacheService.client.dbSize();
    
    // Parser les infos Redis
    const stats = parseRedisInfo(info);

    return {
      status: 'connected',
      keyCount: dbsize,
      memory: stats.memory,
      stats: stats.stats,
      hitRate: calculateHitRate(stats.stats)
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Métriques application
 */
async function getApplicationMetrics() {
  try {
    const [
      accountsCount,
      transactionsCount,
      projectsCount,
      receivablesCount
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM accounts'),
      pool.query('SELECT COUNT(*) as count FROM transactions'),
      pool.query('SELECT COUNT(*) as count FROM projects'),
      pool.query('SELECT COUNT(*) as count FROM receivables')
    ]);

    return {
      entities: {
        accounts: parseInt(accountsCount.rows[0].count),
        transactions: parseInt(transactionsCount.rows[0].count),
        projects: parseInt(projectsCount.rows[0].count),
        receivables: parseInt(receivablesCount.rows[0].count)
      },
      uptime: {
        seconds: Math.floor(process.uptime()),
        human: formatUptime(process.uptime())
      }
    };
  } catch (error) {
    return {
      error: error.message
    };
  }
}

/**
 * Helpers
 */
function calculateCpuUsage(cpus) {
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);

  return `${usage}%`;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function parseRedisInfo(info) {
  const lines = info.split('\r\n');
  const stats = {};
  
  lines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split(':');
      stats[key] = value;
    }
  });

  return {
    memory: {
      used: stats.used_memory_human,
      peak: stats.used_memory_peak_human,
      fragmentation: stats.mem_fragmentation_ratio
    },
    stats: {
      hits: parseInt(stats.keyspace_hits) || 0,
      misses: parseInt(stats.keyspace_misses) || 0,
      commands: parseInt(stats.total_commands_processed) || 0
    }
  };
}

function calculateHitRate(stats) {
  const total = stats.hits + stats.misses;
  if (total === 0) return '0%';
  return `${((stats.hits / total) * 100).toFixed(2)}%`;
}

function calculateHealthScore(system, db, cache) {
  let score = 100;

  // Pénalités
  if (parseFloat(system.memory.usagePercent) > 80) score -= 20;
  if (parseFloat(system.memory.usagePercent) > 90) score -= 30;
  if (db.status !== 'connected') score -= 40;
  if (cache.status !== 'connected') score -= 10;

  return {
    score: Math.max(0, score),
    status: score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'critical'
  };
}

module.exports = router;
