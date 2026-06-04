const Restaurant = require('./Restaurant');
const User = require('./User');
const Customer = require('./Customer');
const Menu = require('./Menu');
const Category = require('./Category');
const Product = require('./Product');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Payment = require('./Payment');
const Invoice = require('./Invoice');
const Subscription = require('./Subscription');
const LoyaltyTransaction = require('./LoyaltyTransaction');
const Voucher = require('./Voucher');

// Définition des relations
const initModels = () => {
  // Restaurant relations
  Restaurant.hasMany(User, { foreignKey: 'restaurant_id', as: 'users' });
  Restaurant.hasMany(Customer, { foreignKey: 'restaurant_id', as: 'customers' });
  Restaurant.hasMany(Menu, { foreignKey: 'restaurant_id', as: 'menus' });
  Restaurant.hasMany(Category, { foreignKey: 'restaurant_id', as: 'categories' });
  Restaurant.hasMany(Product, { foreignKey: 'restaurant_id', as: 'products' });
  Restaurant.hasMany(Order, { foreignKey: 'restaurant_id', as: 'orders' });
  Restaurant.hasMany(Payment, { foreignKey: 'restaurant_id', as: 'payments' });
  Restaurant.hasMany(Invoice, { foreignKey: 'restaurant_id', as: 'invoices' });
  Restaurant.hasOne(Subscription, { foreignKey: 'restaurant_id', as: 'subscription' });

  // User relations
  User.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  User.hasMany(Order, { foreignKey: 'user_id', as: 'orders' });

  // Customer relations
  Customer.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Customer.hasMany(Order, { foreignKey: 'customer_id', as: 'orders' });

  // Menu relations
  Menu.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Menu.hasMany(Category, { foreignKey: 'menu_id', as: 'categories' });

  // Category relations
  Category.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Category.belongsTo(Menu, { foreignKey: 'menu_id', as: 'menu' });
  Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });

  // Product relations
  Product.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
  Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' });

  // Order relations
  Order.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Order.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
  Order.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE' });
  Order.hasMany(Payment, { foreignKey: 'order_id', as: 'payments' });
  Order.hasOne(Invoice, { foreignKey: 'order_id', as: 'invoice' });

  // OrderItem relations
  OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
  OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

  // Payment relations
  Payment.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Payment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

  // Invoice relations
  Invoice.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Invoice.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

  // Subscription relations
  Subscription.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });

  // LoyaltyTransaction relations
  LoyaltyTransaction.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
  LoyaltyTransaction.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });
  LoyaltyTransaction.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Customer.hasMany(LoyaltyTransaction, { foreignKey: 'customer_id', as: 'loyaltyTransactions' });

  // Voucher relations
  Voucher.belongsTo(Restaurant, { foreignKey: 'restaurant_id', as: 'restaurant' });
  Restaurant.hasMany(Voucher, { foreignKey: 'restaurant_id', as: 'vouchers' });

  if (process.env.NODE_ENV !== 'test') {
    console.log('✅ Relations des modèles initialisées');
  }
};

module.exports = {
  Restaurant,
  User,
  Customer,
  Menu,
  Category,
  Product,
  Order,
  OrderItem,
  Payment,
  Invoice,
  Subscription,
  LoyaltyTransaction,
  Voucher,
  initModels
};
