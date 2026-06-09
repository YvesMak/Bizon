const orderService = require('../../src/modules/orders/service');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

describe('Numéro de commande — multi-restaurant', () => {
  it('deux restaurants peuvent passer leur 1re commande du jour (même suffixe) sans collision', async () => {
    const a = await registerOwner();
    const b = await registerOwner();
    const { product: pa } = await createFullMenu(a.restaurant.id, { productPrice: 1000 });
    const { product: pb } = await createFullMenu(b.restaurant.id, { productPrice: 1000 });
    const ca = await createCustomer(a.restaurant.id);
    const cb = await createCustomer(b.restaurant.id);

    const orderA = await orderService.createForCustomer(a.restaurant.id, ca.id, {
      type: 'takeaway', items: [{ product_id: pa.id, quantity: 1 }]
    });
    // Avant le fix : ceci levait une violation d'unicité (même numéro déjà pris).
    const orderB = await orderService.createForCustomer(b.restaurant.id, cb.id, {
      type: 'takeaway', items: [{ product_id: pb.id, quantity: 1 }]
    });

    // Les deux ont le même suffixe (compteur par resto) mais coexistent.
    expect(orderA.order_number).toBe(orderB.order_number);
    expect(orderA.id).not.toBe(orderB.id);
  });

  it('le numéro reste unique AU SEIN d\'un restaurant', async () => {
    const a = await registerOwner();
    const { product } = await createFullMenu(a.restaurant.id, { productPrice: 1000 });
    const c = await createCustomer(a.restaurant.id);

    const o1 = await orderService.createForCustomer(a.restaurant.id, c.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });
    const o2 = await orderService.createForCustomer(a.restaurant.id, c.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });
    expect(o1.order_number).not.toBe(o2.order_number);
  });
});
