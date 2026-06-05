const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const authService = require('../../src/modules/auth/service');
const { registerOwner, createUser } = require('../helpers/factory');

// Un petit PNG 1×1 valide (en mémoire) pour les tests d'upload.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const uploadDir = path.join(__dirname, '..', '..', 'storage', 'uploads');

describe('POST /api/uploads/image', () => {
  it('refuse sans authentification', async () => {
    const res = await request(app)
      .post('/api/uploads/image')
      .attach('image', PNG_1x1, 'photo.png');
    expect(res.status).toBe(401);
  });

  it('refuse un serveur (waiter)', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter' });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', PNG_1x1, 'photo.png');
    expect(res.status).toBe(403);
  });

  it('un owner uploade une image et reçoit une URL /uploads/...', async () => {
    const owner = await registerOwner();
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', PNG_1x1, 'photo.png');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/.+\.png$/);

    // Le fichier existe réellement sur disque → nettoyage
    const filePath = path.join(uploadDir, path.basename(res.body.url));
    expect(fs.existsSync(filePath)).toBe(true);
    fs.unlinkSync(filePath);
  });

  it('refuse un fichier non-image', async () => {
    const owner = await registerOwner();
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('image', Buffer.from('not an image'), 'malware.txt');
    expect(res.status).toBe(400);
  });

  it('refuse une requête sans fichier', async () => {
    const owner = await registerOwner();
    const res = await request(app)
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(400);
  });
});
