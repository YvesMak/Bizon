const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Abonnement Web Push d'un client (un appareil/navigateur = un abonnement).
 * `endpoint` est unique : ré-abonner le même appareil m. à jour ses clés.
 */
const PushSubscription = sequelize.define('PushSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'customers', key: 'id' }
  },
  restaurant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'restaurants', key: 'id' }
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  p256dh: {
    type: DataTypes.STRING,
    allowNull: false
  },
  auth: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'push_subscriptions',
  timestamps: true
});

module.exports = PushSubscription;
