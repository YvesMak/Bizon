'use strict';

/**
 * Récompenses fidélité : un bon peut coûter des points (points_cost) et
 * appartenir à un client (customer_id) lorsqu'il a été obtenu par échange.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('vouchers', 'points_cost', {
      type: Sequelize.INTEGER, allowNull: false, defaultValue: 0
    });
    await queryInterface.addColumn('vouchers', 'customer_id', {
      type: Sequelize.UUID, allowNull: true,
      references: { model: 'customers', key: 'id' }, onUpdate: 'CASCADE'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('vouchers', 'customer_id');
    await queryInterface.removeColumn('vouchers', 'points_cost');
  }
};
