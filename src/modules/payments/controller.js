const PaymentService = require('./service');
const sse = require('../../sse');
const flutterwave = require('./providers/flutterwave');
const { Payment } = require('../../models');

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

  // POST /api/payments/initiate — génère un lien de paiement Flutterwave
  async initiate(req, res) {
    try {
      const result = await PaymentService.initiateFlutterwave(req.restaurantId, req.body);
      res.status(201).json({ message: 'Paiement initié', ...result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/payments/:id/status — statut d'un paiement (polling de secours)
  async status(req, res) {
    try {
      const payment = await Payment.findOne({
        where: { id: req.params.id, restaurant_id: req.restaurantId },
        attributes: ['id', 'status', 'amount', 'provider', 'order_id', 'verified_at']
      });
      if (!payment) return res.status(404).json({ error: 'Paiement non trouvé' });
      res.json(payment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/payments/webhook/flutterwave — PUBLIC (vérifié par signature)
  async flutterwaveWebhook(req, res) {
    // 1. Vérifier la signature du webhook
    const signature = req.headers['verif-hash'];
    if (!flutterwave.verifyWebhookSignature(signature)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    // 2. Toujours répondre 200 vite (Flutterwave réessaie sinon) ; on traite après.
    res.status(200).json({ received: true });

    // 3. Traitement asynchrone du règlement
    try {
      const event = req.body;
      const data = event.data || {};
      if (data.status === 'successful' && (data.id || event['transaction_id'])) {
        const settled = await PaymentService.settleFlutterwave({
          transactionId: data.id || event['transaction_id'],
          txRef: data.tx_ref
        });
        // Notifier les écrans staff (commande → paid)
        if (settled?.order_id) {
          sse.emit(settled.restaurant_id, 'order_status_changed', {
            orderId: settled.order_id,
            status: 'paid'
          });
        }
      }
    } catch (err) {
      // On a déjà répondu 200 ; on journalise pour suivi.
      console.error('[FLW webhook] Échec règlement:', err.message);
    }
  }
}

module.exports = new PaymentController();
