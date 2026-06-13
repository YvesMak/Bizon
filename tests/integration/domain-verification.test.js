const request = require('supertest');
const app = require('../../src/app');
const { createRestaurant, createFullMenu, createPlatformAdmin } = require('../helpers/factory');

// Connecte un super-admin et renvoie son token.
async function adminToken() {
  const { email, password } = await createPlatformAdmin();
  const res = await request(app).post('/api/admin/login').send({ email, password });
  return res.body.token;
}

// Fabrique une réponse fetch minimale.
function fetchOk(body) {
  return { ok: true, status: 200, json: async () => body };
}

describe('Domaine personnalisé — sonde /whoami', () => {
  it('résout le bon restaurant via un domaine personnalisé (Host)', async () => {
    await createRestaurant({ name: 'Autre', slug: 'autre-w' });
    const target = await createRestaurant({
      name: 'Chez Paul', slug: 'chez-paul-w', custom_domain: 'menu.chez-paul.cm'
    });

    const res = await request(app).get('/api/public/whoami').set('Host', 'menu.chez-paul.cm');

    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.restaurant.id).toBe(target.id);
    expect(res.body.restaurant.custom_domain).toBe('menu.chez-paul.cm');
  });

  it('renvoie resolved=false pour un host inconnu', async () => {
    const res = await request(app).get('/api/public/whoami').set('Host', 'inconnu.example.com');
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(false);
  });
});

describe('Domaine personnalisé — vérification admin', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('refuse la vérification sans token (401)', async () => {
    const r = await createRestaurant({ custom_domain: 'menu.x.cm' });
    const res = await request(app).get(`/api/admin/restaurants/${r.id}/verify-domain`);
    expect(res.status).toBe(401);
  });

  it('status no_domain quand aucun domaine personnalisé', async () => {
    const token = await adminToken();
    const r = await createRestaurant();
    const res = await request(app)
      .get(`/api/admin/restaurants/${r.id}/verify-domain`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('no_domain');
  });

  it('status active quand le domaine résout vers ce restaurant', async () => {
    const token = await adminToken();
    const r = await createRestaurant({ custom_domain: 'menu.bon.cm' });
    global.fetch = jest.fn().mockResolvedValue(fetchOk({
      resolved: true,
      restaurant: { id: r.id, name: r.name, slug: r.slug, custom_domain: 'menu.bon.cm' }
    }));

    const res = await request(app)
      .get(`/api/admin/restaurants/${r.id}/verify-domain`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://menu.bon.cm/api/public/whoami',
      expect.any(Object)
    );
  });

  it('status wrong_restaurant quand le domaine résout vers un autre restaurant', async () => {
    const token = await adminToken();
    const r = await createRestaurant({ custom_domain: 'menu.conflit.cm' });
    global.fetch = jest.fn().mockResolvedValue(fetchOk({
      resolved: true,
      restaurant: { id: 'un-autre-id', name: 'Autre', slug: 'autre', custom_domain: 'menu.conflit.cm' }
    }));

    const res = await request(app)
      .get(`/api/admin/restaurants/${r.id}/verify-domain`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('wrong_restaurant');
    expect(res.body.resolved.id).toBe('un-autre-id');
  });

  it('status unresolved quand le domaine est joignable mais ne résout rien', async () => {
    const token = await adminToken();
    const r = await createRestaurant({ custom_domain: 'menu.vide.cm' });
    global.fetch = jest.fn().mockResolvedValue(fetchOk({ resolved: false }));

    const res = await request(app)
      .get(`/api/admin/restaurants/${r.id}/verify-domain`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unresolved');
  });

  it('status unreachable quand le domaine est injoignable (DNS/TLS/timeout)', async () => {
    const token = await adminToken();
    const r = await createRestaurant({ custom_domain: 'menu.injoignable.cm' });
    global.fetch = jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    const res = await request(app)
      .get(`/api/admin/restaurants/${r.id}/verify-domain`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('unreachable');
  });
});
