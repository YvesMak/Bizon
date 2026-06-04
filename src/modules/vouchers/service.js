const { Op } = require('sequelize');
const { Voucher } = require('../../models');
const { sequelize } = require('../../config/database');
const LoyaltyService = require('../loyalty/service');

class VoucherService {
  normalizeCode(code) {
    return String(code || '').trim().toUpperCase();
  }

  /**
   * Valide un code et calcule la réduction pour un sous-total donné.
   * @returns {Promise<{voucher: Voucher, discount: number}>}
   * @throws si le code est invalide / inapplicable
   */
  async validateAndCompute(restaurantId, code, subtotal, options = {}) {
    const normalized = this.normalizeCode(code);
    if (!normalized) throw new Error('Code promo requis');

    const voucher = await Voucher.findOne({
      where: { restaurant_id: restaurantId, code: normalized },
      transaction: options.transaction
    });

    if (!voucher) throw new Error('Code promo invalide');

    // Une récompense (points_cost > 0) n'est pas un code utilisable directement :
    // elle doit d'abord être échangée contre des points → bon personnel.
    if (voucher.points_cost > 0) {
      throw new Error('Ce code n\'est pas utilisable directement');
    }
    // Bon personnel : réservé à son propriétaire.
    if (voucher.customer_id) {
      if (!options.customerId || options.customerId !== voucher.customer_id) {
        throw new Error('Ce bon est réservé à un autre client');
      }
    }

    if (!voucher.active) throw new Error('Ce code promo n\'est plus actif');
    if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
      throw new Error('Ce code promo a expiré');
    }
    if (voucher.max_uses != null && voucher.used_count >= voucher.max_uses) {
      throw new Error('Ce code promo a atteint sa limite d\'utilisation');
    }

    const sub = Number(subtotal);
    const min = Number(voucher.min_order_amount || 0);
    if (sub < min) {
      throw new Error(`Commande minimum de ${min.toLocaleString('fr-FR')} FCFA requise pour ce code`);
    }

    let discount;
    if (voucher.discount_type === 'percentage') {
      discount = sub * (Number(voucher.discount_value) / 100);
      if (voucher.max_discount != null) {
        discount = Math.min(discount, Number(voucher.max_discount));
      }
    } else {
      discount = Number(voucher.discount_value);
    }

    // La réduction ne peut excéder le sous-total, et s'arrondit (FCFA entier).
    discount = Math.round(Math.min(discount, sub));

    return { voucher, discount };
  }

  /** Incrémente le compteur d'utilisation (dans la transaction de la commande). */
  async consume(voucherId, transaction = null) {
    await Voucher.increment('used_count', {
      by: 1, where: { id: voucherId }, transaction
    });
  }

  async create(restaurantId, data) {
    const code = this.normalizeCode(data.code);
    if (!code) throw new Error('Le code est requis');

    const exists = await Voucher.findOne({ where: { restaurant_id: restaurantId, code } });
    if (exists) throw new Error('Un code promo identique existe déjà');

    return Voucher.create({
      restaurant_id: restaurantId,
      code,
      description: data.description || null,
      discount_type: data.discount_type === 'fixed' ? 'fixed' : 'percentage',
      discount_value: data.discount_value,
      min_order_amount: data.min_order_amount || 0,
      max_discount: data.max_discount || null,
      active: data.active !== undefined ? data.active : true,
      expires_at: data.expires_at || null,
      max_uses: data.max_uses || null,
      points_cost: data.points_cost ? parseInt(data.points_cost) : 0
    });
  }

  /** Récompenses échangeables (modèles à coût en points, publiques). */
  async listRewards(restaurantId) {
    return Voucher.findAll({
      where: {
        restaurant_id: restaurantId,
        customer_id: null,
        active: true,
        points_cost: { [Op.gt]: 0 }
      },
      order: [['points_cost', 'ASC']]
    });
  }

  /** Bons personnels d'un client (issus d'échanges de points). */
  async listCustomerVouchers(restaurantId, customerId) {
    return Voucher.findAll({
      where: { restaurant_id: restaurantId, customer_id: customerId },
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Échange des points contre un bon personnel à usage unique.
   * Atomique : déduction des points + création du bon.
   */
  async redeem(restaurantId, customerId, rewardId) {
    const transaction = await sequelize.transaction();
    try {
      const reward = await Voucher.findOne({
        where: { id: rewardId, restaurant_id: restaurantId }, transaction
      });
      if (!reward) throw new Error('Récompense introuvable');
      if (!reward.active) throw new Error('Cette récompense n\'est plus disponible');
      if (!(reward.points_cost > 0)) throw new Error('Cet article n\'est pas échangeable');

      // Déduit les points (lève "Points insuffisants" si solde trop bas)
      await LoyaltyService.spend(
        restaurantId, customerId, reward.points_cost,
        `Échange : ${reward.description || reward.code}`, transaction
      );

      // Génère un bon personnel unique à usage unique
      const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
      const voucher = await Voucher.create({
        restaurant_id: restaurantId,
        customer_id: customerId,
        code: `${reward.code}-${suffix}`,
        description: reward.description,
        discount_type: reward.discount_type,
        discount_value: reward.discount_value,
        min_order_amount: reward.min_order_amount,
        max_discount: reward.max_discount,
        active: true,
        expires_at: reward.expires_at,
        max_uses: 1,
        used_count: 0,
        points_cost: 0
      }, { transaction });

      await transaction.commit();
      return voucher;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async list(restaurantId) {
    return Voucher.findAll({
      where: { restaurant_id: restaurantId },
      order: [['created_at', 'DESC']]
    });
  }

  async setActive(restaurantId, voucherId, active) {
    const voucher = await Voucher.findOne({ where: { id: voucherId, restaurant_id: restaurantId } });
    if (!voucher) throw new Error('Code promo non trouvé');
    await voucher.update({ active: Boolean(active) });
    return voucher;
  }
}

module.exports = new VoucherService();
