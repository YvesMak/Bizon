jest.mock('../../src/modules/payments/providers/flutterwave');
jest.mock('../../src/utils/pdfGenerator', () => ({
  generateInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/fake.pdf')
}));

const request = require('supertest');
const app = require('../../src/app');
const flutterwave = require('../../src/modules/payments/providers/flutterwave');
const voucherService = require('../../src/modules/vouchers/service');
const orderService = require('../../src/modules/orders/service');
const customerService = require('../../src/modules/customers/service');
const authService = require('../../src/modules/auth/service');
const { Voucher, Order } = require('../../src/models');
const {
  createRestaurant, createCustomer, createUser, createFullMenu, createVoucher, registerOwner
} = require('../helpers/factory');

beforeEach(() => {
  flutterwave.createPaymentLink.mockReset();
  flutterwave.createPaymentLink.mockImplementation(async ({ tx_ref }) => ({
    link: `https://checkout.flutterwave.com/pay/${tx_ref}`, tx_ref
  }));
});

describe('VoucherService.validateAndCompute', () => {
  it('calcule une réduction en pourcentage', async () => {
    const resto = await createRestaurant();
    await createVoucher(resto.id, { code: 'BIZON10', discount_type: 'percentage', discount_value: 10 });
    const { discount } = await voucherService.validateAndCompute(resto.id, 'bizon10', 2000);
    expect(discount).toBe(200);
  });

  it('calcule une réduction fixe et la plafonne au sous-total', async () => {
    const resto = await createRestaurant();
    await createVoucher(resto.id, { code: 'MOINS500', discount_type: 'fixed', discount_value: 500 });
    expect((await voucherService.validateAndCompute(resto.id, 'MOINS500', 2000)).discount).toBe(500);
    // réduction > sous-total → plafonnée
    expect((await voucherService.validateAndCompute(resto.id, 'MOINS500', 300)).discount).toBe(300);
  });

  it('applique le plafond max_discount sur un pourcentage', async () => {
    const resto = await createRestaurant();
    await createVoucher(resto.id, { code: 'CAP', discount_type: 'percentage', discount_value: 50, max_discount: 1000 });
    const { discount } = await voucherService.validateAndCompute(resto.id, 'CAP', 10000); // 50% = 5000 → plafonné 1000
    expect(discount).toBe(1000);
  });

  it('rejette un code inexistant', async () => {
    const resto = await createRestaurant();
    await expect(voucherService.validateAndCompute(resto.id, 'NOPE', 2000)).rejects.toThrow(/invalide/i);
  });

  it('rejette un code inactif / expiré / au-dessus de la limite / sous le minimum', async () => {
    const resto = await createRestaurant();
    await createVoucher(resto.id, { code: 'OFF', active: false });
    await expect(voucherService.validateAndCompute(resto.id, 'OFF', 2000)).rejects.toThrow(/actif/i);

    await createVoucher(resto.id, { code: 'EXP', expires_at: new Date(Date.now() - 1000) });
    await expect(voucherService.validateAndCompute(resto.id, 'EXP', 2000)).rejects.toThrow(/expiré/i);

    await createVoucher(resto.id, { code: 'MAXED', max_uses: 2, used_count: 2 });
    await expect(voucherService.validateAndCompute(resto.id, 'MAXED', 2000)).rejects.toThrow(/limite/i);

    await createVoucher(resto.id, { code: 'MIN5000', min_order_amount: 5000 });
    await expect(voucherService.validateAndCompute(resto.id, 'MIN5000', 2000)).rejects.toThrow(/minimum/i);
  });
});

describe('Gestion des codes promo (manager API)', () => {
  it('un owner crée un code promo (201)', async () => {
    const owner = await registerOwner();
    const res = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ code: 'noel20', discount_type: 'percentage', discount_value: 20 });
    expect(res.status).toBe(201);
    expect(res.body.voucher.code).toBe('NOEL20'); // normalisé en majuscules
  });

  it('un serveur ne peut pas créer de code promo (403)', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter' });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'HACK', discount_value: 90 });
    expect(res.status).toBe(403);
  });

  it('refuse un code dupliqué dans le même restaurant', async () => {
    const owner = await registerOwner();
    await createVoucher(owner.restaurant.id, { code: 'DUP' });
    const res = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ code: 'dup', discount_value: 5 });
    expect(res.status).toBe(400);
  });
});

describe('Aperçu client + application à la commande', () => {
  async function customerCtx() {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
    const token = customerService.generateToken(customer.id, resto.id);
    return { resto, customer, product, token };
  }

  it('POST /validate-voucher renvoie un aperçu de réduction', async () => {
    const { resto, token } = await customerCtx();
    await createVoucher(resto.id, { code: 'BIZON10', discount_value: 10 });
    const res = await request(app)
      .post('/api/customers/validate-voucher')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'BIZON10', subtotal: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.discount).toBe(200);
    expect(res.body.code).toBe('BIZON10');
  });

  it('applique la réduction à la commande et incrémente used_count', async () => {
    const { resto, customer, product } = await customerCtx();
    const voucher = await createVoucher(resto.id, { code: 'BIZON10', discount_value: 10 });

    // sous-total 2×1000 = 2000 ; -10% = 1800 ; +18% = 2124
    const order = await orderService.createForCustomer(resto.id, customer.id, {
      type: 'takeaway',
      items: [{ product_id: product.id, quantity: 2 }],
      voucher_code: 'bizon10'
    });

    expect(Number(order.discount_amount)).toBe(200);
    expect(Number(order.total_amount)).toBeCloseTo(2124, 0);

    const dbOrder = await Order.findByPk(order.id);
    expect(Number(dbOrder.discount_amount)).toBe(200);

    const refreshedVoucher = await Voucher.findByPk(voucher.id);
    expect(refreshedVoucher.used_count).toBe(1);
  });

  it('rejette la commande si le code est invalide', async () => {
    const { resto, customer, product } = await customerCtx();
    await expect(orderService.createForCustomer(resto.id, customer.id, {
      type: 'takeaway',
      items: [{ product_id: product.id, quantity: 1 }],
      voucher_code: 'INEXISTANT'
    })).rejects.toThrow(/invalide/i);
  });
});
