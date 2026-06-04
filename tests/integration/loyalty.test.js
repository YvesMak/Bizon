// Fidélité : gain de points au règlement (Flutterwave mocké, pas de réseau/PDF).
jest.mock('../../src/modules/payments/providers/flutterwave');
jest.mock('../../src/utils/pdfGenerator', () => ({
  generateInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/fake.pdf')
}));

const request = require('supertest');
const app = require('../../src/app');
const flutterwave = require('../../src/modules/payments/providers/flutterwave');
const customerService = require('../../src/modules/customers/service');
const orderService = require('../../src/modules/orders/service');
const paymentService = require('../../src/modules/payments/service');
const { Customer, LoyaltyTransaction } = require('../../src/models');
const { createRestaurant, createCustomer, createUser, createFullMenu } = require('../helpers/factory');

beforeEach(() => {
  flutterwave.createPaymentLink.mockReset();
  flutterwave.verifyTransaction.mockReset();
  flutterwave.createPaymentLink.mockImplementation(async ({ tx_ref }) => ({
    link: `https://checkout.flutterwave.com/pay/${tx_ref}`, tx_ref
  }));
});

async function paidCustomerOrder({ qty = 2, price = 1000 } = {}) {
  const resto = await createRestaurant();
  const customer = await createCustomer(resto.id);
  const { product } = await createFullMenu(resto.id, { productPrice: price });
  const order = await orderService.createForCustomer(resto.id, customer.id, {
    type: 'takeaway', items: [{ product_id: product.id, quantity: qty }]
  });
  const init = await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });
  flutterwave.verifyTransaction.mockResolvedValue({
    status: 'successful', amount: Number(order.total_amount), currency: 'XAF', tx_ref: init.tx_ref
  });
  return { resto, customer, order, init };
}

describe('Fidélité — gain de points au paiement', () => {
  it('crédite floor(total/100) points et écrit une ligne au ledger', async () => {
    const { resto, customer, order } = await paidCustomerOrder(); // total 2000 → 20 pts
    await paymentService.settleFlutterwave({ transactionId: 1, txRef: order.order_number });

    const refreshed = await Customer.findByPk(customer.id);
    expect(refreshed.loyalty_points).toBe(20);

    const txns = await LoyaltyTransaction.findAll({ where: { customer_id: customer.id } });
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('earn');
    expect(txns[0].points).toBe(20);
    expect(txns[0].balance_after).toBe(20);
  });

  it('est idempotent : un seul gain même si le règlement est rejoué', async () => {
    const { customer, order } = await paidCustomerOrder();
    await paymentService.settleFlutterwave({ transactionId: 1, txRef: order.order_number });
    await paymentService.settleFlutterwave({ transactionId: 1, txRef: order.order_number });

    const refreshed = await Customer.findByPk(customer.id);
    expect(refreshed.loyalty_points).toBe(20); // pas 40
    const txns = await LoyaltyTransaction.findAll({ where: { customer_id: customer.id } });
    expect(txns).toHaveLength(1);
  });

  it('ne crédite rien pour une commande sans client (staff)', async () => {
    const resto = await createRestaurant();
    const user = await createUser(resto.id, { role: 'owner' });
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
    const order = await orderService.create(resto.id, user.id, {
      table_number: '2', items: [{ product_id: product.id, quantity: 1 }]
    });
    const init = await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });
    flutterwave.verifyTransaction.mockResolvedValue({
      status: 'successful', amount: Number(order.total_amount), currency: 'XAF', tx_ref: init.tx_ref
    });
    await paymentService.settleFlutterwave({ transactionId: 9, txRef: init.tx_ref });

    const count = await LoyaltyTransaction.count();
    expect(count).toBe(0);
  });
});

describe('Fidélité — paiements staff (cash / mobile money manuel)', () => {
  async function staffOrderWithCustomer({ qty = 2, price = 1000 } = {}) {
    const resto = await createRestaurant();
    const user = await createUser(resto.id, { role: 'owner' });
    const customer = await createCustomer(resto.id);
    const { product } = await createFullMenu(resto.id, { productPrice: price });
    const order = await orderService.create(resto.id, user.id, {
      customer_id: customer.id, table_number: '1',
      items: [{ product_id: product.id, quantity: qty }]
    });
    return { resto, customer, order };
  }

  it('un paiement cash crédite les points du client lié', async () => {
    const { resto, customer, order } = await staffOrderWithCustomer(); // total 2000 → 20 pts
    await paymentService.create(resto.id, {
      order_id: order.id, amount: order.total_amount, method: 'cash'
    });
    const refreshed = await Customer.findByPk(customer.id);
    expect(refreshed.loyalty_points).toBe(20);
  });

  it('un paiement mobile money vérifié crédite les points', async () => {
    const { resto, customer, order } = await staffOrderWithCustomer();
    const payment = await paymentService.create(resto.id, {
      order_id: order.id, amount: order.total_amount, method: 'mobile_money'
    });
    await paymentService.verify(resto.id, payment.id, 'TX123456');
    const refreshed = await Customer.findByPk(customer.id);
    expect(refreshed.loyalty_points).toBe(20);
  });

  it('ne crédite rien pour un paiement cash sans client lié', async () => {
    const resto = await createRestaurant();
    const user = await createUser(resto.id, { role: 'owner' });
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
    const order = await orderService.create(resto.id, user.id, {
      table_number: '2', items: [{ product_id: product.id, quantity: 1 }]
    });
    await paymentService.create(resto.id, {
      order_id: order.id, amount: order.total_amount, method: 'cash'
    });
    const count = await LoyaltyTransaction.count();
    expect(count).toBe(0);
  });
});

describe('GET /api/customers/me/loyalty', () => {
  it('refuse sans token', async () => {
    const res = await request(app).get('/api/customers/me/loyalty');
    expect(res.status).toBe(401);
  });

  it('renvoie le solde et l\'historique après un paiement', async () => {
    const { resto, customer, order } = await paidCustomerOrder();
    await paymentService.settleFlutterwave({ transactionId: 1, txRef: order.order_number });

    const token = customerService.generateToken(customer.id, resto.id);
    const res = await request(app)
      .get('/api/customers/me/loyalty')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.points).toBe(20);
    expect(res.body.transactions).toHaveLength(1);
    expect(res.body.transactions[0].points).toBe(20);
  });
});
