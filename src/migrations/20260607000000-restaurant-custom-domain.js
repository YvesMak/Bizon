'use strict';

/**
 * Domaine personnalisé d'un restaurant (ex. commande.chez-paul.cm).
 * Nullable + unique : permet de résoudre le restaurant depuis le Host HTTP.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('restaurants', 'custom_domain', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('restaurants', 'custom_domain');
  }
};
