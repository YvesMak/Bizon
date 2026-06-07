const request = require('supertest');
const app = require('../../src/app');
const { Restaurant, User } = require('../../src/models');
const {
  createPlatformAdmin, registerOwner, createCustomer, createFullMenu
} = require('../helpers/factory');

describe('Back-office plateforme (super-admin)', () => {
  describe('POST /api/admin/login', () => {
    it('connecte un admin valide et renvoie un token', async () => {
      const { email, password } = await createPlatformAdmin();
      const res = await request(app).post('/api/admin/login').send({ email, password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.admin.password).toBeUndefined();
    });

    it('refuse un mauvais mot de passe', async () => {
      const { email } = await createPlatformAdmin();
      const res = await request(app).post('/api/admin/login').send({ email, password: 'wrong' });
      expect(res.status).toBe(401);
    });
  });

  describe('Protection des routes', () => {
    it('refuse l\'accès sans token (401)', async () => {
      const res = await request(app).get('/api/admin/restaurants');
      expect(res.status).toBe(401);
    });

    it('refuse un token de propriétaire normal (403)', async () => {
      const owner = await registerOwner();
      const res = await request(app)
        .get('/api/admin/restaurants')
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Gestion des propriétaires', () => {
    it('crée un propriétaire avec son premier restaurant', async () => {
      const { token } = await createPlatformAdmin();
      const res = await request(app)
        .post('/api/admin/owners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'proprio@test.cm', password: 'secret123',
          first_name: 'Paul', last_name: 'Biya',
          restaurant_name: 'Chez Paul', max_restaurants: 3,
          service_types: ['dine_in', 'delivery']
        });
      expect(res.status).toBe(201);
      expect(res.body.owner.role).toBe('owner');
      expect(res.body.owner.max_restaurants).toBe(3);
      expect(res.body.restaurant.owner_id).toBe(res.body.owner.id);
      expect(res.body.restaurant.settings.service_types).toEqual(['dine_in', 'delivery']);

      // Le propriétaire peut se connecter
      const login = await request(app).post('/api/auth/login')
        .send({ email: 'proprio@test.cm', password: 'secret123' });
      expect(login.status).toBe(200);
    });

    it('liste les propriétaires avec leurs restaurants', async () => {
      const { token } = await createPlatformAdmin();
      await request(app).post('/api/admin/owners').set('Authorization', `Bearer ${token}`)
        .send({ email: 'o1@test.cm', password: 'secret123', restaurant_name: 'R1' });
      const res = await request(app).get('/api/admin/owners').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].ownedRestaurants.length).toBe(1);
    });

    it('met à jour le quota d\'un propriétaire', async () => {
      const { token } = await createPlatformAdmin();
      const created = await request(app).post('/api/admin/owners').set('Authorization', `Bearer ${token}`)
        .send({ email: 'o2@test.cm', password: 'secret123', restaurant_name: 'R2' });
      const res = await request(app)
        .patch(`/api/admin/owners/${created.body.owner.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ max_restaurants: 5 });
      expect(res.status).toBe(200);
      expect(res.body.max_restaurants).toBe(5);
    });
  });

  describe('Gestion des restaurants', () => {
    it('crée un restaurant pour un propriétaire et applique le quota', async () => {
      const { token } = await createPlatformAdmin();
      const created = await request(app).post('/api/admin/owners').set('Authorization', `Bearer ${token}`)
        .send({ email: 'o3@test.cm', password: 'secret123', restaurant_name: 'Premier', max_restaurants: 2 });
      const ownerId = created.body.owner.id;

      // 2e restaurant : OK (quota 2, déjà 1)
      const r2 = await request(app).post('/api/admin/restaurants').set('Authorization', `Bearer ${token}`)
        .send({ name: 'Deuxième', owner_id: ownerId, service_types: ['takeaway'] });
      expect(r2.status).toBe(201);

      // 3e restaurant : refusé (quota dépassé)
      const r3 = await request(app).post('/api/admin/restaurants').set('Authorization', `Bearer ${token}`)
        .send({ name: 'Troisième', owner_id: ownerId });
      expect(r3.status).toBe(400);
      expect(r3.body.error).toMatch(/[Qq]uota/);
    });

    it('enregistre et normalise un domaine personnalisé', async () => {
      const { token } = await createPlatformAdmin();
      const owner = await registerOwner();
      const res = await request(app)
        .patch(`/api/admin/restaurants/${owner.restaurant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ custom_domain: 'https://www.Commande.Chez-Paul.cm/menu' });
      expect(res.status).toBe(200);
      expect(res.body.custom_domain).toBe('commande.chez-paul.cm');
    });

    it('refuse un domaine déjà utilisé par un autre restaurant', async () => {
      const { token } = await createPlatformAdmin();
      const a = await registerOwner();
      const b = await registerOwner();
      await request(app).patch(`/api/admin/restaurants/${a.restaurant.id}`)
        .set('Authorization', `Bearer ${token}`).send({ custom_domain: 'resto.cm' });
      const res = await request(app).patch(`/api/admin/restaurants/${b.restaurant.id}`)
        .set('Authorization', `Bearer ${token}`).send({ custom_domain: 'resto.cm' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/déjà utilisé/);
    });

    it('suspend un restaurant et modifie ses modes de service', async () => {
      const { token } = await createPlatformAdmin();
      const owner = await registerOwner();
      const res = await request(app)
        .patch(`/api/admin/restaurants/${owner.restaurant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'suspended', service_types: ['delivery'] });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
      expect(res.body.settings.service_types).toEqual(['delivery']);
    });

    it('renvoie des statistiques globales', async () => {
      const { token } = await createPlatformAdmin();
      await registerOwner();
      const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.restaurants).toBeGreaterThanOrEqual(1);
      expect(res.body.owners).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Self-service propriétaire : multi-restaurants', () => {
  it('liste les restaurants du propriétaire', async () => {
    const owner = await registerOwner();
    const res = await request(app).get('/api/restaurants/mine')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.restaurants.length).toBe(1);
    expect(res.body.current_restaurant_id).toBe(owner.restaurant.id);
  });

  it('crée un restaurant supplémentaire dans la limite du quota', async () => {
    const owner = await registerOwner();
    await Restaurant.update({ owner_id: owner.user.id }, { where: { id: owner.restaurant.id } });
    // quota par défaut = 1, donc création refusée
    const refused = await request(app).post('/api/restaurants/mine')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Annexe' });
    expect(refused.status).toBe(400);

    // on relève le quota puis on réessaie
    await User.update({ max_restaurants: 2 }, { where: { id: owner.user.id } });
    const ok = await request(app).post('/api/restaurants/mine')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Annexe', service_types: ['takeaway'] });
    expect(ok.status).toBe(201);
    expect(ok.body.restaurant.owner_id).toBe(owner.user.id);
  });

  it('bascule le restaurant actif et renvoie un nouveau token', async () => {
    const owner = await registerOwner();
    await User.update({ max_restaurants: 2 }, { where: { id: owner.user.id } });
    await Restaurant.update({ owner_id: owner.user.id }, { where: { id: owner.restaurant.id } });
    const created = await request(app).post('/api/restaurants/mine')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Annexe' });
    const newId = created.body.restaurant.id;

    const sw = await request(app).post(`/api/restaurants/switch/${newId}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(sw.status).toBe(200);
    expect(sw.body.token).toBeDefined();

    // Le nouveau token cible bien le nouveau restaurant
    const me = await request(app).get('/api/restaurants')
      .set('Authorization', `Bearer ${sw.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(newId);
  });
});

describe('Restriction des modes de service à la commande', () => {
  it('refuse une commande dans un mode non proposé par le restaurant', async () => {
    const owner = await registerOwner();
    await Restaurant.update(
      { settings: { service_types: ['delivery'] } },
      { where: { id: owner.restaurant.id } }
    );
    const { product } = await createFullMenu(owner.restaurant.id);
    const customer = await createCustomer(owner.restaurant.id);

    // login client
    const login = await request(app).post('/api/customers/login')
      .send({ phone: customer.phone, password: 'motdepasse', restaurantId: owner.restaurant.id });
    const ctoken = login.body.token;

    const res = await request(app).post('/api/customers/orders')
      .set('Authorization', `Bearer ${ctoken}`)
      .send({ type: 'dine_in', table_number: '5', items: [{ product_id: product.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ne propose pas/);
  });
});
