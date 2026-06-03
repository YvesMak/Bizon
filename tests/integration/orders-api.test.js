const request = require('supertest');
const app = require('../../src/app');
const { registerOwner, createFullMenu } = require('../helpers/factory');

describe('API /api/orders (authentifiée)', () => {
  let token, restaurantId, product;

  beforeEach(async () => {
    const owner = await registerOwner({ name: 'Resto Orders' });
    token = owner.token;
    restaurantId = owner.restaurant.id;
    ({ product } = await createFullMenu(restaurantId, { productPrice: 1500 }));
  });

  it('refuse l\'accès sans token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('refuse un token invalide', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', 'Bearer pas-un-vrai-token');
    expect(res.status).toBe(401);
  });

  it('crée une commande puis la retrouve dans la liste', async () => {
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ table_number: '7', items: [{ product_id: product.id, quantity: 2 }] });

    expect(create.status).toBe(201);
    expect(create.body.order.status).toBe('draft');

    const list = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some(o => o.id === create.body.order.id)).toBe(true);
  });

  it('rejette une commande sans produit (400)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ table_number: '7', items: [] });
    expect(res.status).toBe(400);
  });

  it('met à jour le statut draft → confirmed via PATCH', async () => {
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ table_number: '7', items: [{ product_id: product.id, quantity: 1 }] });

    const res = await request(app)
      .patch(`/api/orders/${create.body.order.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('confirmed');
  });
});
