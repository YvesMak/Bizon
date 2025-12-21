const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification JWT
 * Vérifie la présence et la validité du token JWT
 */
const auth = async (req, res, next) => {
  try {
    // Récupération du token depuis le header Authorization
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token d\'authentification manquant' });
    }

    // Vérification du token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupération de l'utilisateur
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Compte utilisateur inactif' });
    }

    // Ajout de l'utilisateur et du restaurant_id au contexte de la requête
    req.user = user;
    req.restaurantId = user.restaurant_id;

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

module.exports = auth;
