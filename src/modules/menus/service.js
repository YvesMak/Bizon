const { Menu, Category, Product } = require('../../models');

class MenuService {
  async getAll(restaurantId) {
    const menus = await Menu.findAll({
      where: { restaurant_id: restaurantId },
      include: [{
        model: Category,
        as: 'categories',
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

    return menus;
  }

  async getById(restaurantId, menuId) {
    const menu = await Menu.findOne({
      where: {
        id: menuId,
        restaurant_id: restaurantId
      },
      include: [{
        model: Category,
        as: 'categories',
        include: [{
          model: Product,
          as: 'products'
        }]
      }]
    });

    if (!menu) {
      throw new Error('Menu non trouvé');
    }

    return menu;
  }

  async create(restaurantId, data) {
    const { name, description, is_active, display_order } = data;

    const menu = await Menu.create({
      restaurant_id: restaurantId,
      name,
      description,
      is_active: is_active !== false,
      display_order: display_order || 0
    });

    return menu;
  }

  async update(restaurantId, menuId, data) {
    const menu = await Menu.findOne({
      where: {
        id: menuId,
        restaurant_id: restaurantId
      }
    });

    if (!menu) {
      throw new Error('Menu non trouvé');
    }

    const { name, description, is_active, display_order } = data;
    await menu.update({ name, description, is_active, display_order });

    return menu;
  }

  async delete(restaurantId, menuId) {
    const menu = await Menu.findOne({
      where: {
        id: menuId,
        restaurant_id: restaurantId
      }
    });

    if (!menu) {
      throw new Error('Menu non trouvé');
    }

    await menu.destroy();
    return true;
  }

  // Catégories
  async createCategory(restaurantId, menuId, data) {
    const menu = await Menu.findOne({
      where: {
        id: menuId,
        restaurant_id: restaurantId
      }
    });

    if (!menu) {
      throw new Error('Menu non trouvé');
    }

    const { name, description, image_url, is_active, display_order } = data;

    const category = await Category.create({
      restaurant_id: restaurantId,
      menu_id: menuId,
      name,
      description,
      image_url,
      is_active: is_active !== false,
      display_order: display_order || 0
    });

    return category;
  }

  async updateCategory(restaurantId, categoryId, data) {
    const category = await Category.findOne({
      where: {
        id: categoryId,
        restaurant_id: restaurantId
      }
    });

    if (!category) {
      throw new Error('Catégorie non trouvée');
    }

    const { name, description, image_url, is_active, display_order } = data;
    await category.update({ name, description, image_url, is_active, display_order });

    return category;
  }

  async deleteCategory(restaurantId, categoryId) {
    const category = await Category.findOne({
      where: {
        id: categoryId,
        restaurant_id: restaurantId
      }
    });

    if (!category) {
      throw new Error('Catégorie non trouvée');
    }

    await category.destroy();
    return true;
  }
}

module.exports = new MenuService();
