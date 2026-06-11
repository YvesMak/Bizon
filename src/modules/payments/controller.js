const PaymentService = require('./service');
const sse = require('../../sse');
const flutterwave = require('./providers/flutterwave');
const campay = require('./providers/campay');
const campayConfig = require('../../config/campay');
const NotificationService = require('../notifications/service');
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

  // POST /api/payments/campay/initiate — encaissement Campay par le caissier
  async initiateCampay(req, res) {
    try {
      const result = await PaymentService.initiateCampayCollect(req.restaurantId, req.body);
      res.status(201).json({ message: 'Demande de paiement envoyée', ...result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/payments/:id/campay-status — suivi (et règlement) d'un paiement Campay
  async campayStatus(req, res) {
    try {
      const result = await PaymentService.checkCampayStatus(req.restaurantId, req.params.id);
      res.json({ status: result.status });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/payments/report?date=YYYY-MM-DD — rapport de caisse (Z) du jour
  async report(req, res) {
    try {
      const result = await PaymentService.cashReport(req.restaurantId, req.query.date);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/payments/accounting?from=&to= — comptabilité du restaurant courant
  async accounting(req, res) {
    try {
      const result = await PaymentService.accountingReport(req.restaurantId, req.query);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/payments/accounting/consolidated?from=&to= — vue owner multi-restos
  async consolidated(req, res) {
    try {
      const result = await PaymentService.consolidatedReport(req.user, req.query);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/payments/refunds — commandes payées + annulées à rembourser
  async listRefunds(req, res) {
    try {
      res.json(await PaymentService.listRefundable(req.restaurantId));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // POST /api/payments/refunds/:orderId — rembourse (campay = MoMo réel, manual)
  async refund(req, res) {
    try {
      const result = await PaymentService.refundOrder(req.restaurantId, req.params.orderId, { mode: req.body.mode });
      res.json({ message: 'Remboursement enregistré', ...result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // GET /api/payments/accounting/export?from=&to= — export CSV de la compta
  async accountingExport(req, res) {
    try {
      const csv = await PaymentService.accountingCsv(req.restaurantId, req.query);
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="comptabilite-bizon-${stamp}.csv"`);
      res.send(csv);
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
        // Notifier les écrans staff + le client (commande payée → confirmée)
        if (settled?.order_id) {
          const newStatus = settled.order ? settled.order.status : 'paid';
          sse.emit(settled.restaurant_id, 'order_status_changed', {
            orderId: settled.order_id,
            status: newStatus
          });
          if (settled.order?.customer_id) {
            sse.emitToCustomer(settled.order.customer_id, 'order_status_changed', {
              orderId: settled.order_id,
              orderNumber: settled.order.order_number,
              status: newStatus
            });
            NotificationService.notifyOrderStatus(settled.order.customer_id, {
              orderNumber: settled.order.order_number, status: newStatus
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      // On a déjà répondu 200 ; on journalise pour suivi.
      console.error('[FLW webhook] Échec règlement:', err.message);
    }
  }

  /**
   * Webhook Campay — règle la commande même si le client a fermé l'app.
   * Sécurité : signature JWT (si clé configurée) + revérification serveur du
   * statut auprès de l'API Campay (source de vérité).
   */
  async campayWebhook(req, res) {
    // Répondre vite (Campay réessaie sinon) ; on traite ensuite.
    res.status(200).json({ received: true });

    try {
      const body = { ...req.query, ...req.body };
      const reference = body.reference;
      if (!reference) return;

      // Signature optionnelle, vérifiée avec la clé webhook du compte concerné
      // (celui du restaurant, sinon global). Le règlement re-vérifie de toute
      // façon la transaction côté API (source de vérité).
      const creds = await PaymentService.campayCredsForReference(reference);
      if (creds.webhookKey && !campay.verifyWebhookSignature(body.signature, creds)) {
        console.warn('[Campay webhook] Signature invalide — ignoré');
        return;
      }

      const settled = await PaymentService.settleCampayByReference(reference);
      if (settled && settled.status === 'completed' && settled.order) {
        const order = settled.order;
        sse.emit(settled.restaurant_id, 'order_status_changed', { orderId: order.id, status: order.status });
        if (order.customer_id) {
          sse.emitToCustomer(order.customer_id, 'order_status_changed', {
            orderId: order.id, orderNumber: order.order_number, status: order.status
          });
          NotificationService.notifyOrderStatus(order.customer_id, {
            orderNumber: order.order_number, status: order.status
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('[Campay webhook] Échec règlement:', err.message);
    }
  }
}

module.exports = new PaymentController();
