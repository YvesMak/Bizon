const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Paiement d'abonnement (plateforme) : trace une tentative d'activation d'un
// plan payant par un restaurant, via Campay (Mobile Money).
const SubscriptionPayment = sequelize.define('SubscriptionPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  restaurant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'restaurants', key: 'id' }
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  plan: {
    type: DataTypes.ENUM('basic', 'premium', 'enterprise'),
    allowNull: false
  },
  cadence: {
    type: DataTypes.ENUM('monthly', 'yearly'),
    allowNull: false,
    defaultValue: 'monthly'
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'XAF'
  },
  status: {
    type: DataTypes.ENUM('pending', 'successful', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  operator: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'subscription_payments',
  timestamps: true
});

module.exports = SubscriptionPayment;
