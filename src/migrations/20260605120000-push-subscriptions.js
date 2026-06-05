'use strict';

/**
 * Abonnements Web Push des clients (notifications même app fermée).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('push_subscriptions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      customer_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'customers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      restaurant_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'restaurants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      endpoint: { type: Sequelize.TEXT, allowNull: false, unique: true },
      p256dh: { type: Sequelize.STRING, allowNull: false },
      auth: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('push_subscriptions', ['customer_id'], {
      name: 'push_subscriptions_customer_idx'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('push_subscriptions');
  }
};
