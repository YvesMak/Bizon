const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Choix au sein d'un groupe d'options, avec un delta de prix (ex. +500 FCFA).
const ProductOption = sequelize.define('ProductOption', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  restaurant_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'restaurants', key: 'id' } },
  group_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'option_groups', key: 'id' } },
  name: { type: DataTypes.STRING, allowNull: false },
  price_delta: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  display_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: 'product_options',
  timestamps: true
});

module.exports = ProductOption;
