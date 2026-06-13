const { Subscription, SubscriptionPayment } = require('../../models');
const { PLANS } = require('../../config/plans');
const campayConfig = require('../../config/campay');
const campay = require('../payments/providers/campay');

const PAID_PLANS = ['basic', 'premium'];

function planAmount(planId, cadence) {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new Error('Plan inconnu');
  if (plan.custom) throw new Error('Le plan Enterprise se souscrit sur devis — contactez-nous.');
  const amount = cadence === 'yearly' ? plan.yearly : plan.monthly;
  if (!amount) throw new Error('Tarif indisponible pour ce plan');
  return amount;
}

// Mode simulation : hors production, si Campay n'est pas configuré (ou
// CAMPAY_SIMULATE=true), on simule le flux pour tester sans identifiants.
function isSimulate() {
  return process.env.NODE_ENV !== 'production'
    && (process.env.CAMPAY_SIMULATE === 'true' || !campay.isConfigured());
}

class SubscriptionPaymentService {
  /**
   * Démarre un paiement Campay pour activer un plan payant.
   * Retourne la référence + le code USSD à valider sur le téléphone.
   */
  async checkout(restaurantId, { plan, cadence = 'monthly', phone }) {
    if (plan === 'enterprise') throw new Error('Le plan Enterprise se souscrit sur devis — contactez-nous.');
    if (!PAID_PLANS.includes(plan)) throw new Error('Plan invalide');
    if (!['monthly', 'yearly'].includes(cadence)) throw new Error('Cadence invalide');
    if (!phone) throw new Error('Numéro Mobile Money requis');

    const amount = planAmount(plan, cadence);

    let reference; let ussdCode; let operator;
    if (isSimulate()) {
      reference = `SIM-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      ussdCode = '*126#';
      operator = 'SIMULATION';
    } else {
      const r = await campay.collect({
        amount,
        phone,
        description: `Abonnement Bizon ${plan} (${cadence})`,
        externalReference: `sub-${restaurantId}-${Date.now()}`
      }, null); // identifiants plateforme (creds par défaut)
      reference = r.reference;
      ussdCode = r.ussd_code;
      operator = r.operator;
    }

    await SubscriptionPayment.create({
      restaurant_id: restaurantId,
      reference,
      plan,
      cadence,
      amount,
      currency: campayConfig.currency,
      status: 'pending',
      operator,
      phone
    });

    return {
      reference,
      amount,
      currency: campayConfig.currency,
      ussd_code: ussdCode,
      operator,
      status: 'pending',
      simulate: isSimulate()
    };
  }

  /**
   * Vérifie l'état du paiement ; en cas de succès, active l'abonnement.
   */
  async confirm(restaurantId, reference) {
    const payment = await SubscriptionPayment.findOne({
      where: { reference, restaurant_id: restaurantId }
    });
    if (!payment) throw new Error('Paiement introuvable');

    if (payment.status === 'successful') {
      const sub = await Subscription.findOne({ where: { restaurant_id: restaurantId } });
      return { status: 'successful', subscription: sub ? sub.toJSON() : null };
    }
    if (payment.status === 'failed') return { status: 'failed' };

    let result = 'pending';
    if (isSimulate() || String(reference).startsWith('SIM-')) {
      result = 'successful'; // succès automatique en simulation
    } else {
      const v = await campay.verifyTransaction(reference, null);
      result = v.status; // successful | failed | pending
    }

    if (result === 'successful') {
      await payment.update({ status: 'successful' });
      const subscription = await this.activate(restaurantId, payment.plan, payment.cadence);
      return { status: 'successful', subscription };
    }
    if (result === 'failed') {
      await payment.update({ status: 'failed' });
      return { status: 'failed' };
    }
    return { status: 'pending' };
  }

  /** Active l'abonnement : plan payant, statut actif, échéance prolongée. */
  async activate(restaurantId, plan, cadence) {
    const sub = await Subscription.findOne({ where: { restaurant_id: restaurantId } });
    if (!sub) throw new Error('Abonnement non trouvé');
    const days = cadence === 'yearly' ? 365 : 30;
    const base = new Date(Math.max(Date.now(), new Date(sub.end_date).getTime()));
    base.setDate(base.getDate() + days);
    await sub.update({ plan, status: 'active', end_date: base });
    return sub.toJSON();
  }
}

module.exports = new SubscriptionPaymentService();
