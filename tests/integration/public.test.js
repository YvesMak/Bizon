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

  it('cible le bon restaurant via son slug (?slug=)', async () => {
    // Deux restaurants : on doit obtenir celui demandé par slug, pas le premier.
    const first = await createRestaurant({ name: 'Premier', slug: 'premier-resto' });
    await createFullMenu(first.id);
    const target = await createRestaurant({ name: 'Chez Paul', slug: 'chez-paul' });
    await createFullMenu(target.id, { productPrice: 3200 });

    const res = await request(app).get('/api/public/menu?slug=chez-paul');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.restaurant.id).toBe(target.id);
    expect(res.body.restaurant.slug).toBe('chez-paul');
  });

  it('renvoie available=false pour un slug inconnu', async () => {
    const resto = await createRestaurant({ name: 'Resto' });
    await createFullMenu(resto.id);
    const res = await request(app).get('/api/public/menu?slug=nexiste-pas');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });

  it('expose service_types dans le restaurant public', async () => {
    const resto = await createRestaurant({ name: 'Resto Modes', settings: { service_types: ['delivery'] } });
    await createFullMenu(resto.id);
    const res = await request(app).get(`/api/public/menu?restaurantId=${resto.id}`);
    expect(res.body.restaurant.service_types).toEqual(['delivery']);
  });

  it('résout le restaurant via son domaine personnalisé (Host)', async () => {
    const other = await createRestaurant({ name: 'Autre', slug: 'autre' });
    await createFullMenu(other.id);
    const target = await createRestaurant({
      name: 'Chez Paul', slug: 'chez-paul-d', custom_domain: 'commande.chez-paul.cm'
    });
    await createFullMenu(target.id, { productPrice: 4000 });

    const res = await request(app).get('/api/public/menu').set('Host', 'commande.chez-paul.cm');
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe(target.id);
  });

  it('résout le restaurant via un slug en sous-domaine (Host)', async () => {
    await createRestaurant({ name: 'Premier', slug: 'premier-sub' }).then((r) => createFullMenu(r.id));
    const target = await createRestaurant({ name: 'Sushi', slug: 'sushi-test' });
    await createFullMenu(target.id);

    const res = await request(app).get('/api/public/menu').set('Host', 'sushi-test.bizon.cm');
    expect(res.status).toBe(200);
    expect(res.body.restaurant.id).toBe(target.id);
  });
});
