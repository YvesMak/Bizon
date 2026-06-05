const CustomerService = require('./service');
const OrderService = require('../orders/service');
const PaymentService = require('../payments/service');
const LoyaltyService = require('../loyalty/service');
const VoucherService = require('../vouchers/service');
const NotificationService = require('../notifications/service');
const sse = require('../../sse');
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

  // GET /api/customers/me/stream — flux SSE temps réel des commandes du client
  stream(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const customerId = req.customerId;
    sse.addCustomerClient(customerId, res);

    const keepAlive = setInterval(() => {
      try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sse.removeCustomerClient(customerId, res);
    });
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

  // GET /api/customers/me/rewards — récompenses échangeables + mes bons + solde
  async getRewards(req, res) {
    try {
      const [available, myVouchers, loyalty] = await Promise.all([
        VoucherService.listRewards(req.restaurantId),
        VoucherService.listCustomerVouchers(req.restaurantId, req.customerId),
        LoyaltyService.getHistory(req.customerId, req.restaurantId)
      ]);
      res.json({ points: loyalty.points, available, myVouchers });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/customers/me/redeem — échange des points contre un bon personnel
  async redeemReward(req, res) {
    try {
      const voucher = await VoucherService.redeem(
        req.restaurantId, req.customerId, req.body.reward_id
      );
      res.status(201).json({ message: 'Récompense échangée', voucher });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/customers/validate-voucher — aperçu de la réduction (avant commande)
  async validateVoucher(req, res) {
    try {
      const { code, subtotal } = req.body;
      const { voucher, discount } = await VoucherService.validateAndCompute(
        req.restaurantId, code, subtotal || 0, { customerId: req.customerId }
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

  // ----- Notifications push -----

  // Public : clé publique VAPID pour s'abonner côté navigateur.
  async getVapidKey(req, res) {
    res.json({ publicKey: NotificationService.getPublicKey(), enabled: NotificationService.isConfigured() });
  }

  async subscribePush(req, res) {
    try {
      await NotificationService.subscribe(req.customerId, req.restaurantId, req.body.subscription || req.body);
      res.status(201).json({ message: 'Notifications activées' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async unsubscribePush(req, res) {
    try {
      const endpoint = (req.body && req.body.endpoint) || (req.body.subscription && req.body.subscription.endpoint);
      await NotificationService.unsubscribe(endpoint);
      res.json({ message: 'Notifications désactivées' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new CustomerController();
