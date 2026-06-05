'use strict';

/**
 * Couche « plateforme » au-dessus des restaurants :
 *  - table `platform_admins` : super-administrateurs de la plateforme (hors restaurant).
 *  - `restaurants.owner_id`   : propriétaire (User) à qui appartient le restaurant.
 *  - `users.max_restaurants`  : quota de restaurants qu'un owner peut créer/posséder.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_admins', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addColumn('restaurants', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('users', 'max_restaurants', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'max_restaurants');
    await queryInterface.removeColumn('restaurants', 'owner_id');
    await queryInterface.dropTable('platform_admins');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_platform_admins_status" CASCADE;'
    );
  }
};
