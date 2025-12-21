const { sequelize } = require('../../config/database');
const { Restaurant, User, Menu, Category, Product, Subscription } = require('../../models');
const { MENU_TEMPLATES } = require('./templates');

class OnboardingService {
  /**
   * Crée un restaurant complet avec owner, menu démo et produits en une seule transaction
   * Utilisé pour onboarding rapide (< 10 minutes)
   */
  async quickStart(data) {
    const {
      // Restaurant
      restaurantName,
      restaurantAddress,
      restaurantPhone,
      
      // Owner
      ownerEmail,
      ownerPassword,
      ownerFirstName,
      ownerLastName,
      
      // Menu template
      menuTemplate = 'fast-food' // 'fast-food', 'restaurant', 'bar'
    } = data;

    // Validation
    if (!restaurantName || !ownerEmail || !ownerPassword) {
      throw new Error('Le nom du restaurant, l\'email et le mot de passe du propriétaire sont obligatoires');
    }

    if (!MENU_TEMPLATES[menuTemplate]) {
      throw new Error(`Template de menu invalide. Options: ${Object.keys(MENU_TEMPLATES).join(', ')}`);
    }

    const template = MENU_TEMPLATES[menuTemplate];

    const transaction = await sequelize.transaction();

    try {
      // Générer un slug unique depuis le nom
      const baseSlug = restaurantName
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Supprimer les accents
        .replace(/[^a-z0-9]+/g, '-') // Remplacer caractères spéciaux par -
        .replace(/^-+|-+$/g, ''); // Supprimer - au début/fin
      
      // Vérifier l'unicité et ajouter un numéro si nécessaire
      let slug = baseSlug;
      let counter = 1;
      while (await Restaurant.findOne({ where: { slug } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // 1. Créer le restaurant
      const restaurant = await Restaurant.create({
        name: restaurantName,
        slug: slug,
        address: restaurantAddress || 'À configurer',
        phone: restaurantPhone || 'À configurer',
        status: 'active'
      }, { transaction });

      // 2. Créer la souscription (trial de 30 jours)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      await Subscription.create({
        restaurant_id: restaurant.id,
        plan: 'trial',
        status: 'active',
        start_date: new Date(),
        end_date: trialEndDate
      }, { transaction });

      // 3. Créer le propriétaire (le hook beforeCreate hashera le mot de passe)
      const owner = await User.create({
        restaurant_id: restaurant.id,
        email: ownerEmail,
        password: ownerPassword, // Passer en clair, le hook le hashera
        first_name: ownerFirstName || 'Propriétaire',
        last_name: ownerLastName || '',
        role: 'owner',
        status: 'active'
      }, { transaction });

      // 4. Créer le menu démo
      const menu = await Menu.create({
        restaurant_id: restaurant.id,
        name: template.name,
        description: template.description,
        is_active: true
      }, { transaction });

      // 5. Créer les catégories et produits
      const categoriesCreated = [];
      
      for (const categoryData of template.categories) {
        const category = await Category.create({
          restaurant_id: restaurant.id,
          menu_id: menu.id,
          name: categoryData.name,
          description: categoryData.description,
          display_order: template.categories.indexOf(categoryData)
        }, { transaction });

        const productsCreated = [];
        
        for (const productData of categoryData.products) {
          const product = await Product.create({
            restaurant_id: restaurant.id,
            menu_id: menu.id,
            category_id: category.id,
            name: productData.name,
            description: productData.description,
            price: productData.price,
            stock_quantity: productData.stock_quantity,
            track_stock: true,
            is_available: true
          }, { transaction });

          productsCreated.push(product);
        }

        categoriesCreated.push({
          ...category.toJSON(),
          products: productsCreated
        });
      }

      await transaction.commit();

      return {
        restaurant: restaurant.toJSON(),
        owner: {
          id: owner.id,
          email: owner.email,
          first_name: owner.first_name,
          last_name: owner.last_name,
          role: owner.role
        },
        subscription: {
          plan: 'trial',
          trial_days_remaining: 30,
          end_date: trialEndDate
        },
        menu: {
          ...menu.toJSON(),
          categories: categoriesCreated
        },
        next_steps: [
          'Connectez-vous avec votre email et mot de passe',
          'Personnalisez vos produits et prix',
          'Ajoutez votre logo et informations de contact',
          'Invitez votre équipe (gérants, serveurs, caissiers)',
          'Commencez à prendre des commandes !'
        ]
      };

    } catch (error) {
      await transaction.rollback();
      
      // Messages d'erreur clairs en français
      if (error.name === 'SequelizeUniqueConstraintError') {
        if (error.fields?.email) {
          throw new Error('Cette adresse email est déjà utilisée. Veuillez en choisir une autre.');
        }
        if (error.fields?.name) {
          throw new Error('Un restaurant avec ce nom existe déjà.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Récupère les templates disponibles
   */
  async getTemplates() {
    return Object.keys(MENU_TEMPLATES).map(key => ({
      id: key,
      name: MENU_TEMPLATES[key].name,
      description: MENU_TEMPLATES[key].description,
      categories_count: MENU_TEMPLATES[key].categories.length,
      products_count: MENU_TEMPLATES[key].categories.reduce(
        (sum, cat) => sum + cat.products.length, 
        0
      )
    }));
  }
}

module.exports = new OnboardingService();
