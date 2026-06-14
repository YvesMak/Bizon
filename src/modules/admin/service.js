const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { sequelize } = require('../../config/database');
const {
  PlatformAdmin, User, Restaurant, Subscription, Order
} = require('../../models');
const { PLANS } = require('../../config/plans');

const SERVICE_TYPES = ['dine_in', 'takeaway', 'delivery'];

function sanitizeServiceTypes(types) {
  if (!Array.isArray(types)) return null;
  const cleaned = [...new Set(types)].filter((t) => SERVICE_TYPES.includes(t));
  return cleaned.length ? cleaned : null;
}

function slugify(name) {
  return `${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'resto';
}

// Nettoie un domaine saisi : retire protocole, chemin, port, espaces, www. → null si vide.
function normalizeDomain(input) {
  if (input == null) return null;
  let d = `${input}`.trim().toLowerCase();
  if (!d) return null;
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '');
  if (d.startsWith('www.')) d = d.slice(4);
  return d || null;
}

// Sonde HTTP vers le /whoami d'un domaine personnalisé (fetch natif, Node ≥ 18).
// Borne le temps d'attente pour ne pas bloquer si le DNS n'est pas propagé.
async function probeWhoami(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { accept: 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

class AdminService {
  generateToken(adminId) {
    return jwt.sign(
      { adminId, scope: 'platform' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
  }

  async login(email, password) {
    const admin = await PlatformAdmin.findOne({ where: { email } });
    if (!admin) throw new Error('Identifiants invalides');

    const valid = await admin.comparePassword(password);
    if (!valid) throw new Error('Identifiants invalides');
    if (admin.status !== 'active') throw new Error('Compte administrateur inactif');

    const token = this.generateToken(admin.id);
    const data = admin.toJSON();
    delete data.password;
    return { token, admin: data };
  }

  async getStats() {
    const [restaurants, owners, orders] = await Promise.all([
      Restaurant.count(),
      User.count({ where: { role: 'owner' } }),
      Order.count()
    ]);

    const byStatus = await Restaurant.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });
    const restaurantsByStatus = byStatus.reduce((acc, r) => {
      acc[r.status] = parseInt(r.count, 10);
      return acc;
    }, {});

    return { restaurants, owners, orders, restaurantsByStatus };
  }

  /**
   * Métriques agrégées pour la vue d'ensemble (KPIs + graphiques) :
   * MRR estimé, répartition des plans, statut des restaurants, inscriptions
   * par semaine (8 dernières).
   */
  async getDashboard() {
    const [restaurants, owners, orders, subs, restaurantRows, paidOrders] = await Promise.all([
      Restaurant.count(),
      User.count({ where: { role: 'owner' } }),
      Order.count(),
      Subscription.findAll({ attributes: ['plan', 'status', 'end_date'], raw: true }),
      Restaurant.findAll({ attributes: ['status', 'created_at'], raw: true }),
      Order.findAll({ where: { status: 'paid' }, attributes: ['total_amount', 'created_at'], raw: true })
    ]);

    const planMonthly = {};
    PLANS.forEach((p) => { if (!p.custom) planMonthly[p.id] = p.monthly; });

    const now = Date.now();
    const planDistribution = { trial: 0, basic: 0, premium: 0, enterprise: 0 };
    let paying = 0; let expired = 0; let expiringSoon = 0; let mrr = 0; let trials = 0;

    subs.forEach((s) => {
      const isExpired = s.status === 'expired'
        || (s.status !== 'cancelled' && new Date(s.end_date).getTime() < now);
      if (planDistribution[s.plan] !== undefined) planDistribution[s.plan] += 1;
      if (isExpired) expired += 1;
      if (s.plan === 'trial' && !isExpired && s.status === 'active') trials += 1;
      if (s.plan !== 'trial' && s.status === 'active' && !isExpired) {
        paying += 1;
        mrr += planMonthly[s.plan] || 0;
      }
      if (!isExpired && s.status === 'active') {
        const days = Math.ceil((new Date(s.end_date).getTime() - now) / 86400000);
        if (days >= 0 && days <= 3) expiringSoon += 1;
      }
    });

    const statusDistribution = { active: 0, suspended: 0, closed: 0 };
    const WEEKS = 8;
    const weekCounts = new Array(WEEKS).fill(0);
    restaurantRows.forEach((r) => {
      if (statusDistribution[r.status] !== undefined) statusDistribution[r.status] += 1;
      const idx = Math.floor((now - new Date(r.created_at).getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < WEEKS) weekCounts[WEEKS - 1 - idx] += 1;
    });
    const weekLabel = (i) => (i === WEEKS - 1 ? 'Cette sem.' : `S-${WEEKS - 1 - i}`);
    const signupsByWeek = weekCounts.map((count, i) => ({ label: weekLabel(i), count }));

    // Revenu (CA) des commandes payées, par semaine (8 dernières).
    const revenueWeeks = new Array(WEEKS).fill(0);
    let revenueTotal = 0;
    paidOrders.forEach((o) => {
      const amount = Number(o.total_amount) || 0;
      revenueTotal += amount;
      const idx = Math.floor((now - new Date(o.created_at).getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < WEEKS) revenueWeeks[WEEKS - 1 - idx] += amount;
    });
    const revenueByWeek = revenueWeeks.map((amount, i) => ({ label: weekLabel(i), amount: Math.round(amount) }));
    const revenue8w = revenueByWeek.reduce((a, r) => a + r.amount, 0);

    return {
      totals: { restaurants, owners, orders },
      mrr,
      currency: 'FCFA',
      revenue: { total: Math.round(revenueTotal), last8Weeks: revenue8w },
      subscriptions: { trials, paying, expired, expiringSoon },
      planDistribution,
      statusDistribution,
      signupsByWeek,
      revenueByWeek
    };
  }

  /**
   * Détail d'un restaurant pour la page de détail (KPIs + équipe).
   */
  async getRestaurantDetail(restaurantId) {
    const restaurant = await Restaurant.findByPk(restaurantId, {
      include: [
        { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { model: Subscription, as: 'subscription', attributes: ['plan', 'status', 'end_date'] }
      ]
    });
    if (!restaurant) throw new Error('Restaurant non trouvé');

    const [orderCount, paidCount, revenue, team] = await Promise.all([
      Order.count({ where: { restaurant_id: restaurantId } }),
      Order.count({ where: { restaurant_id: restaurantId, status: 'paid' } }),
      Order.sum('total_amount', { where: { restaurant_id: restaurantId, status: 'paid' } }),
      User.findAll({
        where: { restaurant_id: restaurantId },
        attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'status'],
        order: [['role', 'ASC'], ['created_at', 'ASC']]
      })
    ]);

    const r = restaurant.toJSON();
    return {
      restaurant: {
        id: r.id, name: r.name, slug: r.slug, status: r.status,
        custom_domain: r.custom_domain, address: r.address, phone: r.phone
      },
      owner: r.owner ? { name: `${r.owner.first_name} ${r.owner.last_name}`.trim(), email: r.owner.email } : null,
      subscription: r.subscription || null,
      stats: { orders: orderCount, paidOrders: paidCount, revenue: Math.round(revenue || 0) },
      team: team.map((u) => ({
        id: u.id, name: `${u.first_name} ${u.last_name}`.trim(), email: u.email, role: u.role, status: u.status
      }))
    };
  }

  async listOwners() {
    return User.findAll({
      where: { role: 'owner' },
      attributes: { exclude: ['password'] },
      include: [{
        model: Restaurant,
        as: 'ownedRestaurants',
        attributes: ['id', 'name', 'slug', 'status']
      }],
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Crée un propriétaire + son premier restaurant + un abonnement d'essai.
   */
  async createOwner(data) {
    const {
      email, password, first_name, last_name, phone,
      restaurant_name, max_restaurants, service_types
    } = data;

    if (!email || !password) throw new Error('Email et mot de passe requis');
    if (!restaurant_name) throw new Error('Le nom du premier restaurant est requis');
    if (`${password}`.length < 6) throw new Error('Le mot de passe doit contenir au moins 6 caractères');

    const existing = await User.findOne({ where: { email } });
    if (existing) throw new Error('Cet email est déjà utilisé');

    const transaction = await sequelize.transaction();
    try {
      const restaurant = await Restaurant.create({
        name: restaurant_name,
        slug: `${slugify(restaurant_name)}-${Date.now().toString(36)}`,
        email,
        phone,
        settings: { service_types: sanitizeServiceTypes(service_types) || SERVICE_TYPES }
      }, { transaction });

      const owner = await User.create({
        restaurant_id: restaurant.id,
        email,
        password,
        first_name: first_name || 'Owner',
        last_name: last_name || '',
        phone,
        role: 'owner',
        status: 'active',
        max_restaurants: Number.isInteger(max_restaurants) && max_restaurants > 0 ? max_restaurants : 1
      }, { transaction });

      await restaurant.update({ owner_id: owner.id }, { transaction });

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await Subscription.create({
        restaurant_id: restaurant.id,
        plan: 'trial',
        status: 'active',
        start_date: new Date(),
        end_date: trialEnd,
        max_users: 5,
        max_products: 100
      }, { transaction });

      await transaction.commit();

      const ownerData = owner.toJSON();
      delete ownerData.password;
      return { owner: ownerData, restaurant: restaurant.toJSON() };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateOwner(ownerId, data) {
    const owner = await User.findOne({ where: { id: ownerId, role: 'owner' } });
    if (!owner) throw new Error('Propriétaire non trouvé');

    const patch = {};
    if (data.status && ['active', 'inactive'].includes(data.status)) patch.status = data.status;
    if (Number.isInteger(data.max_restaurants) && data.max_restaurants > 0) {
      patch.max_restaurants = data.max_restaurants;
    }
    if (data.first_name != null) patch.first_name = data.first_name;
    if (data.last_name != null) patch.last_name = data.last_name;
    if (data.phone != null) patch.phone = data.phone;

    await owner.update(patch);
    const out = owner.toJSON();
    delete out.password;
    return out;
  }

  async listRestaurants() {
    return Restaurant.findAll({
      include: [
        { model: User, as: 'owner', attributes: ['id', 'email', 'first_name', 'last_name'] },
        { model: Subscription, as: 'subscription', attributes: ['plan', 'status', 'end_date'] }
      ],
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Crée un restaurant supplémentaire et l'assigne à un propriétaire existant
   * (en respectant son quota `max_restaurants`).
   */
  async createRestaurant(data) {
    const { name, owner_id, service_types, address, phone, email } = data;
    if (!name) throw new Error('Le nom du restaurant est requis');
    if (!owner_id) throw new Error('Un propriétaire doit être assigné');

    const owner = await User.findOne({ where: { id: owner_id, role: 'owner' } });
    if (!owner) throw new Error('Propriétaire non trouvé');

    const owned = await Restaurant.count({ where: { owner_id } });
    if (owned >= owner.max_restaurants) {
      throw new Error(`Quota atteint : ce propriétaire est limité à ${owner.max_restaurants} restaurant(s)`);
    }

    const transaction = await sequelize.transaction();
    try {
      const restaurant = await Restaurant.create({
        name,
        slug: `${slugify(name)}-${Date.now().toString(36)}`,
        owner_id,
        address,
        phone,
        email,
        settings: { service_types: sanitizeServiceTypes(service_types) || SERVICE_TYPES }
      }, { transaction });

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      await Subscription.create({
        restaurant_id: restaurant.id,
        plan: 'trial',
        status: 'active',
        start_date: new Date(),
        end_date: trialEnd,
        max_users: 5,
        max_products: 100
      }, { transaction });

      await transaction.commit();
      return restaurant.toJSON();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateRestaurant(restaurantId, data) {
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) throw new Error('Restaurant non trouvé');

    const patch = {};
    if (data.name != null) patch.name = data.name;
    if (data.address != null) patch.address = data.address;
    if (data.phone != null) patch.phone = data.phone;
    if (data.status && ['active', 'suspended', 'closed'].includes(data.status)) {
      patch.status = data.status;
    }
    if (data.owner_id) {
      const owner = await User.findOne({ where: { id: data.owner_id, role: 'owner' } });
      if (!owner) throw new Error('Propriétaire non trouvé');
      patch.owner_id = data.owner_id;
    }

    const serviceTypes = sanitizeServiceTypes(data.service_types);
    if (data.service_types !== undefined) {
      if (!serviceTypes) throw new Error('Au moins un mode de service valide est requis');
      patch.settings = { ...(restaurant.settings || {}), service_types: serviceTypes };
    }

    if (data.custom_domain !== undefined) {
      const domain = normalizeDomain(data.custom_domain);
      if (domain) {
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
          throw new Error('Domaine personnalisé invalide (ex. commande.mon-resto.cm)');
        }
        const clash = await Restaurant.findOne({ where: { custom_domain: domain } });
        if (clash && clash.id !== restaurantId) {
          throw new Error('Ce domaine est déjà utilisé par un autre restaurant');
        }
      }
      patch.custom_domain = domain; // null efface
    }

    await restaurant.update(patch);
    return restaurant.toJSON();
  }

  /**
   * Vérifie en conditions réelles qu'un domaine personnalisé est « live » :
   * interroge https://<domaine>/api/public/whoami et confirme que la chaîne
   * complète (DNS → hébergeur → app → résolution par Host) aboutit au BON
   * restaurant. Statuts possibles :
   *   - no_domain        : aucun domaine personnalisé configuré
   *   - unreachable      : injoignable (DNS non propagé, TLS absent, hébergeur non configuré, timeout)
   *   - unresolved       : joignable mais l'app ne résout aucun restaurant pour ce Host
   *   - wrong_restaurant : joignable mais résout vers un AUTRE restaurant
   *   - active           : tout est bon, le domaine sert bien ce restaurant
   */
  async verifyDomain(restaurantId) {
    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) throw new Error('Restaurant non trouvé');

    const domain = restaurant.custom_domain;
    if (!domain) return { status: 'no_domain', domain: null };

    const url = `https://${domain}/api/public/whoami`;
    let probe;
    try {
      probe = await probeWhoami(url);
    } catch (err) {
      return { status: 'unreachable', domain, url, error: err.message };
    }

    if (!probe || !probe.resolved || !probe.restaurant) {
      return { status: 'unresolved', domain, url };
    }
    if (probe.restaurant.id !== restaurant.id) {
      return { status: 'wrong_restaurant', domain, url, resolved: probe.restaurant };
    }
    return { status: 'active', domain, url, resolved: probe.restaurant };
  }

  /**
   * Liste tous les abonnements (un par restaurant) avec le restaurant et son
   * propriétaire, plus des champs calculés (jours restants, expiré).
   */
  async listSubscriptions() {
    const subs = await Subscription.findAll({
      include: [{
        model: Restaurant,
        as: 'restaurant',
        attributes: ['id', 'name', 'slug', 'status'],
        include: [{ model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'email'] }]
      }],
      order: [['end_date', 'ASC']]
    });
    const now = Date.now();
    return subs.map((s) => {
      const j = s.toJSON();
      const r = j.restaurant;
      const end = new Date(j.end_date).getTime();
      const daysRemaining = Math.ceil((end - now) / 86400000);
      return {
        restaurant_id: j.restaurant_id,
        restaurant: r ? { id: r.id, name: r.name, slug: r.slug, status: r.status } : null,
        owner: r && r.owner
          ? { id: r.owner.id, name: `${r.owner.first_name} ${r.owner.last_name}`.trim(), email: r.owner.email }
          : null,
        plan: j.plan,
        status: j.status,
        start_date: j.start_date,
        end_date: j.end_date,
        daysRemaining,
        isExpired: j.status === 'expired' || (j.status !== 'cancelled' && daysRemaining < 0)
      };
    });
  }

  /**
   * Gère l'abonnement d'un restaurant : changement de plan, de statut, et/ou
   * prolongation de l'échéance (extend_days). Une prolongation positive
   * réactive l'abonnement si aucun statut explicite n'est fourni.
   */
  async updateSubscription(restaurantId, data) {
    const sub = await Subscription.findOne({ where: { restaurant_id: restaurantId } });
    if (!sub) throw new Error('Abonnement non trouvé');

    const PLANS = ['trial', 'basic', 'premium', 'enterprise'];
    const STATUSES = ['active', 'expired', 'cancelled', 'suspended'];
    const patch = {};

    if (data.plan !== undefined) {
      if (!PLANS.includes(data.plan)) throw new Error('Plan invalide');
      patch.plan = data.plan;
    }
    if (data.status !== undefined) {
      if (!STATUSES.includes(data.status)) throw new Error('Statut invalide');
      patch.status = data.status;
    }
    if (data.extend_days !== undefined && data.extend_days !== null && data.extend_days !== '') {
      const n = parseInt(data.extend_days, 10);
      if (!Number.isInteger(n)) throw new Error('Prolongation invalide');
      const base = new Date(Math.max(Date.now(), new Date(sub.end_date).getTime()));
      base.setDate(base.getDate() + n);
      patch.end_date = base;
      if (n > 0 && data.status === undefined) patch.status = 'active';
    }

    await sub.update(patch);
    return sub.toJSON();
  }
}

module.exports = new AdminService();
module.exports.SERVICE_TYPES = SERVICE_TYPES;
module.exports.sanitizeServiceTypes = sanitizeServiceTypes;
