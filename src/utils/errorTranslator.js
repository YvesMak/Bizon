/**
 * Messages d'erreur en français pour Bizon
 * Mapping des erreurs techniques vers des messages clairs pour utilisateurs
 */

const ERROR_MESSAGES = {
  // Erreurs d'authentification
  'Invalid credentials': 'Email ou mot de passe incorrect',
  'User not found': 'Utilisateur introuvable',
  'Email already exists': 'Cette adresse email est déjà utilisée',
  'Token expired': 'Votre session a expiré. Veuillez vous reconnecter',
  'Invalid token': 'Token d\'authentification invalide',
  'Unauthorized': 'Accès non autorisé',
  
  // Erreurs de droits
  'Insufficient permissions': 'Vous n\'avez pas les droits nécessaires pour cette action',
  'Access denied': 'Accès refusé',
  
  // Erreurs de stock
  'Insufficient stock': 'Stock insuffisant',
  'Out of stock': 'Produit en rupture de stock',
  'Product not available': 'Ce produit n\'est plus disponible',
  
  // Erreurs de paiement
  'Payment already exists': 'Un paiement a déjà été effectué pour cette commande',
  'Payment failed': 'Le paiement a échoué. Veuillez réessayer',
  'Invalid payment method': 'Méthode de paiement invalide',
  'Invalid transaction code': 'Code de transaction invalide',
  'Payment not found': 'Paiement introuvable',
  
  // Erreurs de commande
  'Order not found': 'Commande introuvable',
  'Order already cancelled': 'Cette commande est déjà annulée',
  'Cannot cancel completed order': 'Impossible d\'annuler une commande terminée',
  'Cannot cancel paid order': 'Impossible d\'annuler une commande déjà payée',
  'Order already confirmed': 'Cette commande est déjà confirmée',
  'Empty cart': 'Votre panier est vide',
  
  // Erreurs de restaurant
  'Restaurant not found': 'Restaurant introuvable',
  'Restaurant already exists': 'Un restaurant avec ce nom existe déjà',
  'Restaurant inactive': 'Ce restaurant n\'est pas actif',
  
  // Erreurs de menu/produits
  'Menu not found': 'Menu introuvable',
  'Product not found': 'Produit introuvable',
  'Category not found': 'Catégorie introuvable',
  'Menu not active': 'Ce menu n\'est pas actif',
  
  // Erreurs de validation
  'Required field': 'Champ obligatoire',
  'Invalid email': 'Adresse email invalide',
  'Invalid phone': 'Numéro de téléphone invalide',
  'Invalid price': 'Prix invalide',
  'Invalid quantity': 'Quantité invalide',
  'Quantity must be positive': 'La quantité doit être positive',
  
  // Erreurs de souscription
  'Subscription expired': 'Votre abonnement a expiré',
  'Trial expired': 'Votre période d\'essai est terminée',
  'Subscription not found': 'Abonnement introuvable',
  
  // Erreurs génériques
  'Not found': 'Ressource introuvable',
  'Bad request': 'Requête invalide',
  'Internal server error': 'Erreur serveur. Veuillez réessayer',
  'Database error': 'Erreur de base de données',
  'Validation error': 'Erreur de validation',
  'Network error': 'Erreur réseau. Vérifiez votre connexion'
};

/**
 * Traduit un message d'erreur en français
 */
function translateError(errorMessage) {
  if (!errorMessage) return 'Une erreur est survenue';
  
  // Chercher une traduction exacte
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }
  
  // Chercher par correspondance partielle
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Traductions dynamiques pour certains patterns
  
  // "Insufficient stock for X"
  const stockMatch = errorMessage.match(/Insufficient stock for "([^"]+)"/i);
  if (stockMatch) {
    return `Stock insuffisant pour "${stockMatch[1]}"`;
  }
  
  // "X is required"
  const requiredMatch = errorMessage.match(/(.+) is required/i);
  if (requiredMatch) {
    return `Le champ "${requiredMatch[1]}" est obligatoire`;
  }
  
  // "X must be Y"
  const mustBeMatch = errorMessage.match(/(.+) must be (.+)/i);
  if (mustBeMatch) {
    return `${mustBeMatch[1]} doit être ${mustBeMatch[2]}`;
  }
  
  // Si pas de traduction, retourner le message original
  // (mieux vaut un message en anglais qu'un message vide)
  return errorMessage;
}

/**
 * Middleware Express pour traduire les erreurs en français
 */
function errorTranslationMiddleware(err, req, res, next) {
  // Extraire le message d'erreur
  let errorMessage = err.message || 'Une erreur est survenue';
  
  // Gérer les erreurs Sequelize
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(e => translateError(e.message));
    return res.status(400).json({ 
      error: 'Erreur de validation',
      details: errors 
    });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.fields ? Object.keys(err.fields)[0] : 'champ';
    return res.status(409).json({ 
      error: `Cette valeur de ${field} existe déjà`
    });
  }
  
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ 
      error: 'Cette action est impossible car des données dépendantes existent'
    });
  }
  
  // Traduire le message
  const translatedMessage = translateError(errorMessage);
  
  // Déterminer le code de statut
  const statusCode = err.statusCode || err.status || 500;
  
  // Log l'erreur (sera utile pour le logging structuré)
  if (statusCode >= 500) {
    console.error('Erreur serveur:', err);
  }
  
  // Répondre avec l'erreur traduite
  res.status(statusCode).json({ 
    error: translatedMessage,
    ...(process.env.NODE_ENV === 'development' && { 
      original: errorMessage,
      stack: err.stack 
    })
  });
}

module.exports = {
  ERROR_MESSAGES,
  translateError,
  errorTranslationMiddleware
};
