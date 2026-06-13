// Plans d'abonnement de la plateforme Bizon (marché Cameroun, FCFA).
// L'annuel applique 2 mois offerts (10 × le mensuel).
const TRIAL_DAYS = 14;

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Pour démarrer sereinement',
    monthly: 5000,
    yearly: 50000,
    popular: false,
    custom: false,
    limits: { max_users: 5, max_products: 100 },
    features: [
      'Commandes & paiements Mobile Money',
      'Menu, catégories et produits',
      'Application client + QR à table',
      "Jusqu'à 5 comptes équipe",
      'Tableau de bord & comptabilité'
    ]
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Pour faire grandir votre restaurant',
    monthly: 15000,
    yearly: 150000,
    popular: true,
    custom: false,
    limits: { max_users: 20, max_products: 1000 },
    features: [
      'Tout le plan Basic',
      "Jusqu'à 20 comptes équipe",
      'Programme de fidélité & codes promo',
      'Campagnes push marketing',
      'Écran cuisine (KDS) & rapports avancés',
      'Domaine personnalisé'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Plusieurs établissements',
    monthly: null,
    yearly: null,
    popular: false,
    custom: true,
    limits: { max_users: 1000, max_products: 100000 },
    features: [
      'Tout le plan Premium',
      'Multi-restaurants & vue consolidée',
      'Comptes & produits illimités',
      'Accompagnement dédié',
      'Tarif sur devis'
    ]
  }
];

module.exports = { TRIAL_DAYS, CURRENCY: 'FCFA', PLANS };
