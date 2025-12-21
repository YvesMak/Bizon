const { Subscription, User, Product } = require('../../models');

class SubscriptionService {
  /**
   * Récupérer la subscription du restaurant
   */
  async get(restaurantId) {
    const subscription = await Subscription.findOne({
      where: { restaurant_id: restaurantId }
    });

    if (!subscription) {
      throw new Error('Subscription non trouvée');
    }

    return subscription;
  }

  /**
   * Vérifier les limites d'utilisation
   */
  async checkLimits(restaurantId) {
    const subscription = await this.get(restaurantId);

    const [currentUsers, currentProducts] = await Promise.all([
      User.count({
        where: {
          restaurant_id: restaurantId,
          status: 'active'
        }
      }),
      Product.count({
        where: { restaurant_id: restaurantId }
      })
    ]);

    const isExpired = new Date() > new Date(subscription.end_date);

    return {
      plan: subscription.plan,
      status: subscription.status,
      isExpired,
      endDate: subscription.end_date,
      users: {
        current: currentUsers,
        max: subscription.max_users,
        remaining: subscription.max_users - currentUsers,
        exceeded: currentUsers >= subscription.max_users
      },
      products: {
        current: currentProducts,
        max: subscription.max_products,
        remaining: subscription.max_products - currentProducts,
        exceeded: currentProducts >= subscription.max_products
      }
    };
  }

  /**
   * Vérifier si une limite est atteinte
   */
  async canAddUser(restaurantId) {
    const limits = await this.checkLimits(restaurantId);
    return !limits.users.exceeded && !limits.isExpired;
  }

  async canAddProduct(restaurantId) {
    const limits = await this.checkLimits(restaurantId);
    return !limits.products.exceeded && !limits.isExpired;
  }
}

module.exports = new SubscriptionService();
