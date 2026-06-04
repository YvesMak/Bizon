jest.mock('../../src/utils/pdfGenerator', () => ({
  generateInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/fake.pdf')
}));

const request = require('supertest');
const app = require('../../src/app');
const orderService = require('../../src/modules/orders/service');
const paymentService = require('../../src/modules/payments/service');
const authService = require('../../src/modules/auth/service');
const { Order } = require('../../src/models');
const { registerOwner, createUser, createCustomer, createFullMenu } = require('../helpers/factory');

describe('GET /api/analytics', () => {
  it('refuse un serveur (waiter)', async () => {
    const owner = await registerOwner();
    const waiter = await createUser(owner.restaurant.id, { role: 'waiter' });
    const token = authService.generateToken(waiter.id, owner.restaurant.id, 'waiter');
    const res = await request(app).get('/api/analytics').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('renvoie une vue d\'ensemble : CA 7j, top produits, bons, fidélité', async () => {
    const owner = await registerOwner();
    const restaurantId = owner.restaurant.id;
    const customer = await createCustomer(restaurantId);
    const { product } = await createFullMenu(restaurantId, { productPrice: 1000 });

    // Commande payée (cash) liée à un client → CA + top produit + points
    const order = await orderService.create(restaurantId, owner.user.id, {
      customer_id: customer.id, table_number: '1',
      items: [{ product_id: product.id, quantity: 2 }]
    });
    await paymentService.create(restaurantId, {
      order_id: order.id, amount: order.total_amount, method: 'cash'
    });

    // Commande confirmée avec réduction → usage des bons
    await Order.create({
      restaurant_id: restaurantId, order_number: 'ANALYTICS-1', status: 'confirmed',
      type: 'takeaway', subtotal: 2000, discount_amount: 500, total_amount: 1500
    });

    const res = await request(app).get('/api/analytics')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);

    // CA 7 jours : série continue de 7 points
    expect(res.body.revenue7d).toHaveLength(7);
    expect(res.body.revenue7d[6].total).toBeGreaterThanOrEqual(2000); // aujourd'hui

    // Top produits
    expect(res.body.topProducts[0].name).toBe('Salade test');
    expect(res.body.topProducts[0].quantity).toBe(2);

    // Bons
    expect(res.body.vouchers.orders_with_discount).toBe(1);
    expect(res.body.vouchers.total_discount).toBe(500);

    // Fidélité (2000 → 20 pts, 1 membre)
    expect(res.body.loyalty.earned).toBe(20);
    expect(res.body.loyalty.members).toBe(1);
  });

  it('renvoie des séries vides cohérentes pour un restaurant neuf', async () => {
    const owner = await registerOwner();
    const res = await request(app).get('/api/analytics')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.revenue7d).toHaveLength(7);
    expect(res.body.revenue7d.every(d => d.total === 0)).toBe(true);
    expect(res.body.topProducts).toEqual([]);
    expect(res.body.loyalty.earned).toBe(0);
  });
});
