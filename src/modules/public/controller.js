const { Menu, Category, Product, Restaurant } = require('../../models');

class PublicController {
  // GET /api/public/menu?restaurantId=xxx  ou premier restaurant si absent
  async getMenu(req, res) {
    try {
      const { restaurantId, slug } = req.query;

      // Cible le restaurant : par id, sinon par slug, sinon le premier actif.
      let targetRestaurantId = restaurantId;
      if (!targetRestaurantId && slug) {
        const bySlug = await Restaurant.findOne({ where: { slug, status: 'active' } });
        if (!bySlug) return res.json({ available: false, menus: [] });
        targetRestaurantId = bySlug.id;
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
          : ['dine_in', 'takeaway', 'delivery']
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
}

module.exports = new PublicController();
