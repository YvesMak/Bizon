const { Menu, Category, Product } = require('../../models');
const { sequelize } = require('../../config/database');

/**
 * Service d'onboarding pour nouveaux restaurants
 * Crée un menu par défaut avec produits exemple
 */
class OnboardingService {
  /**
   * Créer le menu et produits par défaut pour un nouveau restaurant
   */
  async setupDefaultMenu(restaurantId) {
    const transaction = await sequelize.transaction();

    try {
      // 1. Créer le menu principal
      const menu = await Menu.create({
        restaurant_id: restaurantId,
        name: 'Menu Principal',
        description: 'Notre carte',
        is_active: true,
        display_order: 0
      }, { transaction });

      // 2. Créer les catégories
      const categories = await Promise.all([
        Category.create({
          restaurant_id: restaurantId,
          menu_id: menu.id,
          name: 'Entrées',
          description: 'Pour commencer',
          is_active: true,
          display_order: 0
        }, { transaction }),

        Category.create({
          restaurant_id: restaurantId,
          menu_id: menu.id,
          name: 'Plats Principaux',
          description: 'Nos spécialités',
          is_active: true,
          display_order: 1
        }, { transaction }),

        Category.create({
          restaurant_id: restaurantId,
          menu_id: menu.id,
          name: 'Boissons',
          description: 'Boissons fraîches',
          is_active: true,
          display_order: 2
        }, { transaction }),

        Category.create({
          restaurant_id: restaurantId,
          menu_id: menu.id,
          name: 'Desserts',
          description: 'Desserts maison',
          is_active: true,
          display_order: 3
        }, { transaction })
      ]);

      // 3. Créer des produits exemple
      const produitsDemoData = [
        // Entrées
        { 
          category_id: categories[0].id, 
          name: 'Salade Verte', 
          description: 'Salade fraîche de saison',
          price: 1500, 
          display_order: 0 
        },
        { 
          category_id: categories[0].id, 
          name: 'Soupe du Jour', 
          description: 'Soupe maison',
          price: 1000, 
          display_order: 1 
        },

        // Plats
        { 
          category_id: categories[1].id, 
          name: 'Yassa Poulet', 
          description: 'Poulet mariné au citron et oignons',
          price: 2500, 
          display_order: 0 
        },
        { 
          category_id: categories[1].id, 
          name: 'Thiéboudienne', 
          description: 'Riz au poisson, légumes',
          price: 3000, 
          display_order: 1 
        },
        { 
          category_id: categories[1].id, 
          name: 'Mafé', 
          description: 'Viande en sauce arachide',
          price: 2800, 
          display_order: 2 
        },

        // Boissons
        { 
          category_id: categories[2].id, 
          name: 'Eau Minérale', 
          description: 'Eau minérale 1.5L',
          price: 500, 
          display_order: 0 
        },
        { 
          category_id: categories[2].id, 
          name: 'Jus de Bissap', 
          description: 'Jus de bissap frais',
          price: 800, 
          display_order: 1 
        },
        { 
          category_id: categories[2].id, 
          name: 'Coca-Cola', 
          description: 'Coca-Cola 33cl',
          price: 600, 
          display_order: 2 
        },

        // Desserts
        { 
          category_id: categories[3].id, 
          name: 'Thiakry', 
          description: 'Dessert traditionnel au mil',
          price: 1200, 
          display_order: 0 
        },
        { 
          category_id: categories[3].id, 
          name: 'Fruit de Saison', 
          description: 'Fruits frais du jour',
          price: 800, 
          display_order: 1 
        }
      ];

      for (const produitData of produitsDemoData) {
        await Product.create({
          restaurant_id: restaurantId,
          category_id: produitData.category_id,
          name: produitData.name,
          description: produitData.description,
          price: produitData.price,
          stock_quantity: 0,
          low_stock_threshold: 10,
          track_stock: false,  // Désactivé par défaut pour les produits demo
          is_available: true,
          display_order: produitData.display_order
        }, { transaction });
      }

      await transaction.commit();

      return {
        menu,
        categories_count: categories.length,
        products_count: produitsDemoData.length
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Vérifier si un restaurant a déjà un menu
   */
  async hasMenu(restaurantId) {
    const count = await Menu.count({
      where: { restaurant_id: restaurantId }
    });

    return count > 0;
  }

  /**
   * Configuration complète d'un nouveau restaurant
   */
  async completeSetup(restaurantId, options = {}) {
    const hasExistingMenu = await this.hasMenu(restaurantId);

    if (hasExistingMenu && !options.force) {
      throw new Error('Ce restaurant a déjà un menu configuré');
    }

    // Créer le menu par défaut
    const result = await this.setupDefaultMenu(restaurantId);

    return {
      success: true,
      message: 'Configuration du restaurant terminée',
      menu_created: true,
      categories_count: result.categories_count,
      products_count: result.products_count,
      next_steps: [
        'Personnalisez vos produits',
        'Configurez les prix selon votre zone',
        'Ajoutez des images à vos produits',
        'Activez le suivi de stock si nécessaire',
        'Créez des utilisateurs pour votre équipe'
      ]
    };
  }
}

module.exports = new OnboardingService();
