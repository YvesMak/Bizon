const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Bon de réduction / code promo défini par le restaurant.
const Voucher = sequelize.define('Voucher', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  restaurant_id: {
    type: DataTypes.UUID, allowNull: false,
    references: { model: 'restaurants', key: 'id' }
  },
  code: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, allowNull: true },
  discount_type: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    allowNull: false, defaultValue: 'percentage'
  },
  // % (ex. 10) ou montant fixe en FCFA (ex. 500)
  discount_value: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0 } },
  // Montant minimum de commande requis (sous-total)
  min_order_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  // Plafond de réduction (pour les pourcentages), optionnel
  max_discount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  expires_at: { type: DataTypes.DATE, allowNull: true },
  // null = illimité
  max_uses: { type: DataTypes.INTEGER, allowNull: true },
  used_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'vouchers',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['restaurant_id', 'code'], name: 'voucher_unique_code_per_restaurant' }
  ]
});

module.exports = Voucher;
