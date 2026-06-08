const request = require('supertest');
const app = require('../../src/app');
const { registerOwner, createCustomer } = require('../helpers/factory');

describe('Export CSV des clients (manager)', () => {
  it('renvoie un CSV avec en-tête et une ligne par client', async () => {
    const owner = await registerOwner();
    await createCustomer(owner.restaurant.id, { first_name: 'Awa', last_name: 'Nfor', phone: '+237690000009' });

    const res = await request(app).get('/api/restaurants/customers/export')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    const lines = res.text.replace(/^﻿/, '').trim().split('\n');
    expect(lines[0]).toContain('Prénom');
    expect(lines[0]).toContain('Total dépensé');
    expect(lines.some((l) => l.includes('Awa') && l.includes('Nfor'))).toBe(true);
  });

  it('refuse sans authentification', async () => {
    const res = await request(app).get('/api/restaurants/customers/export');
    expect(res.status).toBe(401);
  });
});
