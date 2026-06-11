jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  generateVAPIDKeys: jest.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
  sendNotification: jest.fn(() => Promise.resolve())
}));

process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'test-public-key';
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'test-private-key';
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:test@bizon.cm';

const request = require('supertest');
const webpush = require('web-push');
const app = require('../../src/app');
const NotificationService = require('../../src/modules/notifications/service');
const { registerOwner, createCustomer, createUser } = require('../helpers/factory');
const authService = require('../../src/modules/auth/service');

const sub = (id) => ({
  endpoint: `https://push.example.com/${id}`,
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }
});

beforeEach(() => webpush.sendNotification.mockClear());

describe('Campagnes push marketing', () => {
  it('envoie à tous les clients abonnés du restaurant', async () => {
    const owner = await registerOwner();
    const c1 = await createCustomer(owner.restaurant.id, { phone: '+237690000011' });
    const c2 = await createCustomer(owner.restaurant.id, { phone: '+237690000012' });
    await createCustomer(owner.restaurant.id, { phone: '+237690000013' }); // sans abonnement
    await NotificationService.subscribe(c1.id, owner.restaurant.id, sub('a'));
    await NotificationService.subscribe(c2.id, owner.restaurant.id, sub('b'));

    const res = await NotificationService.sendCampaign(owner.restaurant.id, {
      title: 'Promo du jour', body: '-20% sur les grillades 🔥', url: '/'
    });
    expect(res.targeted).toBe(2);   // 2 clients abonnés
    expect(res.reached).toBe(2);
    expect(res.notifications).toBe(2);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    const [, payload] = webpush.sendNotification.mock.calls[0];
    expect(JSON.parse(payload).title).toBe('Promo du jour');
  });

  it('refuse sans titre ou message', async () => {
    const owner = await registerOwner();
    await expect(NotificationService.sendCampaign(owner.restaurant.id, { body: 'x' }))
      .rejects.toThrow(/Titre/);
    await expect(NotificationService.sendCampaign(owner.restaurant.id, { title: 'x' }))
      .rejects.toThrow(/Message/);
  });

  it('expose la route (owner/manager) et renvoie les stats', async () => {
    const owner = await registerOwner();
    const c1 = await createCustomer(owner.restaurant.id, { phone: '+237690000021' });
    await NotificationService.subscribe(c1.id, owner.restaurant.id, sub('x'));

    const res = await request(app).post('/api/restaurants/campaigns')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Hello', body: 'Bonjour 👋' });
    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(1);
  });

  it('refuse l\'accès à un serveur', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter', email: `${Date.now()}cw@test.cm` });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app).post('/api/restaurants/campaigns')
      .set('Authorization', `Bearer ${token}`).send({ title: 'x', body: 'y' });
    expect(res.status).toBe(403);
  });
});
