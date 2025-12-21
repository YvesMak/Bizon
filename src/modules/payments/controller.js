const PaymentService = require('./service');

class PaymentController {
  async create(req, res) {
    try {
      const payment = await PaymentService.create(req.restaurantId, req.body);
      res.status(201).json({
        message: 'Paiement enregistré',
        payment
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async verify(req, res) {
    try {
      const payment = await PaymentService.verify(req.restaurantId, req.params.id, req.body.transaction_code);
      res.json({
        message: 'Paiement vérifié',
        payment
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getByOrder(req, res) {
    try {
      const payments = await PaymentService.getByOrder(req.restaurantId, req.params.orderId);
      res.json(payments);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  }
}

module.exports = new PaymentController();
