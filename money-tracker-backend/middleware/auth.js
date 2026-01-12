// middleware/auth.js - VERSION CORRIGÉE
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth: Token manquant');
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.substring(7);
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log('❌ Auth: Token invalide -', err.message);
        return res.status(401).json({ error: 'Token invalide' });
      }
      
      // ✅ CORRECTION : Extraire user_id et le renommer en id
      req.user = {
        id: decoded.user_id,           // ← CHANGEMENT ICI
        user_id: decoded.user_id,      // ← Garder aussi user_id pour compatibilité
        authenticated: decoded.authenticated
      };
      
      console.log('✅ Auth: req.user attaché -', req.user);
      next();
    });
  } catch (error) {
    console.error('❌ Erreur middleware auth:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ✅ Export par défaut
module.exports = authenticateToken;

// ✅ Export nommé (compatibilité)
module.exports.authenticateToken = authenticateToken;
