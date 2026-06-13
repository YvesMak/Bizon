'use strict';

/**
 * Table des paiements d'abonnement (plateforme) : trace l'activation d'un plan
 * payant par un restaurant via Campay (Mobile Money).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('subscription_payments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      restaurant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'restaurants', key: 'id' },
        onDelete: 'CASCADE'
      },
      reference: { type: Sequelize.STRING, allowNull: false, unique: true },
      plan: { type: Sequelize.ENUM('basic', 'premium', 'enterprise'), allowNull: false },
      cadence: { type: Sequelize.ENUM('monthly', 'yearly'), allowNull: false, defaultValue: 'monthly' },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      currency: { type: Sequelize.STRING, allowNull: false, defaultValue: 'XAF' },
      status: { type: Sequelize.ENUM('pending', 'successful', 'failed'), allowNull: false, defaultValue: 'pending' },
      operator: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('subscription_payments', ['restaurant_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('subscription_payments');
    // Nettoie les types ENUM créés par Postgres.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscription_payments_plan";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscription_payments_cadence";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_subscription_payments_status";');
  }
};
