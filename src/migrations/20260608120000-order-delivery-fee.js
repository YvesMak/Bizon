'use strict';

/**
 * Frais de livraison enregistrés sur la commande.
 * (Le montant des frais et le minimum de commande livraison sont réglés par le
 *  restaurant dans settings.delivery_fee / settings.min_delivery_order — JSONB.)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('orders', 'delivery_fee', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('orders', 'delivery_fee');
  }
};
