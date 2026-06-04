'use strict';

/** Bons de réduction / codes promo (par restaurant). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('vouchers', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      restaurant_id: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'restaurants', key: 'id' }, onUpdate: 'CASCADE'
      },
      code: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.STRING, allowNull: true },
      discount_type: { type: Sequelize.ENUM('percentage', 'fixed'), allowNull: false, defaultValue: 'percentage' },
      discount_value: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      min_order_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      max_discount: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      expires_at: { type: Sequelize.DATE, allowNull: true },
      max_uses: { type: Sequelize.INTEGER, allowNull: true },
      used_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('vouchers', ['restaurant_id', 'code'], {
      unique: true, name: 'voucher_unique_code_per_restaurant'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('vouchers');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_vouchers_discount_type" CASCADE;'
    );
  }
};
