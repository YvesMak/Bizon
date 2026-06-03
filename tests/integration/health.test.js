const request = require('supertest');
const app = require('../../src/app');

describe('GET /health', () => {
  it('répond 200 avec un statut ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('Route inconnue', () => {
  it('répond 404 avec un message d\'erreur', async () => {
    const res = await request(app).get('/api/route-inexistante');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
