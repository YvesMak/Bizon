const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/modules/auth/service');
const { registerOwner, createUser, createFullMenu } = require('../helpers/factory');

describe('API /api/products — contrôle de rôle', () => {
  let ownerToken, restaurantId, category;

  beforeEach(async () => {
    const owner = await registerOwner({ name: 'Resto Produits' });
    ownerToken = owner.token;
    restaurantId = owner.restaurant.id;
    ({ category } = await createFullMenu(restaurantId));
  });

  it('refuse l\'accès sans token', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('un owner peut créer un produit (201)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ category_id: category.id, name: 'Ndolé', price: 3000 });
    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('Ndolé');
  });

  it('un serveur (waiter) ne peut PAS créer un produit (403)', async () => {
    const waiter = await createUser(restaurantId, { role: 'waiter' });
    const waiterToken = authService.generateToken(waiter.id, restaurantId, 'waiter');

    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ category_id: category.id, name: 'Interdit', price: 1000 });
    expect(res.status).toBe(403);
  });

  it('un serveur peut lire la liste des produits (200)', async () => {
    const waiter = await createUser(restaurantId, { role: 'waiter' });
    const waiterToken = authService.generateToken(waiter.id, restaurantId, 'waiter');

    const res = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
