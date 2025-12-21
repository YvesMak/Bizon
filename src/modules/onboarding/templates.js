// Templates de menus démo pour onboarding rapide

const MENU_TEMPLATES = {
  'fast-food': {
    name: 'Menu Fast-Food',
    description: 'Menu type restauration rapide',
    categories: [
      {
        name: 'Burgers',
        description: 'Nos burgers maison',
        products: [
          { name: 'Burger Classique', description: 'Steak, salade, tomate, oignons', price: 3500, stock_quantity: 50 },
          { name: 'Cheeseburger', description: 'Steak, fromage, salade, sauce', price: 4000, stock_quantity: 50 },
          { name: 'Burger Poulet', description: 'Filet de poulet grillé, salade', price: 3800, stock_quantity: 50 }
        ]
      },
      {
        name: 'Accompagnements',
        description: 'Pour compléter votre repas',
        products: [
          { name: 'Frites', description: 'Portion moyenne', price: 1000, stock_quantity: 100 },
          { name: 'Onion Rings', description: 'Rondelles d\'oignons panées', price: 1200, stock_quantity: 80 }
        ]
      },
      {
        name: 'Boissons',
        description: 'Boissons fraîches',
        products: [
          { name: 'Coca-Cola 33cl', description: 'Canette', price: 500, stock_quantity: 150 },
          { name: 'Eau minérale 50cl', description: 'Bouteille', price: 300, stock_quantity: 200 },
          { name: 'Jus local 33cl', description: 'Jus de fruits', price: 800, stock_quantity: 100 }
        ]
      }
    ]
  },

  restaurant: {
    name: 'Menu Restaurant',
    description: 'Menu type restaurant traditionnel',
    categories: [
      {
        name: 'Entrées',
        description: 'Pour commencer',
        products: [
          { name: 'Salade mixte', description: 'Salade verte, tomates, concombre', price: 1500, stock_quantity: 30 },
          { name: 'Soupe du jour', description: 'Selon arrivage', price: 1200, stock_quantity: 20 }
        ]
      },
      {
        name: 'Plats principaux',
        description: 'Nos spécialités',
        products: [
          { name: 'Poulet braisé', description: 'Avec riz et légumes', price: 4500, stock_quantity: 40 },
          { name: 'Poisson grillé', description: 'Du jour, avec attiéké', price: 5000, stock_quantity: 25 },
          { name: 'Plat du jour', description: 'Demandez au serveur', price: 3500, stock_quantity: 30 }
        ]
      },
      {
        name: 'Desserts',
        description: 'Pour terminer en douceur',
        products: [
          { name: 'Fruit de saison', description: 'Selon disponibilité', price: 1000, stock_quantity: 50 },
          { name: 'Crème glacée', description: 'Vanille ou chocolat', price: 1500, stock_quantity: 40 }
        ]
      }
    ]
  },

  bar: {
    name: 'Menu Bar',
    description: 'Carte de bar',
    categories: [
      {
        name: 'Boissons sans alcool',
        description: 'Boissons fraîches',
        products: [
          { name: 'Coca-Cola', description: 'Canette 33cl', price: 500, stock_quantity: 200 },
          { name: 'Jus naturel', description: 'Pressé minute', price: 1000, stock_quantity: 100 },
          { name: 'Café', description: 'Expresso', price: 700, stock_quantity: 150 }
        ]
      },
      {
        name: 'Bières',
        description: 'Bières locales et importées',
        products: [
          { name: 'Bière locale 33cl', description: 'Bière locale fraîche', price: 800, stock_quantity: 300 },
          { name: 'Bière importée 33cl', description: 'Bière premium', price: 1500, stock_quantity: 150 }
        ]
      },
      {
        name: 'Snacks',
        description: 'Pour accompagner',
        products: [
          { name: 'Cacahuètes', description: 'Sachet', price: 300, stock_quantity: 100 },
          { name: 'Chips', description: 'Sachet', price: 500, stock_quantity: 80 },
          { name: 'Brochettes', description: '3 pièces', price: 1500, stock_quantity: 50 }
        ]
      }
    ]
  }
};

module.exports = { MENU_TEMPLATES };
