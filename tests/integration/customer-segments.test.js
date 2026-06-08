const request = require('supertest');
const app = require('../../src/app');
const { Order } = require('../../src/models');
const { sequelize } = require('../../src/config/database');
const { registerOwner, createCustomer } = require('../helpers/factory');

async function paidOrder(restaurantId, customerId, amount, n) {
  return Order.create({
    restaurant_id: restaurantId, customer_id: customerId,
    order_number: `S-${n}-${Date.now()}`, type: 'takeaway',
    status: 'paid', subtotal: amount, total_amount: amount
  });
}

async function backdate(orderId, days) {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await sequelize.query('UPDATE orders SET created_at = :d WHERE id = :id', {
    replacements: { d, id: orderId }
  });
}

describe('Segments clients (manager)', () => {
  it('segment "top" classe par total dépensé décroissant', async () => {
    const owner = await registerOwner();
    const small = await createCustomer(owner.restaurant.id, { first_name: 'Small' });
    const big = await createCustomer(owner.restaurant.id, { first_name: 'Big' });
    await paidOrder(owner.restaurant.id, small.id, 1000, 1);
    await paidOrder(owner.restaurant.id, big.id, 9000, 2);

    const res = await request(app).get('/api/restaurants/customers?segment=top')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.customers.length).toBe(2);
    expect(res.body.customers[0].id).toBe(big.id); // plus gros dépensier en tête
    expect(res.body.customers[0].total_spent).toBe(9000);
  });

  it('segment "inactive" ne renvoie que les clients sans commande récente (>30j)', async () => {
    const owner = await registerOwner();
    const recent = await createCustomer(owner.restaurant.id, { first_name: 'Recent' });
    const old = await createCustomer(owner.restaurant.id, { first_name: 'Old' });
    await paidOrder(owner.restaurant.id, recent.id, 2000, 1); // commande récente
    const o = await paidOrder(owner.restaurant.id, old.id, 2000, 2);
    await backdate(o.id, 40); // commande il y a 40 jours

    const res = await request(app).get('/api/restaurants/customers?segment=inactive')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.customers.map((c) => c.id);
    expect(ids).toContain(old.id);
    expect(ids).not.toContain(recent.id);
  });
});
