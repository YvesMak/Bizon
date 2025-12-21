/**
 * Middleware de vérification des rôles
 * Vérifie que l'utilisateur possède l'un des rôles autorisés
 */
const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès refusé : permissions insuffisantes',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

module.exports = roleCheck;
