const request = require('supertest');
const app = require('../../src/app');

describe('POST /api/auth/register', () => {
  it('crée un restaurant + owner et renvoie un token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Chez Bizon',
      email: 'owner@chezbizon.cm',
      password: 'password123',
      phone: '+237690000001',
      address: 'Douala'
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('owner@chezbizon.cm');
    expect(res.body.user.role).toBe('owner');
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.restaurant.slug).toBe('chez-bizon');
  });

  it('refuse un email déjà utilisé', async () => {
    const payload = {
      name: 'Resto Dup',
      email: 'dup@test.cm',
      password: 'password123',
      phone: '+237690000002'
    };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send({ ...payload, name: 'Autre' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Resto',
      email: 'login@test.cm',
      password: 'password123',
      phone: '+237690000003'
    });
  });

  it('connecte avec les bons identifiants', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.cm',
      password: 'password123'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejette un mauvais mot de passe', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.cm',
      password: 'mauvais'
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.token).toBeUndefined();
  });

  it('rejette un email inconnu', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'inconnu@test.cm',
      password: 'password123'
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('GET /api/auth/profile', () => {
  it('refuse sans token', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });

  it('renvoie le profil avec un token valide', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Profil Resto',
      email: 'profil@test.cm',
      password: 'password123',
      phone: '+237690000004'
    });
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('profil@test.cm');
    expect(res.body.password).toBeUndefined();
  });
});
