const axios = require('axios');

async function testCORS() {
  console.log('🧪 TEST DE LA CONFIGURATION CORS\n');

  const tests = [
    {
      name: 'Test 1: Requête depuis origin autorisée',
      origin: 'http://localhost:5173',
      shouldPass: true
    },
    {
      name: 'Test 2: Requête depuis origin non autorisée',
      origin: 'http://evil.com',
      shouldPass: false
    },
    {
      name: 'Test 3: Requête sans origin (serveur à serveur)',
      origin: null,
      shouldPass: true // Les requêtes sans Origin passent toujours
    }
  ];

  for (const test of tests) {
    console.log(`\n${test.name}`);
    console.log(`Origin: ${test.origin || '(aucune)'}`);

    try {
      const headers = {};
      if (test.origin) {
        headers['Origin'] = test.origin;
      }

      const response = await axios.get('http://localhost:5002/api/accounts', {
        headers,
        validateStatus: () => true // Ne pas throw sur 4xx/5xx
      });

      const corsHeader = response.headers['access-control-allow-origin'];
      const credentialsHeader = response.headers['access-control-allow-credentials'];

      console.log(`  Statut: ${response.status}`);
      console.log(`  Access-Control-Allow-Origin: ${corsHeader || '(absent)'}`);
      console.log(`  Access-Control-Allow-Credentials: ${credentialsHeader || '(absent)'}`);

      if (test.origin === 'http://localhost:5173') {
        if (corsHeader === 'http://localhost:5173' && credentialsHeader === 'true') {
          console.log(`  ✅ RÉUSSI - Origin autorisée reconnue`);
        } else {
          console.log(`  ❌ ÉCHEC - Headers CORS incorrects`);
        }
      } else if (test.origin === 'http://evil.com') {
        if (!corsHeader || corsHeader !== 'http://evil.com') {
          console.log(`  ✅ RÉUSSI - Origin non autorisée bloquée`);
        } else {
          console.log(`  ❌ ÉCHEC - Origin non autorisée acceptée !`);
        }
      } else {
        console.log(`  ℹ️ INFO - Requête sans origin (normale pour serveur à serveur)`);
      }

    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`  ❌ ERREUR - Serveur non accessible sur http://localhost:5002`);
        console.log(`  Assurez-vous que le backend est démarré !`);
        break;
      } else {
        console.log(`  ❌ ERREUR - ${error.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Tests terminés');
}

testCORS();
