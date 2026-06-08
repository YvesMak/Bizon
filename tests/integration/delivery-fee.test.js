const orderService = require('../../src/modules/orders/service');
const { Restaurant } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

async function setup({ price = 3000, deliveryFee = 500, minOrder = 2000 } = {}) {
  const owner = await registerOwner();
  await Restaurant.update(
    { settings: { service_types: ['dine_in', 'takeaway', 'delivery'], delivery_fee: deliveryFee, min_delivery_order: minOrder } },
    { where: { id: owner.restaurant.id } }
  );
  const { product } = await createFullMenu(owner.restaurant.id, { productPrice: price });
  const customer = await createCustomer(owner.restaurant.id);
  return { restaurantId: owner.restaurant.id, customerId: customer.id, product };
}

describe('Frais de livraison + minimum de commande', () => {
  it('ajoute les frais de livraison au total (commande livraison)', async () => {
    const { restaurantId, customerId, product } = await setup({ price: 3000, deliveryFee: 500 });
    const order = await orderService.createForCustomer(restaurantId, customerId, {
      type: 'delivery', delivery_address: 'Akwa', items: [{ product_id: product.id, quantity: 1 }]
    });
    expect(Number(order.delivery_fee)).toBe(500);
    expect(Number(order.total_amount)).toBe(3500);
  });

  it('refuse une livraison sous le minimum de commande', async () => {
    const { restaurantId, customerId, product } = await setup({ price: 1000, minOrder: 2000 });
    await expect(orderService.createForCustomer(restaurantId, customerId, {
      type: 'delivery', delivery_address: 'Akwa', items: [{ product_id: product.id, quantity: 1 }]
    })).rejects.toThrow(/[Mm]inimum de commande/);
  });

  it('n\'applique pas de frais en à emporter / sur place', async () => {
    const { restaurantId, customerId, product } = await setup({ price: 3000, deliveryFee: 500 });
    const order = await orderService.createForCustomer(restaurantId, customerId, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });
    expect(Number(order.delivery_fee)).toBe(0);
    expect(Number(order.total_amount)).toBe(3000);
  });
});
