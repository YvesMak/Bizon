jest.mock('../../src/modules/payments/providers/campay', () => ({
  name: 'campay', currency: 'XAF', isConfigured: () => true,
  collect: jest.fn(async () => ({ reference: 'CASH-REF-1', status: 'PENDING', ussd_code: '*126#' })),
  verifyTransaction: jest.fn(),
  verifyWebhookSignature: jest.fn(() => true),
  _normalizePhone: (p) => `237${String(p).replace(/\D/g, '').slice(-9)}`
}));

const request = require('supertest');
const campay = require('../../src/modules/payments/providers/campay');
const app = require('../../src/app');
const orderService = require('../../src/modules/orders/service');
const { Order, Payment } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

beforeEach(() => { campay.verifyTransaction.mockReset(); });

describe('Caissier — encaissement Campay', () => {
  it('initie un paiement Campay sur une commande puis le règle', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id, { productPrice: 2000 });
    const customer = await createCustomer(owner.restaurant.id);
    const order = await orderService.createForCustomer(owner.restaurant.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });

    const init = await request(app).post('/api/payments/campay/initiate')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ order_id: order.id, phone: '690000000' });
    expect(init.status).toBe(201);
    expect(init.body.provider).toBe('campay');
    expect(init.body.payment_id).toBeDefined();

    campay.verifyTransaction.mockResolvedValue({ status: 'successful', amount: 2000, currency: 'XAF' });
    const status = await request(app).get(`/api/payments/${init.body.payment_id}/campay-status`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(status.status).toBe(200);
    expect(status.body.status).toBe('completed');
    expect((await Order.findByPk(order.id)).status).toBe('confirmed');
  });
});

describe('Caissier — rapport de caisse (Z)', () => {
  it('totalise les encaissements du jour par mode de paiement', async () => {
    const owner = await registerOwner();
    const o = await Order.create({
      restaurant_id: owner.restaurant.id, order_number: 'R-1', type: 'takeaway',
      status: 'paid', subtotal: 5000, total_amount: 5000
    });
    await Payment.create({
      restaurant_id: owner.restaurant.id, order_id: o.id, amount: 5000,
      method: 'cash', status: 'completed', verified_at: new Date()
    });
    await Payment.create({
      restaurant_id: owner.restaurant.id, order_id: o.id, amount: 3000,
      method: 'mobile_money', status: 'completed', verified_at: new Date()
    });
    // un paiement non complété ne compte pas
    await Payment.create({
      restaurant_id: owner.restaurant.id, order_id: o.id, amount: 9999,
      method: 'mobile_money', status: 'pending'
    });

    const res = await request(app).get('/api/payments/report')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(8000);
    expect(res.body.count).toBe(2);
    const cash = res.body.by_method.find((m) => m.method === 'cash');
    expect(cash.total).toBe(5000);
  });
});
