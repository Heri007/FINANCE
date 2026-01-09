// money-tracker-backend/tests/stress-test.js

/**
 * FINANCE APP - STRESS TEST SUITE
 * Tests de charge et de performance pour l'API
 * 
 * Installation requise:
 * npm install --save-dev artillery autocannon clinic
 */

const autocannon = require('autocannon');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  url: process.env.API_URL || 'http://localhost:5002',
  duration: 60, // secondes
  connections: 100, // connexions simultanées
  pipelining: 10,
  workers: 4
};

// Couleurs pour console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logger avec couleurs
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`)
};

// Token JWT pour authentification
let authToken = null;

/**
 * Obtenir un token d'authentification
 */
async function getAuthToken() {
  try {
    const response = await fetch(`${CONFIG.url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@test.com',
        password: 'password123'
      })
    });
    
    if (!response.ok) {
      throw new Error('Échec authentification');
    }
    
    const data = await response.json();
    authToken = data.token;
    log.success('Token d\'authentification obtenu');
    return authToken;
  } catch (error) {
    log.error(`Erreur authentification: ${error.message}`);
    throw error;
  }
}

/**
 * Test 1: Endpoints GET (Lecture)
 */
async function testReadEndpoints() {
  log.title('TEST 1: LECTURE DES DONNÉES (GET)');
  
  const endpoints = [
    '/api/accounts',
    '/api/transactions',
    '/api/projects',
    '/api/receivables',
    '/api/employees'
  ];

  const results = [];

  for (const endpoint of endpoints) {
    log.info(`Testing ${endpoint}...`);
    
    const instance = autocannon({
      url: `${CONFIG.url}${endpoint}`,
      connections: 50,
      duration: 30,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await promisify(instance.track.bind(instance))();
    
    results.push({
      endpoint,
      ...formatResults(result)
    });

    // Pause entre tests
    await sleep(2000);
  }

  displayResults('Endpoints GET', results);
  return results;
}

/**
 * Test 2: Création de Transactions (POST)
 */
async function testCreateTransactions() {
  log.title('TEST 2: CRÉATION DE TRANSACTIONS (POST)');

  const instance = autocannon({
    url: `${CONFIG.url}/api/transactions`,
    connections: 30,
    duration: 30,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      account_id: 1,
      type: 'expense',
      amount: Math.floor(Math.random() * 10000),
      category: 'Test Stress',
      description: `Transaction stress test ${Date.now()}`,
      transaction_date: new Date().toISOString().split('T')[0]
    })
  });

  const result = await promisify(instance.track.bind(instance))();
  const formatted = formatResults(result);
  
  displayResults('POST Transactions', [{ endpoint: '/api/transactions', ...formatted }]);
  return formatted;
}

/**
 * Test 3: Requêtes Complexes (Projets avec Calculs)
 */
async function testComplexQueries() {
  log.title('TEST 3: REQUÊTES COMPLEXES (Projets & Analytics)');

  const endpoints = [
    '/api/projects?include=progress',
    '/api/transactions?account_id=1&start_date=2026-01-01&end_date=2026-12-31',
    '/api/projects/1/progress',
  ];

  const results = [];

  for (const endpoint of endpoints) {
    log.info(`Testing ${endpoint}...`);
    
    const instance = autocannon({
      url: `${CONFIG.url}${endpoint}`,
      connections: 20,
      duration: 20,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await promisify(instance.track.bind(instance))();
    
    results.push({
      endpoint,
      ...formatResults(result)
    });

    await sleep(2000);
  }

  displayResults('Requêtes Complexes', results);
  return results;
}

/**
 * Test 4: Import CSV (Charge Lourde)
 */
async function testCSVImport() {
  log.title('TEST 4: IMPORT CSV MASSIF');

  // Générer fichier CSV de test
  const csvData = generateTestCSV(1000); // 1000 transactions
  const csvPath = path.join(__dirname, 'test-import.csv');
  fs.writeFileSync(csvPath, csvData);

  log.info('Fichier CSV généré: 1000 transactions');

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream(csvPath));
  form.append('account_id', '1');

  const startTime = Date.now();

  try {
    const response = await fetch(`${CONFIG.url}/api/transactions/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        ...form.getHeaders()
      },
      body: form
    });

    const duration = Date.now() - startTime;
    const result = await response.json();

    log.success(`Import terminé en ${duration}ms`);
    log.info(`Transactions importées: ${result.imported || 'N/A'}`);
    log.info(`Doublons ignorés: ${result.duplicates || 'N/A'}`);

    // Nettoyer
    fs.unlinkSync(csvPath);

    return {
      duration,
      imported: result.imported,
      duplicates: result.duplicates,
      throughput: (1000 / (duration / 1000)).toFixed(2)
    };
  } catch (error) {
    log.error(`Erreur import: ${error.message}`);
    if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
    throw error;
  }
}

/**
 * Test 5: Charge Soutenue (Spike Test)
 */
async function testSpikeLoad() {
  log.title('TEST 5: CHARGE SOUTENUE (Spike Test)');

  const phases = [
    { connections: 10, duration: 10, label: 'Warm-up' },
    { connections: 50, duration: 20, label: 'Normal' },
    { connections: 200, duration: 30, label: 'SPIKE' },
    { connections: 50, duration: 20, label: 'Recovery' },
    { connections: 10, duration: 10, label: 'Cool-down' }
  ];

  const results = [];

  for (const phase of phases) {
    log.info(`Phase: ${phase.label} (${phase.connections} connexions, ${phase.duration}s)`);

    const instance = autocannon({
      url: `${CONFIG.url}/api/transactions`,
      connections: phase.connections,
      duration: phase.duration,
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const result = await promisify(instance.track.bind(instance))();
    
    results.push({
      phase: phase.label,
      connections: phase.connections,
      ...formatResults(result)
    });
  }

  displayResults('Spike Test', results);
  return results;
}

/**
 * Test 6: Concurrence Base de Données
 */
async function testDatabaseConcurrency() {
  log.title('TEST 6: CONCURRENCE BASE DE DONNÉES');

  log.info('Test de liaisons transaction-projet simultanées...');

  const instance = autocannon({
    url: `${CONFIG.url}/api/transactions/1/link`,
    connections: 50,
    duration: 20,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      line_id: 1,
      user: 'stress-test'
    })
  });

  const result = await promisify(instance.track.bind(instance))();
  const formatted = formatResults(result);
  
  displayResults('Concurrence DB', [{ 
    endpoint: 'Transaction Linking', 
    ...formatted 
  }]);
  
  return formatted;
}

/**
 * Test 7: Rate Limiting
 */
async function testRateLimiting() {
  log.title('TEST 7: RATE LIMITING');

  log.info('Test dépassement des limites...');

  const instance = autocannon({
    url: `${CONFIG.url}/api/accounts`,
    connections: 200,
    duration: 10,
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const result = await promisify(instance.track.bind(instance))();
  const formatted = formatResults(result);
  
  log.info(`Requêtes bloquées (429): ${formatted.errors429 || 'N/A'}`);
  
  displayResults('Rate Limiting', [{ 
    endpoint: 'Rate Limit Test', 
    ...formatted 
  }]);
  
  return formatted;
}

/**
 * Formater les résultats autocannon
 */
function formatResults(result) {
  return {
    totalRequests: result.requests.total,
    requestsPerSec: result.requests.average.toFixed(2),
    throughput: `${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`,
    latencyAvg: `${result.latency.mean.toFixed(2)} ms`,
    latencyP99: `${result.latency.p99.toFixed(2)} ms`,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    errors429: result['4xx'] || 0
  };
}

/**
 * Afficher les résultats sous forme de tableau
 */
function displayResults(title, results) {
  console.log(`\n${colors.bright}${colors.magenta}📊 Résultats: ${title}${colors.reset}\n`);
  console.table(results);
}

/**
 * Générer CSV de test
 */
function generateTestCSV(rows) {
  const header = 'date,description,amount,category,type\n';
  const lines = [];

  for (let i = 0; i < rows; i++) {
    const date = new Date(2026, 0, Math.floor(Math.random() * 30) + 1)
      .toISOString().split('T')[0];
    const amount = (Math.random() * 100000).toFixed(2);
    const type = Math.random() > 0.5 ? 'income' : 'expense';
    const categories = ['Nourriture', 'Transport', 'Logement', 'Loisirs', 'Santé'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    lines.push(`${date},"Transaction test ${i}",${amount},${category},${type}`);
  }

  return header + lines.join('\n');
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Générer rapport HTML
 */
function generateHTMLReport(allResults) {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FINANCE - Stress Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 1.1em;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .stat-card h3 {
            font-size: 0.9em;
            opacity: 0.9;
            margin-bottom: 10px;
        }
        .stat-card .value {
            font-size: 2.5em;
            font-weight: bold;
                .test-section {
            margin-bottom: 40px;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 15px;
            border-left: 5px solid #667eea;
        }
        .test-section h2 {
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.8em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        th {
            background: #667eea;
            color: white;
            padding: 15px;
            text-align: left;
            font-weight: 600;
        }
        td {
            padding: 15px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .status-good { color: #28a745; font-weight: bold; }
        .status-warning { color: #ffc107; font-weight: bold; }
        .status-bad { color: #dc3545; font-weight: bold; }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            color: #666;
        }
        .chart {
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>💰 FINANCE - Stress Test Report</h1>
        <p class="subtitle">Généré le ${new Date().toLocaleString('fr-FR')}</p>
        
        <div class="summary">
            <div class="stat-card">
                <h3>Total Requêtes</h3>
                <div class="value">${allResults.totalRequests || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Req/sec Moyenne</h3>
                <div class="value">${allResults.avgReqPerSec || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Latence Moyenne</h3>
                <div class="value">${allResults.avgLatency || 0}<small>ms</small></div>
            </div>
            <div class="stat-card">
                <h3>Taux d'Erreur</h3>
                <div class="value">${allResults.errorRate || 0}<small>%</small></div>
            </div>
        </div>

        ${Object.entries(allResults.tests).map(([testName, results]) => `
            <div class="test-section">
                <h2>${testName}</h2>
                ${Array.isArray(results) ? `
                    <table>
                        <thead>
                            <tr>
                                <th>Endpoint</th>
                                <th>Requêtes Totales</th>
                                <th>Req/sec</th>
                                <th>Latence Moy.</th>
                                <th>P99</th>
                                <th>Erreurs</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${results.map(r => `
                                <tr>
                                    <td>de>${r.endpoint || r.phase || 'N/A'}</code></td>
                                    <td>${r.totalRequests || 'N/A'}</td>
                                    <td>${r.requestsPerSec || 'N/A'}</td>
                                    <td>${r.latencyAvg || 'N/A'}</td>
                                    <td>${r.latencyP99 || 'N/A'}</td>
                                    <td>${r.errors || 0}</td>
                                    <td class="${getStatusClass(r)}">${getStatus(r)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <div class="chart">
                        <pre>${JSON.stringify(results, null, 2)}</pre>
                    </div>
                `}
            </div>
        `).join('')}

        <div class="footer">
            <p><strong>FINANCE Application</strong> - Stress Test Suite v1.0</p>
            <p>Développé avec ❤️ à Antananarivo, Madagascar 🇲🇬</p>
        </div>
    </div>

    <script>
        function getStatusClass(result) {
            const errors = result.errors || 0;
            const latency = parseFloat(result.latencyAvg) || 0;
            
            if (errors > 10 || latency > 1000) return 'status-bad';
            if (errors > 5 || latency > 500) return 'status-warning';
            return 'status-good';
        }

        function getStatus(result) {
            const errors = result.errors || 0;
            const latency = parseFloat(result.latencyAvg) || 0;
            
            if (errors > 10 || latency > 1000) return '❌ Critique';
            if (errors > 5 || latency > 500) return '⚠️ Attention';
            return '✅ Excellent';
        }
    </script>
</body>
</html>
  `;

  const reportPath = path.join(__dirname, 'stress-test-report.html');
  fs.writeFileSync(reportPath, html);
  log.success(`Rapport HTML généré: ${reportPath}`);
  
  return reportPath;
}

/**
 * Fonction principale
 */
async function runStressTests() {
  console.clear();
  log.title('🚀 FINANCE APP - STRESS TEST SUITE');
  
  log.info(`URL: ${CONFIG.url}`);
  log.info(`Durée: ${CONFIG.duration}s par test`);
  log.info(`Connexions: ${CONFIG.connections}`);
  log.info(`Workers: ${CONFIG.workers}\n`);

  const allResults = {
    startTime: new Date().toISOString(),
    tests: {},
    totalRequests: 0,
    avgReqPerSec: 0,
    avgLatency: 0,
    errorRate: 0
  };

  try {
    // Authentification
    await getAuthToken();
    await sleep(1000);

    // Test 1: Lecture
    const test1 = await testReadEndpoints();
    allResults.tests['Test 1: Endpoints GET'] = test1;
    await sleep(3000);

    // Test 2: Création
    const test2 = await testCreateTransactions();
    allResults.tests['Test 2: POST Transactions'] = [test2];
    await sleep(3000);

    // Test 3: Requêtes complexes
    const test3 = await testComplexQueries();
    allResults.tests['Test 3: Requêtes Complexes'] = test3;
    await sleep(3000);

    // Test 4: Import CSV
    log.info('Lancement test import CSV...');
    const test4 = await testCSVImport();
    allResults.tests['Test 4: Import CSV'] = test4;
    await sleep(3000);

    // Test 5: Spike
    const test5 = await testSpikeLoad();
    allResults.tests['Test 5: Spike Test'] = test5;
    await sleep(3000);

    // Test 6: Concurrence DB
    const test6 = await testDatabaseConcurrency();
    allResults.tests['Test 6: Concurrence DB'] = [test6];
    await sleep(3000);

    // Test 7: Rate Limiting
    const test7 = await testRateLimiting();
    allResults.tests['Test 7: Rate Limiting'] = [test7];

    // Calculer statistiques globales
    const allTestResults = [
      ...test1,
      test2,
      ...test3,
      test6,
      test7
    ];

    allResults.totalRequests = allTestResults.reduce(
      (sum, r) => sum + (parseInt(r.totalRequests) || 0), 0
    );
    
    allResults.avgReqPerSec = (
      allTestResults.reduce(
        (sum, r) => sum + (parseFloat(r.requestsPerSec) || 0), 0
      ) / allTestResults.length
    ).toFixed(2);

    allResults.avgLatency = (
      allTestResults.reduce(
        (sum, r) => sum + (parseFloat(r.latencyAvg) || 0), 0
      ) / allTestResults.length
    ).toFixed(2);

    const totalErrors = allTestResults.reduce(
      (sum, r) => sum + (r.errors || 0), 0
    );
    allResults.errorRate = (
      (totalErrors / allResults.totalRequests) * 100
    ).toFixed(2);

    allResults.endTime = new Date().toISOString();

    // Générer rapport
    log.title('📊 GÉNÉRATION DU RAPPORT');
    const reportPath = generateHTMLReport(allResults);
    
    // Sauvegarder JSON
    const jsonPath = path.join(__dirname, 'stress-test-results.json');
    fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));
    log.success(`Résultats JSON sauvegardés: ${jsonPath}`);

    // Résumé final
    log.title('📈 RÉSUMÉ FINAL');
    console.log(`
${colors.bright}Statistiques Globales:${colors.reset}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Requêtes:      ${colors.cyan}${allResults.totalRequests}${colors.reset}
  Req/sec Moyenne:     ${colors.cyan}${allResults.avgReqPerSec}${colors.reset}
  Latence Moyenne:     ${colors.cyan}${allResults.avgLatency} ms${colors.reset}
  Taux d'Erreur:       ${allResults.errorRate > 5 ? colors.red : colors.green}${allResults.errorRate}%${colors.reset}
  
  Début:               ${allResults.startTime}
  Fin:                 ${allResults.endTime}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${colors.green}✓ Tests terminés avec succès!${colors.reset}
${colors.blue}📄 Ouvrez le rapport: ${reportPath}${colors.reset}
    `);

    process.exit(0);

  } catch (error) {
    log.error(`Erreur durant les tests: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Helper pour status
function getStatusClass(result) {
  const errors = result.errors || 0;
  const latency = parseFloat(result.latencyAvg) || 0;
  
  if (errors > 10 || latency > 1000) return 'status-bad';
  if (errors > 5 || latency > 500) return 'status-warning';
  return 'status-good';
}

function getStatus(result) {
  const errors = result.errors || 0;
  const latency = parseFloat(result.latencyAvg) || 0;
  
  if (errors > 10 || latency > 1000) return '❌ Critique';
  if (errors > 5 || latency > 500) return '⚠️ Attention';
  return '✅ Excellent';
}

// Exécuter si appelé directement
if (require.main === module) {
  runStressTests();
}

// Exports pour utilisation programmatique
module.exports = {
  runStressTests,
  testReadEndpoints,
  testCreateTransactions,
  testComplexQueries,
  testCSVImport,
  testSpikeLoad,
  testDatabaseConcurrency,
  testRateLimiting
};
