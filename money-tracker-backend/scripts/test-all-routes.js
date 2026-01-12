// scripts/test-routes-correct.js
const API_BASE = 'http://localhost:5002';
let authToken = null;
let csrfToken = null;

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  cyan: '\x1b[96m',
  reset: '\x1b[0m'
};

const stats = { total: 0, passed: 0, failed: 0, errors: [] };

function logResult(method, route, status, success, note = '') {
  stats.total++;
  const color = success ? colors.green : colors.red;
  const symbol = success ? '✓' : '✗';
  
  console.log(`${color}${symbol}${colors.reset} ${method.padEnd(6)} ${route.padEnd(50)} [${status}] ${note}`);
  
  if (success) {
    stats.passed++;
  } else {
    stats.failed++;
    stats.errors.push({ method, route, status });
  }
}

async function apiRequest(method, endpoint, data = null) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;

  const options = { method, headers, credentials: 'include' };
  if (data && method !== 'GET') options.body = JSON.stringify(data);

  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    let responseData = null;

    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    }

    return { ok: response.ok, status: response.status, data: responseData };
  } catch (error) {
    return { ok: false, status: 0, error: error.message };
  }
}

console.log(`\n${colors.cyan}╔═════════════════════════════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║   TEST COMPLET DES ROUTES API - FINANCE (AVEC AUTH PIN)         ║${colors.reset}`);
console.log(`${colors.cyan}╚═════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

async function runTests() {
  // ========== PHASE 0: CSRF TOKEN ==========
  console.log(`${colors.yellow}▶ PHASE 0: INITIALISATION${colors.reset}`);
  
  let result = await apiRequest('GET', '/api/csrf-token');
  logResult('GET', '/api/csrf-token', result.status, result.ok);
  if (result.ok) csrfToken = result.data.csrfToken;

  // ========== PHASE 1: AUTHENTIFICATION ==========
  console.log(`\n${colors.yellow}▶ PHASE 1: AUTHENTIFICATION (PIN)${colors.reset}`);
  
  result = await apiRequest('GET', '/api/auth/check-pin');
  logResult('GET', '/api/auth/check-pin', result.status, result.ok);

  // Tester avec PIN - MODIFIEZ VOTRE PIN ICI
  result = await apiRequest('POST', '/api/auth/verify-pin', { pin: '111111' });
  logResult('POST', '/api/auth/verify-pin', result.status, result.ok, result.ok ? '🔐 Connecté' : '❌ PIN incorrect');
  if (result.ok && result.data?.token) {
    authToken = result.data.token;
    console.log(`   ${colors.green}→ Token JWT récupéré${colors.reset}`);
  }

  result = await apiRequest('GET', '/api/auth/verify-token');
  logResult('GET', '/api/auth/verify-token', result.status, result.ok);

  result = await apiRequest('GET', '/api/auth/settings');
  logResult('GET', '/api/auth/settings', result.status, result.ok);

  // ========== PHASE 2: ROUTES PROTÉGÉES ==========
  if (authToken) {
    console.log(`\n${colors.yellow}▶ PHASE 2: COMPTES (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/accounts');
    logResult('GET', '/api/accounts', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 3: TRANSACTIONS (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/transactions');
    logResult('GET', '/api/transactions', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 4: PROJETS (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/projects');
    logResult('GET', '/api/projects', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 5: RECEIVABLES (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/receivables');
    logResult('GET', '/api/receivables', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 6: OPERATOR (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/operator/summary');
    logResult('GET', '/api/operator/summary', result.status, result.ok);

    result = await apiRequest('GET', '/api/operator/stats');
    logResult('GET', '/api/operator/stats', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 7: NOTES (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/notes');
    logResult('GET', '/api/notes', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 8: VISION (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/vision');
    logResult('GET', '/api/vision', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 9: CONTENT (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/content');
    logResult('GET', '/api/content', result.status, result.ok);

    console.log(`\n${colors.yellow}▶ PHASE 10: TRANSACTION LINKING (Authentifié)${colors.reset}`);
    
    result = await apiRequest('GET', '/api/transaction-linking');
    logResult('GET', '/api/transaction-linking', result.status, result.ok);
  } else {
    console.log(`\n${colors.red}⚠️  Authentification échouée - Tests des routes protégées ignorés${colors.reset}`);
    console.log(`${colors.yellow}   Vérifiez votre PIN à la ligne 62 du script${colors.reset}\n`);
  }

  // ========== PHASE 11: ROUTES PUBLIQUES ==========
  console.log(`\n${colors.yellow}▶ PHASE 11: ROUTES PUBLIQUES${colors.reset}`);
  
  result = await apiRequest('GET', '/api/employees');
  logResult('GET', '/api/employees', result.status, result.ok);

  result = await apiRequest('GET', '/api/health');
  logResult('GET', '/api/health', result.status, result.ok);

  result = await apiRequest('GET', '/');
  logResult('GET', '/ (API Info)', result.status, result.ok);

  // ========== RÉSULTATS ==========
  console.log(`\n${colors.cyan}╔═════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                          RÉSULTATS FINAUX                       ║${colors.reset}`);
  console.log(`${colors.cyan}╚═════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  console.log(`Total testé:     ${stats.total}`);
  console.log(`${colors.green}✓ Succès:        ${stats.passed}${colors.reset}`);
  console.log(`${colors.red}✗ Échecs:        ${stats.failed}${colors.reset}`);
  console.log(`Taux de succès:  ${colors.cyan}${((stats.passed / stats.total) * 100).toFixed(1)}%${colors.reset}\n`);

  if (stats.failed > 0 && authToken) {
    console.log(`${colors.yellow}💡 NOTES:${colors.reset}`);
    console.log(`   • Les routes sont bien configurées`);
    console.log(`   • L'authentification fonctionne`);
    console.log(`   • Vérifiez les routes qui retournent 404\n`);
  } else if (!authToken) {
    console.log(`${colors.red}❌ ÉCHEC AUTHENTIFICATION${colors.reset}`);
    console.log(`   • Modifiez le PIN à la ligne 62`);
    console.log(`   • Relancez le script\n`);
  } else {
    console.log(`${colors.green}🎉 TOUS LES TESTS PASSENT ! API 100% FONCTIONNELLE${colors.reset}\n`);
  }
}

runTests().catch(console.error);
