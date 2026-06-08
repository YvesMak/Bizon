const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  restaurant_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'restaurants', key: 'id' } },
  first_name: { type: DataTypes.STRING, allowNull: false },
  last_name: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  address: { type: DataTypes.TEXT, allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true },
  password_hash: { type: DataTypes.STRING, allowNull: true },
  loyalty_points: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('active', 'blocked'), allowNull: false, defaultValue: 'active' }
}, {
  tableName: 'customers',
  timestamps: true,
  hooks: {
    beforeCreate: async (customer) => {
      if (customer.password_hash && !customer.password_hash.startsWith('$2')) {
        customer.password_hash = await bcrypt.hash(customer.password_hash, 10);
      }
    },
    beforeUpdate: async (customer) => {
      if (customer.changed('password_hash') && customer.password_hash && !customer.password_hash.startsWith('$2')) {
        customer.password_hash = await bcrypt.hash(customer.password_hash, 10);
      }
    }
  }
});

Customer.prototype.comparePassword = async function(password) {
  if (!this.password_hash) return false;
  return bcrypt.compare(password, this.password_hash);
};

module.exports = Customer;
