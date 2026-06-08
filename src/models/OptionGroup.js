const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Groupe d'options d'un produit (ex. « Taille », « Suppléments »).
const OptionGroup = sequelize.define('OptionGroup', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  restaurant_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'restaurants', key: 'id' } },
  product_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'products', key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('single', 'multiple'), allowNull: false, defaultValue: 'single' },
  required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'option_groups',
  timestamps: true
});

module.exports = OptionGroup;
