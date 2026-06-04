const { sequelize } = require('../../config/database');
const { QueryTypes } = require('sequelize');

class AnalyticsService {
  /**
   * Vue d'ensemble analytique d'un restaurant :
   * CA des 7 derniers jours, top produits, usage des codes promo, fidélité.
   */
  async getOverview(restaurantId) {
    const [revenueRows, topProducts, vouchers, loyalty, members] = await Promise.all([
      // CA par jour (paiements complétés) sur les 7 derniers jours
      sequelize.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COALESCE(SUM(amount), 0)::float AS total
         FROM payments
         WHERE restaurant_id = :rid AND status = 'completed'
           AND created_at >= (CURRENT_DATE - INTERVAL '6 days')
         GROUP BY 1 ORDER BY 1`,
        { replacements: { rid: restaurantId }, type: QueryTypes.SELECT }
      ),

      // Top 5 produits par quantité vendue (hors brouillons/annulées)
      sequelize.query(
        `SELECT oi.product_name AS name,
                SUM(oi.quantity)::int AS quantity,
                COALESCE(SUM(oi.subtotal), 0)::float AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.restaurant_id = :rid AND o.status NOT IN ('draft', 'cancelled')
         GROUP BY oi.product_name
         ORDER BY quantity DESC
         LIMIT 5`,
        { replacements: { rid: restaurantId }, type: QueryTypes.SELECT }
      ),

      // Usage des codes promo
      sequelize.query(
        `SELECT COUNT(*)::int AS orders_with_discount,
                COALESCE(SUM(discount_amount), 0)::float AS total_discount
         FROM orders
         WHERE restaurant_id = :rid AND discount_amount > 0
           AND status NOT IN ('draft', 'cancelled')`,
        { replacements: { rid: restaurantId }, type: QueryTypes.SELECT }
      ),

      // Fidélité : points gagnés / dépensés
      sequelize.query(
        `SELECT COALESCE(SUM(CASE WHEN type='earn' THEN points ELSE 0 END), 0)::int AS earned,
                COALESCE(SUM(CASE WHEN type='redeem' THEN -points ELSE 0 END), 0)::int AS redeemed
         FROM loyalty_transactions
         WHERE restaurant_id = :rid`,
        { replacements: { rid: restaurantId }, type: QueryTypes.SELECT }
      ),

      // Membres fidélité actifs (au moins 1 point)
      sequelize.query(
        `SELECT COUNT(*)::int AS count FROM customers
         WHERE restaurant_id = :rid AND loyalty_points > 0`,
        { replacements: { rid: restaurantId }, type: QueryTypes.SELECT }
      )
    ]);

    return {
      revenue7d: this._fill7Days(revenueRows),
      topProducts,
      vouchers: vouchers[0] || { orders_with_discount: 0, total_discount: 0 },
      loyalty: {
        ...(loyalty[0] || { earned: 0, redeemed: 0 }),
        members: members[0] ? members[0].count : 0
      }
    };
  }

  // Construit une série continue de 7 jours (remplit les jours sans CA à 0).
  _fill7Days(rows) {
    const map = new Map(rows.map(r => [r.day, r.total]));
    const series = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, total: map.get(key) || 0 });
    }
    return series;
  }
}

module.exports = new AnalyticsService();
