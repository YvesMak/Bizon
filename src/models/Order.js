const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  restaurant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'restaurants',
      key: 'id'
    }
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true, // null = commande passée par le client lui-même (self-service)
    references: {
      model: 'users',
      key: 'id'
    }
  },
  order_number: {
    type: DataTypes.STRING,
    allowNull: false
    // Unicité par restaurant (index composite ci-dessous), pas globale :
    // le numéro est généré par compteur par restaurant/jour.
  },
  type: {
    type: DataTypes.ENUM('dine_in', 'takeaway', 'delivery'),
    defaultValue: 'dine_in'
  },
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Adresse de livraison (type = delivery)'
  },
  status: {
    type: DataTypes.ENUM('draft', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'),
    defaultValue: 'draft'
  },
  table_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Nom du client si pas dans base customers'
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  tax_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  delivery_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'orders',
  timestamps: true,
  indexes: [
    // Unicité du numéro de commande PAR restaurant (multi-restaurant safe).
    { unique: true, fields: ['restaurant_id', 'order_number'], name: 'orders_restaurant_order_number_unique' }
  ]
});

module.exports = Order;
