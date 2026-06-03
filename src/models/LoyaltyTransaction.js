const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Journal (ledger) des mouvements de points de fidélité.
const LoyaltyTransaction = sequelize.define('LoyaltyTransaction', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  restaurant_id: {
    type: DataTypes.UUID, allowNull: false,
    references: { model: 'restaurants', key: 'id' }
  },
  customer_id: {
    type: DataTypes.UUID, allowNull: false,
    references: { model: 'customers', key: 'id' }
  },
  order_id: {
    type: DataTypes.UUID, allowNull: true,
    references: { model: 'orders', key: 'id' }
  },
  // Positif = gagné, négatif = dépensé.
  points: { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.ENUM('earn', 'redeem', 'adjust'),
    allowNull: false, defaultValue: 'earn'
  },
  // Solde du client après ce mouvement (pratique pour l'affichage de l'historique).
  balance_after: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true }
}, {
  tableName: 'loyalty_transactions',
  timestamps: true,
  indexes: [
    // Idempotence : un seul gain par commande.
    { unique: true, fields: ['order_id', 'type'], name: 'loyalty_unique_earn_per_order' }
  ]
});

module.exports = LoyaltyTransaction;
