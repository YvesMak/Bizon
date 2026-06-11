const request = require('supertest');
const app = require('../../src/app');
const { Order, OrderItem, Customer } = require('../../src/models');
const { registerOwner, createUser, createFullMenu } = require('../helpers/factory');
const authService = require('../../src/modules/auth/service');

let seq = 0;
async function makeOrder(restaurantId, customerId, productId, status) {
  const o = await Order.create({
    restaurant_id: restaurantId, customer_id: customerId, order_number: `KR-${Date.now()}-${++seq}`,
    type: 'takeaway', status, customer_name: 'X', subtotal: 1000, total_amount: 1000
  });
  await OrderItem.create({ order_id: o.id, product_id: productId, product_name: 'Plat', quantity: 1, unit_price: 1000, subtotal: 1000 });
  return o;
}

describe('Rôle cuisine (kitchen)', () => {
  it('voit les commandes confirmées/en préparation/prêtes, pas les payées/brouillons', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id, { productPrice: 1000 });
    const c = await Customer.create({ restaurant_id: owner.restaurant.id, first_name: 'A', last_name: 'B', phone: '+237690000099', password_hash: 'x' });
    const kitchen = await createUser(owner.restaurant.id, { role: 'kitchen', email: `${Date.now()}k@test.cm` });
    const token = authService.generateToken(kitchen.id, owner.restaurant.id, 'kitchen');

    await makeOrder(owner.restaurant.id, c.id, product.id, 'confirmed');
    await makeOrder(owner.restaurant.id, c.id, product.id, 'preparing');
    await makeOrder(owner.restaurant.id, c.id, product.id, 'paid');

    const res = await request(app).get('/api/orders?status=confirmed,preparing,ready')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const statuses = res.body.map((o) => o.status);
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('preparing');
    expect(statuses).not.toContain('paid');
  });

  it('peut faire avancer une commande (confirmed → preparing)', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id, { productPrice: 1000 });
    const c = await Customer.create({ restaurant_id: owner.restaurant.id, first_name: 'A', last_name: 'B', phone: '+237690000098', password_hash: 'x' });
    const kitchen = await createUser(owner.restaurant.id, { role: 'kitchen', email: `${Date.now()}k2@test.cm` });
    const token = authService.generateToken(kitchen.id, owner.restaurant.id, 'kitchen');
    const order = await makeOrder(owner.restaurant.id, c.id, product.id, 'confirmed');

    const res = await request(app).patch(`/api/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'preparing' });
    expect(res.status).toBe(200);
    await order.reload();
    expect(order.status).toBe('preparing');
  });

  it('le manager peut créer un utilisateur avec le rôle cuisine', async () => {
    const owner = await registerOwner();
    const res = await request(app).post('/api/restaurants/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: `${Date.now()}newk@test.cm`, password: 'password123', first_name: 'Chef', last_name: 'Test', role: 'kitchen' });
    expect(res.status).toBe(201);
    expect(res.body.user ? res.body.user.role : res.body.role).toBe('kitchen');
  });
});
