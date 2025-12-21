const { Order, OrderItem, Product, Customer, Payment } = require('../../models');
const { sequelize } = require('../../config/database');
const { Op } = require('sequelize');
const ProductService = require('../products/service');
const logger = require('../../utils/logger');

class OrderService {
  /**
   * Génère un numéro de commande unique
   */
  async generateOrderNumber(restaurantId) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const count = await Order.count({
      where: {
        restaurant_id: restaurantId,
        created_at: {
          [Op.gte]: new Date(today.setHours(0, 0, 0, 0))
        }
      }
    });

    return `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async getAll(restaurantId, filters = {}) {
    const where = { restaurant_id: restaurantId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.startDate && filters.endDate) {
      where.created_at = {
        [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
      };
    }

    const orders = await Order.findAll({
      where,
      include: [
        {
          model: OrderItem,
          as: 'items'
        },
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'first_name', 'last_name', 'phone']
        },
        {
          model: Payment,
          as: 'payments'
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return orders;
  }

  async getById(restaurantId, orderId) {
    const order = await Order.findOne({
      where: {
        id: orderId,
        restaurant_id: restaurantId
      },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [{
            model: Product,
            as: 'product',
            attributes: ['id', 'name', 'image_url']
          }]
        },
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Payment,
          as: 'payments'
        }
      ]
    });

    if (!order) {
      throw new Error('Commande non trouvée');
    }

    return order;
  }

  /**
   * Création d'une commande avec gestion du stock
   */
  async create(restaurantId, userId, data) {
    const transaction = await sequelize.transaction();

    try {
      const { customer_id, type, table_number, items, notes } = data;

      // Validation des items
      if (!items || items.length === 0) {
        throw new Error('La commande doit contenir au moins un produit');
      }

      // Génération du numéro de commande
      const orderNumber = await this.generateOrderNumber(restaurantId);

      // Calcul des totaux et vérification du stock
      let subtotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const product = await Product.findOne({
          where: {
            id: item.product_id,
            restaurant_id: restaurantId
          },
          transaction
        });

        if (!product) {
          throw new Error(`Produit ${item.product_id} non trouvé`);
        }

        if (!product.is_available) {
          throw new Error(`Le produit "${product.name}" n'est pas disponible`);
        }

        // 🔒 PROTECTION RACE CONDITION : Vérification + décrémentation atomique
        if (product.track_stock) {
          if (product.stock_quantity < item.quantity) {
            throw new Error(`Stock insuffisant pour "${product.name}"`);
          }

          // Décrémentation atomique avec vérification dans UPDATE
          const [updatedRows] = await sequelize.query(
            `UPDATE products 
             SET stock_quantity = stock_quantity - :quantity, updated_at = NOW() 
             WHERE id = :productId 
             AND stock_quantity >= :quantity 
             AND track_stock = true`,
            {
              replacements: { 
                productId: product.id, 
                quantity: item.quantity 
              },
              transaction,
              type: sequelize.QueryTypes.UPDATE
            }
          );

          if (updatedRows === 0) {
            throw new Error(`Stock insuffisant pour "${product.name}" (concurrent order)`);
          }
        }

        const itemSubtotal = parseFloat(product.price) * item.quantity;
        subtotal += itemSubtotal;

        validatedItems.push({
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          unit_price: product.price,
          subtotal: itemSubtotal,
          notes: item.notes
        });
      }

      // TODO V2: APPLIQUER PROMOTIONS ICI
      // Avant calcul total, vérifier promotions applicables :
      // - const promotions = await PromotionService.findApplicable(restaurantId, validatedItems, subtotal, new Date());
      // - const discountAmount = PromotionService.calculateDiscount(promotions[0], subtotal);
      // - Utiliser Order.discount_amount (champ déjà existant)
      // Voir détails : V2-ROADMAP.md section "Système de Promotions"
      
      // Calcul des taxes et total (TVA 18% exemple)
      const taxAmount = subtotal * 0.18;
      const totalAmount = subtotal + taxAmount;

      // Création de la commande
      const order = await Order.create({
        restaurant_id: restaurantId,
        customer_id,
        user_id: userId,
        order_number: orderNumber,
        type: type || 'dine_in',
        status: 'pending',
        table_number,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: totalAmount,
        notes
      }, { transaction });

      // 📝 LOG: Création commande
      await logger.info('ORDER_CREATED', {
        restaurant_id: restaurantId,
        order_id: order.id,
        order_number: orderNumber,
        items_count: items.length,
        total_amount: totalAmount,
        user_id: userId
      });

      // Création des items
      for (const item of validatedItems) {
        await OrderItem.create({
          order_id: order.id,
          ...item
        }, { transaction });
      }

      await transaction.commit();

      // Recharger avec les relations
      return this.getById(restaurantId, order.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Mise à jour du statut de commande
   */
  async updateStatus(restaurantId, orderId, newStatus) {
    const order = await Order.findOne({
      where: {
        id: orderId,
        restaurant_id: restaurantId
      }
    });

    if (!order) {
      throw new Error('Commande non trouvée');
    }

    if (order.status === 'cancelled') {
      throw new Error('Impossible de modifier une commande annulée');
    }

    if (order.status === 'completed') {
      throw new Error('Impossible de modifier une commande terminée');
    }

    // Validation des transitions de statut
    const validTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['completed', 'cancelled']
    };

    if (!validTransitions[order.status]?.includes(newStatus)) {
      throw new Error(`Transition de statut invalide: ${order.status} -> ${newStatus}`);
    }

    const updateData = { status: newStatus };
    if (newStatus === 'completed') {
      updateData.completed_at = new Date();
    }

    await order.update(updateData);
    
    // TODO V2: ÉMETTRE WEBSOCKET EVENT  
    // Ajouter notification temps réel pour changement statut :
    // - socketService.emitToRestaurant(restaurantId, 'order:status_changed', { orderId, newStatus })
    // - Permet update automatique écran cuisine/caisse
    // Voir détails : V2-ROADMAP.md section "Notifications Temps Réel"
    
    return order;
  }

  /**
   * Annulation d'une commande avec restauration du stock
   */
  async cancel(restaurantId, orderId) {
    const transaction = await sequelize.transaction();

    try {
      const order = await Order.findOne({
        where: {
          id: orderId,
          restaurant_id: restaurantId
        },
        include: [{
          model: OrderItem,
          as: 'items'
        }],
        transaction
      });

      if (!order) {
        throw new Error('Commande non trouvée');
      }

      if (order.status === 'cancelled') {
        throw new Error('Commande déjà annulée');
      }

      if (order.status === 'completed') {
        throw new Error('Impossible d\'annuler une commande terminée');
      }

      // 🔒 PROTECTION FINANCIÈRE : Vérifier paiements avant annulation
      const completedPayment = await Payment.findOne({
        where: {
          order_id: orderId,
          restaurant_id: restaurantId,
          status: 'completed'
        },
        transaction
      });

      if (completedPayment) {
        throw new Error('Impossible d\'annuler une commande déjà payée. Effectuez un remboursement.');
      }

      // Restauration du stock
      for (const item of order.items) {
        const product = await Product.findByPk(item.product_id, { transaction });
        if (product && product.track_stock) {
          await product.update({
            stock_quantity: product.stock_quantity + item.quantity
          }, { transaction });
        }
      }

      // Mise à jour du statut
      await order.update({ status: 'cancelled' }, { transaction });

      await transaction.commit();
      return order;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new OrderService();
