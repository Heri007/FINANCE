import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Métriques personnalisées
const errorRate = new Rate('errors');

// Configuration du test
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Montée progressive à 10 users
    { duration: '1m', target: 50 },   // Montée à 50 users
    { duration: '2m', target: 50 },   // Maintien à 50 users
    { duration: '30s', target: 100 }, // Pic à 100 users
    { duration: '1m', target: 100 },  // Maintien au pic
    { duration: '30s', target: 0 },   // Descente progressive
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% des requêtes < 500ms
    'errors': ['rate<0.1'],              // Moins de 10% d'erreurs
  },
};

const BASE_URL = 'http://localhost:5002';

// Token d'authentification (à remplacer par un vrai token)
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  // Test 1: Health Check
  let response = http.get(`${BASE_URL}/api/health`);
  check(response, {
    'health check status 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 2: Get Accounts
  response = http.get(`${BASE_URL}/api/accounts`, params);
  check(response, {
    'accounts status 200': (r) => r.status === 200,
    'accounts has data': (r) => JSON.parse(r.body).length > 0,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 3: Get Transactions
  response = http.get(`${BASE_URL}/api/transactions`, params);
  check(response, {
    'transactions status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.5);

  // Test 4: Get Projects
  response = http.get(`${BASE_URL}/api/projects`, params);
  check(response, {
    'projects status 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(1);
}
