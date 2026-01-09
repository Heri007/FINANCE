import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Montée à 50 users
    { duration: '1m', target: 50 },   // Maintien
    { duration: '30s', target: 0 },   // Descente
  ],
};

const BASE_URL = 'http://localhost:5002';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Votre token

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
    },
  };

  // Test accounts
  let res = http.get(`${BASE_URL}/api/accounts`, params);
  check(res, { 'accounts OK': (r) => r.status === 200 });
  
  sleep(0.5);

  // Test transactions
  res = http.get(`${BASE_URL}/api/transactions`, params);
  check(res, { 'transactions OK': (r) => r.status === 200 });
  
  sleep(0.5);

  // Test projects
  res = http.get(`${BASE_URL}/api/projects`, params);
  check(res, { 'projects OK': (r) => r.status === 200 });
  
  sleep(1);
}
