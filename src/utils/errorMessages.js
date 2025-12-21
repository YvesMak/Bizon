/**
 * Messages d'erreur en français
 * Centralise tous les messages pour cohérence et traduction facile
 */

const ErrorMessages = {
  // Authentification
  AUTH: {
    INVALID_CREDENTIALS: 'Email ou mot de passe incorrect',
    EMAIL_ALREADY_EXISTS: 'Cet email est déjà utilisé',
    TOKEN_REQUIRED: 'Authentification requise',
    TOKEN_INVALID: 'Token d\'authentification invalide',
    TOKEN_EXPIRED: 'Votre session a expiré, veuillez vous reconnecter',
    UNAUTHORIZED: 'Vous n\'avez pas les permissions nécessaires',
    PASSWORD_TOO_WEAK: 'Le mot de passe doit contenir au moins 8 caractères',
    OLD_PASSWORD_INCORRECT: 'Ancien mot de passe incorrect'
  },

  // Commandes
  ORDER: {
    NOT_FOUND: 'Commande non trouvée',
    EMPTY_CART: 'La commande doit contenir au moins un produit',
    ALREADY_CANCELLED: 'Cette commande est déjà annulée',
    ALREADY_COMPLETED: 'Cette commande est déjà terminée',
    CANNOT_MODIFY_CANCELLED: 'Impossible de modifier une commande annulée',
    CANNOT_MODIFY_COMPLETED: 'Impossible de modifier une commande terminée',
    CANNOT_CANCEL_PAID: 'Impossible d\'annuler une commande déjà payée. Effectuez un remboursement.',
    INVALID_STATUS_TRANSITION: (from, to) => `Transition de statut invalide: ${from} → ${to}`,
    STOCK_INSUFFICIENT: (productName) => `Stock insuffisant pour "${productName}"`
  },

  // Paiements
  PAYMENT: {
    NOT_FOUND: 'Paiement non trouvé',
    ORDER_NOT_FOUND: 'Commande non trouvée',
    ORDER_CANCELLED: 'Impossible de payer une commande annulée',
    ALREADY_PAID: 'Cette commande a déjà été payée',
    PAYMENT_PENDING: 'Un paiement est déjà en attente pour cette commande',
    ALREADY_VERIFIED: 'Ce paiement a déjà été vérifié',
    INVALID_AMOUNT: (expected, provided) => `Le montant doit être égal au total de la commande: ${expected} FCFA (fourni: ${provided} FCFA)`,
    TRANSACTION_CODE_INVALID: 'Code de transaction invalide (minimum 6 caractères)',
    TRANSACTION_CODE_DUPLICATE: 'Ce code de transaction a déjà été utilisé',
    VERIFICATION_FAILED: 'La vérification du paiement a échoué'
  },

  // Produits
  PRODUCT: {
    NOT_FOUND: 'Produit non trouvé',
    NOT_AVAILABLE: (productName) => `Le produit "${productName}" n'est pas disponible`,
    CATEGORY_NOT_FOUND: 'Catégorie non trouvée',
    CATEGORY_NOT_IN_RESTAURANT: 'Cette catégorie n\'appartient pas à votre restaurant',
    NAME_REQUIRED: 'Le nom du produit est obligatoire',
    PRICE_REQUIRED: 'Le prix du produit est obligatoire',
    PRICE_INVALID: 'Le prix doit être un nombre positif',
    STOCK_NEGATIVE: 'Le stock ne peut pas être négatif'
  },

  // Menus & Catégories
  MENU: {
    NOT_FOUND: 'Menu non trouvé',
    NAME_REQUIRED: 'Le nom du menu est obligatoire',
    CATEGORY_NOT_FOUND: 'Catégorie non trouvée',
    CATEGORY_NOT_IN_MENU: 'Cette catégorie n\'appartient pas à ce menu'
  },

  // Restaurant
  RESTAURANT: {
    NOT_FOUND: 'Restaurant non trouvé',
    NAME_REQUIRED: 'Le nom du restaurant est obligatoire',
    EMAIL_REQUIRED: 'L\'email est obligatoire',
    PHONE_REQUIRED: 'Le numéro de téléphone est obligatoire'
  },

  // Utilisateurs
  USER: {
    NOT_FOUND: 'Utilisateur non trouvé',
    EMAIL_REQUIRED: 'L\'email est obligatoire',
    PASSWORD_REQUIRED: 'Le mot de passe est obligatoire',
    FIRST_NAME_REQUIRED: 'Le prénom est obligatoire',
    ROLE_INVALID: 'Rôle invalide. Valeurs acceptées: owner, manager, waiter, cashier',
    CANNOT_DELETE_OWNER: 'Impossible de supprimer le propriétaire du restaurant',
    CANNOT_MODIFY_OWNER: 'Seul le propriétaire peut modifier ses propres informations'
  },

  // Factures
  INVOICE: {
    NOT_FOUND: 'Facture non trouvée',
    GENERATION_FAILED: 'La génération de la facture a échoué',
    PDF_NOT_FOUND: 'Le fichier PDF de la facture n\'a pas été trouvé',
    ALREADY_EXISTS: 'Une facture existe déjà pour cette commande'
  },

  // Abonnements
  SUBSCRIPTION: {
    NOT_FOUND: 'Abonnement non trouvé',
    EXPIRED: 'Votre abonnement a expiré. Veuillez le renouveler.',
    SUSPENDED: 'Votre abonnement est suspendu. Contactez le support.',
    MAX_USERS_REACHED: (max) => `Nombre maximum d\'utilisateurs atteint (${max})`,
    MAX_PRODUCTS_REACHED: (max) => `Nombre maximum de produits atteint (${max})`
  },

  // Onboarding
  ONBOARDING: {
    ALREADY_SETUP: 'Ce restaurant a déjà un menu configuré',
    SETUP_FAILED: 'La configuration du restaurant a échoué'
  },

  // Génériques
  GENERIC: {
    REQUIRED_FIELD: (field) => `Le champ "${field}" est obligatoire`,
    INVALID_UUID: 'Identifiant invalide',
    SERVER_ERROR: 'Une erreur serveur est survenue. Veuillez réessayer.',
    FORBIDDEN: 'Accès refusé: vous ne pouvez accéder qu\'aux données de votre restaurant',
    NOT_FOUND: 'Ressource non trouvée',
    VALIDATION_ERROR: 'Erreur de validation des données'
  }
};

/**
 * Créer une erreur avec message français
 */
function createError(category, key, ...args) {
  const message = ErrorMessages[category]?.[key];
  
  if (!message) {
    return new Error('Erreur inconnue');
  }

  if (typeof message === 'function') {
    return new Error(message(...args));
  }

  return new Error(message);
}

module.exports = {
  ErrorMessages,
  createError
};
