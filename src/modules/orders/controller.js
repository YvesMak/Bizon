const OrderService = require('./service');

class OrderController {
  async getAll(req, res) {
    try {
      const orders = await OrderService.getAll(req.restaurantId, req.query);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const order = await OrderService.getById(req.restaurantId, req.params.id);
      res.json(order);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }

  async create(req, res) {
    try {
      const order = await OrderService.create(req.restaurantId, req.user.id, req.body);
      res.status(201).json({
        message: 'Commande créée',
        order
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateStatus(req, res) {
    try {
      const order = await OrderService.updateStatus(req.restaurantId, req.params.id, req.body.status);
      res.json({
        message: 'Statut mis à jour',
        order
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async cancel(req, res) {
    try {
      const order = await OrderService.cancel(req.restaurantId, req.params.id);
      res.json({
        message: 'Commande annulée',
        order
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new OrderController();
