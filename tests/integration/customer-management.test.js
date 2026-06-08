const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/modules/auth/service');
const { Order } = require('../../src/models');
const { registerOwner, createUser, createCustomer } = require('../helpers/factory');

async function paidOrder(restaurantId, customerId, amount, n) {
  return Order.create({
    restaurant_id: restaurantId, customer_id: customerId,
    order_number: `M-${n}-${Date.now()}`, type: 'takeaway',
    status: 'paid', subtotal: amount, total_amount: amount
  });
}

function customerToken(customerId, restaurantId) {
  const jwt = require('jsonwebtoken');
  return jwt.sign({ customerId, restaurantId, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Gestion des clients (manager)', () => {
  it('liste les clients avec agrégats (commandes, total dépensé)', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id, { first_name: 'Awa', last_name: 'Nfor' });
    await paidOrder(owner.restaurant.id, c.id, 2000, 1);
    await paidOrder(owner.restaurant.id, c.id, 3000, 2);

    const res = await request(app).get('/api/restaurants/customers')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.stats.total).toBe(1);
    const row = res.body.customers.find((x) => x.id === c.id);
    expect(row.orders_count).toBe(2);
    expect(row.total_spent).toBe(5000);
    expect(row.password_hash).toBeUndefined();
  });

  it('recherche par nom/téléphone', async () => {
    const owner = await registerOwner();
    await createCustomer(owner.restaurant.id, { first_name: 'Awa', phone: '+237680000001' });
    await createCustomer(owner.restaurant.id, { first_name: 'Bingo', phone: '+237680000002' });
    const res = await request(app).get('/api/restaurants/customers?q=bingo')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.body.customers.length).toBe(1);
    expect(res.body.customers[0].first_name).toBe('Bingo');
  });

  it('refuse l\'accès à un serveur (waiter)', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter' });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app).get('/api/restaurants/customers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('réinitialise le mot de passe → le client peut se connecter avec', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id, { phone: '+237681111111', password: 'oldpass' });

    const reset = await request(app)
      .post(`/api/restaurants/customers/${c.id}/reset-password`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(reset.status).toBe(200);
    expect(reset.body.tempPassword).toHaveLength(8);

    const login = await request(app).post('/api/customers/login')
      .send({ phone: '+237681111111', password: reset.body.tempPassword, restaurantId: owner.restaurant.id });
    expect(login.status).toBe(200);
  });

  it('bloque puis réactive un client (login refusé quand bloqué)', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id, { phone: '+237682222222', password: 'secret1' });

    await request(app).patch(`/api/restaurants/customers/${c.id}/status`)
      .set('Authorization', `Bearer ${owner.token}`).send({ status: 'blocked' });

    const blocked = await request(app).post('/api/customers/login')
      .send({ phone: '+237682222222', password: 'secret1', restaurantId: owner.restaurant.id });
    expect(blocked.status).toBe(401);
    expect(blocked.body.error).toMatch(/bloqué/i);

    await request(app).patch(`/api/restaurants/customers/${c.id}/status`)
      .set('Authorization', `Bearer ${owner.token}`).send({ status: 'active' });
    const ok = await request(app).post('/api/customers/login')
      .send({ phone: '+237682222222', password: 'secret1', restaurantId: owner.restaurant.id });
    expect(ok.status).toBe(200);
  });

  it('isole les clients par restaurant (404 cross-tenant)', async () => {
    const a = await registerOwner();
    const b = await registerOwner();
    const cb = await createCustomer(b.restaurant.id);
    const res = await request(app).get(`/api/restaurants/customers/${cb.id}`)
      .set('Authorization', `Bearer ${a.token}`);
    expect(res.status).toBe(404);
  });
});

describe('Changement de mot de passe (client connecté)', () => {
  it('change le mot de passe avec le mot de passe actuel correct', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id, { phone: '+237683333333', password: 'current1' });
    const token = customerToken(c.id, owner.restaurant.id);

    const res = await request(app).post('/api/customers/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'current1', newPassword: 'newpass1' });
    expect(res.status).toBe(200);

    const login = await request(app).post('/api/customers/login')
      .send({ phone: '+237683333333', password: 'newpass1', restaurantId: owner.restaurant.id });
    expect(login.status).toBe(200);
  });

  it('refuse si le mot de passe actuel est incorrect', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id, { phone: '+237684444444', password: 'current1' });
    const token = customerToken(c.id, owner.restaurant.id);
    const res = await request(app).post('/api/customers/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WRONG', newPassword: 'newpass1' });
    expect(res.status).toBe(400);
  });
});
