const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/modules/auth/service');
const { Customer, LoyaltyTransaction } = require('../../src/models');
const { registerOwner, createUser, createCustomer } = require('../helpers/factory');

async function adjust(token, customerId, body) {
  return request(app).post(`/api/restaurants/customers/${customerId}/loyalty`)
    .set('Authorization', `Bearer ${token}`).send(body);
}

describe('Ajustement manuel des points fidélité (manager)', () => {
  it('crédite des points et écrit une ligne adjust', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const res = await adjust(owner.token, c.id, { points: 50, reason: 'Geste commercial' });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(50);

    const reloaded = await Customer.findByPk(c.id);
    expect(reloaded.loyalty_points).toBe(50);
    const tx = await LoyaltyTransaction.findOne({ where: { customer_id: c.id, type: 'adjust' } });
    expect(tx.points).toBe(50);
  });

  it('retire des points sans descendre sous 0', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    await adjust(owner.token, c.id, { points: 30 });
    const res = await adjust(owner.token, c.id, { points: -100 }); // borné à 0
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(0);
    expect(res.body.applied).toBe(-30);
  });

  it('refuse 0 point', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const res = await adjust(owner.token, c.id, { points: 0 });
    expect(res.status).toBe(400);
  });

  it('refuse l\'accès à un serveur (waiter)', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter' });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await adjust(token, c.id, { points: 10 });
    expect(res.status).toBe(403);
  });
});
