const { Restaurant, User, Order, Product, Payment, Subscription } = require('../../models');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');

class RestaurantService {
  /**
   * Récupérer les informations du restaurant
   */
  async getRestaurant(restaurantId) {
    const restaurant = await Restaurant.findByPk(restaurantId, {
      include: [{
        model: Subscription,
        as: 'subscription'
      }]
    });

    if (!restaurant) {
      throw new Error('Restaurant non trouvé');
    }

    return restaurant;
  }

  /**
   * Mettre à jour le restaurant
   */
  async updateRestaurant(restaurantId, data) {
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      throw new Error('Restaurant non trouvé');
    }

    const { name, address, phone, email, logo_url, settings } = data;
    await restaurant.update({
      name,
      address,
      phone,
      email,
      logo_url,
      settings
    });

    return restaurant;
  }

  /**
   * Obtenir les statistiques du restaurant
   */
  async getStats(restaurantId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      todayOrders,
      totalRevenue,
      todayRevenue,
      totalProducts,
      lowStockProducts,
      activeUsers
    ] = await Promise.all([
      // Total des commandes
      Order.count({ where: { restaurant_id: restaurantId } }),
      
      // Commandes aujourd'hui
      Order.count({
        where: {
          restaurant_id: restaurantId,
          created_at: { [Op.gte]: today }
        }
      }),
      
      // Revenu total
      Payment.sum('amount', {
        where: {
          restaurant_id: restaurantId,
          status: 'completed'
        }
      }),
      
      // Revenu aujourd'hui
      Payment.sum('amount', {
        where: {
          restaurant_id: restaurantId,
          status: 'completed',
          created_at: { [Op.gte]: today }
        }
      }),
      
      // Total produits
      Product.count({ where: { restaurant_id: restaurantId } }),
      
      // Produits en stock bas
      Product.count({
        where: {
          restaurant_id: restaurantId,
          track_stock: true,
          stock_quantity: {
            [Op.lte]: sequelize.col('low_stock_threshold')
          }
        }
      }),
      
      // Utilisateurs actifs
      User.count({
        where: {
          restaurant_id: restaurantId,
          status: 'active'
        }
      })
    ]);

    return {
      orders: {
        total: totalOrders,
        today: todayOrders
      },
      revenue: {
        total: parseFloat(totalRevenue || 0),
        today: parseFloat(todayRevenue || 0)
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts
      },
      users: {
        active: activeUsers
      }
    };
  }

  /**
   * Obtenir les utilisateurs du restaurant
   */
  async getUsers(restaurantId) {
    const users = await User.findAll({
      where: { restaurant_id: restaurantId },
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']]
    });

    return users;
  }

  /**
   * Créer un utilisateur
   */
  async createUser(restaurantId, data) {
    const { email, password, first_name, last_name, role, phone } = data;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new Error('Cet email est déjà utilisé');
    }

    const user = await User.create({
      restaurant_id: restaurantId,
      email,
      password,
      first_name,
      last_name,
      role: role || 'waiter',
      phone,
      status: 'active'
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    return userResponse;
  }

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(restaurantId, userId, data) {
    const user = await User.findOne({
      where: {
        id: userId,
        restaurant_id: restaurantId
      }
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const { first_name, last_name, role, phone, status } = data;
    await user.update({ first_name, last_name, role, phone, status });

    const userResponse = user.toJSON();
    delete userResponse.password;

    return userResponse;
  }

  /**
   * Supprimer un utilisateur
   */
  async deleteUser(restaurantId, userId) {
    const user = await User.findOne({
      where: {
        id: userId,
        restaurant_id: restaurantId
      }
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    if (user.role === 'owner') {
      throw new Error('Impossible de supprimer le propriétaire');
    }

    await user.destroy();
    return true;
  }

  // ----- Self-service propriétaire : multi-restaurants -----

  /**
   * Restaurants appartenant au propriétaire (ceux dont il est owner_id,
   * plus son restaurant courant pour les comptes hérités sans owner_id).
   */
  async getOwnedRestaurants(user) {
    return Restaurant.findAll({
      where: {
        [Op.or]: [{ owner_id: user.id }, { id: user.restaurant_id }]
      },
      include: [{ model: Subscription, as: 'subscription', attributes: ['plan', 'status', 'end_date'] }],
      order: [['created_at', 'ASC']]
    });
  }

  async countOwnedRestaurants(user) {
    return Restaurant.count({
      where: { [Op.or]: [{ owner_id: user.id }, { id: user.restaurant_id }] }
    });
  }

  /**
   * Un propriétaire crée lui-même un restaurant supplémentaire,
   * dans la limite de son quota `max_restaurants`.
   */
  async createOwnedRestaurant(user, data) {
    if (user.role !== 'owner') {
      throw new Error('Seul un propriétaire peut créer un restaurant');
    }
    const { name, address, phone, email, service_types } = data;
    if (!name) throw new Error('Le nom du restaurant est requis');

    const owned = await this.countOwnedRestaurants(user);
    if (owned >= user.max_restaurants) {
      throw new Error(`Quota atteint : vous êtes limité à ${user.max_restaurants} restaurant(s). Contactez l'administrateur.`);
    }

    const SERVICE_TYPES = ['dine_in', 'takeaway', 'delivery'];
    const cleaned = Array.isArray(service_types)
      ? [...new Set(service_types)].filter((t) => SERVICE_TYPES.includes(t))
      : [];
    const slug = `${`${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'resto'}-${Date.now().toString(36)}`;

    const transaction = await sequelize.transaction();
    try {
      const restaurant = await Restaurant.create({
        name, slug, address, phone, email,
        owner_id: user.id,
        settings: { service_types: cleaned.length ? cleaned : SERVICE_TYPES }
      }, { transaction });

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await Subscription.create({
        restaurant_id: restaurant.id,
        plan: 'trial', status: 'active',
        start_date: new Date(), end_date: trialEnd,
        max_users: 5, max_products: 100
      }, { transaction });

      await transaction.commit();
      return restaurant.toJSON();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Bascule le restaurant « actif » du propriétaire et renvoie un nouveau token.
   */
  async switchRestaurant(user, targetId) {
    const restaurant = await Restaurant.findOne({
      where: { id: targetId, [Op.or]: [{ owner_id: user.id }, { id: user.restaurant_id }] }
    });
    if (!restaurant) throw new Error('Restaurant introuvable ou non autorisé');
    if (restaurant.status !== 'active') throw new Error('Ce restaurant est suspendu');

    await User.update({ restaurant_id: targetId }, { where: { id: user.id } });

    const authService = require('../auth/service');
    const token = authService.generateToken(user.id, targetId, user.role);
    return { token, restaurant: restaurant.toJSON() };
  }
}

module.exports = new RestaurantService();
