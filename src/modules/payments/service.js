const { Op } = require('sequelize');
const { Payment, Order, OrderItem } = require('../../models');
const InvoiceService = require('../invoices/service');
const OrderService = require('../orders/service');
const LoyaltyService = require('../loyalty/service');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/errorMessages');
const flutterwave = require('./providers/flutterwave');
const flwConfig = require('../../config/flutterwave');
const campay = require('./providers/campay');
const campayConfig = require('../../config/campay');
const { sequelize } = require('../../config/database');

// Provider de paiement actif (env PAYMENT_PROVIDER : 'campay' | 'flutterwave').
function activeProvider() {
  return (process.env.PAYMENT_PROVIDER || 'flutterwave').toLowerCase();
}

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

      // 🎁 Fidélité : créditer les points si la commande est liée à un client
      try {
        await LoyaltyService.creditForOrder(restaurantId, order);
      } catch (loyaltyError) {
        console.error('Erreur crédit fidélité:', loyaltyError.message);
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

      // 🎁 Fidélité : créditer les points si la commande est liée à un client
      await LoyaltyService.creditForOrder(restaurantId, order, transaction);

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
   * =================================================================
   * FLUTTERWAVE — INITIATION
   * =================================================================
   * Crée un paiement `pending` et génère un lien de paiement hébergé
   * (Mobile Money MTN/Orange + cartes). Le règlement réel se fait via
   * le webhook / callback après vérification serveur.
   */
  async initiateFlutterwave(restaurantId, data) {
    const { order_id, customer = {} } = data;

    const order = await Order.findOne({
      where: { id: order_id, restaurant_id: restaurantId }
    });
    if (!order) throw new Error('Commande non trouvée');
    if (order.status === 'cancelled') throw new Error('Impossible de payer une commande annulée');

    // 🔒 Anti double-paiement
    const existing = await Payment.findOne({
      where: { order_id, restaurant_id: restaurantId, status: ['completed', 'pending'] }
    });
    if (existing) {
      if (existing.status === 'completed') throw new Error('Cette commande a déjà été payée');
      // Un paiement est déjà en attente : on renvoie son lien existant si disponible.
      const link = existing.metadata?.checkout_link;
      if (link) {
        return {
          payment_id: existing.id,
          tx_ref: existing.reference,
          link,
          amount: existing.amount,
          currency: flwConfig.currency,
          reused: true
        };
      }
      throw new Error('Un paiement est déjà en attente pour cette commande');
    }

    const txRef = `BIZON-${order.order_number}-${Date.now()}`;

    const payment = await Payment.create({
      restaurant_id: restaurantId,
      order_id,
      amount: order.total_amount,
      method: 'mobile_money',
      status: 'pending',
      provider: 'flutterwave',
      reference: txRef,
      phone_number: customer.phone || null
    });

    try {
      const { link } = await flutterwave.createPaymentLink({
        tx_ref: txRef,
        amount: order.total_amount,
        customer: {
          email: customer.email,
          phone: customer.phone,
          name: customer.name || order.customer_name
        },
        redirectUrl: `${flwConfig.appBaseUrl}/payment-callback.html`,
        meta: {
          order_id,
          restaurant_id: restaurantId,
          payment_id: payment.id,
          description: `Commande ${order.order_number}`
        }
      });

      await payment.update({ metadata: { ...payment.metadata, checkout_link: link } });

      await logger.critical('FLW_PAYMENT_INITIATED', {
        restaurant_id: restaurantId, payment_id: payment.id, order_id, tx_ref: txRef
      });

      return {
        payment_id: payment.id,
        tx_ref: txRef,
        link,
        amount: order.total_amount,
        currency: flwConfig.currency
      };
    } catch (error) {
      // Le lien n'a pas pu être créé : on marque le paiement échoué pour
      // ne pas bloquer un futur réessai (la garde anti-doublon ignore `failed`).
      await payment.update({ status: 'failed' });
      throw error;
    }
  }

  /**
   * =================================================================
   * FLUTTERWAVE — RÈGLEMENT (vérification serveur, idempotent)
   * =================================================================
   * Appelé par le webhook et/ou le callback de redirection.
   * La vérification via l'API Flutterwave est la SOURCE DE VÉRITÉ.
   */
  async settleFlutterwave({ transactionId, txRef }) {
    if (!transactionId) throw new Error('transaction_id manquant');

    // 1. Vérification serveur auprès de Flutterwave
    const data = await flutterwave.verifyTransaction(transactionId);
    const verifiedRef = data.tx_ref || txRef;

    // 2. Retrouver le paiement local via la référence
    const payment = await Payment.findOne({
      where: { reference: verifiedRef },
      include: [{ model: Order, as: 'order' }]
    });
    if (!payment) throw new Error('Paiement introuvable pour cette transaction');

    // 3. Idempotence : déjà réglé → on renvoie tel quel
    if (payment.status === 'completed') return payment;

    // 4. Validations métier
    if (data.status !== 'successful') {
      await payment.update({ status: 'failed', transaction_code: String(transactionId) });
      throw new Error('Transaction non réussie');
    }
    if (Number(data.amount) < Number(payment.amount)) {
      throw new Error('Montant payé insuffisant');
    }
    if (data.currency && data.currency !== flwConfig.currency) {
      throw new Error('Devise incorrecte');
    }

    // 5. Règlement atomique (factorisé, partagé avec Campay)
    await this._finalizeSettlement(payment, String(transactionId), 'FLW_PAYMENT_SETTLED');
    return payment;
  }

  /**
   * =================================================================
   * RÈGLEMENT ATOMIQUE PARTAGÉ (tous providers)
   * =================================================================
   * Marque le paiement complété, génère la facture, fait avancer la commande
   * (self-service draft → confirmed + décrément stock ; sinon → paid) et
   * crédite la fidélité. À appeler uniquement après vérification serveur OK.
   */
  async _finalizeSettlement(payment, providerTxId, logEvent = 'PAYMENT_SETTLED') {
    const transaction = await sequelize.transaction();
    try {
      await payment.update({
        status: 'completed',
        transaction_code: String(providerTxId),
        verified_at: new Date()
      }, { transaction });

      await InvoiceService.generate(payment.restaurant_id, payment.order_id, transaction);

      const order = payment.order || await Order.findByPk(payment.order_id, { transaction });
      if (order) {
        if (!order.user_id && order.status === 'draft') {
          const items = await OrderItem.findAll({ where: { order_id: order.id }, transaction });
          await OrderService.decrementStockForOrder({ items }, transaction);
          await order.update({ status: 'confirmed' }, { transaction });
        } else if (order.status !== 'paid') {
          await order.update({ status: 'paid' }, { transaction });
        }
        await LoyaltyService.creditForOrder(payment.restaurant_id, order, transaction);
      }

      await transaction.commit();

      await logger.critical(logEvent, {
        restaurant_id: payment.restaurant_id,
        payment_id: payment.id,
        order_id: payment.order_id,
        transaction_id: providerTxId
      });

      return payment;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * =================================================================
   * CAMPAY — INITIATION (Mobile Money / USSD)
   * =================================================================
   * Déclenche une demande de paiement MoMo : le client valide via USSD.
   * Retourne le paiement `pending` ; le statut se suit via checkCampayStatus.
   */
  async initiateCampayCollect(restaurantId, data) {
    const { order_id, phone, customer = {} } = data;
    if (!phone) throw new Error('Numéro Mobile Money requis');

    const order = await Order.findOne({ where: { id: order_id, restaurant_id: restaurantId } });
    if (!order) throw new Error('Commande non trouvée');
    if (order.status === 'cancelled') throw new Error('Impossible de payer une commande annulée');

    // 🔒 Anti double-paiement
    const existing = await Payment.findOne({
      where: { order_id, restaurant_id: restaurantId, status: ['completed', 'pending'] }
    });
    if (existing) {
      if (existing.status === 'completed') throw new Error('Cette commande a déjà été payée');
      return {
        payment_id: existing.id,
        reference: existing.reference,
        status: 'pending',
        provider: 'campay',
        reused: true
      };
    }

    const externalRef = `BIZON-${order.order_number}-${Date.now()}`;
    let collectRes;
    try {
      collectRes = await campay.collect({
        amount: order.total_amount,
        phone,
        description: `Commande ${order.order_number}`,
        externalReference: externalRef
      });
    } catch (error) {
      throw new Error(`Échec de l'initiation Mobile Money : ${error.message}`);
    }

    const payment = await Payment.create({
      restaurant_id: restaurantId,
      order_id,
      amount: order.total_amount,
      method: 'mobile_money',
      status: 'pending',
      provider: 'campay',
      reference: collectRes.reference, // référence transaction Campay
      phone_number: campay._normalizePhone(phone),
      metadata: { external_reference: externalRef, operator: collectRes.operator, ussd_code: collectRes.ussd_code }
    });

    await logger.critical('CAMPAY_PAYMENT_INITIATED', {
      restaurant_id: restaurantId, payment_id: payment.id, order_id, reference: collectRes.reference
    });

    return {
      payment_id: payment.id,
      reference: collectRes.reference,
      status: 'pending',
      provider: 'campay',
      ussd_code: collectRes.ussd_code || null,
      operator: collectRes.operator || null,
      amount: order.total_amount,
      currency: campayConfig.currency
    };
  }

  /**
   * CAMPAY — Suivi de statut (vérification serveur, idempotent).
   * Règle le paiement si SUCCESSFUL, le marque échoué si FAILED.
   */
  async checkCampayStatus(restaurantId, paymentId) {
    const payment = await Payment.findOne({
      where: { id: paymentId, restaurant_id: restaurantId },
      include: [{ model: Order, as: 'order' }]
    });
    if (!payment) throw new Error('Paiement non trouvé');
    if (payment.status === 'completed') return { status: 'completed', payment };
    if (payment.status === 'failed') return { status: 'failed', payment };

    const data = await campay.verifyTransaction(payment.reference);

    if (data.status === 'successful') {
      if (Number(data.amount) < Number(payment.amount)) {
        throw new Error('Montant payé insuffisant');
      }
      await this._finalizeSettlement(payment, payment.reference, 'CAMPAY_PAYMENT_SETTLED');
      return { status: 'completed', payment };
    }
    if (data.status === 'failed') {
      await payment.update({ status: 'failed' });
      return { status: 'failed', payment };
    }
    return { status: 'pending', payment };
  }

  /**
   * CAMPAY — Règlement depuis le webhook (clé : référence transaction Campay).
   * Re-vérifie le statut côté API (source de vérité), idempotent.
   * Renvoie le paiement (avec sa commande) ou null si introuvable.
   */
  async settleCampayByReference(reference) {
    if (!reference) throw new Error('Référence manquante');
    const payment = await Payment.findOne({
      where: { reference, provider: 'campay' },
      include: [{ model: Order, as: 'order' }]
    });
    if (!payment) return null;
    if (payment.status === 'completed') return payment;

    const data = await campay.verifyTransaction(reference);
    if (data.status === 'successful') {
      if (Number(data.amount) < Number(payment.amount)) throw new Error('Montant payé insuffisant');
      await this._finalizeSettlement(payment, reference, 'CAMPAY_PAYMENT_SETTLED');
      return payment;
    }
    if (data.status === 'failed') {
      await payment.update({ status: 'failed' });
      return payment;
    }
    return payment; // toujours pending
  }

  /**
   * Rapport de caisse (Z) : encaissements complétés du jour, par mode de paiement.
   */
  async cashReport(restaurantId, dateStr) {
    const day = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(day.getTime())) throw new Error('Date invalide');
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(day); end.setHours(23, 59, 59, 999);

    const rows = await Payment.findAll({
      where: {
        restaurant_id: restaurantId,
        status: 'completed',
        verified_at: { [Op.between]: [start, end] }
      },
      attributes: [
        'method',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('amount')), 'total']
      ],
      group: ['method'],
      raw: true
    });

    const byMethod = rows.map((r) => ({
      method: r.method,
      count: parseInt(r.count, 10),
      total: Math.round(parseFloat(r.total))
    }));
    const total = byMethod.reduce((s, r) => s + r.total, 0);
    const count = byMethod.reduce((s, r) => s + r.count, 0);
    // Libellé de date en composantes locales (cohérent avec le sélecteur).
    const ymd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    return { date: ymd, total, count, by_method: byMethod };
  }

  /**
   * Initiation provider-agnostique : route vers Campay (collect) ou Flutterwave
   * (lien hébergé) selon PAYMENT_PROVIDER.
   */
  async initiatePayment(restaurantId, data) {
    if (activeProvider() === 'campay') {
      return this.initiateCampayCollect(restaurantId, data);
    }
    return this.initiateFlutterwave(restaurantId, data);
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
