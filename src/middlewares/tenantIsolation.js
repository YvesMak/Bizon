/**
 * Middleware d'isolation multi-tenant
 * S'assure que les utilisateurs ne peuvent accéder qu'aux données de leur restaurant
 */
const tenantIsolation = (req, res, next) => {
  if (!req.user || !req.restaurantId) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  // Ajouter le restaurant_id automatiquement aux requêtes de création
  if (req.method === 'POST' && req.body) {
    req.body.restaurant_id = req.restaurantId;
  }

  // Pour les requêtes avec paramètre restaurantId, vérifier la correspondance
  if (req.params.restaurantId && req.params.restaurantId !== req.restaurantId) {
    return res.status(403).json({ 
      error: 'Accès refusé : vous ne pouvez accéder qu\'aux données de votre restaurant' 
    });
  }

  next();
};

module.exports = tenantIsolation;
