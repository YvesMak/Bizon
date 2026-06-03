// On neutralise la génération de PDF (effet de bord disque) pour des tests déterministes.
jest.mock('../../src/utils/pdfGenerator', () => ({
  generateInvoicePDF: jest.fn().mockResolvedValue('/storage/invoices/fake.pdf')
}));

const paymentService = require('../../src/modules/payments/service');
const orderService = require('../../src/modules/orders/service');
const { Order, Invoice } = require('../../src/models');
const { createRestaurant, createUser, createFullMenu } = require('../helpers/factory');

async function makeOrder({ qty = 1 } = {}) {
  const resto = await createRestaurant();
  const user = await createUser(resto.id, { role: 'owner' });
  const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
  const order = await orderService.create(resto.id, user.id, {
    table_number: '3',
    items: [{ product_id: product.id, quantity: qty }]
  });
  return { resto, user, product, order };
}

describe('PaymentService', () => {
  describe('create', () => {
    it('crée un paiement mobile money en statut pending', async () => {
      const { resto, order } = await makeOrder();
      const payment = await paymentService.create(resto.id, {
        order_id: order.id,
        amount: order.total_amount,
        method: 'mobile_money',
        phone_number: '+237690000000',
        provider: 'mtn'
      });
      expect(payment.status).toBe('pending');
      expect(payment.verified_at).toBeNull();
    });

    it('rejette un montant différent du total de la commande', async () => {
      const { resto, order } = await makeOrder();
      await expect(
        paymentService.create(resto.id, {
          order_id: order.id,
          amount: 1,
          method: 'mobile_money'
        })
      ).rejects.toThrow(/montant/i);
    });

    it('empêche un double paiement (pending déjà existant)', async () => {
      const { resto, order } = await makeOrder();
      await paymentService.create(resto.id, {
        order_id: order.id, amount: order.total_amount, method: 'mobile_money'
      });
      await expect(
        paymentService.create(resto.id, {
          order_id: order.id, amount: order.total_amount, method: 'mobile_money'
        })
      ).rejects.toThrow(/en attente|déjà/i);
    });

    it('refuse de payer une commande annulée', async () => {
      const { resto, user, order } = await makeOrder();
      await orderService.cancel(resto.id, order.id, user.id);
      await expect(
        paymentService.create(resto.id, {
          order_id: order.id, amount: order.total_amount, method: 'mobile_money'
        })
      ).rejects.toThrow(/annulée/i);
    });

    it('un paiement cash est complété immédiatement et passe la commande en paid', async () => {
      const { resto, order } = await makeOrder();
      const payment = await paymentService.create(resto.id, {
        order_id: order.id, amount: order.total_amount, method: 'cash'
      });
      expect(payment.status).toBe('completed');
      const refreshed = await Order.findByPk(order.id);
      expect(refreshed.status).toBe('paid');
    });
  });

  describe('verify (Mobile Money)', () => {
    async function pendingPayment() {
      const ctx = await makeOrder();
      const payment = await paymentService.create(ctx.resto.id, {
        order_id: ctx.order.id, amount: ctx.order.total_amount, method: 'mobile_money'
      });
      return { ...ctx, payment };
    }

    it('rejette un code de transaction trop court', async () => {
      const { resto, payment } = await pendingPayment();
      await expect(
        paymentService.verify(resto.id, payment.id, '123')
      ).rejects.toThrow(/code/i);
    });

    it('valide un code correct : paiement completed, commande paid, facture générée', async () => {
      const { resto, order, payment } = await pendingPayment();
      const verified = await paymentService.verify(resto.id, payment.id, 'TX123456');
      expect(verified.status).toBe('completed');
      expect(verified.verified_at).toBeTruthy();

      const refreshedOrder = await Order.findByPk(order.id);
      expect(refreshedOrder.status).toBe('paid');

      const invoice = await Invoice.findOne({ where: { order_id: order.id } });
      expect(invoice).not.toBeNull();
      expect(Number(invoice.total_amount)).toBeCloseTo(Number(order.total_amount), 2);
    });

    it('rejette la re-vérification d\'un paiement déjà complété', async () => {
      const { resto, payment } = await pendingPayment();
      await paymentService.verify(resto.id, payment.id, 'TX123456');
      await expect(
        paymentService.verify(resto.id, payment.id, 'TX999999')
      ).rejects.toThrow(/déjà/i);
    });
  });
});
