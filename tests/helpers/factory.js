// Fabriques de données de test : créent des entités valides minimales.
const {
  Restaurant, User, Customer, Menu, Category, Product, Voucher
} = require('../../src/models');
const authService = require('../../src/modules/auth/service');

let counter = 0;
const uniq = (prefix) => `${prefix}-${Date.now()}-${counter++}`;

async function createRestaurant(overrides = {}) {
  const name = overrides.name || uniq('Resto');
  return Restaurant.create({
    name,
    slug: overrides.slug || uniq('resto'),
    phone: '+237690000000',
    email: `${uniq('resto')}@test.cm`,
    status: 'active',
    ...overrides
  });
}

async function createUser(restaurantId, overrides = {}) {
  return User.create({
    restaurant_id: restaurantId,
    email: overrides.email || `${uniq('user')}@test.cm`,
    password: overrides.password || 'password123',
    first_name: overrides.first_name || 'Jean',
    last_name: overrides.last_name || 'Test',
    role: overrides.role || 'owner',
    status: 'active',
    ...overrides
  });
}

async function createCustomer(restaurantId, overrides = {}) {
  return Customer.create({
    restaurant_id: restaurantId,
    first_name: overrides.first_name || 'Awa',
    last_name: overrides.last_name || 'Client',
    phone: overrides.phone || uniq('+23769'),
    email: overrides.email || `${uniq('client')}@test.cm`,
    password_hash: overrides.password || 'motdepasse',
    ...overrides
  });
}

// Crée une arborescence menu → catégorie → produit disponible.
async function createFullMenu(restaurantId, { productPrice = 2000 } = {}) {
  const menu = await Menu.create({
    restaurant_id: restaurantId,
    name: 'Menu principal',
    is_active: true,
    display_order: 0
  });
  const category = await Category.create({
    restaurant_id: restaurantId,
    menu_id: menu.id,
    name: 'Entrées',
    is_active: true,
    display_order: 0
  });
  const product = await Product.create({
    restaurant_id: restaurantId,
    category_id: category.id,
    name: 'Salade test',
    price: productPrice,
    is_available: true,
    stock_quantity: 10
  });
  return { menu, category, product };
}

// Inscrit un owner via le service d'auth réel → renvoie token + entités.
async function registerOwner(overrides = {}) {
  return authService.register({
    name: overrides.name || uniq('Resto'),
    email: overrides.email || `${uniq('owner')}@test.cm`,
    password: overrides.password || 'password123',
    phone: '+237690000000',
    address: 'Douala'
  });
}

async function createVoucher(restaurantId, overrides = {}) {
  return Voucher.create({
    restaurant_id: restaurantId,
    code: overrides.code || uniq('PROMO').toUpperCase(),
    discount_type: overrides.discount_type || 'percentage',
    discount_value: overrides.discount_value != null ? overrides.discount_value : 10,
    min_order_amount: overrides.min_order_amount || 0,
    max_discount: overrides.max_discount || null,
    active: overrides.active !== undefined ? overrides.active : true,
    expires_at: overrides.expires_at || null,
    max_uses: overrides.max_uses || null,
    used_count: overrides.used_count || 0,
    points_cost: overrides.points_cost || 0,
    customer_id: overrides.customer_id || null
  });
}

module.exports = {
  createRestaurant,
  createUser,
  createCustomer,
  createFullMenu,
  registerOwner,
  createVoucher
};
