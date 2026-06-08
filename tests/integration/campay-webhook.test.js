// Provider Campay mocké : aucun appel réseau.
jest.mock('../../src/modules/payments/providers/campay', () => ({
  name: 'campay',
  currency: 'XAF',
  isConfigured: () => true,
  collect: jest.fn(async () => ({ reference: 'WH-REF-1', status: 'PENDING' })),
  verifyTransaction: jest.fn(),
  verifyWebhookSignature: jest.fn(() => true),
  _normalizePhone: (p) => `237${String(p).replace(/\D/g, '').slice(-9)}`
}));

const request = require('supertest');
const campay = require('../../src/modules/payments/providers/campay');
const app = require('../../src/app');
const PaymentService = require('../../src/modules/payments/service');
const orderService = require('../../src/modules/orders/service');
const { Payment, Order } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

async function pendingPayment() {
  const owner = await registerOwner();
  const { product } = await createFullMenu(owner.restaurant.id, { productPrice: 2000 });
  const customer = await createCustomer(owner.restaurant.id);
  const order = await orderService.createForCustomer(owner.restaurant.id, customer.id, {
    type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
  });
  const init = await PaymentService.initiateCampayCollect(owner.restaurant.id, { order_id: order.id, phone: '690000000' });
  return { restaurantId: owner.restaurant.id, order, paymentId: init.payment_id };
}

async function waitFor(fn, ms = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

beforeEach(() => { campay.verifyTransaction.mockReset(); campay.verifyWebhookSignature.mockReturnValue(true); });

describe('settleCampayByReference', () => {
  it('règle la commande quand la transaction est SUCCESSFUL', async () => {
    const { order, paymentId } = await pendingPayment();
    campay.verifyTransaction.mockResolvedValue({ status: 'successful', amount: 2000, currency: 'XAF' });

    const p = await PaymentService.settleCampayByReference('WH-REF-1');
    expect(p.status).toBe('completed');
    expect((await Order.findByPk(order.id)).status).toBe('confirmed');
    expect((await Payment.findByPk(paymentId)).status).toBe('completed');
  });

  it('est idempotent (2e appel ne casse rien)', async () => {
    await pendingPayment();
    campay.verifyTransaction.mockResolvedValue({ status: 'successful', amount: 2000, currency: 'XAF' });
    await PaymentService.settleCampayByReference('WH-REF-1');
    const again = await PaymentService.settleCampayByReference('WH-REF-1');
    expect(again.status).toBe('completed');
    expect(campay.verifyTransaction).toHaveBeenCalledTimes(1); // pas de re-vérif après règlement
  });

  it('renvoie null pour une référence inconnue', async () => {
    const p = await PaymentService.settleCampayByReference('NOPE');
    expect(p).toBeNull();
  });
});

describe('POST /api/payments/webhook/campay', () => {
  it('répond 200 et règle la commande de façon asynchrone', async () => {
    const { order, paymentId } = await pendingPayment();
    campay.verifyTransaction.mockResolvedValue({ status: 'successful', amount: 2000, currency: 'XAF' });

    const res = await request(app).post('/api/payments/webhook/campay').send({ reference: 'WH-REF-1' });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const settled = await waitFor(async () => (await Payment.findByPk(paymentId)).status === 'completed');
    expect(settled).toBe(true);
    expect((await Order.findByPk(order.id)).status).toBe('confirmed');
  });
});
