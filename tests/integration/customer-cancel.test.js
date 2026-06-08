const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const orderService = require('../../src/modules/orders/service');
const { Order, OrderItem, Payment, Product } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');

function customerToken(customerId, restaurantId) {
  return jwt.sign({ customerId, restaurantId, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('Annulation de commande par le client', () => {
  it('annule une commande draft (non payée)', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id);
    const customer = await createCustomer(owner.restaurant.id);
    const order = await orderService.createForCustomer(owner.restaurant.id, customer.id, {
      type: 'takeaway', items: [{ product_id: product.id, quantity: 1 }]
    });
    const token = customerToken(customer.id, owner.restaurant.id);

    const res = await request(app).post(`/api/customers/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
    expect(res.body.refund_pending).toBe(false);
    expect((await Order.findByPk(order.id)).status).toBe('cancelled');
  });

  it('annule une commande confirmée + restaure le stock + signale un remboursement', async () => {
    const owner = await registerOwner();
    const { product } = await createFullMenu(owner.restaurant.id);
    await product.update({ track_stock: true, stock_quantity: 5 });
    const customer = await createCustomer(owner.restaurant.id);

    const order = await Order.create({
      restaurant_id: owner.restaurant.id, customer_id: customer.id,
      order_number: 'C-1', type: 'takeaway', status: 'confirmed',
      subtotal: 2000, total_amount: 2000
    });
    await OrderItem.create({ order_id: order.id, product_id: product.id, product_name: product.name, quantity: 2, unit_price: 1000, subtotal: 2000 });
    await Payment.create({ restaurant_id: owner.restaurant.id, order_id: order.id, amount: 2000, method: 'mobile_money', status: 'completed', verified_at: new Date() });

    const token = customerToken(customer.id, owner.restaurant.id);
    const res = await request(app).post(`/api/customers/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.refund_pending).toBe(true);
    expect((await Product.findByPk(product.id)).stock_quantity).toBe(7); // 5 + 2 restaurés
  });

  it('refuse d\'annuler une commande en préparation', async () => {
    const owner = await registerOwner();
    const customer = await createCustomer(owner.restaurant.id);
    const order = await Order.create({
      restaurant_id: owner.restaurant.id, customer_id: customer.id,
      order_number: 'C-2', type: 'takeaway', status: 'preparing', subtotal: 1000, total_amount: 1000
    });
    const token = customerToken(customer.id, owner.restaurant.id);
    const res = await request(app).post(`/api/customers/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ne peut plus être annulée/);
  });

  it('ne permet pas d\'annuler la commande d\'un autre client', async () => {
    const owner = await registerOwner();
    const c1 = await createCustomer(owner.restaurant.id);
    const c2 = await createCustomer(owner.restaurant.id);
    const order = await Order.create({
      restaurant_id: owner.restaurant.id, customer_id: c1.id,
      order_number: 'C-3', type: 'takeaway', status: 'draft', subtotal: 1000, total_amount: 1000
    });
    const token = customerToken(c2.id, owner.restaurant.id);
    const res = await request(app).post(`/api/customers/orders/${order.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non trouvée/);
  });
});
