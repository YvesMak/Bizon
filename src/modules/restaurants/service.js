const { Restaurant, User, Order, Product, Payment, Subscription, Customer, OrderItem } = require('../../models');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');

// Statuts de commande comptant comme « réalisés » (chiffre d'affaires client).
const FULFILLED_STATUSES = ['confirmed', 'preparing', 'ready', 'paid'];

function genTempPassword() {
  // 8 caractères lisibles (sans 0/O/1/I) — communiqués au client par le staff.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p = '';
  for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

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
    const patch = { name, address, phone, email, logo_url };
    // Fusionner les settings (ne pas écraser service_types, etc.).
    if (settings && typeof settings === 'object') {
      patch.settings = { ...(restaurant.settings || {}), ...settings };
    }
    await restaurant.update(patch);

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

  // ----- Gestion des clients (côté manager) -----

  /**
   * Liste des clients du restaurant + agrégats (commandes réalisées, total
   * dépensé, dernière visite). Recherche optionnelle sur nom/téléphone/email.
   */
  async listCustomers(restaurantId, { q, segment } = {}) {
    const where = { restaurant_id: restaurantId };
    if (q && q.trim()) {
      const like = { [Op.iLike]: `%${q.trim()}%` };
      where[Op.or] = [{ first_name: like }, { last_name: like }, { phone: like }, { email: like }];
    }

    const customers = await Customer.findAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']]
    });

    // Agrégats commandes par client (une seule requête).
    const agg = await Order.findAll({
      where: { restaurant_id: restaurantId, customer_id: { [Op.ne]: null }, status: { [Op.in]: FULFILLED_STATUSES } },
      attributes: [
        'customer_id',
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders_count'],
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'total_spent'],
        [sequelize.fn('MAX', sequelize.col('created_at')), 'last_order_at']
      ],
      group: ['customer_id'],
      raw: true
    });
    const byCustomer = agg.reduce((acc, a) => { acc[a.customer_id] = a; return acc; }, {});

    let rows = customers.map((c) => {
      const j = c.toJSON();
      const a = byCustomer[c.id];
      return {
        ...j,
        orders_count: a ? parseInt(a.orders_count, 10) : 0,
        total_spent: a ? Math.round(parseFloat(a.total_spent)) : 0,
        last_order_at: a ? a.last_order_at : null
      };
    });

    // Segments : top clients (plus gros dépensiers) / inactifs (>30 j sans commande).
    if (segment === 'top') {
      rows = rows.filter((r) => r.total_spent > 0)
        .sort((x, y) => y.total_spent - x.total_spent)
        .slice(0, 50);
    } else if (segment === 'inactive') {
      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      rows = rows.filter((r) => !r.last_order_at || new Date(r.last_order_at).getTime() < cutoff)
        .sort((x, y) => {
          const tx = x.last_order_at ? new Date(x.last_order_at).getTime() : 0;
          const ty = y.last_order_at ? new Date(y.last_order_at).getTime() : 0;
          return tx - ty; // les plus anciens d'abord
        });
    }
    return rows;
  }

  /** Génère un CSV des clients (mêmes filtres que la liste). */
  async exportCustomersCsv(restaurantId, opts = {}) {
    const rows = await this.listCustomers(restaurantId, opts);
    const headers = ['Prénom', 'Nom', 'Téléphone', 'Email', 'Commandes', 'Total dépensé (FCFA)', 'Points', 'Dernière visite', 'Statut', 'Inscrit le'];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    const lines = [headers.join(';')];
    for (const c of rows) {
      lines.push([
        esc(c.first_name), esc(c.last_name), esc(c.phone), esc(c.email),
        c.orders_count, c.total_spent, c.loyalty_points || 0,
        fmtDate(c.last_order_at), c.status === 'blocked' ? 'Bloqué' : 'Actif',
        fmtDate(c.created_at || c.createdAt)
      ].join(';'));
    }
    // BOM UTF-8 pour qu'Excel ouvre correctement les accents.
    return `﻿${lines.join('\n')}`;
  }

  /** Statistiques clients globales du restaurant. */
  async getCustomerStats(restaurantId) {
    const total = await Customer.count({ where: { restaurant_id: restaurantId } });
    const blocked = await Customer.count({ where: { restaurant_id: restaurantId, status: 'blocked' } });
    const since = new Date(); since.setDate(since.getDate() - 7);
    const newThisWeek = await Customer.count({
      where: { restaurant_id: restaurantId, created_at: { [Op.gte]: since } }
    });
    return { total, blocked, active: total - blocked, new_this_week: newThisWeek };
  }

  /** Détail d'un client + ses dernières commandes. */
  async getCustomerDetail(restaurantId, customerId) {
    const customer = await Customer.findOne({
      where: { id: customerId, restaurant_id: restaurantId },
      attributes: { exclude: ['password_hash'] }
    });
    if (!customer) throw new Error('Client non trouvé');

    const orders = await Order.findAll({
      where: { customer_id: customerId, restaurant_id: restaurantId },
      include: [{ model: OrderItem, as: 'items' }],
      order: [['created_at', 'DESC']],
      limit: 15
    });
    return { customer: customer.toJSON(), orders };
  }

  /** Réinitialise le mot de passe d'un client → renvoie le mot de passe temporaire. */
  async resetCustomerPassword(restaurantId, customerId) {
    const customer = await Customer.findOne({ where: { id: customerId, restaurant_id: restaurantId } });
    if (!customer) throw new Error('Client non trouvé');
    const tempPassword = genTempPassword();
    await customer.update({ password_hash: tempPassword }); // hashé par le hook beforeUpdate
    return { tempPassword };
  }

  /** Ajustement manuel des points fidélité d'un client (par le manager). */
  async adjustCustomerLoyalty(restaurantId, customerId, points, reason) {
    const LoyaltyService = require('../loyalty/service');
    return LoyaltyService.adjust(restaurantId, customerId, points, reason);
  }

  /** Bloque ou réactive un client. */
  async setCustomerStatus(restaurantId, customerId, status) {
    if (!['active', 'blocked'].includes(status)) throw new Error('Statut invalide');
    const customer = await Customer.findOne({ where: { id: customerId, restaurant_id: restaurantId } });
    if (!customer) throw new Error('Client non trouvé');
    await customer.update({ status });
    const j = customer.toJSON();
    delete j.password_hash;
    return j;
  }

  // =================================================================
  // CONFIG DE PAIEMENT PAR RESTAURANT (Modèle B — reversement direct)
  // =================================================================

  /**
   * Renvoie la config de paiement du restaurant SANS jamais exposer les secrets
   * (mot de passe / clé webhook masqués).
   */
  async getPaymentConfig(restaurantId) {
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) throw new Error('Restaurant non trouvé');
    const pc = (restaurant.settings && restaurant.settings.payment && restaurant.settings.payment.campay) || {};
    const username = pc.username || '';
    const baseUrl = pc.base_url || '';
    return {
      provider: 'campay',
      configured: Boolean(pc.username && pc.password_enc),
      username_masked: username ? `${username.slice(0, 2)}••••${username.slice(-2)}` : '',
      env: baseUrl.includes('www.campay') ? 'prod' : (baseUrl ? 'demo' : ''),
      has_webhook_key: Boolean(pc.webhook_key_enc)
    };
  }

  /**
   * Enregistre les identifiants Campay du restaurant (secrets chiffrés).
   * Le mot de passe / la clé webhook laissés vides conservent l'existant.
   */
  async setPaymentConfig(restaurantId, data) {
    const { encrypt } = require('../../utils/secrets');
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) throw new Error('Restaurant non trouvé');

    const { username, password, webhook_key, env } = data;
    if (!username || !String(username).trim()) throw new Error('Identifiant Campay (username) requis');

    const existing = (restaurant.settings && restaurant.settings.payment && restaurant.settings.payment.campay) || {};

    let password_enc;
    if (password) password_enc = encrypt(String(password));
    else if (existing.password_enc) password_enc = existing.password_enc;
    else throw new Error('Mot de passe Campay requis');

    const campay = {
      username: String(username).trim(),
      password_enc,
      base_url: env === 'prod' ? 'https://www.campay.net' : 'https://demo.campay.net'
    };
    if (webhook_key) campay.webhook_key_enc = encrypt(String(webhook_key));
    else if (existing.webhook_key_enc) campay.webhook_key_enc = existing.webhook_key_enc;

    const settings = { ...(restaurant.settings || {}) };
    settings.payment = { ...(settings.payment || {}), provider: 'campay', campay };
    await restaurant.update({ settings });

    return this.getPaymentConfig(restaurantId);
  }
}

module.exports = new RestaurantService();
