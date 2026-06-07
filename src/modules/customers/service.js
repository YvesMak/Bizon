const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Customer, Order, OrderItem } = require('../../models');

// Statuts comptant dans la file d'attente « cuisine ».
const QUEUE_STATUSES = ['confirmed', 'preparing'];

class CustomerService {
  generateToken(customerId, restaurantId) {
    return jwt.sign(
      { customerId, restaurantId, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
  }

  async register(restaurantId, data) {
    const { first_name, last_name, phone, password } = data;
    // Un email vide ('') doit être traité comme absent (sinon échec isEmail).
    const email = data.email && data.email.trim() ? data.email.trim() : null;

    if (email) {
      const existing = await Customer.findOne({ where: { email, restaurant_id: restaurantId } });
      if (existing) throw new Error('Un compte existe déjà avec cet email');
    }

    const existing = await Customer.findOne({ where: { phone, restaurant_id: restaurantId } });
    if (existing) throw new Error('Un compte existe déjà avec ce numéro de téléphone');

    const customer = await Customer.create({
      restaurant_id: restaurantId,
      first_name,
      last_name,
      phone,
      email,
      password_hash: password
    });

    const token = this.generateToken(customer.id, restaurantId);
    const result = customer.toJSON();
    delete result.password_hash;
    return { token, customer: result };
  }

  async login(restaurantId, data) {
    const { email, phone, password } = data;

    let customer;
    if (email) {
      customer = await Customer.findOne({ where: { email, restaurant_id: restaurantId } });
    } else if (phone) {
      customer = await Customer.findOne({ where: { phone, restaurant_id: restaurantId } });
    }

    if (!customer) throw new Error('Identifiants incorrects');

    const valid = await customer.comparePassword(password);
    if (!valid) throw new Error('Identifiants incorrects');

    const token = this.generateToken(customer.id, restaurantId);
    const result = customer.toJSON();
    delete result.password_hash;
    return { token, customer: result };
  }

  async getProfile(customerId) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) throw new Error('Client non trouvé');
    const result = customer.toJSON();
    delete result.password_hash;
    return result;
  }

  async updateProfile(customerId, data) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) throw new Error('Client non trouvé');
    const { first_name, last_name, phone, address } = data;
    const email = data.email && data.email.trim() ? data.email.trim() : null;
    await customer.update({ first_name, last_name, phone, email, address });
    const result = customer.toJSON();
    delete result.password_hash;
    return result;
  }

  async getOrders(customerId, restaurantId) {
    const orders = await Order.findAll({
      where: { customer_id: customerId, restaurant_id: restaurantId },
      include: [{ model: OrderItem, as: 'items' }],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // File d'attente cuisine du restaurant (toutes commandes en préparation),
    // ordonnée par ancienneté → on en déduit la position de chaque commande.
    const queue = await Order.findAll({
      where: { restaurant_id: restaurantId, status: { [Op.in]: QUEUE_STATUSES } },
      attributes: ['id'],
      order: [['createdAt', 'ASC']],
      raw: true
    });
    const queueIds = queue.map((q) => q.id);
    const queueTotal = queueIds.length;

    return orders.map((o) => {
      const json = o.toJSON();
      const idx = queueIds.indexOf(o.id);
      if (idx !== -1) {
        json.queue_ahead = idx;            // commandes devant celle-ci
        json.queue_position = idx + 1;     // rang (1 = prochaine servie)
        json.queue_total = queueTotal;     // total en préparation
      }
      return json;
    });
  }
}

module.exports = new CustomerService();
