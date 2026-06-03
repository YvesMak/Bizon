// Pas d'appel réseau : on mocke le provider Flutterwave et la génération PDF.
jest.mock('../../src/modules/payments/providers/flutterwave');
jest.mock('../../src/utils/pdfGenerator', () => ({
  generateInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/fake.pdf')
}));

const request = require('supertest');
const app = require('../../src/app');
const flutterwave = require('../../src/modules/payments/providers/flutterwave');
const paymentService = require('../../src/modules/payments/service');
const orderService = require('../../src/modules/orders/service');
const { Order, Payment, Invoice } = require('../../src/models');
const { createRestaurant, createUser, createFullMenu } = require('../helpers/factory');

async function makeOrder({ qty = 2, price = 1000 } = {}) {
  const resto = await createRestaurant();
  const user = await createUser(resto.id, { role: 'owner' });
  const { product } = await createFullMenu(resto.id, { productPrice: price });
  const order = await orderService.create(resto.id, user.id, {
    table_number: '4',
    items: [{ product_id: product.id, quantity: qty }]
  });
  return { resto, user, order };
}

beforeEach(() => {
  flutterwave.createPaymentLink.mockReset();
  flutterwave.verifyTransaction.mockReset();
  flutterwave.verifyWebhookSignature.mockReset();
  // Valeurs par défaut
  flutterwave.createPaymentLink.mockImplementation(async ({ tx_ref }) => ({
    link: `https://checkout.flutterwave.com/pay/${tx_ref}`, tx_ref
  }));
});

describe('Flutterwave — initiation', () => {
  it('crée un paiement pending et renvoie un lien de checkout', async () => {
    const { resto, order } = await makeOrder();
    const result = await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });

    expect(result.link).toMatch(/^https:\/\/checkout/);
    expect(result.currency).toBe('XAF');

    const payment = await Payment.findByPk(result.payment_id);
    expect(payment.status).toBe('pending');
    expect(payment.provider).toBe('flutterwave');
    expect(payment.reference).toBe(result.tx_ref);
  });

  it('refuse d\'initier sur une commande annulée', async () => {
    const { resto, user, order } = await makeOrder();
    await orderService.cancel(resto.id, order.id, user.id);
    await expect(
      paymentService.initiateFlutterwave(resto.id, { order_id: order.id })
    ).rejects.toThrow(/annulée/i);
  });

  it('réutilise le lien existant si un paiement est déjà en attente', async () => {
    const { resto, order } = await makeOrder();
    const first = await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });
    const second = await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });
    expect(second.reused).toBe(true);
    expect(second.payment_id).toBe(first.payment_id);
    expect(flutterwave.createPaymentLink).toHaveBeenCalledTimes(1);
  });

  it('marque le paiement failed si Flutterwave échoue', async () => {
    const { resto, order } = await makeOrder();
    flutterwave.createPaymentLink.mockRejectedValueOnce(new Error('FLW down'));
    await expect(
      paymentService.initiateFlutterwave(resto.id, { order_id: order.id })
    ).rejects.toThrow(/FLW down/);
    const payment = await Payment.findOne({ where: { order_id: order.id } });
    expect(payment.status).toBe('failed');
  });
});

describe('Flutterwave — règlement (settle)', () => {
  async function initiated() {
    const ctx = await makeOrder();
    const init = await paymentService.initiateFlutterwave(ctx.resto.id, { order_id: ctx.order.id });
    return { ...ctx, init };
  }

  it('valide la transaction : paiement completed, commande paid, facture créée', async () => {
    const { order, init } = await initiated();
    flutterwave.verifyTransaction.mockResolvedValue({
      status: 'successful', amount: Number(order.total_amount), currency: 'XAF', tx_ref: init.tx_ref
    });

    const settled = await paymentService.settleFlutterwave({ transactionId: 999111, txRef: init.tx_ref });
    expect(settled.status).toBe('completed');

    const refreshedOrder = await Order.findByPk(order.id);
    expect(refreshedOrder.status).toBe('paid');
    const invoice = await Invoice.findOne({ where: { order_id: order.id } });
    expect(invoice).not.toBeNull();
  });

  it('est idempotent (double règlement sans erreur ni double facture)', async () => {
    const { order, init } = await initiated();
    flutterwave.verifyTransaction.mockResolvedValue({
      status: 'successful', amount: Number(order.total_amount), currency: 'XAF', tx_ref: init.tx_ref
    });
    await paymentService.settleFlutterwave({ transactionId: 999111, txRef: init.tx_ref });
    const second = await paymentService.settleFlutterwave({ transactionId: 999111, txRef: init.tx_ref });
    expect(second.status).toBe('completed');
    const invoices = await Invoice.findAll({ where: { order_id: order.id } });
    expect(invoices).toHaveLength(1);
  });

  it('rejette une transaction non réussie et marque le paiement failed', async () => {
    const { init, resto } = await initiated();
    flutterwave.verifyTransaction.mockResolvedValue({
      status: 'failed', amount: 2360, currency: 'XAF', tx_ref: init.tx_ref
    });
    await expect(
      paymentService.settleFlutterwave({ transactionId: 1, txRef: init.tx_ref })
    ).rejects.toThrow(/non réussie/i);
    const payment = await Payment.findByPk(init.payment_id);
    expect(payment.status).toBe('failed');
  });

  it('rejette un montant payé insuffisant', async () => {
    const { init } = await initiated();
    flutterwave.verifyTransaction.mockResolvedValue({
      status: 'successful', amount: 10, currency: 'XAF', tx_ref: init.tx_ref
    });
    await expect(
      paymentService.settleFlutterwave({ transactionId: 1, txRef: init.tx_ref })
    ).rejects.toThrow(/insuffisant/i);
  });
});

describe('Flutterwave — webhook HTTP', () => {
  it('rejette une signature invalide (401)', async () => {
    flutterwave.verifyWebhookSignature.mockReturnValue(false);
    const res = await request(app)
      .post('/api/payments/webhook/flutterwave')
      .set('verif-hash', 'mauvais')
      .send({ event: 'charge.completed', data: { status: 'successful', id: 1 } });
    expect(res.status).toBe(401);
  });

  it('accepte une signature valide (200)', async () => {
    flutterwave.verifyWebhookSignature.mockReturnValue(true);
    flutterwave.verifyTransaction.mockResolvedValue({ status: 'failed', tx_ref: 'x', amount: 0 });
    const res = await request(app)
      .post('/api/payments/webhook/flutterwave')
      .set('verif-hash', 'bon-hash')
      .send({ event: 'charge.completed', data: { status: 'successful', id: 123 } });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(flutterwave.verifyWebhookSignature).toHaveBeenCalled();
  });
});
