const request = require('supertest');
const app = require('../../src/app');
const PaymentService = require('../../src/modules/payments/service');
const { Payment, Restaurant, User, Order } = require('../../src/models');
const { registerOwner, createCustomer, createUser } = require('../helpers/factory');
const authService = require('../../src/modules/auth/service');

let orderSeq = 0;

// Crée une commande payée (Order direct + Payment) — order_number unique pour
// éviter la collision globale entre restaurants (compteur par resto/jour).
async function paidOrder(restaurantId, customerId, _productId, { amount, method = 'mobile_money', status = 'completed', when }) {
  const order = await Order.create({
    restaurant_id: restaurantId, customer_id: customerId, user_id: null,
    order_number: `ACC-${Date.now()}-${++orderSeq}`,
    type: 'takeaway', status: 'paid',
    customer_name: 'Test', subtotal: amount, total_amount: amount
  });
  return Payment.create({
    restaurant_id: restaurantId, order_id: order.id,
    amount, method, status, provider: 'campay',
    reference: `R-${Math.random().toString(36).slice(2)}`,
    verified_at: when || new Date()
  });
}

describe('Comptabilité — rapport par restaurant', () => {
  it('agrège encaissé, par méthode, remboursements et net', async () => {
    const owner = await registerOwner();
    const customer = await createCustomer(owner.restaurant.id);

    await paidOrder(owner.restaurant.id, customer.id, null, { amount: 3000, method: 'mobile_money' });
    await paidOrder(owner.restaurant.id, customer.id, null, { amount: 2000, method: 'cash' });
    await paidOrder(owner.restaurant.id, customer.id, null, { amount: 500, status: 'refunded' });

    const rep = await PaymentService.accountingReport(owner.restaurant.id, {});
    expect(rep.total).toBe(5000);
    expect(rep.count).toBe(2);
    expect(rep.refunds_total).toBe(500);
    expect(rep.net).toBe(4500);
    const momo = rep.by_method.find((m) => m.method === 'mobile_money');
    const cash = rep.by_method.find((m) => m.method === 'cash');
    expect(momo.total).toBe(3000);
    expect(cash.total).toBe(2000);
    expect(rep.daily.reduce((s, d) => s + d.total, 0)).toBe(5000);
  });

  it('exclut les paiements hors période', async () => {
    const owner = await registerOwner();
    const customer = await createCustomer(owner.restaurant.id);
    const old = new Date(); old.setDate(old.getDate() - 100);
    await paidOrder(owner.restaurant.id, customer.id, null, { amount: 9999, when: old });

    const rep = await PaymentService.accountingReport(owner.restaurant.id, {}); // 30 derniers jours
    expect(rep.total).toBe(0);
  });

  it('expose la route API (owner/manager)', async () => {
    const owner = await registerOwner();
    const res = await request(app).get('/api/payments/accounting')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('by_method');
  });
});

describe('Comptabilité — vue owner consolidée', () => {
  it('agrège plusieurs restaurants du même propriétaire', async () => {
    const owner = await registerOwner();
    const ownerUser = await User.findOne({ where: { restaurant_id: owner.restaurant.id, role: 'owner' } });

    // 2e restaurant possédé par le même owner
    const resto2 = await Restaurant.create({ name: 'Resto 2', slug: `resto2-${Date.now()}`, owner_id: ownerUser.id });

    const c1 = await createCustomer(owner.restaurant.id);
    await paidOrder(owner.restaurant.id, c1.id, null, { amount: 4000 });

    const c2 = await createCustomer(resto2.id);
    await paidOrder(resto2.id, c2.id, null, { amount: 6000 });

    const rep = await PaymentService.consolidatedReport(ownerUser, {});
    expect(rep.total).toBe(10000);
    expect(rep.restaurants.length).toBeGreaterThanOrEqual(2);
    const r2 = rep.restaurants.find((r) => r.restaurant_id === resto2.id);
    expect(r2.total).toBe(6000);
  });

  it('refuse la vue consolidée à un manager (owner seulement)', async () => {
    const owner = await registerOwner();
    const manager = await createUser(owner.restaurant.id, { role: 'manager', email: `${Date.now()}m@test.cm` });
    const token = authService.generateToken(manager.id, owner.restaurant.id, 'manager');
    const res = await request(app).get('/api/payments/accounting/consolidated')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
