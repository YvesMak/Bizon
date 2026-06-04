jest.mock('../../src/modules/payments/providers/flutterwave');

const flutterwave = require('../../src/modules/payments/providers/flutterwave');
const orderService = require('../../src/modules/orders/service');
const paymentService = require('../../src/modules/payments/service');
const { sequelize } = require('../../src/config/database');
const { Order, Payment } = require('../../src/models');
const { createRestaurant, createCustomer, createUser, createFullMenu } = require('../helpers/factory');

beforeEach(() => {
  flutterwave.createPaymentLink.mockReset();
  flutterwave.createPaymentLink.mockImplementation(async ({ tx_ref }) => ({
    link: `https://checkout.flutterwave.com/pay/${tx_ref}`, tx_ref
  }));
});

// Force la date de création d'une commande (simule l'ancienneté)
async function ageOrder(orderId, minutes) {
  const old = new Date(Date.now() - minutes * 60 * 1000);
  await sequelize.query('UPDATE orders SET created_at = :d WHERE id = :id', {
    replacements: { d: old, id: orderId }
  });
}

describe('Expiration des commandes client non payées', () => {
  it('annule une commande client draft trop ancienne et échoue son paiement', async () => {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });

    const order = await orderService.createForCustomer(resto.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });
    await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });
    await ageOrder(order.id, 45); // > TTL 30 min

    const count = await orderService.expireStaleCustomerDrafts(30);
    expect(count).toBe(1);

    const refreshed = await Order.findByPk(order.id);
    expect(refreshed.status).toBe('cancelled');
    const payment = await Payment.findOne({ where: { order_id: order.id } });
    expect(payment.status).toBe('failed');
  });

  it('ne touche pas une commande client récente', async () => {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
    const order = await orderService.createForCustomer(resto.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });

    const count = await orderService.expireStaleCustomerDrafts(30);
    expect(count).toBe(0);
    const refreshed = await Order.findByPk(order.id);
    expect(refreshed.status).toBe('draft');
  });

  it('ne touche pas un brouillon du staff (user_id renseigné)', async () => {
    const resto = await createRestaurant();
    const user = await createUser(resto.id, { role: 'waiter' });
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
    const order = await orderService.create(resto.id, user.id, {
      table_number: '3', items: [{ product_id: product.id, quantity: 1 }]
    });
    await ageOrder(order.id, 120);

    const count = await orderService.expireStaleCustomerDrafts(30);
    expect(count).toBe(0);
    const refreshed = await Order.findByPk(order.id);
    expect(refreshed.status).toBe('draft');
  });

  it('ne touche pas une commande déjà confirmée/payée', async () => {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
    const order = await orderService.createForCustomer(resto.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });
    // Passe en confirmed (comme après paiement)
    await Order.update({ status: 'confirmed' }, { where: { id: order.id } });
    await ageOrder(order.id, 120);

    const count = await orderService.expireStaleCustomerDrafts(30);
    expect(count).toBe(0);
    const refreshed = await Order.findByPk(order.id);
    expect(refreshed.status).toBe('confirmed');
  });
});
