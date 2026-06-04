const CustomerService = require('./service');
const OrderService = require('../orders/service');
const PaymentService = require('../payments/service');
const LoyaltyService = require('../loyalty/service');
const VoucherService = require('../vouchers/service');
const { Restaurant, Customer } = require('../../models');

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

  // POST /api/customers/orders — crée la commande ET initie le paiement (immédiat)
  async createOrder(req, res) {
    try {
      const order = await OrderService.createForCustomer(
        req.restaurantId, req.customerId, req.body
      );

      const customer = await Customer.findByPk(req.customerId);
      const payment = await PaymentService.initiateFlutterwave(req.restaurantId, {
        order_id: order.id,
        customer: {
          email: customer.email,
          phone: customer.phone,
          name: `${customer.first_name} ${customer.last_name}`.trim()
        }
      });

      res.status(201).json({ order, payment });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/customers/me/loyalty — solde + historique des points
  async getLoyalty(req, res) {
    try {
      const data = await LoyaltyService.getHistory(req.customerId, req.restaurantId);
      res.json(data);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  // POST /api/customers/validate-voucher — aperçu de la réduction (avant commande)
  async validateVoucher(req, res) {
    try {
      const { code, subtotal } = req.body;
      const { voucher, discount } = await VoucherService.validateAndCompute(
        req.restaurantId, code, subtotal || 0
      );
      res.json({
        code: voucher.code,
        description: voucher.description,
        discount_type: voucher.discount_type,
        discount
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CustomerController();
