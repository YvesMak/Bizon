const { Menu, Category, Product, Restaurant } = require('../../models');

class PublicController {
  // GET /api/public/menu?restaurantId=xxx  ou premier restaurant si absent
  async getMenu(req, res) {
    try {
      const { restaurantId } = req.query;

      let where = { is_active: true };
      if (restaurantId) where.restaurant_id = restaurantId;

      // Si pas de restaurantId, prendre le premier restaurant actif
      let targetRestaurantId = restaurantId;
      if (!targetRestaurantId) {
        const restaurant = await Restaurant.findOne({ where: { status: 'active' } });
        if (!restaurant) return res.json({ available: false, menus: [] });
        targetRestaurantId = restaurant.id;
      }

      const restaurant = await Restaurant.findByPk(targetRestaurantId, {
        attributes: ['id', 'name', 'slug', 'address', 'phone']
      });

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
