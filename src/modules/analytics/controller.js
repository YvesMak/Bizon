const AnalyticsService = require('./service');

class AnalyticsController {
  async getOverview(req, res) {
    try {
      const data = await AnalyticsService.getOverview(req.restaurantId);
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new AnalyticsController();
