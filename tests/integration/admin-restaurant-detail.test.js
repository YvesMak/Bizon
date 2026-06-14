const request = require('supertest');
const app = require('../../src/app');
const { createPlatformAdmin, registerOwner } = require('../helpers/factory');

async function adminToken() {
  const { email, password } = await createPlatformAdmin();
  const res = await request(app).post('/api/admin/login').send({ email, password });
  return res.body.token;
}

describe('Back-office — détail restaurant', () => {
  it('refuse l\'accès sans token (401)', async () => {
    const owner = await registerOwner({ email: `det-${Date.now()}@test.cm` });
    const res = await request(app).get(`/api/admin/restaurants/${owner.restaurant.id}/detail`);
    expect(res.status).toBe(401);
  });

  it('renvoie KPIs, abonnement et équipe', async () => {
    const token = await adminToken();
    const owner = await registerOwner({ name: 'Resto Détail', email: `det2-${Date.now()}@test.cm` });

    const res = await request(app)
      .get(`/api/admin/restaurants/${owner.restaurant.id}/detail`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.restaurant.name).toBe('Resto Détail');
    expect(res.body.owner).not.toBeNull();
    expect(res.body.stats).toHaveProperty('orders');
    expect(res.body.stats).toHaveProperty('revenue');
    expect(Array.isArray(res.body.team)).toBe(true);
    // le compte propriétaire fait partie de l'équipe
    expect(res.body.team.length).toBeGreaterThanOrEqual(1);
    expect(res.body.team.some((u) => u.role === 'owner')).toBe(true);
  });

  it('404 pour un restaurant inconnu', async () => {
    const token = await adminToken();
    const res = await request(app)
      .get('/api/admin/restaurants/00000000-0000-0000-0000-000000000000/detail')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
