const jwt = require('jsonwebtoken');
const { PlatformAdmin } = require('../models');

/**
 * Authentification des super-administrateurs de la plateforme.
 * Le token doit porter `scope: 'platform'` et un `adminId` valide.
 */
const platformAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.scope !== 'platform' || !decoded.adminId) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs plateforme' });
    }

    const admin = await PlatformAdmin.findByPk(decoded.adminId, {
      attributes: { exclude: ['password'] }
    });
    if (!admin) {
      return res.status(401).json({ error: 'Administrateur non trouvé' });
    }
    if (admin.status !== 'active') {
      return res.status(403).json({ error: 'Compte administrateur inactif' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    return res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

module.exports = platformAuth;
