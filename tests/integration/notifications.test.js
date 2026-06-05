// On mocke web-push pour ne jamais sortir sur le réseau.
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  generateVAPIDKeys: jest.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
  sendNotification: jest.fn(() => Promise.resolve())
}));

// Garantir une configuration VAPID même en CI (web-push est mocké : le format importe peu).
// Doit être défini AVANT le chargement du service (lecture de l'env au require).
process.env.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'test-public-key';
process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'test-private-key';
process.env.VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:test@bizon.cm';

const request = require('supertest');
const webpush = require('web-push');
const app = require('../../src/app');
const authService = require('../../src/modules/auth/service');
const NotificationService = require('../../src/modules/notifications/service');
const { PushSubscription, Customer } = require('../../src/models');
const { registerOwner, createCustomer } = require('../helpers/factory');

function customerToken(customerId, restaurantId) {
  // Le middleware customerAuth attend un token avec role=customer
  const jwt = require('jsonwebtoken');
  return jwt.sign({ customerId, restaurantId, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const FAKE_SUB = {
  endpoint: 'https://push.example.com/abc123',
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }
};

beforeEach(() => {
  webpush.sendNotification.mockClear();
});

describe('Notifications push', () => {
  describe('GET /api/customers/push/vapid-key', () => {
    it('expose la clé publique VAPID (public)', async () => {
      const res = await request(app).get('/api/customers/push/vapid-key');
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
      expect(res.body.publicKey).toBeTruthy();
    });
  });

  describe('Abonnement', () => {
    it('refuse l\'abonnement sans authentification', async () => {
      const res = await request(app).post('/api/customers/me/push/subscribe').send({ subscription: FAKE_SUB });
      expect(res.status).toBe(401);
    });

    it('enregistre un abonnement puis le met à jour (pas de doublon)', async () => {
      const owner = await registerOwner();
      const customer = await createCustomer(owner.restaurant.id);
      const token = customerToken(customer.id, owner.restaurant.id);

      const r1 = await request(app).post('/api/customers/me/push/subscribe')
        .set('Authorization', `Bearer ${token}`).send({ subscription: FAKE_SUB });
      expect(r1.status).toBe(201);
      expect(await PushSubscription.count()).toBe(1);

      // Même endpoint → mise à jour, toujours 1 ligne
      const r2 = await request(app).post('/api/customers/me/push/subscribe')
        .set('Authorization', `Bearer ${token}`).send({ subscription: FAKE_SUB });
      expect(r2.status).toBe(201);
      expect(await PushSubscription.count()).toBe(1);
    });

    it('désabonne (supprime l\'enregistrement)', async () => {
      const owner = await registerOwner();
      const customer = await createCustomer(owner.restaurant.id);
      const token = customerToken(customer.id, owner.restaurant.id);
      await request(app).post('/api/customers/me/push/subscribe')
        .set('Authorization', `Bearer ${token}`).send({ subscription: FAKE_SUB });

      const res = await request(app).post('/api/customers/me/push/unsubscribe')
        .set('Authorization', `Bearer ${token}`).send({ endpoint: FAKE_SUB.endpoint });
      expect(res.status).toBe(200);
      expect(await PushSubscription.count()).toBe(0);
    });
  });

  describe('Envoi', () => {
    it('envoie une notification à chaque appareil du client', async () => {
      const owner = await registerOwner();
      const customer = await createCustomer(owner.restaurant.id);
      await NotificationService.subscribe(customer.id, owner.restaurant.id, FAKE_SUB);

      const res = await NotificationService.notifyOrderStatus(customer.id, {
        orderNumber: 'ORD-1', status: 'ready'
      });
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
      expect(res.sent).toBe(1);
      const [, payload] = webpush.sendNotification.mock.calls[0];
      expect(JSON.parse(payload).title).toMatch(/prête/i);
    });

    it('supprime un abonnement expiré (410)', async () => {
      const owner = await registerOwner();
      const customer = await createCustomer(owner.restaurant.id);
      await NotificationService.subscribe(customer.id, owner.restaurant.id, FAKE_SUB);
      webpush.sendNotification.mockRejectedValueOnce({ statusCode: 410, message: 'Gone' });

      const res = await NotificationService.sendToCustomer(customer.id, { title: 'x', body: 'y' });
      expect(res.removed).toBe(1);
      expect(await PushSubscription.count()).toBe(0);
    });

    it('ne fait rien si le client n\'a aucun abonnement', async () => {
      const owner = await registerOwner();
      const customer = await createCustomer(owner.restaurant.id);
      const res = await NotificationService.sendToCustomer(customer.id, { title: 'x', body: 'y' });
      expect(res.sent).toBe(0);
      expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
  });
});
