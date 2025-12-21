const SubscriptionService = require('./service');

class SubscriptionController {
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
