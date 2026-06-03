const CustomerService = require('./service');
const { Restaurant } = require('../../models');

class CustomerController {
  // Résout le restaurantId depuis query param ou premier restaurant actif
  async _resolveRestaurantId(req) {
    const id = req.query.restaurantId || req.body.restaurantId;
    if (id) return id;
    const r = await Restaurant.findOne({ where: { status: 'active' } });
    if (!r) throw new Error('Restaurant non trouvé');
    return r.id;
  }

  async register(req, res) {
    try {
      const restaurantId = await this._resolveRestaurantId(req);
      const result = await CustomerService.register(restaurantId, req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const restaurantId = await this._resolveRestaurantId(req);
      const result = await CustomerService.login(restaurantId, req.body);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  }

  async getProfile(req, res) {
    try {
      const customer = await CustomerService.getProfile(req.customerId);
      res.json(customer);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async updateProfile(req, res) {
    try {
      const customer = await CustomerService.updateProfile(req.customerId, req.body);
      res.json({ message: 'Profil mis à jour', customer });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getOrders(req, res) {
    try {
      const orders = await CustomerService.getOrders(req.customerId, req.restaurantId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new CustomerController();
