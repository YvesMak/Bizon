const { Order } = require('../../src/models');
const CustomerService = require('../../src/modules/customers/service');
const { registerOwner, createCustomer } = require('../helpers/factory');

async function mkOrder(restaurantId, customerId, status, n) {
  return Order.create({
    restaurant_id: restaurantId,
    customer_id: customerId,
    order_number: `Q-${n}-${Date.now()}`,
    type: 'takeaway',
    status,
    subtotal: 1000,
    total_amount: 1000
  });
}

describe("File d'attente cuisine (queue_position)", () => {
  it('calcule la position selon l\'ancienneté des commandes en préparation', async () => {
    const owner = await registerOwner();
    const rid = owner.restaurant.id;
    const c1 = await createCustomer(rid);
    const c2 = await createCustomer(rid);
    const c3 = await createCustomer(rid);

    const o1 = await mkOrder(rid, c1.id, 'preparing', 1); // la plus ancienne
    const o2 = await mkOrder(rid, c2.id, 'confirmed', 2);
    await mkOrder(rid, c3.id, 'confirmed', 3);

    const c2orders = await CustomerService.getOrders(c2.id, rid);
    const active = c2orders.find((o) => o.id === o2.id);
    expect(active.queue_total).toBe(3);
    expect(active.queue_position).toBe(2);
    expect(active.queue_ahead).toBe(1);

    // La plus ancienne est en tête de file
    const c1orders = await CustomerService.getOrders(c1.id, rid);
    expect(c1orders.find((o) => o.id === o1.id).queue_position).toBe(1);
  });

  it('n\'attribue pas de position aux commandes prêtes ou terminées', async () => {
    const owner = await registerOwner();
    const rid = owner.restaurant.id;
    const c1 = await createCustomer(rid);
    const ready = await mkOrder(rid, c1.id, 'ready', 9);

    const orders = await CustomerService.getOrders(c1.id, rid);
    const o = orders.find((x) => x.id === ready.id);
    expect(o.queue_position).toBeUndefined();
    expect(o.queue_ahead).toBeUndefined();
  });

  it('ignore les commandes d\'un autre restaurant', async () => {
    const a = await registerOwner();
    const b = await registerOwner();
    const ca = await createCustomer(a.restaurant.id);
    const cb = await createCustomer(b.restaurant.id);
    await mkOrder(b.restaurant.id, cb.id, 'preparing', 1); // file du resto B
    const oa = await mkOrder(a.restaurant.id, ca.id, 'preparing', 2);

    const orders = await CustomerService.getOrders(ca.id, a.restaurant.id);
    const o = orders.find((x) => x.id === oa.id);
    expect(o.queue_total).toBe(1); // seul dans la file de son resto
    expect(o.queue_position).toBe(1);
  });
});
