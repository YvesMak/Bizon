'use strict';

/**
 * Options / variantes de produit :
 *  - option_groups : groupes (ex. « Taille » à choix unique, « Suppléments » à
 *    choix multiple), rattachés à un produit.
 *  - product_options : choix au sein d'un groupe, avec un delta de prix.
 *  - order_items.options : snapshot JSONB des options choisies à la commande.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('option_groups', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      restaurant_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'restaurants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      product_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.ENUM('single', 'multiple'), allowNull: false, defaultValue: 'single' },
      required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('option_groups', ['product_id'], { name: 'option_groups_product_idx' });

    await queryInterface.createTable('product_options', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      restaurant_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'restaurants', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      group_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'option_groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING, allowNull: false },
      price_delta: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('product_options', ['group_id'], { name: 'product_options_group_idx' });

    await queryInterface.addColumn('order_items', 'options', {
      type: Sequelize.JSONB, allowNull: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('order_items', 'options');
    await queryInterface.dropTable('product_options');
    await queryInterface.dropTable('option_groups');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_option_groups_type" CASCADE;');
  }
};
