const { Product, Category } = require('../../models');
const { Op } = require('sequelize');

class ProductService {
  async getAll(restaurantId, filters = {}) {
    const where = { restaurant_id: restaurantId };

    // Filtres optionnels
    if (filters.categoryId) {
      where.category_id = filters.categoryId;
    }
    if (filters.isAvailable !== undefined) {
      where.is_available = filters.isAvailable === 'true';
    }
    if (filters.search) {
      where.name = { [Op.iLike]: `%${filters.search}%` };
    }

    const products = await Product.findAll({
      where,
      include: [{
        model: Category,
        as: 'category',
        attributes: ['id', 'name']
      }],
      order: [['display_order', 'ASC'], ['name', 'ASC']]
    });

    return products;
  }

  async getById(restaurantId, productId) {
    const product = await Product.findOne({
      where: {
        id: productId,
        restaurant_id: restaurantId
      },
      include: [{
        model: Category,
        as: 'category'
      }]
    });

    if (!product) {
      throw new Error('Produit non trouvé');
    }

    return product;
  }

  async create(restaurantId, data) {
    const { category_id, name, description, price, cost_price, stock_quantity, low_stock_threshold, track_stock, image_url } = data;

    // Vérifier que la catégorie appartient au restaurant
    const category = await Category.findOne({
      where: {
        id: category_id,
        restaurant_id: restaurantId
      }
    });

    if (!category) {
      throw new Error('Catégorie non trouvée');
    }

    const product = await Product.create({
      restaurant_id: restaurantId,
      category_id,
      name,
      description,
      price,
      cost_price,
      stock_quantity: stock_quantity || 0,
      low_stock_threshold: low_stock_threshold || 10,
      track_stock: track_stock !== false,
      image_url,
      is_available: true
    });

    return product;
  }

  async update(restaurantId, productId, data) {
    const product = await Product.findOne({
      where: {
        id: productId,
        restaurant_id: restaurantId
      }
    });

    if (!product) {
      throw new Error('Produit non trouvé');
    }

    const { category_id, name, description, price, cost_price, low_stock_threshold, track_stock, is_available, image_url } = data;

    // Si la catégorie change, vérifier qu'elle appartient au restaurant
    if (category_id && category_id !== product.category_id) {
      const category = await Category.findOne({
        where: {
          id: category_id,
          restaurant_id: restaurantId
        }
      });

      if (!category) {
        throw new Error('Catégorie non trouvée');
      }
    }

    await product.update({
      category_id,
      name,
      description,
      price,
      cost_price,
      low_stock_threshold,
      track_stock,
      is_available,
      image_url
    });

    return product;
  }

  async delete(restaurantId, productId) {
    const product = await Product.findOne({
      where: {
        id: productId,
        restaurant_id: restaurantId
      }
    });

    if (!product) {
      throw new Error('Produit non trouvé');
    }

    await product.destroy();
    return true;
  }

  /**
   * Mise à jour du stock
   * operation: 'add' ou 'subtract'
   */
  async updateStock(restaurantId, productId, quantity, operation = 'add') {
    const product = await Product.findOne({
      where: {
        id: productId,
        restaurant_id: restaurantId
      }
    });

    if (!product) {
      throw new Error('Produit non trouvé');
    }

    if (!product.track_stock) {
      throw new Error('Ce produit ne gère pas le stock');
    }

    let newStock = product.stock_quantity;
    if (operation === 'add') {
      newStock += quantity;
    } else if (operation === 'subtract') {
      newStock -= quantity;
      if (newStock < 0) {
        throw new Error('Stock insuffisant');
      }
    }

    await product.update({ stock_quantity: newStock });
    return product;
  }

  /**
   * Décrémentation du stock (utilisé lors de la création de commande)
   */
  async decrementStock(restaurantId, productId, quantity) {
    return this.updateStock(restaurantId, productId, quantity, 'subtract');
  }
}

module.exports = new ProductService();
