const SubscriptionService = require('./service');
const SubscriptionPaymentService = require('./payment.service');

class SubscriptionController {
  async checkout(req, res) {
    try {
      res.json(await SubscriptionPaymentService.checkout(req.restaurantId, req.body));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async confirmCheckout(req, res) {
    try {
      res.json(await SubscriptionPaymentService.confirm(req.restaurantId, req.params.reference));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async get(req, res) {
    try {
      const subscription = await SubscriptionService.get(req.restaurantId);
      res.json(subscription);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async checkLimits(req, res) {
    try {
      const limits = await SubscriptionService.checkLimits(req.restaurantId);
      res.json(limits);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new SubscriptionController();
