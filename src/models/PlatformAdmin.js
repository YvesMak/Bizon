const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * Super-administrateur de la plateforme.
 * N'appartient à aucun restaurant : il gère les propriétaires et les restaurants.
 */
const PlatformAdmin = sequelize.define('PlatformAdmin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'platform_admins',
  timestamps: true,
  hooks: {
    beforeCreate: async (admin) => {
      if (admin.password) {
        admin.password = await bcrypt.hash(admin.password, 10);
      }
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        admin.password = await bcrypt.hash(admin.password, 10);
      }
    }
  }
});

PlatformAdmin.prototype.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = PlatformAdmin;
