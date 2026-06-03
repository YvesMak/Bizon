const request = require('supertest');
const app = require('../../src/app');
const { createRestaurant, createFullMenu } = require('../helpers/factory');

describe('GET /api/public/menu', () => {
  it('renvoie available=false quand aucun restaurant n\'existe', async () => {
    const res = await request(app).get('/api/public/menu');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
    expect(res.body.menus).toEqual([]);
  });

  it('renvoie le menu actif d\'un restaurant avec ses produits', async () => {
    const resto = await createRestaurant({ name: 'Resto Menu' });
    await createFullMenu(resto.id, { productPrice: 2500 });

    const res = await request(app).get(`/api/public/menu?restaurantId=${resto.id}`);
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.restaurant.id).toBe(resto.id);
    expect(res.body.menus.length).toBe(1);

    const categories = res.body.menus[0].categories;
    expect(categories.length).toBe(1);
    expect(categories[0].products.length).toBe(1);
    expect(Number(categories[0].products[0].price)).toBe(2500);
  });

  it('n\'expose pas de données sensibles du restaurant', async () => {
    const resto = await createRestaurant({ name: 'Resto Privé' });
    await createFullMenu(resto.id);
    const res = await request(app).get(`/api/public/menu?restaurantId=${resto.id}`);
    expect(res.body.restaurant.settings).toBeUndefined();
    expect(res.body.restaurant.email).toBeUndefined();
  });
});
