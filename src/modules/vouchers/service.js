const { Voucher } = require('../../models');
const { sequelize } = require('../../config/database');

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
      max_uses: data.max_uses || null
    });
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
