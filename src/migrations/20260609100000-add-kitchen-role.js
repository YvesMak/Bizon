'use strict';

/**
 * Ajoute le rôle « kitchen » (cuisine) à l'énumération des rôles utilisateur.
 * Ce rôle accède uniquement à l'écran cuisine (KDS).
 */
module.exports = {
  async up(queryInterface) {
    // PG 12+ : ADD VALUE IF NOT EXISTS (idempotent). Hors transaction.
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_users_role\" ADD VALUE IF NOT EXISTS 'kitchen';"
    );
  },

  async down() {
    // PostgreSQL ne permet pas de retirer simplement une valeur d'enum.
    // (Le rollback est volontairement un no-op : la valeur reste disponible.)
  }
};
