const request = require('supertest');
const app = require('../../src/app');
const { Restaurant } = require('../../src/models');
const { decrypt } = require('../../src/utils/secrets');
const { getRestaurantCampay } = require('../../src/modules/payments/credentials');
const { registerOwner, createUser } = require('../helpers/factory');
const authService = require('../../src/modules/auth/service');

describe('Config de paiement par restaurant (Modèle B)', () => {
  it('enregistre les identifiants Campay (secrets chiffrés) et ne les renvoie jamais', async () => {
    const owner = await registerOwner();

    const put = await request(app)
      .put('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ username: 'resto_x_app', password: 'super-secret', webhook_key: 'whk_123', env: 'prod' });
    expect(put.status).toBe(200);
    expect(put.body.configured).toBe(true);
    expect(put.body.env).toBe('prod');
    // Aucun secret en clair dans la réponse
    expect(JSON.stringify(put.body)).not.toContain('super-secret');
    expect(JSON.stringify(put.body)).not.toContain('whk_123');
    expect(put.body.username_masked).toMatch(/••••/);

    // En base : le mot de passe est chiffré et récupérable via decrypt()
    const resto = await Restaurant.findByPk(owner.restaurant.id);
    const stored = resto.settings.payment.campay;
    expect(stored.password_enc).not.toContain('super-secret');
    expect(decrypt(stored.password_enc)).toBe('super-secret');
    expect(decrypt(stored.webhook_key_enc)).toBe('whk_123');
    expect(stored.base_url).toBe('https://www.campay.net');
  });

  it('GET renvoie le statut masqué (jamais les secrets)', async () => {
    const owner = await registerOwner();
    await request(app).put('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ username: 'compte_demo', password: 'pw', env: 'demo' });

    const get = await request(app).get('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(get.status).toBe(200);
    expect(get.body.configured).toBe(true);
    expect(get.body.env).toBe('demo');
    expect(get.body.has_webhook_key).toBe(false);
    expect(get.body.password_enc).toBeUndefined();
  });

  it('conserve le mot de passe existant si on ré-enregistre sans le fournir', async () => {
    const owner = await registerOwner();
    await request(app).put('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ username: 'acct', password: 'first-pw', env: 'demo' });
    // Mise à jour sans password → garde l'ancien
    await request(app).put('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ username: 'acct-renamed', env: 'prod' });

    const resto = await Restaurant.findByPk(owner.restaurant.id);
    expect(decrypt(resto.settings.payment.campay.password_enc)).toBe('first-pw');
    expect(resto.settings.payment.campay.username).toBe('acct-renamed');
  });

  it('résolveur : compte du restaurant si configuré, sinon repli global', async () => {
    const owner = await registerOwner();
    // Pas encore configuré → global
    let resto = await Restaurant.findByPk(owner.restaurant.id);
    expect(getRestaurantCampay(resto).source).toBe('global');

    await request(app).put('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ username: 'resto_app', password: 'pw', env: 'prod' });

    resto = await Restaurant.findByPk(owner.restaurant.id);
    const creds = getRestaurantCampay(resto);
    expect(creds.source).toBe('restaurant');
    expect(creds.username).toBe('resto_app');
    expect(creds.password).toBe('pw');
    expect(creds.baseUrl).toBe('https://www.campay.net');
  });

  it('refuse l\'accès à un rôle serveur', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter', email: `${Date.now()}w@test.cm` });
    const waiterToken = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app).get('/api/restaurants/payment-config')
      .set('Authorization', `Bearer ${waiterToken}`);
    expect(res.status).toBe(403);
  });
});
