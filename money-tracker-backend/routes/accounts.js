const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate'); // ✅ NOUVEAU

router.use(authMiddleware);

router.get('/', accountController.getAllAccounts); // ✅ GET sans body = OK

// ✅ POST/PUT avec validation JOI
router.post('/', validate('account'), accountController.createAccount);
router.put('/:id', validate('account'), accountController.updateAccount);
router.delete('/:id', accountController.deleteAccount); // ✅ DELETE sans body = OK

// ✅ ROUTES RECALCUL (sécurisées ID)
router.post('/:id/recalculate', accountController.recalculateBalance);
router.post('/recalculate-all', accountController.recalculateAllBalances);

module.exports = router;
