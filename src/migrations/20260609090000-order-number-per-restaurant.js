'use strict';

/**
 * Corrige l'unicité du numéro de commande.
 *
 * Avant : `order_number` était unique GLOBALEMENT, mais il est généré par un
 * compteur par restaurant/jour (ORD-YYYYMMDD-0001). Dès qu'un 2e restaurant
 * passait sa 1re commande du jour, il regénérait un numéro déjà pris → échec.
 *
 * Après : unicité composite (restaurant_id, order_number).
 */
module.exports = {
  async up(queryInterface) {
    // Supprimer l'ancienne contrainte/index unique global (nom Postgres par défaut).
    await queryInterface.sequelize.query(
      'ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_order_number_key";'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "orders_order_number_key";'
    );

    // Unicité par restaurant.
    await queryInterface.addIndex('orders', ['restaurant_id', 'order_number'], {
      unique: true,
      name: 'orders_restaurant_order_number_unique'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('orders', 'orders_restaurant_order_number_unique');
    await queryInterface.changeColumn('orders', 'order_number', {
      type: Sequelize.STRING,
      allowNull: false,
      unique: true
    });
  }
};
