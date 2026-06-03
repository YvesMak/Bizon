'use strict';

/**
 * Support des commandes passées par le client lui-même (self-service) :
 * - orders.user_id devient nullable (pas de staff associé)
 * - nouveau type de commande 'delivery'
 * - orders.delivery_address pour l'adresse de livraison
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. user_id nullable (SQL brut : déterministe, indépendant de la FK existante)
    await queryInterface.sequelize.query(
      `ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;`
    );

    // 2. Ajouter 'delivery' à l'enum des types (hors transaction).
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_orders_type" ADD VALUE IF NOT EXISTS 'delivery';`
    );

    // 3. Colonne adresse de livraison
    await queryInterface.addColumn('orders', 'delivery_address', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('orders', 'delivery_address');

    // PostgreSQL ne permet pas de retirer une valeur d'enum simplement :
    // on laisse 'delivery' en place (sans impact). On restaure user_id NOT NULL.
    await queryInterface.sequelize.query(
      `ALTER TABLE "orders" ALTER COLUMN "user_id" SET NOT NULL;`
    );
  }
};
