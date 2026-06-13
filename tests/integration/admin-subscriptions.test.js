const request = require('supertest');
const app = require('../../src/app');
const { Subscription } = require('../../src/models');
const { createPlatformAdmin, registerOwner } = require('../helpers/factory');

async function adminToken() {
  const { email, password } = await createPlatformAdmin();
  const res = await request(app).post('/api/admin/login').send({ email, password });
  return res.body.token;
}

describe('Back-office — abonnements', () => {
  it('refuse l\'accès sans token (401)', async () => {
    const res = await request(app).get('/api/admin/subscriptions');
    expect(res.status).toBe(401);
  });

  it('liste les abonnements avec restaurant, propriétaire et jours restants', async () => {
    const token = await adminToken();
    const owner = await registerOwner({ name: 'Chez Test', email: `sub-${Date.now()}@test.cm` });

    const res = await request(app)
      .get('/api/admin/subscriptions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const sub = res.body.find((s) => s.restaurant_id === owner.restaurant.id);
    expect(sub).toBeDefined();
    expect(sub.plan).toBe('trial');
    expect(sub.restaurant.name).toBe('Chez Test');
    expect(sub.owner).not.toBeNull();
    expect(typeof sub.daysRemaining).toBe('number');
    expect(sub).toHaveProperty('isExpired');
  });

  it('change le plan d\'un abonnement', async () => {
    const token = await adminToken();
    const owner = await registerOwner({ email: `plan-${Date.now()}@test.cm` });

    const res = await request(app)
      .patch(`/api/admin/subscriptions/${owner.restaurant.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'premium' });

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('premium');
  });

  it('prolonge l\'échéance et réactive l\'abonnement', async () => {
    const token = await adminToken();
    const owner = await registerOwner({ email: `ext-${Date.now()}@test.cm` });
    await Subscription.update(
      { status: 'expired', end_date: new Date(Date.now() - 86400000) },
      { where: { restaurant_id: owner.restaurant.id } }
    );

    const res = await request(app)
      .patch(`/api/admin/subscriptions/${owner.restaurant.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ extend_days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
    expect(new Date(res.body.end_date).getTime()).toBeGreaterThan(Date.now());
  });

  it('refuse un plan invalide (400)', async () => {
    const token = await adminToken();
    const owner = await registerOwner({ email: `bad-${Date.now()}@test.cm` });

    const res = await request(app)
      .patch(`/api/admin/subscriptions/${owner.restaurant.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'gold' });

    expect(res.status).toBe(400);
  });
});
