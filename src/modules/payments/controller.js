const PaymentService = require('./service');
const sse = require('../../sse');

class PaymentController {
  async create(req, res) {
    try {
      const payment = await PaymentService.create(req.restaurantId, req.body);

      // Notifier les clients SSE du changement de statut (commande → paid)
      if (payment.order) {
        sse.emit(req.restaurantId, 'order_status_changed', {
          orderId: payment.order.id,
          orderNumber: payment.order.order_number,
          status: payment.order.status,
          tableNumber: payment.order.table_number,
          customerName: payment.order.customer_name
        });
      }

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

      if (payment.order) {
        sse.emit(req.restaurantId, 'order_status_changed', {
          orderId: payment.order.id,
          orderNumber: payment.order.order_number,
          status: payment.order.status,
          tableNumber: payment.order.table_number,
          customerName: payment.order.customer_name
        });
      }

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
