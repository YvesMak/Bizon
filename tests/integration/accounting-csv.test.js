const request = require('supertest');
const app = require('../../src/app');
const PaymentService = require('../../src/modules/payments/service');
const { Payment, Order } = require('../../src/models');
const { registerOwner, createCustomer } = require('../helpers/factory');

let seq = 0;
async function paidOrder(restaurantId, customerId, { amount, method = 'mobile_money', status = 'completed' }) {
  const order = await Order.create({
    restaurant_id: restaurantId, customer_id: customerId, user_id: null,
    order_number: `CSV-${Date.now()}-${++seq}`, type: 'takeaway', status: 'paid',
    customer_name: 'Test', subtotal: amount, total_amount: amount
  });
  return Payment.create({
    restaurant_id: restaurantId, order_id: order.id, amount, method, status,
    provider: 'campay', reference: `R-${Math.random().toString(36).slice(2)}`, verified_at: new Date()
  });
}

describe('Export CSV comptabilité', () => {
  it('génère un CSV avec en-têtes, lignes et récapitulatif', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    await paidOrder(owner.restaurant.id, c.id, { amount: 3000, method: 'mobile_money' });
    await paidOrder(owner.restaurant.id, c.id, { amount: 2000, method: 'cash' });
    await paidOrder(owner.restaurant.id, c.id, { amount: 500, status: 'refunded' });

    const csv = await PaymentService.accountingCsv(owner.restaurant.id, {});
    expect(csv).toContain('N° commande');
    expect(csv).toContain('Mobile Money');
    expect(csv).toContain('Espèces');
    expect(csv).toContain('Total encaissé;5000');
    expect(csv).toContain('Remboursements;500');
    expect(csv).toContain('Net;4500');
  });

  it('expose la route d\'export (CSV téléchargeable)', async () => {
    const owner = await registerOwner();
    const res = await request(app).get('/api/payments/accounting/export')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
  });
});
