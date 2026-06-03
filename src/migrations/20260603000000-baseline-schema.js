'use strict';

/**
 * Migration baseline — schéma initial complet de Bizon.
 *
 * Reflète fidèlement les modèles Sequelize au moment de l'introduction des
 * migrations versionnées. `createTable` génère du `CREATE TABLE IF NOT EXISTS`
 * sous PostgreSQL : cette migration est donc sûre à exécuter sur une base
 * existante (créée historiquement via `sequelize.sync`) comme sur une base
 * vierge (CI, environnement de test, nouveau déploiement).
 *
 * Convention de colonnes : `underscored: true` → created_at / updated_at.
 */

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false }
});

const fk = (Sequelize, table, { allowNull = false, onDelete } = {}) => ({
  type: Sequelize.UUID,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  ...(onDelete ? { onDelete } : {})
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const pk = { type: Sequelize.UUID, primaryKey: true, allowNull: false };
    const dec = () => ({ type: Sequelize.DECIMAL(10, 2) });

    // 1. restaurants
    await queryInterface.createTable('restaurants', {
      id: pk,
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      address: { type: Sequelize.TEXT },
      phone: { type: Sequelize.STRING },
      email: { type: Sequelize.STRING },
      logo_url: { type: Sequelize.STRING },
      status: { type: Sequelize.ENUM('active', 'suspended', 'closed'), defaultValue: 'active' },
      settings: { type: Sequelize.JSONB, defaultValue: {} },
      ...timestamps(Sequelize)
    });

    // 2. users
    await queryInterface.createTable('users', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      first_name: { type: Sequelize.STRING, allowNull: false },
      last_name: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('owner', 'manager', 'waiter', 'cashier'), defaultValue: 'waiter' },
      phone: { type: Sequelize.STRING },
      status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' },
      ...timestamps(Sequelize)
    });

    // 3. customers
    await queryInterface.createTable('customers', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      first_name: { type: Sequelize.STRING, allowNull: false },
      last_name: { type: Sequelize.STRING, allowNull: false },
      phone: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING },
      address: { type: Sequelize.TEXT },
      notes: { type: Sequelize.TEXT },
      password_hash: { type: Sequelize.STRING },
      loyalty_points: { type: Sequelize.INTEGER, defaultValue: 0 },
      ...timestamps(Sequelize)
    });

    // 4. menus
    await queryInterface.createTable('menus', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      display_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      ...timestamps(Sequelize)
    });

    // 5. categories
    await queryInterface.createTable('categories', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      menu_id: fk(Sequelize, 'menus'),
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      image_url: { type: Sequelize.STRING },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      display_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      ...timestamps(Sequelize)
    });

    // 6. products
    await queryInterface.createTable('products', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      category_id: fk(Sequelize, 'categories'),
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      price: { ...dec(), allowNull: false },
      cost_price: { ...dec() },
      image_url: { type: Sequelize.STRING },
      stock_quantity: { type: Sequelize.INTEGER, defaultValue: 0 },
      low_stock_threshold: { type: Sequelize.INTEGER, defaultValue: 10 },
      track_stock: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_available: { type: Sequelize.BOOLEAN, defaultValue: true },
      display_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      ...timestamps(Sequelize)
    });

    // 7. orders
    await queryInterface.createTable('orders', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      customer_id: fk(Sequelize, 'customers', { allowNull: true }),
      user_id: fk(Sequelize, 'users'),
      order_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      type: { type: Sequelize.ENUM('dine_in', 'takeaway'), defaultValue: 'dine_in' },
      status: {
        type: Sequelize.ENUM('draft', 'confirmed', 'preparing', 'ready', 'paid', 'cancelled'),
        defaultValue: 'draft'
      },
      table_number: { type: Sequelize.STRING },
      customer_name: { type: Sequelize.STRING },
      subtotal: { ...dec(), allowNull: false, defaultValue: 0 },
      tax_amount: { ...dec(), defaultValue: 0 },
      discount_amount: { ...dec(), defaultValue: 0 },
      total_amount: { ...dec(), allowNull: false, defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      completed_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize)
    });

    // 8. order_items
    await queryInterface.createTable('order_items', {
      id: pk,
      order_id: fk(Sequelize, 'orders', { onDelete: 'CASCADE' }),
      product_id: fk(Sequelize, 'products'),
      product_name: { type: Sequelize.STRING, allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unit_price: { ...dec(), allowNull: false },
      subtotal: { ...dec(), allowNull: false },
      notes: { type: Sequelize.TEXT },
      ...timestamps(Sequelize)
    });

    // 9. payments
    await queryInterface.createTable('payments', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      order_id: fk(Sequelize, 'orders'),
      amount: { ...dec(), allowNull: false },
      method: { type: Sequelize.ENUM('mobile_money', 'cash', 'card'), defaultValue: 'mobile_money' },
      status: { type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'), defaultValue: 'pending' },
      transaction_code: { type: Sequelize.STRING },
      phone_number: { type: Sequelize.STRING },
      provider: { type: Sequelize.STRING },
      reference: { type: Sequelize.STRING },
      metadata: { type: Sequelize.JSONB, defaultValue: {} },
      verified_at: { type: Sequelize.DATE },
      ...timestamps(Sequelize)
    });

    // 10. invoices
    await queryInterface.createTable('invoices', {
      id: pk,
      restaurant_id: fk(Sequelize, 'restaurants'),
      order_id: fk(Sequelize, 'orders'),
      invoice_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      customer_name: { type: Sequelize.STRING },
      customer_phone: { type: Sequelize.STRING },
      subtotal: { ...dec(), allowNull: false },
      tax_amount: { ...dec(), defaultValue: 0 },
      discount_amount: { ...dec(), defaultValue: 0 },
      total_amount: { ...dec(), allowNull: false },
      pdf_url: { type: Sequelize.STRING },
      status: { type: Sequelize.ENUM('draft', 'issued', 'paid', 'cancelled'), defaultValue: 'issued' },
      issued_at: { type: Sequelize.DATE, defaultValue: Sequelize.fn('NOW') },
      ...timestamps(Sequelize)
    });

    // 11. subscriptions
    await queryInterface.createTable('subscriptions', {
      id: pk,
      restaurant_id: { ...fk(Sequelize, 'restaurants'), unique: true },
      plan: { type: Sequelize.ENUM('trial', 'basic', 'premium', 'enterprise'), defaultValue: 'trial' },
      status: { type: Sequelize.ENUM('active', 'expired', 'cancelled', 'suspended'), defaultValue: 'active' },
      start_date: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      end_date: { type: Sequelize.DATE, allowNull: false },
      features: { type: Sequelize.JSONB, defaultValue: {} },
      max_users: { type: Sequelize.INTEGER, defaultValue: 5 },
      max_products: { type: Sequelize.INTEGER, defaultValue: 100 },
      ...timestamps(Sequelize)
    });
  },

  async down(queryInterface, Sequelize) {
    // Ordre inverse pour respecter les contraintes de clés étrangères.
    const tables = [
      'subscriptions', 'invoices', 'payments', 'order_items', 'orders',
      'products', 'categories', 'menus', 'customers', 'users', 'restaurants'
    ];
    for (const t of tables) {
      await queryInterface.dropTable(t);
    }

    // Sous PostgreSQL, dropTable ne supprime pas les types ENUM associés.
    const enums = [
      'enum_restaurants_status', 'enum_users_role', 'enum_users_status',
      'enum_orders_type', 'enum_orders_status', 'enum_payments_method',
      'enum_payments_status', 'enum_invoices_status', 'enum_subscriptions_plan',
      'enum_subscriptions_status'
    ];
    for (const e of enums) {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${e}" CASCADE;`);
    }
  }
};
