// Parcours self-service client : commande + paiement immédiat (Flutterwave mocké).
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
const { Order, Product, Invoice } = require('../../src/models');
const { createRestaurant, createCustomer, createFullMenu } = require('../helpers/factory');

async function setup() {
  const resto = await createRestaurant();
  const customer = await createCustomer(resto.id);
  const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
  const token = customerService.generateToken(customer.id, resto.id);
  return { resto, customer, product, token };
}

beforeEach(() => {
  flutterwave.createPaymentLink.mockReset();
  flutterwave.verifyTransaction.mockReset();
  flutterwave.createPaymentLink.mockImplementation(async ({ tx_ref }) => ({
    link: `https://checkout.flutterwave.com/pay/${tx_ref}`, tx_ref
  }));
});

describe('POST /api/customers/orders', () => {
  it('refuse sans token client', async () => {
    const res = await request(app).post('/api/customers/orders').send({});
    expect(res.status).toBe(401);
  });

  it('crée une commande sur place + renvoie un lien de paiement', async () => {
    const { product, token } = await setup();
    const res = await request(app)
      .post('/api/customers/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'dine_in', table_number: '8', items: [{ product_id: product.id, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('draft');
    expect(res.body.order.type).toBe('dine_in');
    expect(res.body.payment.link).toMatch(/^https:\/\/checkout/);
  });

  it('crée une commande livraison avec adresse', async () => {
    const { product, token } = await setup();
    const res = await request(app)
      .post('/api/customers/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'delivery', delivery_address: 'Bonapriso, Douala', items: [{ product_id: product.id, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.order.type).toBe('delivery');
    expect(res.body.order.delivery_address).toBe('Bonapriso, Douala');
  });

  it('refuse une livraison sans adresse (400)', async () => {
    const { product, token } = await setup();
    const res = await request(app)
      .post('/api/customers/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'delivery', items: [{ product_id: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/adresse/i);
  });

  it('refuse une commande sur place sans table (400)', async () => {
    const { product, token } = await setup();
    const res = await request(app)
      .post('/api/customers/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'dine_in', items: [{ product_id: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/table/i);
  });

  it('crée la commande en draft sans engager le stock', async () => {
    const { product, token } = await setup();
    await request(app)
      .post('/api/customers/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'takeaway', items: [{ product_id: product.id, quantity: 3 }] });
    const refreshed = await Product.findByPk(product.id);
    expect(refreshed.stock_quantity).toBe(product.stock_quantity); // inchangé
  });
});

describe('Règlement d\'une commande client (self-service)', () => {
  it('au paiement : stock engagé + commande confirmée (pas terminale)', async () => {
    const { resto, customer, product } = await setup();

    // 1. Commande client (draft)
    const order = await orderService.createForCustomer(resto.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 4 }]
    });

    // 2. Initiation paiement
    const init = await paymentService.initiateFlutterwave(resto.id, { order_id: order.id });

    // 3. Règlement (vérif Flutterwave mockée → succès)
    flutterwave.verifyTransaction.mockResolvedValue({
      status: 'successful', amount: Number(order.total_amount), currency: 'XAF', tx_ref: init.tx_ref
    });
    await paymentService.settleFlutterwave({ transactionId: 555, txRef: init.tx_ref });

    // Commande confirmée (en cuisine), PAS 'paid' (le paiement est attesté par le Payment)
    const refreshedOrder = await Order.findByPk(order.id);
    expect(refreshedOrder.status).toBe('confirmed');

    // Stock désormais engagé
    const refreshedProduct = await Product.findByPk(product.id);
    expect(refreshedProduct.stock_quantity).toBe(product.stock_quantity - 4);

    // Facture émise
    const invoice = await Invoice.findOne({ where: { order_id: order.id } });
    expect(invoice).not.toBeNull();
  });
});
