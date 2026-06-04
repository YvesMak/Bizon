const { Order, OrderItem, Product, Customer, Payment } = require('../../models');
const { sequelize } = require('../../config/database');
const { Op } = require('sequelize');
const ProductService = require('../products/service');
const VoucherService = require('../vouchers/service');
const logger = require('../../utils/logger');

/**
 * =================================================================
 * ORDRE CYCLE DE VIE DES COMMANDES - RÈGLES STRICTES MVP
 * =================================================================
 * 
 * FLUX NORMAL :
 * draft → confirmed → preparing → ready → paid
 * 
 * ANNULATION POSSIBLE :
 * - depuis draft (avant envoi cuisine)
 * - depuis confirmed (juste après envoi)
 * - INTERDITE depuis preparing/ready/paid
 * 
 * RÈGLES MÉTIER CRITIQUES :
 * 1. Stock décrémenté UNIQUEMENT au passage draft → confirmed
 * 2. Stock restauré UNIQUEMENT au passage → cancelled
 * 3. AUCUN saut d'état autorisé
 * 4. AUCUN retour en arrière possible
 * 
 * =================================================================
 */

// Machine à états stricte
const STATUS_TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],  // Annulation possible si pas encore en cuisine
  preparing: ['ready'],                    // Plus d'annulation possible
  ready: ['paid'],                         // Commande prête, attente paiement
  paid: [],                                // État final
  cancelled: []                            // État final
};

// États visibles par rôle
const VISIBLE_STATUS_BY_ROLE = {
  waiter: ['draft', 'confirmed', 'preparing', 'ready'],  // Pas de paid/cancelled
  cashier: ['ready', 'paid'],                            // Uniquement paiement
  manager: ['draft', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'],  // Tout
  owner: ['draft', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled']     // Tout
};

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

  /**
   * =================================================================
   * VALIDATION TRANSITION D'ÉTAT - GARDE-FOU CRITIQUE
   * =================================================================
   * Vérifie qu'une transition de statut est autorisée
   * Empêche tout saut d'état ou retour en arrière
   * 
   * @throws {Error} si transition invalide
   */
  validateStatusTransition(currentStatus, newStatus) {
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
    
    if (!allowedTransitions) {
      throw new Error(`État actuel inconnu: ${currentStatus}`);
    }
    
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Transition interdite: ${currentStatus} → ${newStatus}. ` +
        `Transitions autorisées: ${allowedTransitions.join(', ')}`
      );
    }
    
    return true;
  }

  /**
   * Filtre les commandes selon le rôle
   */
  getVisibleStatusForRole(role) {
    return VISIBLE_STATUS_BY_ROLE[role] || VISIBLE_STATUS_BY_ROLE.waiter;
  }

  async getAll(restaurantId, filters = {}, userRole = null) {
    const where = { restaurant_id: restaurantId };

    // 🔒 FILTRAGE PAR RÔLE : Le serveur ne voit pas draft/paid/cancelled
    if (userRole && VISIBLE_STATUS_BY_ROLE[userRole]) {
      where.status = { [Op.in]: VISIBLE_STATUS_BY_ROLE[userRole] };
    }

    if (filters.status) {
      // Support pour statuts multiples séparés par virgule
      if (filters.status.includes(',')) {
        const requestedStatuses = filters.status.split(',');
        
        // Intersection avec les statuts visibles par rôle
        if (userRole && VISIBLE_STATUS_BY_ROLE[userRole]) {
          const allowedStatuses = requestedStatuses.filter(s => 
            VISIBLE_STATUS_BY_ROLE[userRole].includes(s)
          );
          where.status = { [Op.in]: allowedStatuses };
        } else {
          where.status = { [Op.in]: requestedStatuses };
        }
      } else {
        // Vérifier que le statut demandé est visible par le rôle
        if (userRole && VISIBLE_STATUS_BY_ROLE[userRole] && 
            !VISIBLE_STATUS_BY_ROLE[userRole].includes(filters.status)) {
          throw new Error(`Statut ${filters.status} non autorisé pour le rôle ${userRole}`);
        }
        where.status = filters.status;
      }
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
   * =================================================================
   * CRÉATION COMMANDE - RÈGLE CRITIQUE : DRAFT PAR DÉFAUT
   * =================================================================
   * Les commandes sont créées en état DRAFT
   * Le stock N'EST PAS touché à ce stade
   * Le passage à CONFIRMED décrémente le stock
   */
  async create(restaurantId, userId, data) {
    const transaction = await sequelize.transaction();

    try {
      const { customer_id, type, table_number, customer_name, items, notes } = data;

      // 🔒 VALIDATION SERVEUR : table OU nom client obligatoire
      if (!table_number && !customer_name) {
        throw new Error('Le numéro de table ou le nom du client est obligatoire');
      }

      // Validation des items
      if (!items || items.length === 0) {
        throw new Error('La commande doit contenir au moins un produit');
      }

      // Génération du numéro de commande
      const orderNumber = await this.generateOrderNumber(restaurantId);

      // Calcul des totaux (SANS décrémentation stock)
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

        // ⚠️ VÉRIFICATION STOCK MAIS PAS DE DÉCRÉMENTATION EN DRAFT
        if (product.track_stock && product.stock_quantity < item.quantity) {
          throw new Error(`Stock insuffisant pour "${product.name}"`);
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
      
      // Calcul des taxes et total
      const taxAmount = subtotal * 0.18;
      const totalAmount = subtotal + taxAmount;

      // 🎯 CRÉATION EN DRAFT PAR DÉFAUT
      const order = await Order.create({
        restaurant_id: restaurantId,
        customer_id,
        user_id: userId,
        order_number: orderNumber,
        type: type || 'dine_in',
        status: 'draft',  // ⚠️ DRAFT, pas confirmed !
        table_number,
        customer_name,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: 0,
        total_amount: totalAmount,
        notes
      }, { transaction });

      // // Safe logging without Sequelize model serialization
      // logger.info('ORDER_CREATED_DRAFT', JSON.stringify({
      //   restaurant_id: restaurantId,
      //   order_id: order.id,
      //   order_number: orderNumber,
      //   items_count: items.length,
      //   user_id: userId || null
      // }));

      // Création des items
      for (const item of validatedItems) {
        await OrderItem.create({
          order_id: order.id,
          ...item
        }, { transaction });
      }

      await transaction.commit();

      // Retourner un objet simple avec les champs principaux
      return {
        id: order.id,
        restaurant_id: restaurantId,
        order_number: orderNumber,
        status: 'draft',
        type: order.type,
        table_number: order.table_number,
        customer_name: order.customer_name,
        total_amount: totalAmount,
        created_at: order.created_at
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Décrémente le stock des produits d'une commande de façon atomique
   * (protection contre les races). Réutilisé par updateStatus (draft→confirmed)
   * et par le règlement d'un paiement client (Flutterwave).
   * @param {{items: Array}} order - commande avec ses `items` chargés
   */
  async decrementStockForOrder(order, transaction) {
    for (const item of order.items) {
      const product = await Product.findByPk(item.product_id, { transaction });
      if (!product) {
        throw new Error(`Produit ${item.product_id} non trouvé`);
      }
      if (product.track_stock) {
        const [updatedRows] = await sequelize.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - :quantity, updated_at = NOW()
           WHERE id = :productId
           AND stock_quantity >= :quantity
           AND track_stock = true`,
          {
            replacements: { productId: product.id, quantity: item.quantity },
            transaction,
            type: sequelize.QueryTypes.UPDATE
          }
        );
        if (updatedRows === 0) {
          throw new Error(
            `Stock insuffisant pour "${product.name}". ` +
            `Commande annulée, rechargez la liste des produits.`
          );
        }
      }
    }
  }

  /**
   * =================================================================
   * CRÉATION COMMANDE CLIENT (self-service)
   * =================================================================
   * Commande passée par le client lui-même (sans staff → user_id null).
   * Créée en DRAFT, stock NON engagé : il le sera au règlement du paiement.
   * Types supportés : dine_in (table), takeaway, delivery (adresse).
   */
  async createForCustomer(restaurantId, customerId, data) {
    const transaction = await sequelize.transaction();
    try {
      const { type = 'dine_in', table_number, delivery_address, items, notes, voucher_code } = data;

      if (!['dine_in', 'takeaway', 'delivery'].includes(type)) {
        throw new Error('Type de commande invalide');
      }
      if (!items || items.length === 0) {
        throw new Error('La commande doit contenir au moins un produit');
      }
      if (type === 'dine_in' && !table_number) {
        throw new Error('Le numéro de table est obligatoire (sur place)');
      }
      if (type === 'delivery' && !delivery_address) {
        throw new Error('L\'adresse de livraison est obligatoire');
      }

      const customer = await Customer.findOne({
        where: { id: customerId, restaurant_id: restaurantId }, transaction
      });
      if (!customer) throw new Error('Client non trouvé');

      const orderNumber = await this.generateOrderNumber(restaurantId);

      let subtotal = 0;
      const validatedItems = [];
      for (const item of items) {
        const product = await Product.findOne({
          where: { id: item.product_id, restaurant_id: restaurantId }, transaction
        });
        if (!product) throw new Error(`Produit ${item.product_id} non trouvé`);
        if (!product.is_available) throw new Error(`Le produit "${product.name}" n'est pas disponible`);
        if (product.track_stock && product.stock_quantity < item.quantity) {
          throw new Error(`Stock insuffisant pour "${product.name}"`);
        }
        const itemSubtotal = parseFloat(product.price) * item.quantity;
        subtotal += itemSubtotal;
        validatedItems.push({
          product_id: product.id, product_name: product.name,
          quantity: item.quantity, unit_price: product.price,
          subtotal: itemSubtotal, notes: item.notes
        });
      }

      // Code promo éventuel : réduction appliquée sur le sous-total.
      let discount = 0;
      let appliedVoucher = null;
      if (voucher_code) {
        const res = await VoucherService.validateAndCompute(
          restaurantId, voucher_code, subtotal, { transaction }
        );
        discount = res.discount;
        appliedVoucher = res.voucher;
      }

      const discountedSubtotal = subtotal - discount;
      const taxAmount = discountedSubtotal * 0.18;
      const totalAmount = discountedSubtotal + taxAmount;

      const order = await Order.create({
        restaurant_id: restaurantId,
        customer_id: customerId,
        user_id: null,
        order_number: orderNumber,
        type,
        status: 'draft',
        table_number: type === 'dine_in' ? table_number : null,
        delivery_address: type === 'delivery' ? delivery_address : null,
        customer_name: `${customer.first_name} ${customer.last_name}`.trim(),
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        notes
      }, { transaction });

      for (const item of validatedItems) {
        await OrderItem.create({ order_id: order.id, ...item }, { transaction });
      }

      if (appliedVoucher) {
        await VoucherService.consume(appliedVoucher.id, transaction);
      }

      await transaction.commit();
      return {
        id: order.id,
        order_number: orderNumber,
        status: 'draft',
        type: order.type,
        delivery_address: order.delivery_address,
        table_number: order.table_number,
        subtotal,
        discount_amount: discount,
        total_amount: totalAmount,
        created_at: order.created_at
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * =================================================================
   * MISE À JOUR STATUT - DÉCLENCHE LA GESTION DU STOCK
   * =================================================================
   * 
   * RÈGLE CRITIQUE : Stock décrémenté au passage draft → confirmed
   * C'est ici que la commande "engage" le stock
   */
  async updateStatus(restaurantId, orderId, newStatus, userId = null) {
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

      // 🔒 VALIDATION TRANSITION D'ÉTAT
      this.validateStatusTransition(order.status, newStatus);

      // =================================================================
      // 🎯 GESTION DU STOCK : DÉCRÉMENTATION AU PASSAGE À CONFIRMED
      // =================================================================
      if (order.status === 'draft' && newStatus === 'confirmed') {
        await this.decrementStockForOrder(order, transaction);
      }

      // Mise à jour du statut
      const previousStatus = order.status;  // Sauvegarder avant update
      const updateData = { status: newStatus };
      
      if (newStatus === 'paid') {
        updateData.completed_at = new Date();
      }

      await order.update(updateData, { transaction });

      // logger.info('ORDER_STATUS_UPDATED', JSON.stringify({
      //   restaurant_id: restaurantId,
      //   order_id: orderId,
      //   from_status: previousStatus,
      //   to_status: newStatus,
      //   user_id: userId || null
      // }));

      await transaction.commit();
      
      // Retourner un objet simple sans relations pour éviter stack overflow
      return {
        id: order.id,
        restaurant_id: restaurantId,
        order_number: order.order_number,
        status: newStatus,
        type: order.type,
        table_number: order.table_number,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        completed_at: updateData.completed_at || null
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * =================================================================
   * ANNULATION - RESTAURATION DU STOCK
   * =================================================================
   * 
   * RÈGLES :
   * - Annulation autorisée depuis draft ou confirmed uniquement
   * - Si confirmed : stock déjà décrémenté → on restaure
   * - Si draft : stock jamais touché → rien à restaurer
   */
  async cancel(restaurantId, orderId, userId = null) {
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

      // 🔒 VALIDATION : Annulation autorisée ?
      this.validateStatusTransition(order.status, 'cancelled');

      // 🔒 PROTECTION FINANCIÈRE : Aucun paiement en cours
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

      // =================================================================
      // 🎯 RESTAURATION STOCK : UNIQUEMENT SI ÉTAIT CONFIRMED
      // =================================================================
      if (order.status === 'confirmed') {
        // logger.info('ORDER_CANCELLING_CONFIRMED', JSON.stringify({
        //   restaurant_id: restaurantId,
        //   order_id: orderId,
        //   note: 'Restauration du stock en cours'
        // }));

        for (const item of order.items) {
          const product = await Product.findByPk(item.product_id, { transaction });
          
          if (product && product.track_stock) {
            await product.update({
              stock_quantity: product.stock_quantity + item.quantity
            }, { transaction });

            // logger.info('STOCK_RESTORED', JSON.stringify({
            //   restaurant_id: restaurantId,
            //   order_id: orderId,
            //   product_id: product.id,
            //   product_name: product.name,
            //   quantity: item.quantity
            // }));
          }
        }
      } else if (order.status === 'draft') {
        // logger.info('ORDER_CANCELLING_DRAFT', JSON.stringify({
        //   restaurant_id: restaurantId,
        //   order_id: orderId,
        //   note: 'Aucun stock à restaurer (jamais décrémenté)'
        // }));
      }

      const previousStatus = order.status;  // Sauvegarder avant update
      await order.update({ status: 'cancelled' }, { transaction });

      // logger.info('ORDER_CANCELLED', JSON.stringify({
      //   restaurant_id: restaurantId,
      //   order_id: orderId,
      //   previous_status: previousStatus,
      //   user_id: userId || null
      // }));

      await transaction.commit();
      
      // Retourner un objet simple sans relations pour éviter stack overflow
      return {
        id: order.id,
        restaurant_id: restaurantId,
        order_number: order.order_number,
        status: 'cancelled',
        type: order.type,
        table_number: order.table_number,
        customer_name: order.customer_name,
        total_amount: order.total_amount
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = new OrderService();
