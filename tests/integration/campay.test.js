// Provider Campay mocké : aucun appel réseau.
jest.mock('../../src/modules/payments/providers/campay', () => ({
  name: 'campay',
  currency: 'XAF',
  isConfigured: () => true,
  collect: jest.fn(async () => ({ reference: 'CAMPAY-REF-1', status: 'PENDING', ussd_code: '*126#', operator: 'MTN' })),
  verifyTransaction: jest.fn(),
  _normalizePhone: (p) => `237${String(p).replace(/\D/g, '').slice(-9)}`
}));

const campay = require('../../src/modules/payments/providers/campay');
const PaymentService = require('../../src/modules/payments/service');
const orderService = require('../../src/modules/orders/service');
const { Payment, Order } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

async function makeDraftOrder() {
  const owner = await registerOwner();
  const { product } = await createFullMenu(owner.restaurant.id, { productPrice: 2000 });
  const customer = await createCustomer(owner.restaurant.id);
  const order = await orderService.createForCustomer(owner.restaurant.id, customer.id, {
    type: 'takeaway',
    items: [{ product_id: product.id, quantity: 1 }]
  });
  return { restaurantId: owner.restaurant.id, order, customer };
}

beforeEach(() => {
  campay.collect.mockClear();
  campay.verifyTransaction.mockReset();
});

describe('Paiement Campay (Mobile Money / collect)', () => {
  it('initie un collect et crée un paiement pending', async () => {
    const { restaurantId, order } = await makeDraftOrder();
    const res = await PaymentService.initiateCampayCollect(restaurantId, {
      order_id: order.id, phone: '690000000'
    });
    expect(res.provider).toBe('campay');
    expect(res.status).toBe('pending');
    expect(res.reference).toBe('CAMPAY-REF-1');
    expect(campay.collect).toHaveBeenCalledTimes(1);

    const payment = await Payment.findByPk(res.payment_id);
    expect(payment.status).toBe('pending');
    expect(payment.provider).toBe('campay');
    expect(payment.reference).toBe('CAMPAY-REF-1');
  });

  it('exige un numéro Mobile Money', async () => {
    const { restaurantId, order } = await makeDraftOrder();
    await expect(
      PaymentService.initiateCampayCollect(restaurantId, { order_id: order.id })
    ).rejects.toThrow(/Mobile Money/);
  });

  it('règle la commande quand la transaction est SUCCESSFUL', async () => {
    const { restaurantId, order } = await makeDraftOrder();
    const init = await PaymentService.initiateCampayCollect(restaurantId, {
      order_id: order.id, phone: '690000000'
    });
    campay.verifyTransaction.mockResolvedValue({
      status: 'successful', amount: 2000, currency: 'XAF', reference: 'CAMPAY-REF-1'
    });

    const res = await PaymentService.checkCampayStatus(restaurantId, init.payment_id);
    expect(res.status).toBe('completed');

    const payment = await Payment.findByPk(init.payment_id);
    expect(payment.status).toBe('completed');
    // Commande self-service payée → passe en 'confirmed' (envoyée en cuisine)
    const reloaded = await Order.findByPk(order.id);
    expect(reloaded.status).toBe('confirmed');
  });

  it('reste pending tant que Campay renvoie PENDING', async () => {
    const { restaurantId, order } = await makeDraftOrder();
    const init = await PaymentService.initiateCampayCollect(restaurantId, {
      order_id: order.id, phone: '690000000'
    });
    campay.verifyTransaction.mockResolvedValue({ status: 'pending', amount: 2000, currency: 'XAF' });

    const res = await PaymentService.checkCampayStatus(restaurantId, init.payment_id);
    expect(res.status).toBe('pending');
    expect((await Payment.findByPk(init.payment_id)).status).toBe('pending');
  });

  it('marque échoué quand la transaction est FAILED', async () => {
    const { restaurantId, order } = await makeDraftOrder();
    const init = await PaymentService.initiateCampayCollect(restaurantId, {
      order_id: order.id, phone: '690000000'
    });
    campay.verifyTransaction.mockResolvedValue({ status: 'failed' });

    const res = await PaymentService.checkCampayStatus(restaurantId, init.payment_id);
    expect(res.status).toBe('failed');
    expect((await Payment.findByPk(init.payment_id)).status).toBe('failed');
  });

  it('empêche un second paiement d\'une commande déjà payée', async () => {
    const { restaurantId, order } = await makeDraftOrder();
    const init = await PaymentService.initiateCampayCollect(restaurantId, {
      order_id: order.id, phone: '690000000'
    });
    campay.verifyTransaction.mockResolvedValue({ status: 'successful', amount: 2000, currency: 'XAF' });
    await PaymentService.checkCampayStatus(restaurantId, init.payment_id);

    await expect(
      PaymentService.initiateCampayCollect(restaurantId, { order_id: order.id, phone: '690000000' })
    ).rejects.toThrow(/déjà été payée/);
  });
});
