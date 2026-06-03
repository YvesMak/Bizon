const orderService = require('../../src/modules/orders/service');

describe('OrderService — machine à états (logique pure)', () => {
  describe('validateStatusTransition', () => {
    it('autorise les transitions du flux normal', () => {
      expect(() => orderService.validateStatusTransition('draft', 'confirmed')).not.toThrow();
      expect(() => orderService.validateStatusTransition('confirmed', 'preparing')).not.toThrow();
      expect(() => orderService.validateStatusTransition('preparing', 'ready')).not.toThrow();
      expect(() => orderService.validateStatusTransition('ready', 'paid')).not.toThrow();
    });

    it('autorise l\'annulation depuis draft et confirmed', () => {
      expect(() => orderService.validateStatusTransition('draft', 'cancelled')).not.toThrow();
      expect(() => orderService.validateStatusTransition('confirmed', 'cancelled')).not.toThrow();
    });

    it('interdit l\'annulation depuis preparing, ready ou paid', () => {
      expect(() => orderService.validateStatusTransition('preparing', 'cancelled')).toThrow(/interdite/i);
      expect(() => orderService.validateStatusTransition('ready', 'cancelled')).toThrow(/interdite/i);
      expect(() => orderService.validateStatusTransition('paid', 'cancelled')).toThrow(/interdite/i);
    });

    it('interdit les sauts d\'état', () => {
      expect(() => orderService.validateStatusTransition('draft', 'ready')).toThrow(/interdite/i);
      expect(() => orderService.validateStatusTransition('draft', 'paid')).toThrow(/interdite/i);
      expect(() => orderService.validateStatusTransition('confirmed', 'paid')).toThrow(/interdite/i);
    });

    it('interdit tout retour en arrière', () => {
      expect(() => orderService.validateStatusTransition('confirmed', 'draft')).toThrow(/interdite/i);
      expect(() => orderService.validateStatusTransition('ready', 'preparing')).toThrow(/interdite/i);
    });

    it('rejette un état final (paid / cancelled)', () => {
      expect(() => orderService.validateStatusTransition('paid', 'preparing')).toThrow();
      expect(() => orderService.validateStatusTransition('cancelled', 'confirmed')).toThrow();
    });

    it('rejette un état inconnu', () => {
      expect(() => orderService.validateStatusTransition('inconnu', 'confirmed')).toThrow(/inconnu/i);
    });
  });

  describe('getVisibleStatusForRole', () => {
    it('le serveur ne voit ni paid ni cancelled', () => {
      const visible = orderService.getVisibleStatusForRole('waiter');
      expect(visible).toContain('preparing');
      expect(visible).not.toContain('paid');
      expect(visible).not.toContain('cancelled');
    });

    it('le caissier ne voit que ready et paid', () => {
      expect(orderService.getVisibleStatusForRole('cashier')).toEqual(['ready', 'paid']);
    });

    it('owner et manager voient tous les états', () => {
      expect(orderService.getVisibleStatusForRole('owner')).toHaveLength(6);
      expect(orderService.getVisibleStatusForRole('manager')).toContain('cancelled');
    });

    it('retombe sur les droits serveur pour un rôle inconnu', () => {
      expect(orderService.getVisibleStatusForRole('xxx')).toEqual(
        orderService.getVisibleStatusForRole('waiter')
      );
    });
  });
});
