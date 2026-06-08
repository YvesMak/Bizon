'use strict';

/**
 * Statut d'un client (actif / bloqué) — permet au manager de bloquer un abus.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('customers', 'status', {
      type: Sequelize.ENUM('active', 'blocked'),
      allowNull: false,
      defaultValue: 'active'
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('customers', 'status');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_customers_status" CASCADE;'
    );
  }
};
