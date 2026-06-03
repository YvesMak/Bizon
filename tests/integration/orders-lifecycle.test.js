const orderService = require('../../src/modules/orders/service');
const { Product } = require('../../src/models');
const { createRestaurant, createUser, createFullMenu } = require('../helpers/factory');

async function setup() {
  const resto = await createRestaurant();
  const user = await createUser(resto.id, { role: 'owner' });
  const { product } = await createFullMenu(resto.id, { productPrice: 1000 });
  return { resto, user, product };
}

const baseOrder = (productId, qty = 2) => ({
  table_number: '5',
  items: [{ product_id: productId, quantity: qty }]
});

describe('Cycle de vie des commandes (service + DB)', () => {
  describe('create', () => {
    it('crée une commande en DRAFT sans toucher au stock', async () => {
      const { resto, user, product } = await setup();
      const stockBefore = product.stock_quantity;

      const order = await orderService.create(resto.id, user.id, baseOrder(product.id, 3));

      expect(order.status).toBe('draft');
      expect(order.order_number).toMatch(/^ORD-\d{8}-\d{4}$/);

      const refreshed = await Product.findByPk(product.id);
      expect(refreshed.stock_quantity).toBe(stockBefore); // stock inchangé
    });

    it('calcule le total avec TVA 18%', async () => {
      const { resto, user, product } = await setup();
      // 2 × 1000 = 2000 ; +18% = 2360
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id, 2));
      expect(Number(order.total_amount)).toBeCloseTo(2360, 2);
    });

    it('exige une table ou un nom de client', async () => {
      const { resto, user, product } = await setup();
      await expect(
        orderService.create(resto.id, user.id, { items: [{ product_id: product.id, quantity: 1 }] })
      ).rejects.toThrow(/table|client/i);
    });

    it('exige au moins un produit', async () => {
      const { resto, user } = await setup();
      await expect(
        orderService.create(resto.id, user.id, { table_number: '1', items: [] })
      ).rejects.toThrow(/produit/i);
    });

    it('refuse une quantité supérieure au stock', async () => {
      const { resto, user, product } = await setup(); // stock = 10
      await expect(
        orderService.create(resto.id, user.id, baseOrder(product.id, 999))
      ).rejects.toThrow(/stock/i);
    });
  });

  describe('updateStatus + stock', () => {
    it('décrémente le stock au passage draft → confirmed', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id, 4));

      await orderService.updateStatus(resto.id, order.id, 'confirmed', user.id);

      const refreshed = await Product.findByPk(product.id);
      expect(refreshed.stock_quantity).toBe(product.stock_quantity - 4);
    });

    it('refuse un saut d\'état draft → ready', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id));
      await expect(
        orderService.updateStatus(resto.id, order.id, 'ready', user.id)
      ).rejects.toThrow(/interdite/i);
    });

    it('marque completed_at au passage à paid', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id));
      await orderService.updateStatus(resto.id, order.id, 'confirmed', user.id);
      await orderService.updateStatus(resto.id, order.id, 'preparing', user.id);
      await orderService.updateStatus(resto.id, order.id, 'ready', user.id);
      const paid = await orderService.updateStatus(resto.id, order.id, 'paid', user.id);
      expect(paid.completed_at).toBeTruthy();
    });
  });

  describe('cancel + restauration du stock', () => {
    it('restaure le stock si la commande était confirmed', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id, 5));
      await orderService.updateStatus(resto.id, order.id, 'confirmed', user.id);
      // stock décrémenté de 5
      await orderService.cancel(resto.id, order.id, user.id);
      const refreshed = await Product.findByPk(product.id);
      expect(refreshed.stock_quantity).toBe(product.stock_quantity); // restauré
    });

    it('ne touche pas le stock si la commande était en draft', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id, 5));
      await orderService.cancel(resto.id, order.id, user.id);
      const refreshed = await Product.findByPk(product.id);
      expect(refreshed.stock_quantity).toBe(product.stock_quantity);
    });

    it('interdit l\'annulation depuis preparing', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id));
      await orderService.updateStatus(resto.id, order.id, 'confirmed', user.id);
      await orderService.updateStatus(resto.id, order.id, 'preparing', user.id);
      await expect(
        orderService.cancel(resto.id, order.id, user.id)
      ).rejects.toThrow(/interdite/i);
    });
  });

  describe('isolation multi-tenant', () => {
    it('ne trouve pas une commande d\'un autre restaurant', async () => {
      const { resto, user, product } = await setup();
      const order = await orderService.create(resto.id, user.id, baseOrder(product.id));
      const autreResto = await createRestaurant();
      await expect(
        orderService.getById(autreResto.id, order.id)
      ).rejects.toThrow(/non trouvée/i);
    });
  });
});
