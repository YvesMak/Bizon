const request = require('supertest');
const app = require('../../src/app');

describe('Plans publics — GET /api/public/plans', () => {
  it('renvoie la grille tarifaire publique', async () => {
    const res = await request(app).get('/api/public/plans');
    expect(res.status).toBe(200);
    expect(res.body.currency).toBe('FCFA');
    expect(res.body.trial_days).toBe(14);
    expect(Array.isArray(res.body.plans)).toBe(true);

    const ids = res.body.plans.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['basic', 'premium', 'enterprise']));

    const basic = res.body.plans.find((p) => p.id === 'basic');
    expect(basic.monthly).toBe(5000);
    expect(basic.yearly).toBe(50000);
    expect(Array.isArray(basic.features)).toBe(true);

    const premium = res.body.plans.find((p) => p.id === 'premium');
    expect(premium.popular).toBe(true);

    const enterprise = res.body.plans.find((p) => p.id === 'enterprise');
    expect(enterprise.custom).toBe(true);
  });

  it('est accessible sans authentification', async () => {
    const res = await request(app).get('/api/public/plans');
    expect(res.status).not.toBe(401);
  });
});
