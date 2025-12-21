const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  restaurant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'restaurants',
      key: 'id'
    }
  },
  plan: {
    type: DataTypes.ENUM('trial', 'basic', 'premium', 'enterprise'),
    defaultValue: 'trial'
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'cancelled', 'suspended'),
    defaultValue: 'active'
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  max_users: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  max_products: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  }
}, {
  tableName: 'subscriptions',
  timestamps: true
});

module.exports = Subscription;
