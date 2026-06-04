jest.mock('../../src/utils/pdfGenerator', () => ({
  generateInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/fake.pdf')
}));

const request = require('supertest');
const app = require('../../src/app');
const voucherService = require('../../src/modules/vouchers/service');
const orderService = require('../../src/modules/orders/service');
const customerService = require('../../src/modules/customers/service');
const { Customer, Voucher, LoyaltyTransaction } = require('../../src/models');
const { createRestaurant, createCustomer, createFullMenu, createVoucher } = require('../helpers/factory');

// Crée une récompense (modèle à coût en points)
async function createReward(restaurantId, overrides = {}) {
  return createVoucher(restaurantId, {
    code: overrides.code || 'REWARD1000',
    discount_type: 'fixed',
    discount_value: overrides.discount_value != null ? overrides.discount_value : 1000,
    points_cost: overrides.points_cost != null ? overrides.points_cost : 500,
    ...overrides
  });
}

async function setCustomerPoints(customerId, points) {
  await Customer.update({ loyalty_points: points }, { where: { id: customerId } });
}

describe('Échange de points contre un bon', () => {
  it('déduit les points, crée un bon personnel à usage unique, écrit le ledger', async () => {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    await setCustomerPoints(customer.id, 800);
    const reward = await createReward(resto.id, { points_cost: 500, discount_value: 1000 });

    const voucher = await voucherService.redeem(resto.id, customer.id, reward.id);

    expect(voucher.customer_id).toBe(customer.id);
    expect(voucher.points_cost).toBe(0);
    expect(voucher.max_uses).toBe(1);
    expect(voucher.code).toMatch(/^REWARD1000-/);

    const refreshed = await Customer.findByPk(customer.id);
    expect(refreshed.loyalty_points).toBe(300); // 800 - 500

    const redeemTxn = await LoyaltyTransaction.findOne({ where: { customer_id: customer.id, type: 'redeem' } });
    expect(redeemTxn.points).toBe(-500);
  });

  it('refuse l\'échange si les points sont insuffisants (et ne crée pas de bon)', async () => {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    await setCustomerPoints(customer.id, 100);
    const reward = await createReward(resto.id, { points_cost: 500 });

    await expect(voucherService.redeem(resto.id, customer.id, reward.id)).rejects.toThrow(/insuffisant/i);

    const refreshed = await Customer.findByPk(customer.id);
    expect(refreshed.loyalty_points).toBe(100); // inchangé (rollback)
    const personal = await Voucher.count({ where: { customer_id: customer.id } });
    expect(personal).toBe(0);
  });
});

describe('Utilisation des bons personnels', () => {
  it('le bon personnel s\'applique pour son propriétaire', async () => {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    await setCustomerPoints(customer.id, 1000);
    const reward = await createReward(resto.id, { points_cost: 500, discount_value: 1000 });
    const voucher = await voucherService.redeem(resto.id, customer.id, reward.id);

    const { discount } = await voucherService.validateAndCompute(
      resto.id, voucher.code, 5000, { customerId: customer.id }
    );
    expect(discount).toBe(1000);
  });

  it('le bon personnel est refusé à un autre client', async () => {
    const resto = await createRestaurant();
    const owner = await createCustomer(resto.id, { phone: '+237690000001' });
    const other = await createCustomer(resto.id, { phone: '+237690000002' });
    await setCustomerPoints(owner.id, 1000);
    const reward = await createReward(resto.id, { points_cost: 500 });
    const voucher = await voucherService.redeem(resto.id, owner.id, reward.id);

    await expect(voucherService.validateAndCompute(
      resto.id, voucher.code, 5000, { customerId: other.id }
    )).rejects.toThrow(/autre client/i);
  });

  it('une récompense (modèle) n\'est pas utilisable directement comme code', async () => {
    const resto = await createRestaurant();
    const reward = await createReward(resto.id, { code: 'CADEAU', points_cost: 500 });
    await expect(voucherService.validateAndCompute(resto.id, 'CADEAU', 5000))
      .rejects.toThrow(/pas utilisable directement/i);
  });
});

describe('API client — récompenses', () => {
  async function ctx() {
    const resto = await createRestaurant();
    const customer = await createCustomer(resto.id);
    const token = customerService.generateToken(customer.id, resto.id);
    return { resto, customer, token };
  }

  it('GET /me/rewards renvoie le solde, les récompenses dispo et mes bons', async () => {
    const { resto, customer, token } = await ctx();
    await setCustomerPoints(customer.id, 600);
    await createReward(resto.id, { code: 'R1', points_cost: 500 });

    const res = await request(app).get('/api/customers/me/rewards')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.points).toBe(600);
    expect(res.body.available).toHaveLength(1);
    expect(res.body.myVouchers).toHaveLength(0);
  });

  it('POST /me/redeem échange et le bon apparaît dans myVouchers', async () => {
    const { resto, customer, token } = await ctx();
    await setCustomerPoints(customer.id, 600);
    const reward = await createReward(resto.id, { code: 'R1', points_cost: 500 });

    const redeem = await request(app).post('/api/customers/me/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ reward_id: reward.id });
    expect(redeem.status).toBe(201);
    expect(redeem.body.voucher.code).toMatch(/^R1-/);

    const after = await request(app).get('/api/customers/me/rewards')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.points).toBe(100);
    expect(after.body.myVouchers).toHaveLength(1);
  });

  it('refuse l\'échange sans token', async () => {
    const res = await request(app).post('/api/customers/me/redeem').send({ reward_id: 'x' });
    expect(res.status).toBe(401);
  });
});
