const request = require('supertest');
const app = require('../../src/app');
const PaymentService = require('../../src/modules/payments/service');
const campay = require('../../src/modules/payments/providers/campay');
const { Order, Payment } = require('../../src/models');
const { registerOwner, createCustomer } = require('../helpers/factory');

let seq = 0;
async function paidCancelledOrder(restaurantId, customerId, { amount = 3000, method = 'mobile_money', phone = '237690000000' } = {}) {
  const order = await Order.create({
    restaurant_id: restaurantId, customer_id: customerId, order_number: `RF-${Date.now()}-${++seq}`,
    type: 'takeaway', status: 'cancelled', customer_name: 'Awa', subtotal: amount, total_amount: amount
  });
  await Payment.create({
    restaurant_id: restaurantId, order_id: order.id, amount, method, status: 'completed',
    provider: 'campay', reference: `P-${seq}`, phone_number: phone, verified_at: new Date()
  });
  return order;
}

describe('Remboursements', () => {
  it('liste les commandes payées + annulées non encore remboursées', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const o = await paidCancelledOrder(owner.restaurant.id, c.id, { amount: 3000 });

    const list = await PaymentService.listRefundable(owner.restaurant.id);
    expect(list.length).toBe(1);
    expect(list[0].order_id).toBe(o.id);
    expect(list[0].amount).toBe(3000);
    expect(list[0].phone).toBe('237690000000');
  });

  it('remboursement manuel : enregistre un paiement « refunded » et bloque le double', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const o = await paidCancelledOrder(owner.restaurant.id, c.id, { amount: 2000 });

    const res = await PaymentService.refundOrder(owner.restaurant.id, o.id, { mode: 'manual' });
    expect(res.amount).toBe(2000);
    const refunds = await Payment.findAll({ where: { order_id: o.id, status: 'refunded' } });
    expect(refunds.length).toBe(1);
    // plus dans la liste à traiter
    expect((await PaymentService.listRefundable(owner.restaurant.id)).length).toBe(0);
    // double remboursement refusé
    await expect(PaymentService.refundOrder(owner.restaurant.id, o.id, { mode: 'manual' }))
      .rejects.toThrow(/déjà été remboursée/);
  });

  it('remboursement Campay : appelle disburse et enregistre la référence', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const o = await paidCancelledOrder(owner.restaurant.id, c.id, { amount: 4000, phone: '237691234567' });

    const spy = jest.spyOn(campay, 'disburse').mockResolvedValue({ reference: 'CAMPAY-WD-123', status: 'PENDING' });
    const res = await PaymentService.refundOrder(owner.restaurant.id, o.id, { mode: 'campay' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ amount: 4000, phone: '237691234567' });
    expect(res.reference).toBe('CAMPAY-WD-123');
    const refund = await Payment.findOne({ where: { order_id: o.id, status: 'refunded' } });
    expect(refund.reference).toBe('CAMPAY-WD-123');
    spy.mockRestore();
  });

  it('la compta reflète le remboursement (net = 0)', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const o = await paidCancelledOrder(owner.restaurant.id, c.id, { amount: 5000 });
    await PaymentService.refundOrder(owner.restaurant.id, o.id, { mode: 'manual' });

    const rep = await PaymentService.accountingReport(owner.restaurant.id, {});
    expect(rep.total).toBe(5000);
    expect(rep.refunds_total).toBe(5000);
    expect(rep.net).toBe(0);
  });

  it('route : owner peut lister et rembourser', async () => {
    const owner = await registerOwner();
    const c = await createCustomer(owner.restaurant.id);
    const o = await paidCancelledOrder(owner.restaurant.id, c.id, { amount: 1500 });

    const list = await request(app).get('/api/payments/refunds').set('Authorization', `Bearer ${owner.token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const ref = await request(app).post(`/api/payments/refunds/${o.id}`)
      .set('Authorization', `Bearer ${owner.token}`).send({ mode: 'manual' });
    expect(ref.status).toBe(200);
    expect(ref.body.amount).toBe(1500);
  });
});
