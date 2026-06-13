const request = require('supertest');
const app = require('../../src/app');
const { Subscription } = require('../../src/models');
const { registerOwner } = require('../helpers/factory');

// En environnement de test, Campay n'est pas configuré → le service bascule
// automatiquement en mode simulation (référence SIM-…, succès auto).

describe('Abonnement — paiement & activation', () => {
  it('refuse le checkout sans authentification (401)', async () => {
    const res = await request(app).post('/api/subscriptions/checkout').send({ plan: 'basic', phone: '+237690000000' });
    expect(res.status).toBe(401);
  });

  it('démarre un paiement et renvoie une référence + code USSD', async () => {
    const owner = await registerOwner({ email: `co-${Date.now()}@test.cm` });
    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ plan: 'premium', cadence: 'monthly', phone: '+237690000000' });

    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();
    expect(res.body.amount).toBe(15000);
    expect(res.body.status).toBe('pending');
    expect(res.body.ussd_code).toBeDefined();
  });

  it('active l\'abonnement après confirmation du paiement', async () => {
    const owner = await registerOwner({ email: `act-${Date.now()}@test.cm` });
    const rid = owner.restaurant.id;

    const checkout = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ plan: 'basic', cadence: 'yearly', phone: '+237690000000' });
    const { reference } = checkout.body;

    const confirm = await request(app)
      .get(`/api/subscriptions/checkout/${reference}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe('successful');
    expect(confirm.body.subscription.plan).toBe('basic');
    expect(confirm.body.subscription.status).toBe('active');

    // Échéance prolongée d'environ un an (essai 14j + 365j).
    const sub = await Subscription.findOne({ where: { restaurant_id: rid } });
    const days = Math.round((new Date(sub.end_date) - Date.now()) / 86400000);
    expect(days).toBeGreaterThan(360);
  });

  it('refuse le plan Enterprise (sur devis)', async () => {
    const owner = await registerOwner({ email: `ent-${Date.now()}@test.cm` });
    const res = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ plan: 'enterprise', phone: '+237690000000' });
    expect(res.status).toBe(400);
  });

  it('est idempotent : reconfirmer ne double pas l\'activation', async () => {
    const owner = await registerOwner({ email: `idem-${Date.now()}@test.cm` });
    const checkout = await request(app)
      .post('/api/subscriptions/checkout')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ plan: 'basic', cadence: 'monthly', phone: '+237690000000' });
    const { reference } = checkout.body;

    await request(app).get(`/api/subscriptions/checkout/${reference}`).set('Authorization', `Bearer ${owner.token}`);
    const again = await request(app).get(`/api/subscriptions/checkout/${reference}`).set('Authorization', `Bearer ${owner.token}`);

    expect(again.status).toBe(200);
    expect(again.body.status).toBe('successful');
  });
});
