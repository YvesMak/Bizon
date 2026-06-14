const request = require('supertest');
const app = require('../../src/app');
const { createPlatformAdmin, registerOwner } = require('../helpers/factory');

async function adminToken() {
  const { email, password } = await createPlatformAdmin();
  const res = await request(app).post('/api/admin/login').send({ email, password });
  return res.body.token;
}

describe('Back-office — vue d\'ensemble (dashboard)', () => {
  it('refuse l\'accès sans token (401)', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('renvoie les métriques agrégées attendues', async () => {
    const token = await adminToken();
    await registerOwner({ email: `dash-${Date.now()}@test.cm` });

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.totals).toHaveProperty('restaurants');
    expect(res.body.totals).toHaveProperty('owners');
    expect(typeof res.body.mrr).toBe('number');
    expect(res.body.planDistribution).toHaveProperty('trial');
    expect(res.body.planDistribution.trial).toBeGreaterThanOrEqual(1);
    expect(res.body.statusDistribution).toHaveProperty('active');
    expect(Array.isArray(res.body.signupsByWeek)).toBe(true);
    expect(res.body.signupsByWeek).toHaveLength(8);
    // l'inscription récente compte dans la dernière semaine
    expect(res.body.signupsByWeek[7].count).toBeGreaterThanOrEqual(1);
    expect(res.body.subscriptions).toHaveProperty('trials');
  });

  it('inclut le revenu par semaine et le total', async () => {
    const token = await adminToken();
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.revenue).toHaveProperty('total');
    expect(typeof res.body.revenue.total).toBe('number');
    expect(Array.isArray(res.body.revenueByWeek)).toBe(true);
    expect(res.body.revenueByWeek).toHaveLength(8);
    expect(res.body.revenueByWeek[7]).toHaveProperty('amount');
  });
});
