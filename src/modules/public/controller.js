const { Menu, Category, Product, Restaurant } = require('../../models');

class PublicController {
  // GET /api/public/menu?restaurantId=xxx  ou premier restaurant si absent
  async getMenu(req, res) {
    try {
      const { restaurantId, slug } = req.query;

      // Cible le restaurant : 1) id explicite, 2) slug explicite,
      // 3) domaine HTTP (domaine perso, puis slug de sous-domaine), 4) premier actif.
      let targetRestaurantId = restaurantId;
      if (!targetRestaurantId && slug) {
        const bySlug = await Restaurant.findOne({ where: { slug, status: 'active' } });
        if (!bySlug) return res.json({ available: false, menus: [] });
        targetRestaurantId = bySlug.id;
      }
      if (!targetRestaurantId) {
        const byHost = await PublicController.resolveByHost(req);
        if (byHost) targetRestaurantId = byHost;
      }
      if (!targetRestaurantId) {
        const restaurant = await Restaurant.findOne({ where: { status: 'active' } });
        if (!restaurant) return res.json({ available: false, menus: [] });
        targetRestaurantId = restaurant.id;
      }

      const restaurantRow = await Restaurant.findByPk(targetRestaurantId, {
        attributes: ['id', 'name', 'slug', 'address', 'phone', 'settings']
      });
      const restaurant = restaurantRow ? {
        id: restaurantRow.id,
        name: restaurantRow.name,
        slug: restaurantRow.slug,
        address: restaurantRow.address,
        phone: restaurantRow.phone,
        service_types: Array.isArray(restaurantRow.settings?.service_types) && restaurantRow.settings.service_types.length
          ? restaurantRow.settings.service_types
          : ['dine_in', 'takeaway', 'delivery'],
        delivery_fee: Number(restaurantRow.settings?.delivery_fee) || 0,
        min_delivery_order: Number(restaurantRow.settings?.min_delivery_order) || 0
      } : null;

      const menus = await Menu.findAll({
        where: { restaurant_id: targetRestaurantId, is_active: true },
        include: [{
          model: Category,
          as: 'categories',
          where: { is_active: true },
          required: false,
          include: [{
            model: Product,
            as: 'products',
            where: { is_available: true },
            required: false
          }]
        }],
        order: [
          ['display_order', 'ASC'],
          ['categories', 'display_order', 'ASC'],
          ['categories', 'products', 'display_order', 'ASC']
        ]
      });

      res.json({
        available: menus.length > 0,
        restaurant,
        menus
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Résout un restaurant depuis le nom d'hôte de la requête :
   *  1) domaine personnalisé exact (custom_domain),
   *  2) slug en sous-domaine (<slug>.domaine.tld), hors hôtes génériques.
   * Renvoie l'id du restaurant actif trouvé, sinon null.
   */
  static async resolveByHost(req) {
    const raw = (req.headers['x-forwarded-host'] || req.headers.host || req.hostname || '');
    const host = raw.split(',')[0].trim().split(':')[0].toLowerCase();
    if (!host) return null;

    // 1) Domaine personnalisé
    const byDomain = await Restaurant.findOne({ where: { custom_domain: host, status: 'active' } });
    if (byDomain) return byDomain.id;

    // 2) Sous-domaine = slug (ex. chez-paul.bizon.cm)
    const label = host.split('.')[0];
    const GENERIC = ['www', 'app', 'localhost', 'bizon', '127', 'onrender'];
    if (label && host.includes('.') && !GENERIC.includes(label)) {
      const bySub = await Restaurant.findOne({ where: { slug: label, status: 'active' } });
      if (bySub) return bySub.id;
    }
    return null;
  }
}

module.exports = new PublicController();
