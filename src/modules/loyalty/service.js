const { Customer, LoyaltyTransaction } = require('../../models');
const { sequelize } = require('../../config/database');

// Règle d'acquisition : 1 point par tranche de 100 FCFA dépensés.
const FCFA_PER_POINT = 100;

class LoyaltyService {
  pointsForAmount(amount) {
    return Math.floor(Number(amount || 0) / FCFA_PER_POINT);
  }

  /**
   * Crédite les points de fidélité d'une commande payée.
   * Idempotent (un seul gain par commande grâce à l'index unique order_id+type).
   * À appeler DANS la transaction de règlement du paiement.
   * @returns {Promise<LoyaltyTransaction|null>}
   */
  async creditForOrder(restaurantId, order, transaction = null) {
    if (!order || !order.customer_id) return null;

    const points = this.pointsForAmount(order.total_amount);
    if (points <= 0) return null;

    // Idempotence : déjà crédité pour cette commande ?
    const existing = await LoyaltyTransaction.findOne({
      where: { order_id: order.id, type: 'earn' },
      transaction
    });
    if (existing) return existing;

    try {
      // Incrément atomique du solde client
      await Customer.increment('loyalty_points', {
        by: points,
        where: { id: order.customer_id },
        transaction
      });

      const customer = await Customer.findByPk(order.customer_id, { transaction });
      const balanceAfter = customer ? customer.loyalty_points : points;

      return await LoyaltyTransaction.create({
        restaurant_id: restaurantId,
        customer_id: order.customer_id,
        order_id: order.id,
        points,
        type: 'earn',
        balance_after: balanceAfter,
        description: `Commande ${order.order_number || ''}`.trim()
      }, { transaction });
    } catch (err) {
      // Course possible sur l'index unique → on récupère l'existant.
      if (err.name === 'SequelizeUniqueConstraintError') {
        return LoyaltyTransaction.findOne({
          where: { order_id: order.id, type: 'earn' }, transaction
        });
      }
      throw err;
    }
  }

  /**
   * Dépense des points (échange contre une récompense).
   * Vérifie le solde, décrémente atomiquement, écrit une ligne 'redeem'.
   * À appeler DANS une transaction.
   */
  async spend(restaurantId, customerId, points, description, transaction = null) {
    if (!(points > 0)) throw new Error('Nombre de points invalide');

    const customer = await Customer.findByPk(customerId, { transaction });
    if (!customer) throw new Error('Client non trouvé');
    if ((customer.loyalty_points || 0) < points) throw new Error('Points insuffisants');

    await Customer.decrement('loyalty_points', {
      by: points, where: { id: customerId }, transaction
    });
    const updated = await Customer.findByPk(customerId, { transaction });

    return LoyaltyTransaction.create({
      restaurant_id: restaurantId,
      customer_id: customerId,
      order_id: null,
      points: -points,
      type: 'redeem',
      balance_after: updated.loyalty_points,
      description: description || 'Échange de points'
    }, { transaction });
  }

  /**
   * Ajustement manuel des points par le manager (geste commercial / correction).
   * `points` positif = créditer, négatif = retirer (sans descendre sous 0).
   * Écrit une ligne 'adjust' dans le ledger. Atomique.
   */
  async adjust(restaurantId, customerId, points, description) {
    const delta = parseInt(points, 10);
    if (!Number.isInteger(delta) || delta === 0) throw new Error('Nombre de points invalide');

    const transaction = await sequelize.transaction();
    try {
      const customer = await Customer.findOne({
        where: { id: customerId, restaurant_id: restaurantId }, transaction
      });
      if (!customer) throw new Error('Client non trouvé');

      const current = customer.loyalty_points || 0;
      const newBalance = Math.max(0, current + delta);
      const applied = newBalance - current; // borné pour ne pas passer sous 0

      await customer.update({ loyalty_points: newBalance }, { transaction });

      const tx = await LoyaltyTransaction.create({
        restaurant_id: restaurantId,
        customer_id: customerId,
        order_id: null,
        points: applied,
        type: 'adjust',
        balance_after: newBalance,
        description: description || (applied >= 0 ? 'Ajustement manuel (crédit)' : 'Ajustement manuel (retrait)')
      }, { transaction });

      await transaction.commit();
      return { balance: newBalance, applied, transaction: tx };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Solde + historique des points d'un client.
   */
  async getHistory(customerId, restaurantId, limit = 30) {
    const customer = await Customer.findOne({
      where: { id: customerId, restaurant_id: restaurantId },
      attributes: ['id', 'loyalty_points']
    });
    if (!customer) throw new Error('Client non trouvé');

    const transactions = await LoyaltyTransaction.findAll({
      where: { customer_id: customerId, restaurant_id: restaurantId },
      order: [['created_at', 'DESC']],
      limit
    });

    return { points: customer.loyalty_points || 0, transactions };
  }
}

module.exports = new LoyaltyService();
