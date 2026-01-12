const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

// Vérifier si un PIN existe
exports.checkPinExists = async (req, res) => {
  try {
    console.log('🔍 Vérification existence PIN...');
    const result = await pool.query('SELECT id FROM app_settings LIMIT 1');
    const exists = result.rows.length > 0;
    console.log('✅ PIN existe:', exists);
    res.json({ exists });
  } catch (error) {
    console.error('❌ Erreur checkPinExists:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Créer le PIN initial
exports.setupPin = async (req, res) => {
  try {
    console.log('📝 Création du PIN...');
    const { pin } = req.body;
    
    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      console.log('❌ PIN invalide:', pin);
      return res.status(400).json({ error: 'Le PIN doit contenir 6 chiffres' });
    }

    const existing = await pool.query('SELECT id FROM app_settings LIMIT 1');
    if (existing.rows.length > 0) {
      console.log('❌ Un PIN existe déjà');
      return res.status(400).json({ error: 'Un PIN existe déjà' });
    }

    const pinHash = await bcrypt.hash(pin, 10);
    console.log('🔐 PIN hashé');

    const result = await pool.query(
      'INSERT INTO app_settings (pin_hash) VALUES ($1) RETURNING id',
      [pinHash]
    );

    const userId = result.rows[0].id;

    // ✅ Token avec user_id
    const token = jwt.sign(
      { 
        user_id: userId,
        authenticated: true 
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '7d' }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await pool.query(
      'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expiresAt]
    );

    console.log('✅ PIN créé avec succès (user_id:', userId, ')');
    res.json({ success: true, message: 'PIN créé avec succès', token });
    
  } catch (error) {
    console.error('❌ Erreur setupPin:', error);
    res.status(500).json({ error: 'Erreur lors de la création du PIN' });
  }
};

// Vérifier le PIN et créer une session
exports.verifyPin = async (req, res) => {
  try {
    console.log('🔐 Vérification du PIN...');
    const { pin } = req.body;
    
    if (!pin || pin.length !== 6) {
      console.log('❌ PIN invalide (longueur)');
      return res.status(400).json({ error: 'PIN invalide' });
    }

    const result = await pool.query('SELECT id, pin_hash FROM app_settings LIMIT 1');
    if (result.rows.length === 0) {
      console.log('❌ Aucun PIN configuré');
      return res.status(404).json({ error: 'Aucun PIN configuré' });
    }

    const { id: userId, pin_hash } = result.rows[0];
    
    const isValid = await bcrypt.compare(pin, pin_hash);
    if (!isValid) {
      console.log('❌ PIN incorrect');
      return res.status(401).json({ error: 'PIN incorrect' });
    }

    console.log('✅ PIN correct, création du token...');
    
    // ✅ Token avec user_id
    const token = jwt.sign(
      { 
        user_id: userId,
        authenticated: true 
      },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '7d' }
    );
    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await pool.query(
      'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token) DO UPDATE SET expires_at = $3, user_id = $2',
      [token, userId, expiresAt]
    );

    console.log('✅ Token créé (user_id:', userId, ')');
    res.json({ success: true, token });
    
  } catch (error) {
    console.error('❌ Erreur verifyPin:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du PIN' });
  }
};

// Vérifier la validité d'un token
exports.verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false, error: 'Token manquant' });
    }

    const token = authHeader.substring(7);
    
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key', async (err, decoded) => {
      if (err) {
        console.log('❌ Token JWT invalide ou expiré');
        return res.status(401).json({ valid: false, error: 'Token invalide' });
      }
      
      const result = await pool.query(
        'SELECT * FROM sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      
      if (result.rows.length === 0) {
        console.log('❌ Token non trouvé ou expiré en base');
        return res.status(401).json({ valid: false, error: 'Session expirée' });
      }
      
      console.log('✅ Token valide (user_id:', decoded.user_id, ')');
      res.json({ valid: true, data: decoded });
    });
    
  } catch (error) {
    console.error('❌ Erreur verifyToken:', error);
    res.status(500).json({ valid: false, error: 'Erreur serveur' });
  }
};

// Changer le PIN
exports.changePin = async (req, res) => {
  try {
    const { oldPin, newPin } = req.body;
    
    if (!oldPin || !newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      return res.status(400).json({ error: 'PIN invalide' });
    }

    const result = await pool.query('SELECT pin_hash FROM app_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucun PIN configuré' });
    }
    
    const { pin_hash } = result.rows[0];
    const isValid = await bcrypt.compare(oldPin, pin_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Ancien PIN incorrect' });
    }

    const newPinHash = await bcrypt.hash(newPin, 10);
    
    await pool.query(
      'UPDATE app_settings SET pin_hash = $1, updated_at = CURRENT_TIMESTAMP',
      [newPinHash]
    );
    
    res.json({ success: true, message: 'PIN modifié avec succès' });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors du changement de PIN' });
  }
};

// Déconnexion
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    }
    res.json({ success: true, message: 'Déconnecté avec succès' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
};

// Récupérer les paramètres
exports.getSettings = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT is_masked, auto_lock_minutes FROM app_settings LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return res.json({ is_masked: false, auto_lock_minutes: 5 });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Mettre à jour les paramètres
exports.updateSettings = async (req, res) => {
  try {
    const { is_masked, auto_lock_minutes } = req.body;
    
    await pool.query(
      'UPDATE app_settings SET is_masked = $1, auto_lock_minutes = $2, updated_at = CURRENT_TIMESTAMP',
      [is_masked, auto_lock_minutes]
    );
    
    res.json({ success: true, message: 'Paramètres mis à jour' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};
