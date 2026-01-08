// src/dev/TestCsrfSuite.js
import { api } from '../services/api';
import { API_BASE, getAuthHeader, fetchCsrfToken } from '../services/api';

export const runCsrfTestSuite = async () => {
  console.group('🔐 CSRF TEST SUITE');
  console.log('🚀 runCsrfTestSuite appelé');

  try {
    // 1) Vérifier le token / session
    console.log('1️⃣ Vérification session /auth/verify-token...');
    await api.get('/auth/verify-token');
    console.log('✅ Session OK');

    // 2) Recalcul des soldes
    console.log('2️⃣ POST /accounts/recalculate-all...');
    await api.post('/accounts/recalculate-all', {});
    console.log('✅ Recalculate-all OK');

    // ⚠️ POUR LES TESTS PROJETS : adapter avec un vrai projectId et exp/revId
    const TEST_PROJECT_ID = 27; // mets un ID réel
    const TEST_EXPENSE_LINE_ID = 56; // mets un ID réel
    const TEST_REVENUE_LINE_ID = 10; // mets un ID réel

    // 3) Mark expense paid
    console.log('3️⃣ PATCH /projects/:id/expense-lines/:expId/mark-paid...');
    await api.patch(
      `/projects/${TEST_PROJECT_ID}/expense-lines/${TEST_EXPENSE_LINE_ID}/mark-paid`,
      {
        paidexternally: true, // ✅ même naming que backend
        amount: 1000,
        paiddate: new Date().toISOString().split('T')[0], // ✅ même naming que backend
        accountid: 5, // ✅ un vrai compte (ex: Coffre)
      }
    );

    console.log('✅ mark-paid OK');

    // 4) Cancel expense payment
    console.log('4️⃣ PATCH /projects/:id/expense-lines/:expId/cancel-payment...');
    await api.patch(
      `/projects/${TEST_PROJECT_ID}/expense-lines/${TEST_EXPENSE_LINE_ID}/cancel-payment`,
      {}
    );
    console.log('✅ cancel-payment OK');

    // 5) Mark revenue received
    console.log('5️⃣ PATCH /projects/:id/revenue-lines/:revId/mark-received...');
    await api.patch(
      `/projects/${TEST_PROJECT_ID}/revenue-lines/${TEST_REVENUE_LINE_ID}/mark-received`,
      {
        received_externally: true,
        amount: 5000,
        received_date: new Date().toISOString().split('T')[0],
      }
    );
    console.log('✅ mark-received OK');

    // 6) Cancel revenue receipt
    console.log('6️⃣ PATCH /projects/:id/revenue-lines/:revId/cancel-receipt...');
    await api.patch(
      `/projects/${TEST_PROJECT_ID}/revenue-lines/${TEST_REVENUE_LINE_ID}/cancel-receipt`,
      {}
    );
    console.log('✅ cancel-receipt OK');

    // 7) Update operator project
    const TEST_OPERATOR_PROJECT_ID = TEST_PROJECT_ID;
    console.log('7️⃣ PUT /operator/projects/:id...');
    await api.put(`/operator/projects/${TEST_OPERATOR_PROJECT_ID}`, {
      status: 'test-csrf',
    });
    console.log('✅ operator project update OK');

    // 8) Test POST /employees avec FormData + CSRF manuel
    console.log('8️⃣ POST /employees (FormData) avec CSRF...');
    const formData = new FormData();
    formData.append('firstName', 'CSRF');
    formData.append('lastName', 'Test');
    formData.append('position', 'Dev');
    formData.append('department', 'IT');
    formData.append('email', `csrf-test-${Date.now()}@example.com`);
    formData.append('phone', '');
    formData.append('facebook', '');
    formData.append('linkedin', '');
    formData.append('location', '');
    formData.append('salary', 0);
    formData.append('startDate', new Date().toISOString().split('T')[0]);
    formData.append('contractType', 'CDI');
    formData.append('skills', JSON.stringify([]));
    formData.append(
      'emergencyContact',
      JSON.stringify({ name: '', phone: '', relationship: '' })
    );

    const csrfToken = await fetchCsrfToken();

    const response = await fetch(`${API_BASE}/api/employees`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...getAuthHeader(),
        'X-CSRF-Token': csrfToken,
      },
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Erreur /employees');
    }

    console.log('✅ /employees OK');

    console.log('🎉 CSRF TEST SUITE TERMINÉE SANS ERREUR');
  } catch (err) {
    console.error('❌ Erreur dans la CSRF TEST SUITE:', err);
  } finally {
    console.groupEnd();
  }
};
