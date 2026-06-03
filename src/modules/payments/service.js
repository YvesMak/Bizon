const { Payment, Order } = require('../../models');
const InvoiceService = require('../invoices/service');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/errorMessages');

class PaymentService {
  /**
   * Créer un paiement
   */
  async create(restaurantId, data) {
    const { order_id, amount, method, transaction_code, phone_number, provider } = data;

    // Vérifier que la commande existe et appartient au restaurant
    const order = await Order.findOne({
      where: {
        id: order_id,
        restaurant_id: restaurantId
      }
    });

    if (!order) {
      throw new Error('Commande non trouvée');
    }

    if (order.status === 'cancelled') {
      throw new Error('Impossible de payer une commande annulée');
    }

    // 🔒 PROTECTION DOUBLE PAIEMENT : Vérifier paiements existants
    const existingPayment = await Payment.findOne({
      where: {
        order_id,
        restaurant_id: restaurantId,
        status: ['completed', 'pending']
      }
    });

    if (existingPayment) {
      if (existingPayment.status === 'completed') {
        throw new Error('Cette commande a déjà été payée');
      }
      if (existingPayment.status === 'pending') {
        throw new Error('Un paiement est déjà en attente pour cette commande');
      }
    }

    // Vérifier le montant
    const orderTotal = parseFloat(order.total_amount);
    if (parseFloat(amount) !== orderTotal) {
      throw new Error(`Le montant doit être égal au total de la commande: ${orderTotal}`);
    }

    // Créer le paiement
    const payment = await Payment.create({
      restaurant_id: restaurantId,
      order_id,
      amount,
      method: method || 'mobile_money',
      status: method === 'mobile_money' ? 'pending' : 'completed',
      transaction_code,
      phone_number,
      provider,
      verified_at: method !== 'mobile_money' ? new Date() : null
    });

    // 📝 LOG: Création paiement
    await logger.critical('PAYMENT_CREATED', {
      restaurant_id: restaurantId,
      payment_id: payment.id,
      order_id,
      amount,
      method,
      status: payment.status
    });

    // Si paiement cash ou card, générer immédiatement la facture
    if (method !== 'mobile_money') {
      try {
        await InvoiceService.generate(restaurantId, order_id);
      } catch (invoiceError) {
        console.error('Erreur génération facture:', invoiceError);
      }

      // Mettre à jour le statut de la commande
      try {
        await Order.update(
          { status: 'paid' },
          { where: { id: order_id, restaurant_id: restaurantId } }
        );
      } catch (updateError) {
        console.error('Erreur mise à jour statut commande:', updateError);
      }
    }

    return payment;
  }

  /**
   * Vérifier un paiement Mobile Money par code de transaction
   */
  async verify(restaurantId, paymentId, transactionCode) {
    const { sequelize } = require('../../config/database');
    const transaction = await sequelize.transaction();

    try {
      const payment = await Payment.findOne({
        where: {
          id: paymentId,
          restaurant_id: restaurantId
        },
        include: [{
          model: Order,
          as: 'order'
        }],
        transaction
      });

      if (!payment) {
        throw new Error('Paiement non trouvé');
      }

      if (payment.status === 'completed') {
        throw new Error('Paiement déjà vérifié');
      }

      // 🔒 PROTECTION IDEMPOTENCE : Vérifier code transaction en double
      if (transactionCode) {
        const duplicateTransaction = await Payment.findOne({
          where: {
            transaction_code: transactionCode,
            restaurant_id: restaurantId,
            status: 'completed'
          },
          transaction
        });

        if (duplicateTransaction && duplicateTransaction.id !== paymentId) {
          throw new Error('Ce code de transaction a déjà été utilisé');
        }
      }

      // Vérification du code de transaction
      // TODO V2: INTÉGRATION API MOBILE MONEY RÉELLE
      // Remplacer cette validation factice par vraies API :
      // - Orange Money Sénégal : https://api.orange.sn/omoney/v1
      // - Wave : https://api.wave.com/v1  
      // - Free Money : https://api.freemoney.sn/v1
      // Workflow : initier transaction → récupérer transaction_id → vérifier via API
      // Voir détails : V2-ROADMAP.md section "Intégration API Mobile Money"
      // Pour le MVP, on accepte tout code non vide
      if (!transactionCode || transactionCode.length < 6) {
        throw new Error('Code de transaction invalide');
      }

      // 🔒 TRANSACTION ATOMIQUE : Paiement + Facture + Commande
      // Mise à jour du paiement
      await payment.update({
        status: 'completed',
        transaction_code: transactionCode,
        verified_at: new Date()
      }, { transaction });

      // Génération de la facture
      await InvoiceService.generate(restaurantId, payment.order_id, transaction);

      // Mise à jour du statut de la commande
      const order = payment.order;
      if (order.status !== 'paid') {
        await order.update({
          status: 'paid'
        }, { transaction });
      }

      // 📝 LOG: Paiement vérifié avec succès
      await logger.critical('PAYMENT_VERIFIED', {
        restaurant_id: restaurantId,
        payment_id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        transaction_code: transactionCode
      });

      await transaction.commit();
      return payment;
    } catch (error) {
      await transaction.rollback();
      
      // 📝 LOG: Erreur vérification paiement
      await logger.error('PAYMENT_VERIFICATION_FAILED', error, {
        restaurant_id: restaurantId,
        payment_id: paymentId,
        transaction_code: transactionCode
      });
      
      throw error;
    }
  }

  /**
   * Récupérer les paiements d'une commande
   */
  async getByOrder(restaurantId, orderId) {
    const order = await Order.findOne({
      where: {
        id: orderId,
        restaurant_id: restaurantId
      }
    });

    if (!order) {
      throw new Error('Commande non trouvée');
    }

    const payments = await Payment.findAll({
      where: {
        order_id: orderId,
        restaurant_id: restaurantId
      },
      order: [['created_at', 'DESC']]
    });

    return payments;
  }
}

module.exports = new PaymentService();
