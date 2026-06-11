const request = require('supertest');
const app = require('../../src/app');
const RestaurantService = require('../../src/modules/restaurants/service');
const { registerOwner, createUser } = require('../helpers/factory');
const authService = require('../../src/modules/auth/service');

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('QR codes des tables', () => {
  it('génère un PNG valide encodant l\'URL de la table', async () => {
    const owner = await registerOwner();
    const buf = await RestaurantService.tableQrPng(owner.restaurant.id, '5', 'http://localhost:3000');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).equals(PNG_SIG)).toBe(true);
    expect(buf.length).toBeGreaterThan(200);
  });

  it('refuse un numéro de table invalide', async () => {
    const owner = await registerOwner();
    await expect(RestaurantService.tableQrPng(owner.restaurant.id, 'bad table!', 'http://x'))
      .rejects.toThrow(/invalide/);
  });

  it('route renvoie une image PNG (owner/manager)', async () => {
    const owner = await registerOwner();
    const res = await request(app).get('/api/restaurants/qr?table=3')
      .set('Authorization', `Bearer ${owner.token}`)
      .buffer(true)
      .parse((r, cb) => { const ch = []; r.on('data', (d) => ch.push(d)); r.on('end', () => cb(null, Buffer.concat(ch))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
    expect(res.body.slice(0, 4).equals(PNG_SIG)).toBe(true);
  });

  it('refuse l\'accès à un serveur (owner/manager seulement)', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter', email: `${Date.now()}qw@test.cm` });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app).get('/api/restaurants/qr?table=1').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
