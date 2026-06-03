const request = require('supertest');
const app = require('../../src/app');
const { createRestaurant } = require('../helpers/factory');

describe('Parcours client (customers)', () => {
  let restaurant;

  beforeEach(async () => {
    restaurant = await createRestaurant({ name: 'Resto Client' });
  });

  describe('POST /api/customers/register', () => {
    it('crée un compte client et renvoie un token', async () => {
      const res = await request(app)
        .post('/api/customers/register')
        .send({
          restaurantId: restaurant.id,
          first_name: 'Awa',
          last_name: 'Mbarga',
          phone: '+237690123456',
          email: 'awa@test.cm',
          password: 'motdepasse'
        });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.customer.password_hash).toBeUndefined();
      expect(res.body.customer.loyalty_points).toBe(0);
    });

    it('refuse un téléphone déjà inscrit dans le même restaurant', async () => {
      const payload = {
        restaurantId: restaurant.id,
        first_name: 'Awa',
        last_name: 'M',
        phone: '+237690999999',
        password: 'motdepasse'
      };
      await request(app).post('/api/customers/register').send(payload);
      const res = await request(app).post('/api/customers/register').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/téléphone/i);
    });
  });

  describe('POST /api/customers/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/customers/register').send({
        restaurantId: restaurant.id,
        first_name: 'Awa',
        last_name: 'M',
        phone: '+237690123456',
        email: 'awa@test.cm',
        password: 'motdepasse'
      });
    });

    it('connecte via email', async () => {
      const res = await request(app).post('/api/customers/login').send({
        restaurantId: restaurant.id,
        email: 'awa@test.cm',
        password: 'motdepasse'
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('connecte via téléphone', async () => {
      const res = await request(app).post('/api/customers/login').send({
        restaurantId: restaurant.id,
        phone: '+237690123456',
        password: 'motdepasse'
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('rejette un mauvais mot de passe', async () => {
      const res = await request(app).post('/api/customers/login').send({
        restaurantId: restaurant.id,
        email: 'awa@test.cm',
        password: 'faux'
      });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/customers/me', () => {
    it('refuse sans token', async () => {
      const res = await request(app).get('/api/customers/me');
      expect(res.status).toBe(401);
    });

    it('refuse un token staff (role != customer)', async () => {
      // token owner émis par le flux staff
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Staff Resto',
        email: 'staff@test.cm',
        password: 'password123',
        phone: '+237690000010'
      });
      const res = await request(app)
        .get('/api/customers/me')
        .set('Authorization', `Bearer ${reg.body.token}`);
      expect(res.status).toBe(403);
    });

    it('renvoie le profil client avec un token client valide', async () => {
      const reg = await request(app).post('/api/customers/register').send({
        restaurantId: restaurant.id,
        first_name: 'Awa',
        last_name: 'M',
        phone: '+237690123456',
        password: 'motdepasse'
      });
      const res = await request(app)
        .get('/api/customers/me')
        .set('Authorization', `Bearer ${reg.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.first_name).toBe('Awa');
      expect(res.body.password_hash).toBeUndefined();
    });
  });
});
