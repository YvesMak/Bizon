const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/modules/orders/service');
const { OptionGroup, ProductOption, OrderItem } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

// Crée un groupe + options directement (raccourci pour les tests de commande).
async function addOptions(restaurantId, productId, { type = 'single', required = false, options = [] }) {
  const group = await OptionGroup.create({ restaurant_id: restaurantId, product_id: productId, name: 'Taille', type, required });
  const created = [];
  for (const o of options) {
    created.push(await ProductOption.create({ restaurant_id: restaurantId, group_id: group.id, name: o.name, price_delta: o.delta }));
  }
  return { group, options: created };
}

describe('Options produit — gestion manager', () => {
  it('crée un groupe et des options, listés via l\'API', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id);

    const g = await request(app).post(`/api/products/${product.id}/option-groups`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Taille', type: 'single', required: true });
    expect(g.status).toBe(201);

    const o = await request(app).post(`/api/products/option-groups/${g.body.id}/options`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Grande', price_delta: 500 });
    expect(o.status).toBe(201);

    const list = await request(app).get(`/api/products/${product.id}/option-groups`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(list.body.length).toBe(1);
    expect(list.body[0].options.length).toBe(1);
    expect(Number(list.body[0].options[0].price_delta)).toBe(500);
  });
});

describe('Options produit — menu public', () => {
  it('expose les groupes d\'options par produit', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id);
    await addOptions(owner.restaurant.id, product.id, { options: [{ name: 'Petite', delta: 0 }, { name: 'Grande', delta: 500 }] });

    const res = await request(app).get(`/api/public/menu?restaurantId=${owner.restaurant.id}`);
    const prod = res.body.menus[0].categories[0].products[0];
    expect(prod.optionGroups.length).toBe(1);
    expect(prod.optionGroups[0].options.length).toBe(2);
  });
});

describe('Options produit — commande', () => {
  it('calcule unit_price = base + somme des deltas et stocke les options', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id, { productPrice: 2000 });
    const { options } = await addOptions(owner.restaurant.id, product.id, {
      type: 'single', required: true, options: [{ name: 'Petite', delta: 0 }, { name: 'Grande', delta: 500 }]
    });
    const customer = await createCustomer(owner.restaurant.id);

    const order = await orderService.createForCustomer(owner.restaurant.id, customer.id, {
      type: 'takeaway',
      items: [{ product_id: product.id, quantity: 2, options: [options[1].id] }] // Grande +500
    });
    expect(Number(order.total_amount)).toBe(5000); // (2000+500) × 2

    const items = await OrderItem.findAll({ where: { order_id: order.id } });
    expect(Number(items[0].unit_price)).toBe(2500);
    expect(items[0].options[0].name).toBe('Grande');
  });

  it('refuse une commande sans choix pour un groupe à choix unique requis', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id);
    await addOptions(owner.restaurant.id, product.id, {
      type: 'single', required: true, options: [{ name: 'Petite', delta: 0 }]
    });
    const customer = await createCustomer(owner.restaurant.id);
    await expect(orderService.createForCustomer(owner.restaurant.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1, options: [] }]
    })).rejects.toThrow(/Choisissez une option/);
  });

  it('refuse une option qui n\'appartient pas au produit', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id);
    const customer = await createCustomer(owner.restaurant.id);
    await expect(orderService.createForCustomer(owner.restaurant.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1, options: ['00000000-0000-0000-0000-000000000000'] }]
    })).rejects.toThrow(/Option invalide/);
  });
});
