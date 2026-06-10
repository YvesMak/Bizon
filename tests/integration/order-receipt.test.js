const stream = require('stream');
const request = require('supertest');
const app = require('../../src/app');
const { streamReceipt } = require('../../src/utils/receiptPdf');
const { Order, OrderItem, Payment } = require('../../src/models');
const { registerOwner, createCustomer, createFullMenu } = require('../helpers/factory');
const jwt = require('jsonwebtoken');

let seq = 0;
async function makePaidOrder(restaurantId, customerId) {
  const { product } = await createFullMenu(restaurantId, { productPrice: 2500 });
  const order = await Order.create({
    restaurant_id: restaurantId, customer_id: customerId, order_number: `RCPT-${Date.now()}-${++seq}`,
    type: 'delivery', status: 'paid', customer_name: 'Awa Test', delivery_address: 'Akwa',
    subtotal: 5000, discount_amount: 0, delivery_fee: 500, total_amount: 5500
  });
  await OrderItem.create({
    order_id: order.id, product_id: product.id, product_name: 'Poulet DG', quantity: 2, unit_price: 2500, subtotal: 5000,
    options: [{ name: 'Grande' }, { name: 'Frites' }], notes: 'sans piment'
  });
  await Payment.create({
    restaurant_id: restaurantId, order_id: order.id, amount: 5500, method: 'mobile_money',
    status: 'completed', provider: 'campay', reference: `R-${seq}`, verified_at: new Date()
  });
  return order;
}

function customerToken(customerId, restaurantId) {
  return jwt.sign({ customerId, restaurantId, role: 'customer' }, process.env.JWT_SECRET);
}

// Collecte le PDF produit par streamReceipt dans un buffer.
function renderToBuffer(data) {
  return new Promise((resolve) => {
    const chunks = [];
    const res = new stream.PassThrough();
    res.setHeader = () => {};
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    streamReceipt(res, data);
  });
}

describe('Reçu PDF de commande', () => {
  it('génère un PDF valide (en-tête %PDF)', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const order = await makePaidOrder(owner.restaurant.id, c.id);
    const data = await require('../../src/modules/orders/service').getReceiptData(owner.restaurant.id, order.id);
    const buf = await renderToBuffer(data);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(800);
  });

  it('route staff renvoie un PDF en pièce jointe', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const order = await makePaidOrder(owner.restaurant.id, c.id);
    const res = await request(app).get(`/api/orders/${order.id}/receipt`)
      .set('Authorization', `Bearer ${owner.token}`)
      .buffer(true)
      .parse((r, cb) => { const ch = []; r.on('data', (d) => ch.push(d)); r.on('end', () => cb(null, Buffer.concat(ch))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('route client : reçu de SA commande, refus pour celle d\'un autre', async () => {
    const owner = await registerOwner();
    const c1 = await createCustomer(owner.restaurant.id, { phone: '+237690000001' });
    const c2 = await createCustomer(owner.restaurant.id, { phone: '+237690000002' });
    const order = await makePaidOrder(owner.restaurant.id, c1.id);

    const ok = await request(app).get(`/api/customers/orders/${order.id}/receipt`)
      .set('Authorization', `Bearer ${customerToken(c1.id, owner.restaurant.id)}`);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toMatch(/application\/pdf/);

    const denied = await request(app).get(`/api/customers/orders/${order.id}/receipt`)
      .set('Authorization', `Bearer ${customerToken(c2.id, owner.restaurant.id)}`);
    expect(denied.status).toBe(404);
  });
});
