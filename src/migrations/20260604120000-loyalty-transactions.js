'use strict';

/**
 * Journal des points de fidélité (ledger).
 * Index unique (order_id, type) → idempotence du gain de points par commande.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('loyalty_transactions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      restaurant_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'restaurants', key: 'id' }, onUpdate: 'CASCADE'
      },
      customer_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'customers', key: 'id' }, onUpdate: 'CASCADE'
      },
      order_id: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: 'orders', key: 'id' }, onUpdate: 'CASCADE'
      },
      points: { type: Sequelize.INTEGER, allowNull: false },
      type: { type: Sequelize.ENUM('earn', 'redeem', 'adjust'), allowNull: false, defaultValue: 'earn' },
      balance_after: { type: Sequelize.INTEGER, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('loyalty_transactions', ['order_id', 'type'], {
      unique: true,
      name: 'loyalty_unique_earn_per_order'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('loyalty_transactions');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_loyalty_transactions_type" CASCADE;'
    );
  }
};
