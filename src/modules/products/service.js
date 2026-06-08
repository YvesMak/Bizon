const { Product, Category, OptionGroup, ProductOption } = require('../../models');
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

  // ----- Options / variantes -----

  async listOptionGroups(restaurantId, productId) {
    const product = await Product.findOne({ where: { id: productId, restaurant_id: restaurantId } });
    if (!product) throw new Error('Produit non trouvé');
    return OptionGroup.findAll({
      where: { product_id: productId, restaurant_id: restaurantId },
      include: [{ model: ProductOption, as: 'options' }],
      order: [['display_order', 'ASC'], [{ model: ProductOption, as: 'options' }, 'display_order', 'ASC']]
    });
  }

  async createOptionGroup(restaurantId, productId, data) {
    const product = await Product.findOne({ where: { id: productId, restaurant_id: restaurantId } });
    if (!product) throw new Error('Produit non trouvé');
    if (!data.name || !data.name.trim()) throw new Error('Le nom du groupe est requis');
    const type = data.type === 'multiple' ? 'multiple' : 'single';
    const count = await OptionGroup.count({ where: { product_id: productId } });
    return OptionGroup.create({
      restaurant_id: restaurantId, product_id: productId,
      name: data.name.trim(), type, required: Boolean(data.required),
      display_order: count
    });
  }

  async deleteOptionGroup(restaurantId, groupId) {
    const group = await OptionGroup.findOne({ where: { id: groupId, restaurant_id: restaurantId } });
    if (!group) throw new Error('Groupe non trouvé');
    await group.destroy();
    return true;
  }

  async createOption(restaurantId, groupId, data) {
    const group = await OptionGroup.findOne({ where: { id: groupId, restaurant_id: restaurantId } });
    if (!group) throw new Error('Groupe non trouvé');
    if (!data.name || !data.name.trim()) throw new Error('Le nom de l\'option est requis');
    const count = await ProductOption.count({ where: { group_id: groupId } });
    return ProductOption.create({
      restaurant_id: restaurantId, group_id: groupId,
      name: data.name.trim(), price_delta: Number(data.price_delta) || 0,
      display_order: count
    });
  }

  async deleteOption(restaurantId, optionId) {
    const option = await ProductOption.findOne({ where: { id: optionId, restaurant_id: restaurantId } });
    if (!option) throw new Error('Option non trouvée');
    await option.destroy();
    return true;
  }
}

module.exports = new ProductService();
