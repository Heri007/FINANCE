const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const { RateLimiterMemory } = require('rate-limiter-flexible');
// const Joi = require('joi'); // unused

// Rate limiting : 5 tentatives de PIN par minute et par IP
const pinLimiter = new RateLimiterMemory({
  points: 5,      // nombre de tentatives autorisées
  duration: 60,   // fenêtre en secondes
});

async function limitPinAttempts(req, res, next) {
  try {
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    console.log('🔐 Rate limit key:', key);
    await pinLimiter.consume(key);
    return next();
  } catch {
    console.log('⛔ Rate limit atteint');
    return res.status(429).json({
      error: 'Trop de tentatives de PIN, réessayez dans une minute',
    });
  }
}


// Routes publiques
router.get('/check-pin', authController.checkPinExists);
router.post('/setup-pin', authController.setupPin);
router.post('/verify-pin', limitPinAttempts, authController.verifyPin);
router.get('/verify-token', authController.verifyToken); // ✅ AJOUT

// Routes protégées
router.post('/change-pin', authMiddleware, authController.changePin);
router.post('/logout', authMiddleware, authController.logout);
router.get('/settings', authMiddleware, authController.getSettings);
router.put('/settings', authMiddleware, authController.updateSettings);

module.exports = router;
